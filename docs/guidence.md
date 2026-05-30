# Agent Kodlama Kılavuzu (Guidance)

Bu döküman, **Smart Waste Detection** projesinde kod yazan AI agent'larının (veya yeni katılan geliştiricilerin) uyması gereken kuralları, konvansiyonları ve kaçınılması gereken hataları toplar. Yeni bir özellik eklemeden veya refactor yapmadan önce okunmalıdır.

> Eşlik eden dökümanlar: [architecture.md](./architecture.md), [project.md](./project.md).

---

## 1. Genel Prensipler

1. **Mevcut dosyaları düzenle, yenilerini şişirme.** Her yeni dosya bir bakım yüküdür. Var olan yapıya ekle.
2. **Türkçe UI metinleri korunur.** Kullanıcıya görünen tüm metin Türkçe'dir. Bunu değiştirme, i18n eklemeden önce kullanıcıya sor.
3. **Sade tut.** Henüz Redux/Zustand, React Router veya TypeScript yok — bunları "ihtiyaç olursa diye" eklemeyin.
4. **Yorum yazma.** Kod kendini anlatmalıdır. Sadece "neden" açıklaması gerektiğinde kısa yorum ekle.
5. **Var olmayan özelliklere savunma ekleme.** Internal kodda aşırı try-catch / null check yapma; sınır noktalarında (kamera izni, fetch, base64 decode) tut.

---

## 2. Frontend Konvansiyonları

### 2.1 Bileşen Yapısı

- **Functional component + hooks.** Class component yok.
- **Default export** kullan: `export default function MyScreen() { ... }`.
- **PascalCase** dosya ve component adı (`HomeScreen.jsx`).
- **Props minimal tut.** Gerekirse callback (`onResultReady`, `onNavigate`) geçir.

### 2.2 Stil

- **Sadece Tailwind utility class'ları.** CSS modülü, styled-components veya inline `style` ekleme.
- **Atık renkleri için tema değişkenlerini kullan:** `bg-[var(--color-waste-paper)]` gibi. Hex değerleri doğrudan yazma.
- **App.css boştur / kullanılmıyor.** Yeni global CSS gerekiyorsa `index.css`'e ekle.

### 2.3 Animasyon

