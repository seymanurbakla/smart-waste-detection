/*
 * Smart Waste Detection — NodeMCU donanim test sketch'i
 *
 * Amac: Asil nodemcu.ino sketch'ini yuklemeden once 5 servonun
 *       dogru pinlerde ve dogru sirada donup donmedigini dogrulamak.
 *
 * Davranis: Her servo sirayla attach edilir, 90 dereceye gider,
 *           geri 0'a doner ve detach edilir. Bir tur bitince 3 sn
 *           bekleyip basa donulur. Ayni anda yalnizca BIR servo
 *           aktiftir (akim korumasi).
 *
 * Pinleme (asil nodemcu.ino ile ayni):
 *   blue   -> D1 (GPIO5)
 *   yellow -> D2 (GPIO4)
 *   green  -> D5 (GPIO14)
 *   gray   -> D6 (GPIO12)
 *   orange -> D7 (GPIO13)
 *
 * Board: NodeMCU 1.0 (ESP-12E Module)
 * Serial Monitor: 115200 baud
 */

#include <Servo.h>

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

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[TEST] servo donanim testi basliyor");
}

void loop() {
  for (size_t i = 0; i < BIN_COUNT; i++) {
    Serial.printf("[TEST] %s (GPIO%u) -> 90 derece\n", bins[i].name, bins[i].pin);
    bins[i].servo.attach(bins[i].pin);
    delay(20);             // PWM stabilize olsun
    bins[i].servo.write(90);
    delay(1500);           // acik kalma suresi
    bins[i].servo.write(0);
    delay(800);            // kapali konuma varma suresi
    bins[i].servo.detach();
    delay(500);            // bir sonrakine gecmeden nefes
  }
  Serial.println("[TEST] tur bitti, 3 sn sonra tekrar");
  delay(3000);
}
