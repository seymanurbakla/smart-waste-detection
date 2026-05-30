# Deployment Dökümanı

Bu döküman **Smart Waste Detection**'ı bulut ortamında veya yerelde container ile çalıştırmak için gereken adımları, kararları ve dikkat edilmesi gereken noktaları anlatır.

İlgili dökümanlar: [architecture.md](./architecture.md), [iot_reqs.md](./iot_reqs.md), [guidence.md](./guidence.md).

---

## 1. Topoloji

```
                ┌──────────────┐
                │  Cloudflare  │  (TLS, WAF, rate-limit, bot mitigation)
                └──────┬───────┘
                       │
                ┌──────▼───────┐
                │ Host / VM    │  Tek makine; 2 container
                │              │
                │  ┌────────┐  │  :80  →  nginx (SPA) + /api proxy
                │  │frontend│──┼───────────────┐
                │  └────────┘  │               │
                │              │               │ (internal: sw-net)
                │  ┌────────┐  │               │
                │  │backend │◀─┼───────────────┘
                │  └────────┘  │   :8000 (sadece compose network)
                └──────────────┘
```

- **Frontend** container: nginx, statik React build'i servis eder. `/api/*` isteklerini compose network üzerinden `backend:8000`'e proxy'ler.
- **Backend** container: FastAPI + YOLOv8. Sadece compose network'ünde dinler, host'a port açmaz. Public erişim **yalnızca** nginx üzerinden mümkün.
- **Cloudflare** (kullanıcının sorumluluğu): TLS, DDoS, bot ve WAF kuralları.

---

## 2. Önkoşullar