- **Framer Motion standarttır.** Yeni bir animasyon kütüphanesi ekleme.
- Geçişler için `AnimatePresence + motion.div` deseni (App.jsx'teki gibi).
- Aşırıya kaçma; performans için sadece transform/opacity kullan, layout değişikliklerini animate etme.

### 2.4 İkonlar

- **Lucide React.** Başka icon kütüphanesi ekleme.
- Boyutu `size` prop'u ile pixel olarak ver.

### 2.5 State

- Lokal `useState` yeterli olduğu sürece **Context veya store ekleme.**
- Yeni bir global state ihtiyacı doğarsa, önce App.jsx'te local state olarak başla.
- Hookları **component'in en üstünde** ve **koşulsuz** çağır.

### 2.6 API Çağrıları

- **Tüm istekler `/api/...` yolunu kullanır.** Doğrudan `http://127.0.0.1:8000` yazma — Vite proxy bozulur.
- `fetch` kullan, axios ekleme.
- **Korumalı endpoint'lere her zaman `Authorization: Bearer <token>` header'ı gönder.** Token App.jsx'te tutulur ve prop olarak iletilir.
- **401 yanıtında token'ı sessizce yutma.** `onUnauthorized()` callback'ini çağır; App.jsx token'ı temizler ve kullanıcıyı login ekranına döndürür.
- **409 yanıtı (slot dolu) hata değildir.** Sessizce geç; sonraki frame'de tekrar denenir.

```js
// Doğru
const res = await fetch('/api/predict', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ image: base64, source: 'camera' }),
});

if (res.status === 401) { onUnauthorized?.(); return; }
if (res.status === 409) return;
```

### 2.6.1 Token Yönetimi

- Token **sadece `App.jsx`'te** tutulur ve `localStorage` ile senkronize edilir (`sw_auth_token`).
- Child component'ler token'ı **prop** olarak alır; doğrudan `localStorage`'a dokunma.
- Token decode etme, expiry kontrolü vs. frontend'de **yapma** — 401'i bekle, gelince logout yap.
- Yeni bir korumalı ekran eklerken `token` ve `onUnauthorized` prop'larını App.jsx'ten geçir.

### 2.7 Kamera ve Canvas

- Frame yakalama aralığı **800 ms**'dir. Düşürmeden önce backend yükünü düşün.
- Base64 üretirken `canvas.toDataURL('image/jpeg', 0.8)` kullan — PNG ağırdır.
- Component unmount olurken `getTracks().forEach(t => t.stop())` ile kamerayı kapat. Bunu unutma; sızıntı kaynağıdır.

### 2.8 Yeni Atık Sınıfı Eklerken

Bir sınıf eklemek **üç yerde** senkron değişiklik gerektirir:

1. `backend/main.py` → YOLO sınıf eşleme tablosu.
2. `src/index.css` → `--color-waste-<yeni>` CSS değişkeni.
3. `src/components/ResultScreen.jsx` → `CLASS_CONFIG` objesi (kutu adı, emoji, gradient).

Modelin de yeni sınıfı tanıması gerekir; sadece kod değişikliği yeterli değildir.

---

## 3. Backend Konvansiyonları

### 3.1 Yapı

- **Tek dosya (`main.py`) yaklaşımı yeterli olduğu sürece bölme.** Endpoint sayısı 3-4'ü geçince modüllere ayır.
- Model yükleme **modül seviyesinde**, request başında değil. Şu anki yapıyı koru.

### 3.2 Şema

- Request gövdesi için **Pydantic `BaseModel`** kullan.
- Response için dict döndürmek şu an yeterli; tip güvenliği için ileride `BaseModel` eklenebilir.

### 3.3 Sınıf Eşleme

- YOLO çıktısı (`biodegradable`, vb.) **doğrudan frontend'e sızdırılmaz.** Frontend yalnızca beş kategoriyi bilir: `paper, plastic, glass, metal, household`. `original_class` debug için döner.

### 3.4 Bounding Box

- **Her zaman normalize (0–1) koordinat döndür.** Frontend video boyutunu bilmez.
- Format: `{x1, y1, x2, y2}` — sol-üst ve sağ-alt köşe.

### 3.5 Hata Yönetimi

- Model yok → 500.
- Decode/parse hatası → 400 + Türkçe mesaj log.
- Tespit yok → 200 + `{"class": "unknown", "confidence": 0}` (hata değil, geçerli durum).

### 3.6 CORS

- `allow_origins=["*"]` sadece geliştirme içindir. Üretim PR'ında mutlaka kısıtla.

---

## 4. Bilinen Eksiklikler — Önceliklendirme

Yeni iş ararken sırasıyla şunları tamamla:

1. **UploadScreen entegrasyonu** — `App.jsx`'e `onUpload` handler bağla, base64'e çevir, `/api/predict`'e gönder, `handleResultReady` ile sonuç ekranına geç.
2. **ErrorScreen tetikleme** — Tespit `unknown` döndüğünde veya confidence çok düşükse `currentScreen = 'error'` yap.
3. **Env-var desteği** — `vite.config.js` proxy hedefini `process.env.VITE_API_TARGET` ile değişken yap.
4. **Loading state kullanımı** — Upload akışında inference süresi boyunca yükleme göstergesi.
5. **Test altyapısı** — Vitest + React Testing Library frontend için, pytest backend için.

---

## 5. Anti-Patternler (Yapma)

- ❌ TypeScript, Redux, React Router, Axios, styled-components ekleme.
- ❌ Yeni bir CSS dosyası oluşturma; Tailwind ile çöz.
- ❌ Backend'de senkron uzun bloklama; FastAPI async handler'ı koru.
- ❌ Base64 görseli localStorage / state'te uzun süre tutma — bellek şişer.
- ❌ İngilizce UI metni ekleme.
- ❌ Hardcoded backend URL'i bileşen içine yazma (proxy'yi kullan).
- ❌ Token'ı `localStorage`'dan rastgele yerlerde okuma; App.jsx tek otoritedir.
- ❌ Frontend'de JWT decode edip claim'lere göre dallanma; backend zaten doğruluyor.
- ❌ Login formuna parolayı `console.log`'lama; ekran kaydında bile sızar.
- ❌ `console.log` bırakma; debug bittiğinde sil.
- ❌ Mevcut `CLASS_CONFIG` veya tema değişkenlerini kopyalayıp ikinci bir kaynak oluşturma.

---

## 6. PR / Commit Kuralları

- Commit mesajları kısa ve açıklayıcı; "neden" odaklı.
- Bir PR tek bir konuya odaklansın (özellik, fix, refactor — karıştırma).
- README / docs etkileniyorsa aynı PR'da güncelle.
- `npm run lint` ve `npm run build` lokalde geçmeden açma.

---

## 7. Hızlı Kontrol Listesi

Bir değişiklik göndermeden önce:

- [ ] Lint temiz mi? (`npm run lint`)
- [ ] Build geçiyor mu? (`npm run build`)
- [ ] Yeni sınıf eklendiyse üç yer de senkron mu? (model, css, ResultScreen)
- [ ] Türkçe metinler korundu mu?
- [ ] Konsola debug log sızmadı mı?
- [ ] Kamera stream'i unmount'ta durduruluyor mu?
- [ ] API URL'i `/api/...` formatında mı?
- [ ] [architecture.md](./architecture.md) etkilendi mi, güncellendi mi?
