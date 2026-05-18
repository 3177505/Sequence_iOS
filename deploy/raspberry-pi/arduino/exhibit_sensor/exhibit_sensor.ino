#define SENSOR_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT);
}

void loop() {
  Serial.println(digitalRead(SENSOR_PIN));
  delay(20);
}
