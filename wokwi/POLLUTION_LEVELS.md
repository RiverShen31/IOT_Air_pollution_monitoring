# Đặt mức độ ô nhiễm cho các thiết bị Wokwi

Để thay đổi mức độ ô nhiễm hiển thị trên dashboard, sửa file `sketch.ino` trong mỗi thư mục thiết bị.

## 📋 Cách làm

Thêm hàm này vào file `sketch.ino` TRƯỚC hàm `setup()`:

```cpp
// Override sensor values for demo (customize per device)
void setPollutionLevel(float &co2, float &co, float &pm25) {
  // Chỉnh giá trị ở đây:
  co2 = 3000.0f;   // Muốn thay đổi → sửa số này
  co = 12.0f;      // Muốn thay đổi → sửa số này
  pm25 = 80.0f;    // Muốn thay đổi → sửa số này
}
```

Rồi thêm dòng này trong hàm `loop()` SAU khi đọc sensor:

```cpp
float co2 = readCO2ppm();
float co = readCOppm();
float pm25 = readPM25();
setPollutionLevel(co2, co, pm25);  // ← Thêm dòng này
float humidity = dht.readHumidity();
```

---

## 🎯 Giá trị đề xuất

### AQ-DEVICE-WOKWI-01: Hazardous (🔴 AQI > 300)
```cpp
co2 = 15000.0f;  // > 10000 ppm
co = 40.0f;      // > 30.4 ppm
pm25 = 350.0f;   // > 250.4 µg/m³
```

### AQ-DEVICE-WOKWI-02: Unhealthy (⚠️ AQI 101-200)
```cpp
co2 = 3000.0f;   // 2000-5000 ppm
co = 12.0f;      // 9.4-15.4 ppm
pm25 = 80.0f;    // 35.4-150.4 µg/m³
```

### AQ-DEVICE-WOKWI-03: Good (✅ AQI 0-50)
```cpp
// Để trống hoặc bỏ hàm setPollutionLevel() để dùng giá trị sensor thực
```

---

## 📊 Bảng tham chiếu AQI

| Level | AQI | Thang |
|-------|-----|-------|
| Good | 0-50 | ✅ |
| Moderate | 51-100 | 🟡 |
| Unhealthy | 101-200 | ⚠️ |
| Very Unhealthy | 201-300 | 🔴 |
| Hazardous | 301+ | ⛔ |

---

## 🔄 Sau khi sửa

1. Reload tab Wokwi (trình duyệt)
2. Chạy sketch
3. Xem dashboard để verify AQI mới

**Lưu ý:** Đặt pollution level trong hàm `setPollutionLevel()` sẽ **override** giá trị cảm biến thực
