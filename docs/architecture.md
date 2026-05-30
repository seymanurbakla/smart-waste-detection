# Mimari Dökümanı

Bu döküman **Smart Waste Detection** projesinin teknik mimarisini açıklar. Proje, kamera veya yüklenen bir görsel üzerinden atık türünü tespit edip kullanıcıyı doğru geri dönüşüm kutusuna yönlendiren bir istemci-sunucu uygulamasıdır.

---

## 1. Genel Bakış

Sistem iki ana bileşenden oluşur:

- **Frontend (İstemci):** React 19 + Vite tabanlı SPA. Kullanıcı arayüzü, kamera akışı, görsel yükleme ve sonuç gösterimi burada gerçekleşir.
- **Backend (Sunucu):** FastAPI tabanlı Python servisi. YOLOv8 modeli ile görsel sınıflandırma yapar.

İletişim, geliştirme ortamında Vite proxy'si üzerinden HTTP/JSON ile sağlanır.

```
┌────────────────────────┐         /api/predict          ┌──────────────────────────┐
│  React SPA (Vite)      │ ───────── (POST) ───────────▶ │  FastAPI Service         │
│  - Camera/Upload UI    │   { image: base64 jpeg }      │  - /predict              │
│  - Live overlay        │ ◀──────── (JSON)  ───────────│  - YOLOv8 (best.pt)      │
│  - Result animation    │   { class, confidence, box } │  - Pillow ön işleme      │
└────────────────────────┘                               └──────────────────────────┘
        Port 5173                  Vite proxy                     Port 8000
```

---

## 2. Frontend Mimarisi

### 2.1 Teknoloji Yığını

| Katman        | Teknoloji                       |
|---------------|---------------------------------|
| Framework     | React 19.2 (functional + hooks) |
| Build Tool    | Vite 5.4 (HMR)                  |
| Stil          | Tailwind CSS 4.2 + özel tema    |
| Animasyon     | Framer Motion 12                |
| İkonlar       | Lucide React                    |
| Dil           | JavaScript / JSX (TS yok)       |
| Lint          | ESLint 9 (flat config)          |

### 2.2 Dizin Yapısı

```
src/
├── main.jsx              # React kök bağlama noktası
├── App.jsx               # Ekran yönlendirici (router yerine state-tabanlı)
├── index.css             # Tailwind + atık türü renk değişkenleri
└── components/
    ├── HomeScreen.jsx    # Giriş ekranı (Kamera / Yükle)
    ├── CameraScreen.jsx  # Canlı kamera + tespit overlay
    ├── UploadScreen.jsx  # Görsel yükleme (entegre değil)
    ├── ResultScreen.jsx  # Animasyonlu sonuç ve geri dönüşüm kutusu
    └── ErrorScreen.jsx   # Tanınamayan atık fallback'i (entegre değil)
```

### 2.3 Durum Yönetimi

Harici state library yoktur. Tüm durum **`App.jsx`** içinde lokal `useState` ile tutulur:

- `currentScreen` — Aktif ekran (`home | camera | upload | result | error`).
- `predictionResult` — Backend'den dönen sınıflandırma sonucu.
- `analyzedImage` — Sonuç ekranında gösterilecek base64 görsel.

Ekranlar arası geçiş `navigateTo(screen)` ile yapılır; `AnimatePresence` geçişleri animasyonlar.

### 2.4 Renk Teması

Atık türü ↔ renk eşlemesi `index.css` içinde CSS custom property olarak tanımlıdır:

| Sınıf       | Kutu      | Renk     |
|-------------|-----------|----------|
| `paper`     | MAVİ      | #3B82F6  |
| `plastic`   | SARI      | #FACC15  |
| `glass`     | YEŞİL     | #22C55E  |
| `metal`     | GRİ       | #6B7280  |
| `household` | TURUNCU   | #F97316  |

Bu eşleme `ResultScreen.jsx` içindeki `CLASS_CONFIG` ile paraleldir; iki tarafta da güncel tutulmalıdır.

### 2.5 Kamera Akışı

`CameraScreen.jsx`:

1. `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` ile arka kamera açılır.
2. Her **800 ms**'de bir `<video>` frame'i `<canvas>`'a çizilir ve base64 JPEG'e dönüştürülür.
3. `POST /api/predict` ile backend'e gönderilir.
4. Dönen `box` (normalize edilmiş 0–1 koordinatlar) video üzerine yeşil overlay olarak çizilir.
5. Confidence ≥ 0.05 ise "Hangi Kutuya Atacağım?" butonu aktif olur.

### 2.6 İletişim

- Geliştirmede istekler `/api/*` üzerinden gider; Vite proxy bunu `http://127.0.0.1:8000/*`'a yönlendirir.
- `/api/predict` → `http://127.0.0.1:8000/predict` (path rewrite).
- Hardcoded; üretim için env-var tabanlı bir yapı eklenmelidir.

