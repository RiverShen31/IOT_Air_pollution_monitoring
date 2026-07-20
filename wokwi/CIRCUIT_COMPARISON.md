# 📊 So sánh Mạch Wokwi vs Arduino Thật

## 🟦 WOKWI (Mô phỏng - AQ-DEVICE-WOKWI-01/02/03)

### Bộ phận chính:
```
ESP32 DevKit V1 (MCU chính)
├── 3 Potentiometer (giả lập 3 cảm biến khí)
│   ├── POT_MQ135 (pin D34) → CO2 equivalent
│   ├── POT_MQ7 (pin D35) → CO
│   └── POT_DUST (pin D32) → PM2.5
├── DHT22 (pin D15) → Temperature + Humidity
├── Red LED + 220Ω resistor (pin D2) → Alert indicator
└── Serial Monitor (USB) → Debug output
```

### Sơ đồ kết nối Wokwi:
```
┌─────────────────────────────────────────┐
│          ESP32 DevKit V1                │
│  (Board với WiFi, MQTT ready)           │
└─────────────────────────────────────────┘
        │          │          │           │
   D34  │      D35 │     D32  │      D15  │  D2
   (ADC)│     (ADC)│    (ADC) │    (DHT) │(GPIO)
        │          │          │           │
    ┌───┴──┐   ┌───┴──┐   ┌───┴──┐   ┌───┴────┐   ┌─────┐
    │ POT  │   │ POT  │   │ POT  │   │ DHT22  │   │ LED │
    │MQ135 │   │ MQ7  │   │DUST  │   │        │   │+220Ω│
    └──┬───┘   └──┬───┘   └──┬───┘   └────┬───┘   └──┬──┘
       │(0-3.3V)  │(0-3.3V) │(0-3.3V)     │(1-wire) │(0-5V)
    ┌──┴────────────┴────────────┴──────────────┼───┴──┐
    │         VCC (3.3V rail)                   │      │
    │         GND (Ground rail)              ALERT   GND
    └──────────────────────────────────────────┘
```

### Nguyên lý hoạt động Potentiometer:
```
Potentiometer (variable resistor):
├─ VCC → 3.3V (từ ESP32)
├─ GND → Ground
└─ SIG → ADC pin (D32/D34/D35)

Khi quay trục:
  - Tay quay ← → Điện trở thay đổi (0Ω ~ 100kΩ)
  - Điện thế SIG thay đổi (0V ~ 3.3V)
  - ADC đọc (0 ~ 4095 tương ứng 0V ~ 3.3V)
  - Sketch map ADC → PPM

Ví dụ:
  Quay tay tay = ADC 0 = 0V = CO2: 400 ppm (sạch)
  Quay tay lên = ADC 2048 = 1.65V = CO2: 1200 ppm (trung bình)
  Quay tay tối đa = ADC 4095 = 3.3V = CO2: 2000 ppm (bẩn)
```

---

## 🟨 ARDUINO THẬT (Lam.ino)

### Bộ phận chính:
```
Arduino UNO / Mega (MCU chính)
├── MQ135 Sensor (pin A0) → Cảm biến CO2 thật
│   └── Datasheet: non-dispersive infrared (NDIR) gas sensor
├── ESP8266 (SoftwareSerial: RX=D9, TX=D10)
│   └── Kết nối WiFi → gửi dữ liệu lên
├── LCD 16x2 (pins 12,11,5,4,3,2) → Hiển thị
├── Buzzer (pin 8) → Báo thí
└── Serial Monitor (UART, baud 115200)
```

### Sơ đồ kết nối Arduino Thật:
```
┌──────────────────────────────────────┐
│      Arduino UNO/Mega                │
│   (8-bit MCU, UART chính)            │
└──────────────────────────────────────┘
        │       │       │       │       │
   A0   │   D9  │  D10  │   D8  │   D2-D5,D11,D12
  (ADC) │  (RX) │  (TX) │ (GPIO)│  (GPIO)
        │       │       │       │       │
   ┌────┴────┐  │   ┌───┴─────┐ │  ┌────┴──────┐
   │  MQ135  │  │   │ ESP8266 │ │  │ LCD 16x2  │
   │ Sensor  │  │   │ WiFi    │ │  │           │
   └────┬────┘  │   └───┬─────┘ │  └────┬──────┘
  (0-5V)│       │       │       │       │
        │       └───────┼───────┘   ┌───┴───┐
        │               │         │ Buzzer │
        │               │         └───┬───┘
   ┌────┴────────────────┼─────────────┴──────┐
   │   VCC (5V)          │   GND (Ground)      │
   │   (từ USB/Adapter)  │                     │
   └─────────────────────┴─────────────────────┘
```

