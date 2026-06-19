// Firmware giả lập thiết bị IoT đo chất lượng không khí, chạy trong trình giả lập Wokwi
// (https://wokwi.com) trên board ESP32 DevKit V1.
//
// Đây là bản "phần cứng giả lập" song song với device-simulator/simulate.js (Node.js):
// - simulate.js: giả lập thuần phần mềm, sinh số ngẫu nhiên, chạy trên máy tính.
// - sketch.ino (file này): firmware C++ THẬT, biên dịch & chạy trong trình mô phỏng vi điều
//   khiển Wokwi, đọc giá trị từ các biến trở (giả lập MQ135/MQ7/cảm biến bụi) và cảm biến
//   DHT22 ảo, kết nối WiFi + MQTT giống hệt một ESP32 thật ngoài đời. Có thể nạp thẳng lên
//   ESP32 thật, chỉ cần đổi giá trị đọc từ potentiometer (analogRead) bằng cảm biến thật.
//
// Cách chạy: xem wokwi/README.md

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ================== CẤU HÌNH ==================

// "Wokwi-GUEST" là mạng WiFi ảo do Wokwi cung cấp, có Internet thật (qua proxy của Wokwi).
// Khi nạp lên ESP32 thật, đổi thành WiFi thật của bạn.
const char *WIFI_SSID = "Wokwi-GUEST";
const char *WIFI_PASSWORD = "";

// ---- Chế độ A (mặc định): demo nhanh, publish lên broker test công khai, KHÔNG cần hạ tầng
//      riêng, không xác thực, không mã hoá (port 1883). Dùng để xem nhanh log Serial Monitor
//      + verify bằng MQTT Explorer.
// ---- Chế độ B: tích hợp đầy đủ với backend của đồ án (đẩy data vào MongoDB + hiện lên web
//      dashboard) qua broker HiveMQ Cloud (miễn phí, đã public sẵn trên Internet — KHÔNG cần
//      ngrok). HiveMQ Cloud bắt buộc TLS (port 8883), code bên dưới tự chuyển sang
//      WiFiClientSecure khi MQTT_PORT == 8883. Xem hướng dẫn lấy host/port/user/pass trong
//      docs/DEPLOYMENT.md (mục HiveMQ Cloud) và wokwi/README.md.
const char *MQTT_HOST = "test.mosquitto.org"; // Chế độ B: đổi thành "<cluster-id>.s1.eu.hivemq.cloud"
const int MQTT_PORT = 1883;                   // Chế độ B: đổi thành 8883 (TLS)
const char *MQTT_USER = "";                   // Chế độ B: điền mqttUsername của thiết bị (HiveMQ credential)
const char *MQTT_PASS = "";                   // Chế độ B: điền mqttPassword của thiết bị (HiveMQ credential)

const char *DEVICE_ID = "AQ-DEVICE-WOKWI-01"; // Phải khớp deviceId đã tạo qua API backend (chế độ B)

#define DHTPIN 15
#define DHTTYPE DHT22
#define MQ135_PIN 34 // giả lập cảm biến CO2/NH3
#define MQ7_PIN 35   // giả lập cảm biến CO
#define DUST_PIN 32  // giả lập cảm biến bụi mịn PM2.5
#define ALERT_LED 2

const unsigned long PUBLISH_INTERVAL_MS = 5000;

// ================== KHỞI TẠO ==================

DHT dht(DHTPIN, DHTTYPE);
WiFiClient plainClient;
WiFiClientSecure secureClient;
PubSubClient mqtt;

char telemetryTopic[64];
char statusTopic[64];
unsigned long lastPublish = 0;

// Chọn transport theo port: 8883 = TLS (HiveMQ Cloud), còn lại = TCP thường (broker test).
// secureClient.setInsecure() bỏ qua việc xác thực chứng chỉ server (chấp nhận được cho mục
// đích mô phỏng/đồ án học thuật; production thật nên pin đúng CA cert của HiveMQ).
void setupMqttTransport() {
  if (MQTT_PORT == 8883) {
    secureClient.setInsecure();
    mqtt.setClient(secureClient);
  } else {
    mqtt.setClient(plainClient);
  }
}

void connectWiFi() {
  Serial.printf("Connecting to WiFi \"%s\" ...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.printf("\nWiFi connected. IP: %s\n", WiFi.localIP().toString().c_str());
}

void connectMQTT() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  while (!mqtt.connected()) {
    Serial.printf("Connecting MQTT %s:%d ...", MQTT_HOST, MQTT_PORT);
    String clientId = String("esp32-") + DEVICE_ID;
    bool ok;

    if (strlen(MQTT_USER) > 0) {
      ok = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, statusTopic, 1, true, "offline");
    } else {
      ok = mqtt.connect(clientId.c_str(), statusTopic, 1, true, "offline");
    }

    if (ok) {
      Serial.println(" connected.");
      mqtt.publish(statusTopic, "online", true);
    } else {
      Serial.printf(" failed, rc=%d. Retry in 2s...\n", mqtt.state());
      delay(2000);
    }
  }
}

// ---- Đọc cảm biến giả lập (potentiometer 0-4095 trên ADC ESP32) ----

float readCO2ppm() {
  int raw = analogRead(MQ135_PIN);
  return (float)map(raw, 0, 4095, 400, 2000); // quy đổi sang ppm (giống dải đo MQ135 thực tế)
}

float readCOppm() {
  int raw = analogRead(MQ7_PIN);
  return (raw / 4095.0f) * 50.0f; // 0-50 ppm
}

float readPM25() {
  int raw = analogRead(DUST_PIN);
  return (raw / 4095.0f) * 300.0f; // 0-300 ug/m3
}

void setup() {
  Serial.begin(115200);
  pinMode(ALERT_LED, OUTPUT);
  dht.begin();

  snprintf(telemetryTopic, sizeof(telemetryTopic), "devices/%s/telemetry", DEVICE_ID);
  snprintf(statusTopic, sizeof(statusTopic), "devices/%s/status", DEVICE_ID);

  setupMqttTransport();
  connectWiFi();
  connectMQTT();
}

void loop() {
  if (!mqtt.connected()) {
    connectMQTT();
  }
  mqtt.loop();

  if (millis() - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = millis();

    float co2 = readCO2ppm();
    float co = readCOppm();
    float pm25 = readPM25();
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();
    if (isnan(humidity) || isnan(temperature)) {
      humidity = 0;
      temperature = 0;
    }

    StaticJsonDocument<256> doc;
    doc["ts"] = (uint32_t)(millis() / 1000); // backend chấp nhận epoch giây hoặc ISO string
    doc["co2_ppm"] = co2;
    doc["co_ppm"] = co;
    doc["pm25_ugm3"] = pm25;
    doc["temperature_c"] = temperature;
    doc["humidity_pct"] = humidity;

    char payload[256];
    size_t len = serializeJson(doc, payload);
    mqtt.publish(telemetryTopic, payload, len);

    bool alert = (co2 > 1500) || (co > 35) || (pm25 > 150);
    digitalWrite(ALERT_LED, alert ? HIGH : LOW);

    Serial.print("Published -> ");
    Serial.println(payload);
  }
}