---

## 3. Backend Mimarisi

### 3.1 Teknoloji Yığını

| Katman        | Teknoloji                       |
|---------------|---------------------------------|
| Framework     | FastAPI                         |
| ASGI Server   | Uvicorn                         |
| ML            | Ultralytics YOLOv8              |
| Image I/O     | Pillow (PIL)                    |
| JWT           | `python-jose[cryptography]`     |
| Parola hash   | `bcrypt`                        |
| Model         | `backend/model/best.pt`         |

### 3.2 Dizin Yapısı

```
backend/
├── main.py              # Tüm uygulama (CORS, model yükleme, /predict)
├── requirements.txt
└── model/
    └── best.pt          # 40.5 MB YOLOv8 ağırlığı
```

### 3.3 Kimlik Doğrulama

İki ayrı şema vardır; karıştırılmamalı:

| Şema           | Kim?     | Endpoint(ler)                              | Mekanizma                  |
|----------------|----------|--------------------------------------------|----------------------------|
| **Bearer JWT** | Frontend | `POST /auth/login`, `POST /predict`        | HS256 imzalı JWT (1 saat)  |
| **API Key**    | IoT      | `GET /fetch-predictions`                   | `X-API-Key` header         |

**JWT akışı:**
1. Kullanıcı login ekranından `username + password` POST eder → `POST /auth/login`.
2. Backend parolayı `bcrypt.checkpw` ile doğrular; başarılıysa `{access_token, token_type, expires_in}` döner.
3. Frontend token'ı `localStorage` (`sw_auth_token`) altında saklar.
4. `POST /predict` çağrılarında `Authorization: Bearer <token>` header'ı gönderilir.
5. Token geçersiz/süresi dolmuşsa backend **401** döner; frontend token'ı temizleyip login ekranına döner.

**İlgili env değişkenleri:**

| Env                   | Anlam                                                    |
|-----------------------|----------------------------------------------------------|
| `AUTH_USERNAME`       | Tek kullanıcı adı (default: `admin`)                     |
| `AUTH_PASSWORD_HASH`  | Bcrypt hash (örn. `$2b$12$...`) — set edilmezse 503     |
| `JWT_SECRET`          | HS256 imzalama sırrı — set edilmezse 503                |
| `JWT_EXPIRE_MINUTES`  | Token ömrü dakika (default: 60)                          |
| `IOT_API_KEY`         | IoT cihazın kullandığı API key — set edilmezse 503      |
| `ALLOWED_ORIGINS`     | Virgülle CORS origin listesi (default: localhost:5173)   |

> Parola hash üretimi:
> ```bash
> python -c "import bcrypt; print(bcrypt.hashpw(b'parola', bcrypt.gensalt()).decode())"
> ```

### 3.4 In-Memory Prediction Slot

Backend, fetch-edilmemiş **tek bir prediction** tutar (`_slot`). Davranış:

- Yeni `POST /predict` slot doluyken gelirse **409 Conflict** döner.
- `GET /fetch-predictions` slot'u okur ve **temizler** (bir kez tüketilir).
- Eşzamanlılık `asyncio.Lock` ile garanti edilir; aynı anda iki predict çağrısı gelse de yalnız biri yazabilir.
- `unknown` sonuçlar slot'a yazılmaz (yalnızca gerçek tespit saklanır).

Redis veya disk yok — sadece process belleği. Servis yeniden başlarsa slot kaybolur (kasıtlı; persistence istenmiyor).

### 3.5 Endpoint: `POST /predict`

**Auth:** `Authorization: Bearer <jwt>` zorunlu (frontend kullanıcısı).

**İstek:**
```json
{ "image": "<base64-jpeg>", "source": "camera" }
```
`source` opsiyoneldir; `"camera"` (varsayılan) veya `"upload"`.

**Akış:**
1. Base64 decode → `BytesIO` → PIL Image → RGB.
2. `model.predict(image, conf=0.05)` ile çıkarım.
3. Tespit yoksa `{"class": "unknown", "confidence": 0}` döner.
4. En yüksek confidence'lı bounding box seçilir.
5. Orijinal YOLO sınıfı (`biodegradable`, `glass`, `metal`, `paper`, `plastic`) frontend kategorisine eşlenir: `biodegradable → household`.

**Yanıt:**
```json
{
  "class": "paper",
  "confidence": 0.87,
  "original_class": "paper",
  "box": { "x1": 0.12, "y1": 0.20, "x2": 0.55, "y2": 0.78 }
}
```

Box koordinatları **normalize**'dir (0–1 aralığı). Bu, frontend'in video boyutundan bağımsız overlay çizmesini sağlar.

Başarılı tespit edildiğinde, response'a ek olarak `timestamp`, `source` ve gönderilen `image` slot'a yazılır. Slot doluyken yeni `POST /predict` gelirse **409 Conflict**, token eksik/geçersizse **401 Unauthorized** döner.