### Nguyên lý hoạt động MQ135 thật:
```
MQ135 Gas Sensor (thật):
├─ VCC → 5V
├─ GND → Ground
└─ AOUT → ADC pin (A0)

Cảm biến hoạt động:
  1. Nung nóng heater (~200°C)
  2. Khí vào → lên tiếp xúc cảm biến
  3. Nếu có chất ô nhiễm (CO2, CO, NH3, ...)
     → Điện trở Rs giảm
     → Điện áp output giảm
     → ADC đọc giảm
  4. Sketch tính PPM từ Rs/Ro ratio

Công thức MQ135 library:
  PPM = A * (Rs/Ro)^(-B)
  
  Với:
  - Rs = điện trở cảm biến (tính từ voltage)
  - Ro = điện trở ở không khí sạch (calibration)
  - A, B = hằng số từ datasheet
```

---

## 📋 So sánh Chi Tiết

| Tiêu chí | **Wokwi (Mô phỏng)** | **Arduino Thật (Lam.ino)** |
|----------|---|---|
| **MCU** | ESP32 DevKit V1 (32-bit, WiFi built-in) | Arduino UNO (8-bit, no WiFi) |
| **Cảm biến CO2** | Potentiometer giả lập (0-3.3V) | MQ135 thật (0-5V, dạng analog) |
| **Cảm biến CO** | Potentiometer giả lập (D35) | Không có (chỉ có MQ135) |
| **Cảm biến PM2.5** | Potentiometer giả lập (D32) | Không có (chỉ có MQ135) |
| **Temp/Humidity** | DHT22 (thật, on board) | Không có (không nạp code DHT) |
| **WiFi/MQTT** | Built-in (WiFiClientSecure) | ESP8266 + SoftwareSerial (external) |
| **Networking** | Trực tiếp WiFi → HiveMQ Cloud | Qua ESP8266 → (local AP mode) |
| **Serial Output** | USB (native ESP32) | UART 115200 (Arduino native) |
| **Độ chính xác** | ± 10% (tuỳ vị trí potentiometer) | ± 5-10% (MQ135 datasheet) |
| **Calibration** | Quay tay potentiometer | Cần calibrate Ro (clean air reference) |
| **Giá thành** | ~$10 (mô phỏng free) | ~$50-100 (cảm biến thật) |
| **Tài nguyên** | 520KB RAM, 4MB Flash | 2KB RAM, 32KB Flash |

---

## 🔌 Kết nối Pin So sánh

### Wokwi (ESP32):
```
D34 (ADC) ← POT_MQ135 (CO2)
D35 (ADC) ← POT_MQ7 (CO)
D32 (ADC) ← POT_DUST (PM2.5)
D15 (DHT) ← DHT22 (Temp+Humidity)
D2 (GPIO) → Red LED (Alert)
```

### Arduino (UNO):
```
A0 (ADC) ← MQ135 (CO2 only)
D9 (RX) ← ESP8266 TX
D10 (TX) → ESP8266 RX
D8 (GPIO) → Buzzer
D2-5, D11-12 → LCD 16x2
```

---

## 💡 Tại sao Wokwi có 5 thông số nhưng Arduino chỉ có 1?

### Wokwi:
- ✅ 3 potentiometer → 3 chất ô nhiễm (CO2, CO, PM2.5)
- ✅ DHT22 → Temperature + Humidity
- = **5 thông số đầy đủ**

### Arduino Lam.ino:
- ✅ 1 MQ135 → chỉ CO2 equivalent
- ❌ Không có MQ7 (CO sensor)
- ❌ Không có bụi (PM2.5 sensor)
- ❌ Không có DHT (Temp/Humidity)
- = **1 thông số duy nhất (CO2)**

---

## 🛠️ Cách nâng cấp Arduino để như Wokwi:

```cpp
// Thêm libraries
#include "MQ7.h"       // CO sensor
#include "DHT.h"       // Temperature/Humidity
#include "MQ135.h"     // Đã có

// Thêm khai báo pins
#define MQ135_PIN A0   // Hiện có
#define MQ7_PIN A1     // Thêm mới
#define DUST_PIN A2    // Thêm mới (analog dust sensor)
#define DHT_PIN 6      // Thêm mới
#define DHTTYPE DHT11

// Thêm khai báo objects
MQ135 mq135(MQ135_PIN);
MQ7 mq7(MQ7_PIN);
DHT dht(DHT_PIN, DHTTYPE);

// Trong updateSensor():
void updateSensor() {
  float co2 = mq135.getPPM();
  float co = mq7.getPPM();
  float pm25 = readDustSensor();  // cảm biến bụi
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  // In serial để serial reader parse
  Serial.print("[MQ135] Air Quality: ");
  Serial.println(co2);
  Serial.print("[MQ7] CO: ");
  Serial.println(co);
  // ... etc
}
```

---

## 📌 Kết luận:

| | **Wokwi** | **Arduino Thật** |
|---|---|---|
| **Mục đích** | Demo/kiểm tra logic (toàn bộ stack) | Kiểm tra hardware thực tế |
| **Chi phí** | 0 (free online) | ~$100 (cảm biến + board) |
| **Số cảm biến** | 5 (đầy đủ) | 1 (giới hạn) |
| **Hiệu suất** | Nhanh (mô phỏng) | Thực tế (sensor thật) |
| **Kết nối** | WiFi native | qua ESP8266 |

**Wokwi tốt cho testing**, **Arduino thật tốt cho deployment**! 🚀
