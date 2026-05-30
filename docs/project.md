# Smart Waste Detection — Proje Dökümanı

## 1. Proje Nedir?

**Smart Waste Detection**, kullanıcının elindeki atığı kamerasına ya da yüklediği bir görsele bakarak tanıyan ve onu hangi geri dönüşüm kutusuna atması gerektiğini eğlenceli, animasyonlu bir arayüzle gösteren bir web uygulamasıdır.

Kısaca: **"Atığını göster, doğru kutuyu öğren."**

Proje, geri dönüşüm farkındalığını artırmayı, özellikle çocuklar ve genç kullanıcılar için "hangi atık hangi kutuya gider?" sorusunu görsel olarak somutlaştırmayı amaçlar.

---

## 2. Kullanıcı Deneyimi

### Akış

1. **Giriş ekranı**: Korumalı alana erişmek için kullanıcı adı + parola girer. Başarılı girişte JWT alır ve tarayıcıda saklanır; oturum 1 saat geçerlidir.
2. **Ana ekran**: "Atığını Kameraya Göster!" başlığı ile karşılaşır. İki seçenek vardır: **Görsel Yükle** veya **Kamera Aç**.
3. **Kamera ekranı**: Arka kamera açılır, görüntü canlı taranır. Tespit edilen nesne yeşil bir çerçeve içine alınır ve altında "ne olduğu + güven yüzdesi" yazar.
4. **Sonuç ekranı**: Tespit edilen atığa göre kutu animasyonu açılır, atık emojisi kutuya düşer, etrafına parıltılar saçılır. Üstte hangi kutuya atılacağı büyük puntoyla yazar.
5. **Tekrar/Ana Sayfa** butonlarıyla döngü kapanır.

### Tanınan Atık Sınıfları

| Sınıf       | Türkçe Karşılığı | Geri Dönüşüm Kutusu |
|-------------|------------------|---------------------|
| `paper`     | Kâğıt            | 🔵 Mavi Kutu        |
| `plastic`   | Plastik          | 🟡 Sarı Kutu        |
| `glass`     | Cam              | 🟢 Yeşil Kutu       |
| `metal`     | Metal            | ⚪ Gri Kutu         |
| `household` | Organik / Evsel  | 🟠 Turuncu Kutu     |

---

## 3. Teknik Özet

| Katman    | Teknoloji                                      |
|-----------|------------------------------------------------|
| Frontend  | React 19, Vite, Tailwind CSS, Framer Motion    |
| Backend   | FastAPI (Python), Uvicorn                      |
| ML Modeli | YOLOv8 (Ultralytics), `backend/model/best.pt`  |
| Dil       | Türkçe arayüz                                  |

Daha derin teknik detay için: [architecture.md](./architecture.md).
Kod katkısı yaparken uyulacak kurallar için: [guidence.md](./guidence.md).

---

## 4. Çalıştırma

### Önkoşullar

- Node.js 18+
- Python 3.10+
- Modern bir tarayıcı (kamera erişimi olan)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate           # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Gerekli env değişkenleri:
export JWT_SECRET="$(openssl rand -hex 32)"
export AUTH_USERNAME="admin"
export AUTH_PASSWORD_HASH="$(python -c 'import bcrypt; print(bcrypt.hashpw(b"parolaniz", bcrypt.gensalt()).decode())')"
export IOT_API_KEY="$(openssl rand -hex 24)"
# Opsiyonel: export ALLOWED_ORIGINS="https://smartwaste.example.com"

uvicorn main:app --reload --port 8000
```

Başarılı yüklemede log: `Model basariyla yuklendi!`

### Frontend

```bash
npm install
npm run dev
```

Arayüz: `http://localhost:5173`

Vite proxy `/api/*` isteklerini `http://127.0.0.1:8000`'a yönlendirdiği için backend'in çalışıyor olması gerekir.

---

## 5. Proje Hedefi ve Hikayesi

Geri dönüşüm kutuları renkleriyle ayrılır ama "hangi atık nereye?" bilgisi insanlar arasında dağınıktır. Bu proje:

- Tespit ettiği atığı **doğru renkli kutuya** eşler.
- Sonucu **animasyon ve emoji** ile somutlaştırır — yalnız bir etiket göstermez.
- **Mobil ilk** düşünülmüştür: arka kamera, kare görüntü çerçevesi, büyük dokunma alanları.

Eğitici bir oyun hissi vermek istediği için tasarım dili sade, renkli ve çocuk dostudur.

---

## 6. Mevcut Durum

- ✅ Canlı kamera tespiti ve overlay çalışıyor.
- ✅ Sonuç ekranı tüm sınıflar için animasyonlu.
- ✅ Backend YOLOv8 ile 5 sınıfı tanıyor.
- 🟡 Görsel yükleme ekranı UI olarak var, akışa bağlanmadı.
- 🟡 Hata ekranı UI olarak var, tetiklenmiyor.
- ❌ Üretim dağıtımı, env yönetimi, test altyapısı yok.

Tahmini tamamlanma oranı: **~%80** (çekirdek deneyim çalışıyor; etrafındaki ikincil akışlar eksik).

---

## 7. Yol Haritası (Önerilen)

1. Upload akışını tamamla.
2. Tanınmayan atıkta ErrorScreen'i tetikle.
3. `.env` ile API adresini dışsallaştır.
4. Frontend ve backend için temel test paketi.
5. Dağıtım: Frontend statik hosting, backend container.
6. Olası genişlemeler: çoklu nesne tespiti, geçmiş tarama listesi, kullanıcı skoru / gamification.

---

## 8. Dizin Yapısı

```
smart-waste-detection/
├── docs/                    # Bu klasör (mimari, kılavuz, proje)
├── public/                  # Statik varlıklar
├── src/                     # React kaynak kodu
│   ├── components/          # Ekran bileşenleri
│   ├── App.jsx              # Ekran yönlendirici
│   ├── main.jsx
│   └── index.css            # Tailwind + tema
├── backend/
│   ├── main.py              # FastAPI + YOLOv8 endpoint
│   ├── requirements.txt
│   └── model/best.pt        # Eğitilmiş model
├── vite.config.js           # /api proxy yapılandırması
├── eslint.config.js
├── package.json
└── README.md
```

---

## 9. Lisans ve Katkı

Şu an için iç geliştirme aşamasındadır. Katkı yapmadan önce [guidence.md](./guidence.md) okunmalıdır.
