# IoT Cihaz Gereksinimleri

Bu döküman, **Smart Waste Detection** backend'iyle konuşacak olan IoT cihazının (kutu kapakları açan mekanik istasyon) sahip olması gereken yetkinlikleri ve uyması gereken protokolü tanımlar.

> İlgili döküman: backend mimarisi için [architecture.md](./architecture.md).

---

## 1. Cihazın Görevi

Backend bir atık tespit ettiğinde, IoT cihazı backend'i sorgular ve sonucuna göre **doğru renkli kutunun kapağını açar.** Görüntü işleme, sınıflandırma, kullanıcı arayüzü cihazın sorumluluğunda değildir; cihaz sadece **"hangi kutu açılacak?"** sinyalini alır ve mekanik aksiyon uygular.

```
[Backend slot] ──GET /fetch-predictions──▶ [IoT cihaz] ──röle──▶ [Kutu kapağı]
```

---

## 2. Donanım Gereksinimleri

| Bileşen        | Minimum                                       |
|----------------|-----------------------------------------------|
| MCU / SBC      | ESP32, Raspberry Pi Pico W, RPi Zero 2W vb.   |
| Ağ             | Wi-Fi (TLS/HTTPS destekli stack)              |
| Güç            | Sürekli, kesintisiz (sleep ile uyumlu)        |
| Çıkış          | 5 adet röle / servo (her kutu için 1)         |
| Bellek         | ~64 KB RAM yeterli (büyük payload yok)        |

**Not:** Kamera, ekran, mikrofon gerekmez. Cihaz "dumb actuator"dır.

---

## 3. Yazılım Gereksinimleri

Cihaz şunları yapabilmelidir:

- **HTTPS isteği** atabilmek (TLS 1.2+).
- **Özel header** (`X-API-Key`) gönderebilmek.
- **JSON parse** edebilmek (mikro kütüphane yeterli; payload < 200 byte).
- **Süreli polling** yapabilmek (varsayılan: 1 saniye).
- **GPIO / röle tetikleyebilmek.**
- **Yeniden bağlanma mantığı** (Wi-Fi düşerse exponential backoff).

---

## 4. API Sözleşmesi

### 4.1 Endpoint

```
GET https://<backend-host>/fetch-predictions
Header: X-API-Key: <gizli-anahtar>
```

> **Not:** IoT cihaz `X-API-Key` kullanır; **JWT / Bearer token kullanmaz.** Bu, frontend kullanıcı oturumu için ayrılmış ayrı bir şemadır (bkz. [architecture.md](./architecture.md) §3.3). İki şema birbirinin yerine kullanılmaz.

### 4.2 Yanıt — Slot Doluyken

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

| Alan         | Tip      | Açıklama                                                       |
|--------------|----------|----------------------------------------------------------------|
| `bin`        | string   | Açılacak kutu: `blue \| yellow \| green \| gray \| orange`     |
| `class`      | string   | Atık sınıfı (log/telemetry için; aksiyon `bin`'e göredir)      |
| `confidence` | float    | 0–1 arası güven skoru, 3 ondalık                               |
| `ts`         | string   | UTC ISO-8601 timestamp                                         |

### 4.3 Yanıt — Slot Boşken

```json
{ "prediction": null }
```

Bu durumda cihaz **hiçbir şey yapmamalı**, bir sonraki polling döngüsünü beklemelidir.

### 4.4 Hata Yanıtları

| HTTP | Anlam                                  | Cihaz davranışı                    |
|------|----------------------------------------|------------------------------------|
| 401  | Geçersiz / eksik API key               | Polling'i durdur, alarm/LED        |
| 503  | Backend'de `IOT_API_KEY` set edilmemiş | 30 sn bekle, tekrar dene           |
| 5xx  | Sunucu hatası                          | Exponential backoff (max 60 sn)    |
| Net  | Bağlantı timeout / DNS                 | Wi-Fi yeniden bağlan, backoff      |

---

## 5. Polling Stratejisi

- **Aralık:** 1 saniyede 1 istek (varsayılan). Backend tarafı ucuz; daha sık polling gereksiz.
- **Backoff:** Ardışık hata durumunda 1 → 2 → 4 → 8 → ... → 60 saniyeye kadar arttır.
- **Başarılı istek sonrası backoff sıfırla.**
- **Eşzamanlı tek istek:** Bir istek tamamlanmadan ikincisini başlatma.

---

## 6. Aksiyon Mantığı (Pseudo-code)

```c
while (true) {
    response = http_get("/fetch-predictions", headers={"X-API-Key": KEY});

    if (response.status == 200 && response.json.prediction != null) {
        bin = response.json.prediction.bin;
        switch (bin) {
            case "blue":   open_relay(PIN_BLUE);   break;
            case "yellow": open_relay(PIN_YELLOW); break;
            case "green":  open_relay(PIN_GREEN);  break;
            case "gray":   open_relay(PIN_GRAY);   break;
            case "orange": open_relay(PIN_ORANGE); break;
        }
        log_event(response.json.prediction);   // class + confidence + ts
        delay(LID_OPEN_DURATION_MS);            // örn. 3000 ms
        close_relay();
    }

    delay(POLL_INTERVAL_MS);   // örn. 1000 ms
}
```

---

## 7. Güvenlik Gereksinimleri

1. **API key gizli kalmalı.** Cihaz firmware'inde **flash'ın güvenli bölgesinde** (NVS / Secure Element) tutulmalı; debug log'a basılmamalı.
2. **Sadece HTTPS.** Düz HTTP üzerinden key gönderme.
3. **Sertifika doğrulama** açık olmalı (TLS root CA gömülü).
4. **Anahtar rotasyonu** desteklenmeli — OTA güncelleme veya bir konfigürasyon sayfası ile değiştirilebilmeli.

---

## 8. Bilinmesi Gereken Sınırlar

- Backend'de **tek bir slot** vardır. Bir tahmin fetch edildiğinde silinir; yeni `predict` çağrısı için yer açılır.
- Cihaz fetch ettikten sonra crash olursa **o prediction kaybolur.** Şu anki tasarım "at-most-once" delivery. Kritik üretim için ack-based mekanizma sonra eklenecektir (bkz. [architecture.md](./architecture.md) yol haritası).
- Backend cevabı `prediction: null` döndüğünde, bu hata değildir — sadece "henüz yeni tespit yok" demektir.

---

## 9. Telemetry (Opsiyonel ama Önerilir)

Cihaz, yerel log veya MQTT ile şunları yayımlayabilir:

- Kaç tahmin işlendi (sınıf bazında sayaç).
- Ortalama polling RTT.
- Son hata zamanları ve kodları.
- Wi-Fi sinyal kalitesi.

Bu telemetry backend API'sinin parçası değildir; ayrı bir toplama kanalı (örn. Influx, Grafana, basit syslog) kullanılır.

---

## 10. Test Kontrol Listesi

Cihazı sahaya almadan önce:

- [ ] Yanlış API key ile 401 alındığında polling durdu mu?
- [ ] `prediction: null` döndüğünde röle tetiklenmedi mi?
- [ ] Wi-Fi kesilip geri geldiğinde otomatik bağlanıyor mu?
- [ ] Backend offline iken backoff doğru artıyor mu?
- [ ] Beş `bin` değeri için doğru röle açılıyor mu?
- [ ] Kapak açma süresi (örn. 3 sn) sonunda röle güvenle kapanıyor mu?
- [ ] API key flash'ta plaintext değil mi?
- [ ] Firmware OTA ile güncellenebiliyor mu?
