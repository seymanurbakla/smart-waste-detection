/*
 * Smart Waste Detection - NodeMCU (ESP8266) firmware
 *
 * Rol: NodeMCU hem WiFi AP yayinlar hem servolari surer.
 *
 * Topoloji:
 *   - NodeMCU AP (SSID="SmartWasteDetection") -> 10.10.10.10/24
 *   - Laptop bu AP'ye baglanir, NodeMCU'nun DHCP'sinden 10.10.10.20 alir
 *     (DHCP havuzu tek IP'ye sabitlenmistir).
 *   - Backend laptop'ta uvicorn ile 0.0.0.0:8000'de calisir.
 *   - NodeMCU her saniye http://10.10.10.20:8000/fetch-predictions
 *     adresine GET atar, X-API-Key header'i ile authenticate olur.
 *
 * Servo pinleri (NodeMCU GPIO -> servo signal teli):
 *   blue   -> D1 (GPIO5)
 *   yellow -> D2 (GPIO4)
 *   green  -> D5 (GPIO14)
 *   gray   -> D6 (GPIO12)
 *   orange -> D7 (GPIO13)
 *
 * Akim korumasi: ayni anda yalnizca BIR servo attach edilir.
 * Diger 4 servo PWM almaz, holding akim cekmez.
 *
 * --- KUTUPHANELER ---
 *   - ArduinoJson (v7+)
 *   - Servo (ESP8266 core)
 *
 * --- BOARD ---
 *   Tools -> Board -> "NodeMCU 1.0 (ESP-12E Module)"
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <Servo.h>

extern "C" {
  #include "user_interface.h"   // wifi_softap_*, dhcps_lease
}

// ---- AP AYARLARI ----
const char* AP_SSID     = "SmartWasteDetection";
const char* AP_PASSWORD = "anan31sj";
const IPAddress AP_IP   (10, 10, 10, 10);
const IPAddress AP_GW   (10, 10, 10, 10);
const IPAddress AP_MASK (255, 255, 255, 0);
const uint8_t   AP_CHANNEL = 1;        // 1, 6, 11 yaygin secimler

// Laptop'a DHCP ile verilecek tek IP:
const IPAddress CLIENT_IP (10, 10, 10, 20);

// ---- BACKEND ----
const char* BACKEND_URL  = "http://10.10.10.20:8000/fetch-predictions";
const char* API_KEY      = "local-dev-iot-key-not-for-prod";

// ---- DAVRANIS ----
const uint32_t POLL_MS         = 1000;
const uint32_t LID_OPEN_MS     = 3000;
const uint32_t SERVO_SETTLE_MS = 400;
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

bool servoBusy = false;
uint32_t backoffMs = POLL_MS;
uint32_t pollCount = 0;
uint8_t  lastStationNum = 0;

// --- Servo kontrol ---

void moveBinClosedToOpenAndBack(Bin& b) {
  b.servo.attach(b.pin);
  delay(20);
  b.servo.write(SERVO_OPEN_DEG);
  delay(LID_OPEN_MS);
  b.servo.write(SERVO_CLOSED_DEG);
  delay(SERVO_SETTLE_MS);
  b.servo.detach();
}

void openBin(const char* name) {
  if (servoBusy) {
    Serial.printf("[BIN] mesgul, '%s' istegi reddedildi\r\n", name);
    return;
  }
  for (size_t i = 0; i < BIN_COUNT; i++) {
    if (strcmp(bins[i].name, name) == 0) {
      Serial.printf("[BIN] %s aciliyor (GPIO%u)\r\n", name, bins[i].pin);
      servoBusy = true;
      moveBinClosedToOpenAndBack(bins[i]);
      servoBusy = false;
      return;
    }
  }
  Serial.printf("[BIN] bilinmeyen bin: %s\r\n", name);
}

// --- AP + DHCP kurulumu ---

void setupAccessPoint() {
  Serial.println("[AP] mod ayarlaniyor");
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_GW, AP_MASK);

  bool ok = WiFi.softAP(AP_SSID, AP_PASSWORD, AP_CHANNEL);
  if (!ok) {
    Serial.println("[AP] softAP basarisiz, restart");
    delay(2000);
    ESP.restart();
  }

  // DHCP havuzunu tek IP'ye sabitle: 10.10.10.20
  struct dhcps_lease lease;
  lease.enable = true;
  IP4_ADDR(&lease.start_ip, 10, 10, 10, 20);
  IP4_ADDR(&lease.end_ip,   10, 10, 10, 20);
  wifi_softap_dhcps_stop();
  if (!wifi_softap_set_dhcps_lease(&lease)) {
    Serial.println("[AP] DHCP lease ayari basarisiz");
  }
  wifi_softap_dhcps_start();

  Serial.printf("[AP] SSID=%s\r\n", AP_SSID);
  Serial.printf("[AP] IP=%s\r\n", WiFi.softAPIP().toString().c_str());
  Serial.printf("[AP] Client'a verilecek IP=%s\r\n", CLIENT_IP.toString().c_str());
}

// --- HTTP polling ---

// Station sayisi degisirse log bas.
void logStationChange() {
  uint8_t n = WiFi.softAPgetStationNum();
  if (n != lastStationNum) {
    Serial.printf("[AP] station sayisi %u -> %u\r\n", lastStationNum, n);
    lastStationNum = n;
  }
}

// true: HTTP basarili (cevap parse edildi veya slot bos). false: tekrar dene.
bool fetchPrediction(String& outBin) {
  outBin = "";
  pollCount++;

  uint8_t stations = WiFi.softAPgetStationNum();
  Serial.printf("[poll #%u] uptime=%lu ms, stations=%u, free heap=%u\r\n",
                pollCount, millis(), stations, ESP.getFreeHeap());

  if (stations == 0) {
    Serial.println("[poll] -> bagli client yok, istek atilmadi");
    return false;
  }

  Serial.printf("[poll] -> GET %s\r\n", BACKEND_URL);

  WiFiClient client;
  HTTPClient http;
  http.setTimeout(5000);

  uint32_t t0 = millis();
  if (!http.begin(client, BACKEND_URL)) {
    Serial.println("[HTTP] begin basarisiz");
    return false;
  }
  http.addHeader("X-API-Key", API_KEY);
  Serial.println("[HTTP] header eklendi (X-API-Key)");

  int code = http.GET();
  uint32_t dt = millis() - t0;
  Serial.printf("[HTTP] response: code=%d, sure=%lu ms\r\n", code, dt);

  if (code <= 0) {
    Serial.printf("[HTTP] hata: %s\r\n", http.errorToString(code).c_str());
    http.end();
    return false;
  }
  if (code == 401) {
    Serial.println("[HTTP] 401 - API key gecersiz");
    http.end();
    return false;
  }
  if (code != 200) {
    Serial.printf("[HTTP] beklenmeyen kod %d\r\n", code);
    String body = http.getString();
    Serial.printf("[HTTP] body: %s\r\n", body.c_str());
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();
  Serial.printf("[HTTP] 200 OK, body=%s\r\n", body.c_str());

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[JSON] parse hatasi: %s\r\n", err.c_str());
    return false;
  }

  if (doc["prediction"].isNull()) {
    Serial.println("[JSON] prediction=null (slot bos)");
    return true;
  }
  const char* bin = doc["prediction"]["bin"];
  if (!bin) {
    Serial.println("[JSON] prediction var ama bin alani yok");
    return true;
  }
  Serial.printf("[JSON] bin=%s\r\n", bin);
  outBin = bin;
  return true;
}

// --- setup / loop ---

void setup() {
  Serial.begin(9600);
  delay(200);

  // Servolari sirayla CLOSED konumuna al, sonra detach.
  Serial.println("[INIT] servolar CLOSED konumuna aliniyor");
  for (size_t i = 0; i < BIN_COUNT; i++) {
    bins[i].servo.attach(bins[i].pin);
    delay(20);
    bins[i].servo.write(SERVO_CLOSED_DEG);
    delay(SERVO_SETTLE_MS);
    bins[i].servo.detach();
  }

  setupAccessPoint();
}

void loop() {
  logStationChange();

  String bin;
  bool ok = fetchPrediction(bin);

  if (ok) {
    backoffMs = POLL_MS;
    if (bin.length() > 0) {
      Serial.printf("[loop] bin '%s' islenecek\r\n", bin.c_str());
      openBin(bin.c_str());
    }
  } else {
    // Debug sirasinda backoff'u kucuk tut (max 5 sn) — uretimde 60 sn'ydi.
    backoffMs = min<uint32_t>(backoffMs * 2, 5000UL);
    Serial.printf("[loop] basarisiz, sonraki polling %u ms sonra\r\n", backoffMs);
  }

  Serial.printf("[loop] %u ms uyuyor\r\n\r\n", backoffMs);
  delay(backoffMs);
}
