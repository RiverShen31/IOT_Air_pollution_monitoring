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
#include <time.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <mbedtls/md.h> // HMAC-SHA256, đã có sẵn trong ESP32 core (dùng nội bộ bởi WiFiClientSecure)

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

// Tuỳ chọn (chế độ B): điền hmacSecret trả về từ response.provisioning.hmacSecret của
// POST /api/devices để bật ký HMAC-SHA256 cho payload — backend verify chống giả mạo dữ liệu
// (xem isValidSignature trong backend/src/services/mqttIngestService.js). Để trống = không ký.
const char *DEVICE_HMAC_SECRET = "";

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

// ESP32 không có RTC pin sẵn, sau khi boot đồng hồ hệ thống bắt đầu từ epoch 0 — nếu dùng
// millis()/1000 làm "ts" thì backend sẽ tính ra ngày 1970 (lệch hàng chục năm so với giờ thật),
// bị chặn bởi kiểm tra "freshness window" (±5 phút) trong ingestTelemetry() và mọi reading sẽ
// bị âm thầm reject. Đồng bộ giờ thật qua NTP ngay sau khi có WiFi để lấy đúng epoch giây thật.
void syncTimeViaNTP() {
  Serial.print("Syncing time via NTP");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  time_t now = time(nullptr);
  while (now < 100000) { // chưa sync xong thì time() vẫn trả về giá trị rất nhỏ (gần epoch 0)
    delay(300);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.printf(" done, epoch=%lu\n", (unsigned long)now);
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
// Thêm noise nhỏ (±8%) để mô phỏng cảm biến thật có biến động tự nhiên

float readCO2ppm() {
  int raw = analogRead(MQ135_PIN);
  float base = (float)map(raw, 0, 4095, 400, 2000);
  float noise = (random(-8, 9)) / 100.0f; // ±8%
  return base * (1.0f + noise);
}

float readCOppm() {
  int raw = analogRead(MQ7_PIN);
  float base = (raw / 4095.0f) * 50.0f;
  float noise = (random(-8, 9)) / 100.0f;
  return base * (1.0f + noise);
}

float readPM25() {
  int raw = analogRead(DUST_PIN);
  float base = (raw / 4095.0f) * 300.0f;
  float noise = (random(-8, 9)) / 100.0f;
  return base * (1.0f + noise);
}

// Áp dụng tình trạng ô nhiễm theo deviceId (để demo ngưỡng cảnh báo)
void applyPollutionScenario(float &co2, float &co, float &pm25) {
  if (strcmp(DEVICE_ID, "AQ-DEVICE-WOKWI-01") == 0) {
    // Hazardous (AQI > 300)
    co2 = 15000.0f;
    co = 40.0f;
    pm25 = 350.0f;
  } else if (strcmp(DEVICE_ID, "AQ-DEVICE-WOKWI-02") == 0) {
    // Unhealthy (AQI 101-200)
    co2 = 3000.0f;
    co = 12.0f;
    pm25 = 80.0f;
  }
  // AQ-DEVICE-WOKWI-03 giữ nguyên (Good)
}

// Ký HMAC-SHA256 chuỗi canonical, ghi ra outHex dạng hex 64 ký tự (khớp
// crypto.createHmac('sha256', key).update(canonical).digest('hex') phía backend Node.js).
void hmacSha256Hex(const char *key, const char *msg, char *outHex) {
  unsigned char hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char *)key, strlen(key));
  mbedtls_md_hmac_update(&ctx, (const unsigned char *)msg, strlen(msg));
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  for (int i = 0; i < 32; i++) {
    sprintf(outHex + i * 2, "%02x", hmacResult[i]);
  }
  outHex[64] = '\0';
}

void setup() {
  Serial.begin(115200);
  pinMode(ALERT_LED, OUTPUT);
  dht.begin();
  randomSeed(analogRead(0)); // seed cho random noise

  snprintf(telemetryTopic, sizeof(telemetryTopic), "devices/%s/telemetry", DEVICE_ID);
  snprintf(statusTopic, sizeof(statusTopic), "devices/%s/status", DEVICE_ID);

  setupMqttTransport();
  connectWiFi();
  syncTimeViaNTP();
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
    applyPollutionScenario(co2, co, pm25);
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();
    if (isnan(humidity) || isnan(temperature)) {
      humidity = 0;
      temperature = 0;
    }

    uint32_t tsEpoch = (uint32_t)time(nullptr); // epoch giây thật (đã sync NTP ở setup()), backend chấp nhận epoch giây hoặc ISO string

    StaticJsonDocument<512> doc;
    doc["ts"] = tsEpoch;
    doc["co2_ppm"] = co2;
    doc["co_ppm"] = co;
    doc["pm25_ugm3"] = pm25;
    doc["temperature_c"] = temperature;
    doc["humidity_pct"] = humidity;

    if (strlen(DEVICE_HMAC_SECRET) > 0) {
      // Chuỗi canonical phải khớp chính xác buildCanonicalString() trong
      // backend/src/services/mqttIngestService.js: deviceId|ts|co2|co|pm25|temp|humidity,
      // mỗi số làm tròn 1 chữ số thập phân (%.1f khớp JS .toFixed(1)).
      char canonical[200];
      snprintf(canonical, sizeof(canonical), "%s|%lu|%.1f|%.1f|%.1f|%.1f|%.1f",
               DEVICE_ID, (unsigned long)tsEpoch, co2, co, pm25, temperature, humidity);
      char sigHex[65];
      hmacSha256Hex(DEVICE_HMAC_SECRET, canonical, sigHex);
      doc["sig"] = sigHex;
    }

    char payload[512];
    size_t len = serializeJson(doc, payload);
    mqtt.publish(telemetryTopic, payload, len);

    bool alert = (co2 > 1500) || (co > 35) || (pm25 > 150);
    digitalWrite(ALERT_LED, alert ? HIGH : LOW);

    Serial.print("Published -> ");
    Serial.println(payload);
  }
}
