import base64
import io
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLO

app = FastAPI()

# Arayuzden gelen isteklere izin ver (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "model/best.pt"

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

@app.post("/predict")
async def predict_waste(payload: ImagePayload):
    if model is None:
        raise HTTPException(status_code=500, detail="Model bulunamadi. Lutfen best.pt dosyasini backend/model/ klasorune yukleyin.")
        
    try:
        # Base64 string'den fotografi cikart
        encoded_data = payload.image.split(",")[1] if "," in payload.image else payload.image
        image_bytes = base64.b64decode(encoded_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Modele gonder ve sonucu al
        results = model.predict(image, conf=0.05)
        
        if not results or len(results[0].boxes) == 0:
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
        
        return {
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
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
