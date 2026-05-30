import asyncio
import base64
import io
import os
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import bcrypt
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLO

app = FastAPI()

# CORS: virgulle ayrilmis origin listesi env'den okunur.
# Production'da CLOUDFLARE arkasinda calistigi icin gercek frontend domain'i set edilmeli.
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)

MODEL_PATH = "model/best.pt"

# --- Kullanici kimlik dogrulama (frontend icin JWT) ---
# Tek kullanici demo: env'den okunan kullanici adi + bcrypt hash'lenmis parola.
AUTH_USERNAME = os.environ.get("AUTH_USERNAME", "admin")
AUTH_PASSWORD_HASH = os.environ.get("AUTH_PASSWORD_HASH")  # bcrypt hash, ornek: $2b$12$...
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "60"))

bearer_scheme = HTTPBearer(auto_error=False)


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_token(username: str) -> str:
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail="JWT_SECRET tanimli degil.")
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def require_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token gerekli.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail="JWT_SECRET tanimli degil.")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token gecersiz veya suresi dolmus.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload.get("sub")


# --- IoT cihaz kimlik dogrulamasi (X-API-Key) ---
# Production'da env-var olarak set edilmeli; set edilmemis ise endpoint herkese kapali.
IOT_API_KEY = os.environ.get("IOT_API_KEY")

# Frontend sinifindan IoT'nin acmasi gereken kutuya direkt esleme.
CLASS_TO_BIN = {
    "paper": "blue",
    "plastic": "yellow",
    "glass": "green",
    "metal": "gray",
    "household": "orange",
}


def require_iot_key(x_api_key: Optional[str] = Header(default=None)):
    if not IOT_API_KEY:
        raise HTTPException(status_code=503, detail="IOT_API_KEY tanimli degil.")
    if x_api_key != IOT_API_KEY:
        raise HTTPException(status_code=401, detail="Gecersiz API key.")

try:
    if os.path.exists(MODEL_PATH):
        model = YOLO(MODEL_PATH)
        print("Model basariyla yuklendi!")
    else:
        print(f"UYARI: Model bulunamadi -> {MODEL_PATH}")
        model = None
except Exception as e:
    print(f"Model yuklenirken hata olustu: {e}")
    model = None

class ImagePayload(BaseModel):
    image: str
    source: Literal["camera", "upload"] = "camera"

# Tek slotluk in-memory prediction buffer.
# Fetch edilmeden uzeri yazilamaz; fetch edilince temizlenir.
# _busy: inference suren bir istek var mi? (slot dolmadan once de yeni istegi bloklar)
_slot: Optional[dict] = None
_busy: bool = False
_slot_lock = asyncio.Lock()

class LoginPayload(BaseModel):
    username: str
    password: str


@app.post("/auth/login")
async def login(payload: LoginPayload):
    if not AUTH_PASSWORD_HASH or not JWT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Sunucu auth icin yapilandirilmamis (AUTH_PASSWORD_HASH / JWT_SECRET).",
        )
    if payload.username != AUTH_USERNAME or not _verify_password(payload.password, AUTH_PASSWORD_HASH):
        raise HTTPException(status_code=401, detail="Kullanici adi veya parola hatali.")
    token = _create_token(payload.username)
    return {"access_token": token, "token_type": "bearer", "expires_in": JWT_EXPIRE_MINUTES * 60}


@app.post("/predict", dependencies=[Depends(require_user)])
async def predict_waste(payload: ImagePayload):
    global _slot, _busy

    if model is None:
        raise HTTPException(status_code=500, detail="Model bulunamadi. Lutfen best.pt dosyasini backend/model/ klasorune yukleyin.")

    # Slotu rezerve et: ya slot dolu ya da baska bir inference suruyorsa reddet.
    reserved = False
    async with _slot_lock:
        if _slot is not None or _busy:
            raise HTTPException(
                status_code=409,
                detail="Onceki prediction henuz fetch edilmedi veya bir inference suruyor. Once /fetch-predictions cagrilmali.",
            )
        _busy = True
        reserved = True

    try:
        # Base64 string'den fotografi cikart
        encoded_data = payload.image.split(",")[1] if "," in payload.image else payload.image
        image_bytes = base64.b64decode(encoded_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Modele gonder ve sonucu al
        results = model.predict(image, conf=0.05)
        
        if not results or len(results[0].boxes) == 0:
            # NOT: "unknown" sonuclar slota yazilmaz; sadece gercek tespit saklanir.
            async with _slot_lock:
                _busy = False
            return {"class": "unknown", "confidence": 0}
             
        # En yuksek ihtimalli kutuyu aliyoruz
        best_box = results[0].boxes[0]
        class_id = int(best_box.cls.item())
        confidence = float(best_box.conf.item())
        
        # Egitilen modeldeki orjinal isimleri cek
        class_names = results[0].names
        predicted_name = class_names[class_id]
        
        # Yazdiginiz etiketleri React arayuzundeki renklere esleme
        # Sizin isimleriniz: 'biodegradable', 'glass', 'metal', 'paper', 'plastic'
        frontend_class_mapping = {
            "biodegradable": "household",
            "glass": "glass",
            "metal": "metal",
            "paper": "paper",
            "plastic": "plastic"
        }
        
        frontend_class = frontend_class_mapping.get(predicted_name, "unknown")
        
        box_coords = best_box.xyxy[0].tolist()
        img_width, img_height = image.size
        
        response = {
            "class": frontend_class,
            "confidence": confidence,
            "original_class": predicted_name,
            "box": {
                "x1": box_coords[0] / img_width,
                "y1": box_coords[1] / img_height,
                "x2": box_coords[2] / img_width,
                "y2": box_coords[3] / img_height
            }
        }

        record = {
            **response,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": payload.source,
            "image": payload.image,
        }

        async with _slot_lock:
            _slot = record
            _busy = False

        return response

    except HTTPException:
        # _busy'yi temizle (rezervasyon sirasinda olusan 409 zaten _busy'yi True yapmamis olur,
        # ama inference sirasindaki HTTPException'larda temizlemek guvenli).
        if reserved:
            async with _slot_lock:
                _busy = False
        raise
    except Exception as e:
        if reserved:
            async with _slot_lock:
                _busy = False
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/fetch-predictions", dependencies=[Depends(require_iot_key)])
async def fetch_predictions():
    """IoT cihazi icin slot'taki prediction'i hafif formatta dondurur ve temizler."""
    global _slot
    async with _slot_lock:
        current = _slot
        _slot = None

    if current is None:
        return {"prediction": None}

    return {
        "prediction": {
            "bin": CLASS_TO_BIN.get(current["class"]),
            "class": current["class"],
            "confidence": round(current["confidence"], 3),
            "ts": current["timestamp"],
        }
    }