| Bileşen           | Sürüm           |
|-------------------|-----------------|
| Docker            | 24+             |
| Docker Compose    | v2 (gömülü)     |
| RAM               | ≥ 2 GB (YOLO inference için)  |
| Disk              | ≥ 3 GB (image'lar + model)    |
| `backend/model/best.pt` | Eğitilmiş YOLO ağırlığı, repo ile birlikte gelir |

GPU **gerekli değil**; CPU inference yeterli (frame başına ~300–800 ms).

---

## 3. Env Değişkenleri

`.env.example`'ı `.env` olarak kopyala, doldur:

```bash
cp .env.example .env
```

| Değişken              | Açıklama                                                    | Üretim                                                     |
|-----------------------|-------------------------------------------------------------|------------------------------------------------------------|
| `JWT_SECRET`          | HS256 imza sırrı (32+ byte)                                 | `openssl rand -hex 32`                                     |
| `AUTH_USERNAME`       | Tek kullanıcı adı                                           | İstediğin (örn. `admin`)                                   |
| `AUTH_PASSWORD_HASH`  | bcrypt hash                                                 | `python -c 'import bcrypt; print(bcrypt.hashpw(b"PAROLA", bcrypt.gensalt()).decode())'` |
| `JWT_EXPIRE_MINUTES`  | Token ömrü                                                  | Default `60`                                               |
| `IOT_API_KEY`         | IoT cihazın gönderdiği `X-API-Key`                          | `openssl rand -hex 24`                                     |
| `ALLOWED_ORIGINS`     | CORS allow list (virgülle ayrılmış)                         | Local: `http://localhost:8080`, prod: `https://senin-domain.com` |

**Eksik bir zorunlu değişken varsa `docker compose up` patlar** (compose dosyasında `${VAR:?...}` ile kontrol edilir). Bu kasıtlıdır — production'a unutarak gitmesin.

---

## 4. Lokal Çalıştırma (Docker Compose)

```bash
# 1. Bağımlılıkları ve .env'i hazırla
cp .env.example .env
# .env'i bir editörle doldur

# 2. Build + ayağa kaldır
docker compose up --build -d

# 3. Logları izle
docker compose logs -f backend
docker compose logs -f frontend

# 4. Erişim
open http://localhost:8080

# 5. Durdurma
docker compose down
```

İlk build:
- Backend ~3–5 dk (ultralytics + torch ağır).
- Frontend ~1 dk (node modules + vite build).

---

## 5. Production'a Çıkış

### 5.1 Host Hazırlığı

1. Linux VM (Ubuntu 22.04 / 24.04 önerilir), 2 vCPU + 4 GB RAM minimum.
2. Docker Engine + Compose v2 kur.
3. Repo'yu çek: `git clone ... && cd smart-waste-detection`.
4. `.env`'i **production değerleriyle** doldur. Asla repo'ya commit'leme.

### 5.2 Cloudflare Önünde Çalıştırma

Cloudflare orchestration kullanıcının sorumluluğundadır. Önerilen yapılandırma:

- **DNS**: Apex (`smartwaste.example.com`) → host public IP. Proxy "orange cloud" açık.
- **SSL/TLS**: Mode `Full (strict)`. Origin'e sertifika gerekiyor — Cloudflare Origin CA kullan.
- **Origin**: Host üzerinde nginx (compose'taki frontend container) 443 yerine **80 dinler**; TLS Cloudflare ↔ origin arasında Origin Cert ile. İstersen Caddy / Traefik ile otomatik Let's Encrypt da olur.
- **Cache**: HTML cache'lenmesin (`Cache-Control: no-store`). Asset'ler default.
- **WAF / Rate Limit**:
  - `/api/auth/login` için 5 req/min/IP.
  - `/api/predict` için 60 req/min/IP.
  - `/fetch-predictions` için **sadece IoT cihazın static IP'sine veya ülkesine** izin ver.
- **Bot Fight Mode**: açık.

### 5.3 Backend Container'ın Public Açık Olmaması

`docker-compose.yml`'de backend `expose: 8000` der; `ports:` **yok**. Bu, backend'in sadece compose network'ünden erişilebilir olduğu anlamına gelir. **Bunu değiştirme.** Public arayüz sadece nginx olmalı.

### 5.4 Logging ve İzleme

Minimum yapı:
- `docker compose logs --tail=200 backend` — anlık inceleme.
- Production'da log driver'ı `json-file` (default) + log rotation (`max-size: 10m`, `max-file: 3`).
- Cloudflare Analytics → request hacmi, 4xx/5xx oranı.
- (Opsiyonel) Prometheus + Grafana; FastAPI için `prometheus-fastapi-instrumentator` paketi entegre edilebilir.

### 5.5 Model Dosyası

`backend/model/best.pt` (~40 MB) build zamanı imaja kopyalanır. Modeli güncellemek istersen:

- **Seçenek A (basit):** Yeni `.pt`'yi commit'le, `docker compose build backend` çalıştır.
- **Seçenek B (daha esnek):** Compose'daki yorumlu `volumes:` satırını aç; modeli host'taki `./backend/model` klasöründen mount et. Restart yeterli olur, build gerekmez.

### 5.6 Yedekleme ve Veri Kalıcılığı

**Bu projenin kalıcı veritabanı yoktur.** Slot in-memory, restart sonrası kaybolur (kasıtlı). Yedeklenecek tek şey:

- `.env` (sırlar) — **güvenli bir parola yöneticisi veya secret store'da tut**, repo'da değil.
- `backend/model/best.pt` — modelin kaynak/eğitim çıktısı zaten ayrı bir yerde olmalı.

---

## 5.7 GHCR Üzerinden Image Kullanımı (CI/CD)

Repo, [.github/workflows/docker-publish.yml](../.github/workflows/docker-publish.yml) ile her `main` push'unda ve `v*` tag'inde iki image'ı **GitHub Container Registry**'ye yayımlar:

- `ghcr.io/<owner>/<repo>-backend`
- `ghcr.io/<owner>/<repo>-frontend`

Tag stratejisi (`docker/metadata-action`):

| Olay              | Tag'ler                                          |
|-------------------|--------------------------------------------------|
| `main` push       | `main`, `sha-<short>`, `latest`                  |
| `v1.2.3` tag      | `1.2.3`, `1.2`, `sha-<short>`                    |
| PR                | `pr-<n>` (build edilir, **push edilmez**)        |
| manual dispatch   | branch'a göre                                    |

Production host'unda image'ı `build` yerine `image:` ile çekmek istersen `docker-compose.yml`'in `build:` satırlarını şununla değiştir:

```yaml
services:
  backend:
    image: ghcr.io/<owner>/<repo>-backend:latest
    # build: ./backend   ← yorum
  frontend:
    image: ghcr.io/<owner>/<repo>-frontend:latest
    # build: .           ← yorum
```

Image private ise host'ta önce login:

```bash
echo "$GITHUB_PAT" | docker login ghcr.io -u <kullanici> --password-stdin
docker compose pull
docker compose up -d
```

PAT scope'u: `read:packages` yeter.

## 6. Güncelleme / Yeni Sürüm

```bash
git pull
docker compose build
docker compose up -d
```

Compose `restart: unless-stopped` ile çalıştığı için container'lar otomatik yeniden başlar. Yeni image build edildiğinde `up -d` mevcut container'ı değiştirir; kısa bir downtime olur (~5 sn).

Sıfır-downtime istiyorsan iki replika + Cloudflare Load Balancer / Traefik gerekir; bu projenin kapsamında değil.

---

## 7. Sağlık Kontrolü

Hızlıca doğrulamak için:

```bash
# Frontend erişiyor mu?
curl -I http://localhost:8080

# Backend ayakta mı? (proxy üzerinden)
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YANLIS"}'
# Beklenen: 401 + "Kullanici adi veya parola hatali."

# IoT endpoint? (yanlış key ile)
curl -H 'X-API-Key: BOGUS' http://localhost:8080/api/fetch-predictions
# Beklenen: 401 + "Gecersiz API key."

# Korumalı endpoint token'sız?
curl -X POST http://localhost:8080/api/predict
# Beklenen: 401 + "Bearer token gerekli."
```

Cloudflare arkasında aynı testleri `https://senin-domain.com/api/...` adresine yapabilirsin.

---

## 8. Bilinen Riskler / İleride

- **Tek instance:** Backend tek process. Yatay ölçek için in-memory slot Redis'e taşınmalı (mevcut tasarım kasıtlı tek-node).
- **Multi-worker desteği yok:** `uvicorn --workers 2`'ye geçilirse her worker kendi slot'unu tutar, "tek prediction" garantisi bozulur. Tek worker'da bırakın.
- **Login rate-limit backend tarafında yok:** Cloudflare'a yüklendi. Cloudflare devre dışı kalırsa brute-force riski var; ileride `slowapi` ile yedek katman eklenebilir.
- **HTTPS sertifikası uçtan uca origin'de değil:** Cloudflare ↔ origin arası Origin CA ile şifrelenir, ama host fiziksel olarak ele geçirilirse trafik düz görülür. Origin'i de Let's Encrypt + Caddy ile TLS yapmak en sağlamı.

---

## 9. Sorun Giderme

| Belirti                                                | Olası Sebep                                            | Çözüm                                                       |
|--------------------------------------------------------|--------------------------------------------------------|-------------------------------------------------------------|
| `docker compose up` `JWT_SECRET set edilmemis` der     | `.env` doldurulmamış                                   | `.env.example`'ı kopyalayıp doldur                          |
| Backend 503 "JWT_SECRET tanimli degil"                 | Container env almadı                                   | `docker compose config` ile env değerlerini kontrol et      |
| Frontend yükleniyor ama login 502/504                  | Backend ayağa kalkmamış / network yanlış               | `docker compose logs backend`; nginx upstream adı `backend` olmalı |
| Backend "Model bulunamadi"                             | `backend/model/best.pt` eksik                          | Modeli ekle ve image'ı yeniden build et                     |
| Inference çok yavaş                                    | CPU yetersiz / başka process YOLO'ya CPU bırakmıyor    | VM'i büyüt veya frame interval'ini artır (frontend)         |
| 401 sürekli geliyor (token doğru görünüyor)            | `JWT_SECRET` build sonrası değişti                     | Kullanıcıyı yeniden login'e zorla; secret rotasyonu için beklenen davranış |
| CORS hatası                                            | `ALLOWED_ORIGINS` yanlış / port farklı                 | Tarayıcı network sekmesinde Origin header'ı oku, env'e ekle |
