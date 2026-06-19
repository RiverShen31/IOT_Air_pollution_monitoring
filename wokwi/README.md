# Giả lập thiết bị IoT bằng Wokwi (ESP32 + cảm biến ảo)

Thư mục này chứa một dự án **Wokwi** (https://wokwi.com) — trình giả lập vi điều khiển chạy
trên trình duyệt, biên dịch và chạy thật firmware C++ cho ESP32 (không cần phần cứng vật lý).
Đây là cách giả lập "giống thật" hơn `device-simulator/` (vốn chỉ là 1 script Node.js sinh số
ngẫu nhiên): ở đây có sơ đồ mạch (`diagram.json`), firmware thật (`sketch.ino`) dùng thư viện
`PubSubClient` y hệt khi nạp lên ESP32 thật, và cảm biến ảo có thể chỉnh giá trị trực tiếp
trên giao diện trong lúc chạy.

## Sơ đồ mạch (diagram.json)

- **ESP32 DevKit V1** — vi điều khiển chính
- **3 Potentiometer** (biến trở) nối vào chân ADC `D34`, `D35`, `D32` — giả lập điện áp ra của
  cảm biến **MQ135** (CO2/NH3), **MQ7** (CO), và **cảm biến bụi PM2.5** (GP2Y10). Xoay biến trở
  trong lúc mô phỏng đang chạy để thay đổi giá trị đọc được, giống như đưa cảm biến thật ra môi
  trường ô nhiễm hơn/sạch hơn.
- **DHT22** — cảm biến nhiệt độ/độ ẩm ảo, nối chân `D15`. Có thể chỉnh giá trị nhiệt độ/độ ẩm
  ngay trên UI của linh kiện trong Wokwi.
- **LED đỏ** nối chân `D2` qua điện trở 220Ω — sáng lên khi bất kỳ chỉ số nào vượt ngưỡng cảnh
  báo (mô phỏng đèn báo động gắn trên thiết bị thật).

## Cách chạy

1. Vào https://wokwi.com → đăng nhập (miễn phí) → **New Project** → chọn template **ESP32**.
2. Mở tab `diagram.json` của project mới tạo (biểu tượng sơ đồ mạch) → bật chế độ
   **"Edit as text"** (hoặc nút `{}`), xoá hết nội dung mặc định, dán nội dung file
   `wokwi/diagram.json` ở thư mục này vào.
3. Mở file `sketch.ino` của project → xoá hết, dán nội dung file `wokwi/sketch.ino`.
4. Mở (hoặc tạo) file `libraries.txt` trong project → dán nội dung file `wokwi/libraries.txt`
   (Wokwi sẽ tự tải các thư viện Arduino tương ứng trước khi build).
5. Bấm nút ▶️ (Play) màu xanh ở góc trên — Wokwi sẽ biên dịch firmware trong vài giây rồi chạy
   mô phỏng. Mở **Serial Monitor** (icon màn hình) để xem log kết nối WiFi/MQTT và dữ liệu được
   publish mỗi 5 giây.

## Hai chế độ vận hành

### Chế độ A — Demo nhanh (mặc định, không cần cấu hình gì thêm)

Firmware mặc định kết nối tới broker test công khai `test.mosquitto.org:1883` (không xác thực),
publish vào topic `devices/AQ-DEVICE-WOKWI-01/telemetry`. Phù hợp để kiểm tra nhanh firmware
chạy đúng (xem log Serial Monitor, hoặc dùng MQTT Explorer/`mosquitto_sub` để subscribe topic
đó từ máy của bạn) **mà không cần dựng backend/broker của đồ án**.

### Chế độ B — Tích hợp đầy đủ với backend & web dashboard của đồ án (qua HiveMQ Cloud)

Để dữ liệu từ Wokwi chạy thẳng vào MongoDB và hiển thị realtime trên web dashboard, trỏ firmware
vào broker **HiveMQ Cloud** — dịch vụ MQTT managed, miễn phí, **đã public sẵn trên Internet**
nên Wokwi (chạy trên cloud của họ) kết nối thẳng được, không cần ngrok hay expose gì từ máy bạn.
Xem hướng dẫn tạo cluster + credential đầy đủ ở [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)
(mục "Bước 2 — HiveMQ Cloud").

1. Tạo cluster HiveMQ Cloud + credential cho thiết bị `AQ-DEVICE-WOKWI-01` theo
   `docs/DEPLOYMENT.md` (nếu chưa làm).
2. Đảm bảo backend của đồ án đang chạy (local trỏ vào cùng HiveMQ Cloud, hoặc đã deploy lên
   Render) và đã tạo thiết bị `AQ-DEVICE-WOKWI-01` qua web app.
3. Trong `sketch.ino` trên Wokwi, sửa 4 dòng cấu hình (lưu ý đổi cả `MQTT_PORT` sang `8883` —
   code đã tự chuyển sang kết nối TLS `WiFiClientSecure` khi phát hiện port này):
   ```cpp
   const char *MQTT_HOST = "xxxxxxxx.s1.eu.hivemq.cloud"; // Cluster URL của bạn
   const int   MQTT_PORT = 8883;                          // TLS
   const char *MQTT_USER = "AQ-DEVICE-WOKWI-01";
   const char *MQTT_PASS = "<password credential đã tạo trên HiveMQ Cloud>";
   ```
4. Chạy lại mô phỏng (▶️) — dữ liệu sẽ xuất hiện realtime trên web dashboard (local
   `http://localhost:5173` hoặc URL Vercel nếu đã deploy), và đèn LED đỏ trong Wokwi sẽ sáng khi
   bạn xoay biến trở lên mức ô nhiễm cao (vượt ngưỡng cảnh báo cấu hình trong trang **Thiết bị**).

> **Lưu ý:** `diagram.json` được soạn thủ công theo đúng cấu trúc định dạng dự án Wokwi, nhưng
> nhãn chân (pin label) chính xác của từng linh kiện có thể lệch nhẹ tuỳ phiên bản thư viện
> linh kiện hiện tại trên Wokwi. Nếu sau khi dán vào mà sơ đồ mạch báo lỗi nối dây (dây đỏ/hiển
> thị cảnh báo), chỉ cần kéo-thả lại đúng chân trên giao diện đồ hoạ của Wokwi (kéo từ chân
> `SIG`/`VCC`/`GND` của từng linh kiện sang đúng chân `D34`/`D35`/`D32`/`D15`/`3V3`/`GND` trên
> board ESP32) — phần code `sketch.ino` không phụ thuộc vào việc vẽ dây, chỉ cần đúng số chân.

## Lên phần cứng thật

`sketch.ino` ở đây dùng đúng thư viện (`PubSubClient`, `DHT sensor library`, `ArduinoJson`) và
đúng giao thức/JSON schema mà một ESP32 thật gắn cảm biến MQ135/MQ7/GP2Y10/DHT11 thật sẽ dùng.
Để chuyển sang phần cứng thật chỉ cần: nạp file `sketch.ino` này lên board ESP32 thật qua
Arduino IDE, đổi `WIFI_SSID`/`WIFI_PASSWORD` thành mạng WiFi thật, và thay 3 lệnh
`analogRead(MQ135_PIN)`/`analogRead(MQ7_PIN)`/`analogRead(DUST_PIN)` bằng code đọc cảm biến
thật tương ứng (thường vẫn là `analogRead` trên đúng chân đã nối cảm biến).