**Endpoint: `POST /auth/login`** (auth gerektirmez)

```json
// İstek
{ "username": "admin", "password": "..." }

// Yanıt (200)
{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 3600 }
```

Hatalı kimlik bilgisi → 401, sunucu yapılandırılmamışsa → 503.

### 3.6 Endpoint: `GET /fetch-predictions`

**IoT cihazı için** tasarlanmış, hafif formatlı endpoint. Slot'taki kaydı döner ve slot'u temizler.

**Auth:** `X-API-Key` header zorunlu. Anahtar backend'de `IOT_API_KEY` env-var'ı ile set edilir. Set edilmemişse endpoint 503 döner (production'da unutmasın diye fail-closed).

**Yanıt (slot doluysa):**
```json
{
  "prediction": {
    "bin": "blue",
    "class": "paper",
    "confidence": 0.873,
    "ts": "2026-05-30T12:34:56.789+00:00"
  }
}
```

| Alan         | Açıklama                                                       |
|--------------|----------------------------------------------------------------|
| `bin`        | Açılacak kutu rengi: `blue \| yellow \| green \| gray \| orange` |
| `class`      | Atık sınıfı (telemetry için)                                   |
| `confidence` | 0–1 güven skoru                                                |
| `ts`         | UTC ISO-8601 timestamp                                         |

**Yanıt (slot boşsa):**
```json
{ "prediction": null }
```

Cevap `image`, `box`, `original_class` içermez — IoT cihazın bant genişliği ve belleği korunur. Tam veri başka bir tüketiciye lazım olursa ayrı bir endpoint eklenir.

Hata kodları:
- `401` — Geçersiz / eksik API key.
- `503` — `IOT_API_KEY` backend'de tanımlı değil.

IoT cihazın sözleşmesi: [iot_reqs.md](./iot_reqs.md).

### 3.7 CORS

`ALLOWED_ORIGINS` env-var'ından okunur (virgülle ayrılmış liste). Geliştirme varsayılanı `http://localhost:5173,http://127.0.0.1:5173`. Method'lar `GET, POST`; header'lar `Authorization, Content-Type, X-API-Key` ile sınırlandı. Production'da gerçek frontend domain'i set edilmeli.

---

## 4. Veri Akışı (Uçtan Uca)

```
1. Kullanıcı HomeScreen → "Kamera Aç" tıklar
2. CameraScreen kamerayı açar, 800 ms periyot başlar
3. Her frame → base64 JPEG → POST /api/predict
4. Vite proxy → FastAPI /predict
5. PIL decode → YOLOv8 inference → en iyi box
6. JSON yanıt → frontend overlay + buton aktif
7. Kullanıcı butona basar → handleResultReady(result, image)
8. App.jsx → ResultScreen render
9. ResultScreen sınıfa göre kutu + emoji + parça animasyonu
```

---

## 5. Dağıtım Topolojisi

**Geliştirme:**

| Servis   | Komut                            | Port |
|----------|----------------------------------|------|
| Frontend | `npm run dev`                    | 5173 |
| Backend  | `uvicorn main:app --reload`      | 8000 |

**Üretim önerileri (henüz uygulanmamış):**

- Frontend: `npm run build` → CDN / statik hosting.
- Backend: Container (GPU/CPU) + reverse proxy (Nginx/Caddy).
- API base URL `.env` ile yönetilmeli (`VITE_API_BASE`).

---

## 6. Bilinen Boşluklar

- `UploadScreen` mevcut fakat `App.jsx`'e bağlanmamış (`onUpload` handler eksik).
- `ErrorScreen` mevcut fakat `currentScreen === 'error'` durumuna hiçbir akış geçmiyor.
- `isLoading` state tanımlı ama kullanılmıyor.
- Env-var desteği yok; backend adresi hardcoded.
- Test (frontend & backend) yok.
- Authentication / rate limiting yok.

---

## 7. Mimari Kararlar ve Gerekçeleri

| Karar                                   | Gerekçe                                                                 |
|-----------------------------------------|-------------------------------------------------------------------------|
| State-tabanlı ekran yönlendirme         | Az sayıda ekran var; React Router gereksiz karmaşıklık olurdu.          |
| Backend'de inference                    | YOLO modeli 40 MB+; mobil/tarayıcıda TF.js'e taşımak büyük yük.         |
| Vite proxy                              | Geliştirmede CORS'u atlatmak ve aynı origin hissi vermek için.          |
| Normalize bounding box                  | Frontend video boyutundan bağımsız çizim.                               |
| 800 ms tarama aralığı                   | İnsan algısı için yeterince akıcı, backend'i boğmayacak kadar seyrek.   |
| `conf=0.05` düşük eşik                  | "unknown" yanıtını azaltmak; UI tarafında ek filtre uygulanabilir.      |
