/*
 * Smart Waste Detection — NodeMCU (ESP8266) firmware
 *
 * Rol: Tek beyin. 5 servonun TAMAMI bu cihazdan PWM ile surulur.
 *      Arduino Uno SADECE 3 servo icin 5V power supply'dir;
 *      Uno'ya kod yuklenmez, USB ile veya 9V jack ile beslenir.
 *
 * --- KONTROL SINYALLERI (hepsi NodeMCU GPIO -> servo signal teli) ---
 *   blue   -> D1 (GPIO5)    [NodeMCU beslemeli]
 *   yellow -> D2 (GPIO4)    [NodeMCU beslemeli]
 *   green  -> D5 (GPIO14)   [Uno beslemeli]
 *   gray   -> D6 (GPIO12)   [Uno beslemeli]
 *   orange -> D7 (GPIO13)   [Uno beslemeli]
 *
 * --- POWER ---
 *   Servo 5V (kirmizi)   <- NodeMCU Vin (USB 5V)  : blue, yellow
 *   Servo 5V (kirmizi)   <- Uno 5V pini           : green, gray, orange
 *   Servo GND (siyah)    <- ORTAK GND (asagi bak)
 *
 *   GND BAGLANTISI KRITIK:
 *     NodeMCU GND  ─┬─  Uno GND  ─┬─  tum servolarin GND'leri
 *     (Ayni nokta) ─┘             ─┘
 *   Servo PWM sinyali NodeMCU'dan cikiyor, gucu Uno'dan aliyorsa
 *   GND'ler birlestirilmezse servolar titrer veya hic donmez.
 *
 *   NodeMCU Vin (USB) genelde 500 mA verir; 2 kucuk servo (SG90 gibi)
 *   icin sinirda. Stall durumunda brown-out olabilir. Eger sorun
 *   yasarsan blue/yellow servolarini da Uno 5V'sine al, NodeMCU
 *   sadece sinyal versin.
 *
 * --- KUTUPHANELER (Library Manager) ---
 *   - ArduinoJson (v7+)
 *   - Servo (ESP8266 core ile gelir)
 *
 * --- BOARD ---
 *   Tools -> Board -> "NodeMCU 1.0 (ESP-12E Module)"
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Servo.h>

// ---- KULLANICI AYARLARI ----
const char* WIFI_SSID    = "SSID";
const char* WIFI_PASS    = "WIFI_PAROLA";
const char* BACKEND_URL  = "https://smartwaste.example.com/api/fetch-predictions";
const char* API_KEY      = "IOT_API_KEY_DEGERIN";
const uint32_t POLL_MS   = 1000;     // 1 sn
const uint32_t LID_OPEN_MS = 3000;   // kapak 3 sn acik kalsin
const uint32_t SERVO_SETTLE_MS = 400; // hareket bitince beklenecek sure (rahatca varsin)
const uint8_t  SERVO_CLOSED_DEG = 0;
const uint8_t  SERVO_OPEN_DEG   = 90;
// ----------------------------

struct Bin {
  const char* name;
  uint8_t     pin;
  Servo       servo;
};

Bin bins[] = {
  { "blue",   D1, Servo() },
  { "yellow", D2, Servo() },
  { "green",  D5, Servo() },
  { "gray",   D6, Servo() },
  { "orange", D7, Servo() },
};
const size_t BIN_COUNT = sizeof(bins) / sizeof(bins[0]);

uint32_t backoffMs = POLL_MS;

// AKIM KORUMASI: Ayni anda yalnizca BIR servo aktif olur.
//   - servoBusy flag'i: kod seviyesinde yeniden giris yasagi.
//   - attach/detach: aktif olmayan servolar PWM almaz; holding akim
//     cekmezler. 5 servonun ayni anda hareketi/holding'i fiziksel
//     olarak imkansiz. ~200-400 mA tek servo cekisi guvenli kalir.
bool servoBusy = false;

void moveBinClosedToOpenAndBack(Bin& b) {
  b.servo.attach(b.pin);
  // attach edildikten sonra kisa bir bekleme: kutuphane PWM uretmeye baslasin.
  delay(20);
  b.servo.write(SERVO_OPEN_DEG);
  delay(LID_OPEN_MS);
  b.servo.write(SERVO_CLOSED_DEG);
  delay(SERVO_SETTLE_MS);  // mekanik olarak kapali konuma varmasini bekle
  b.servo.detach();         // PWM durur, holding akim 0
}

void openBin(const char* name) {
  if (servoBusy) {
    Serial.printf("[BIN] mesgul, '%s' istegi reddedildi\n", name);
    return;
  }
  for (size_t i = 0; i < BIN_COUNT; i++) {
    if (strcmp(bins[i].name, name) == 0) {
      Serial.printf("[BIN] %s aciliyor (GPIO%u)\n", name, bins[i].pin);
      servoBusy = true;
      moveBinClosedToOpenAndBack(bins[i]);
      servoBusy = false;
      return;
    }
  }
  Serial.printf("[BIN] bilinmeyen bin: %s\n", name);
}

void connectWifi() {
  Serial.printf("[WiFi] %s'a baglaniliyor", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] OK, IP=%s\n", WiFi.localIP().toString().c_str());
}

// true: HTTP basarili (cevap parse edildi veya slot bos). false: tekrar dene.
bool fetchPrediction(String& outBin) {
  outBin = "";
  WiFiClientSecure client;
  // NOT: production'da setInsecure() yerine root CA gomulmelidir.
  client.setInsecure();

  HTTPClient https;
  https.setTimeout(8000);
  if (!https.begin(client, BACKEND_URL)) {
    Serial.println("[HTTP] begin basarisiz");
    return false;
  }
  https.addHeader("X-API-Key", API_KEY);

  int code = https.GET();
  if (code <= 0) {
    Serial.printf("[HTTP] hata: %s\n", https.errorToString(code).c_str());
    https.end();
    return false;
  }
  if (code == 401) {
    Serial.println("[HTTP] 401 — API key gecersiz");
    https.end();
    return false;
  }
  if (code != 200) {
    Serial.printf("[HTTP] beklenmeyen kod %d\n", code);
    https.end();
    return false;
  }

  String body = https.getString();
  https.end();

  JsonDocument doc;
  if (deserializeJson(doc, body)) {
    Serial.println("[JSON] parse hatasi");
    return false;
  }

  if (doc["prediction"].isNull()) return true;   // bos slot, hata degil
  const char* bin = doc["prediction"]["bin"];
  if (!bin) return true;
  outBin = bin;
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(200);

  // Acilista her servoyu sirayla CLOSED konumuna al, sonra detach.
  // Ayni anda yalnizca bir servo PWM aliyor olur.
  Serial.println("[INIT] servolar CLOSED konumuna aliniyor");
  for (size_t i = 0; i < BIN_COUNT; i++) {
    bins[i].servo.attach(bins[i].pin);
    delay(20);
    bins[i].servo.write(SERVO_CLOSED_DEG);
    delay(SERVO_SETTLE_MS);
    bins[i].servo.detach();
  }

  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] dustu, yeniden baglaniliyor");
    connectWifi();
  }

  String bin;
  bool ok = fetchPrediction(bin);

  if (ok) {
    backoffMs = POLL_MS;
    if (bin.length() > 0) openBin(bin.c_str());
  } else {
    backoffMs = min<uint32_t>(backoffMs * 2, 60000UL);  // 60 sn'ye kadar
    Serial.printf("[poll] backoff %u ms\n", backoffMs);
  }

  delay(backoffMs);
}
