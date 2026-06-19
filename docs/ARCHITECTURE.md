# Kiến trúc hệ thống — IoT Air Pollution Monitoring

Dự án lấy ý tưởng nghiệp vụ từ bài [IoT Air Pollution Monitoring using Arduino](https://circuitdigest.com/microcontroller-projects/iot-air-pollution-monitoring-using-arduino)
(đo CO2/khí gas bằng MQ135, CO bằng MQ7, bụi mịn PM2.5, nhiệt độ/độ ẩm bằng DHT11) nhưng được
thiết kế lại theo kiến trúc IoT 4 lớp chuẩn (Device → Connectivity → Backend → Application),
có bổ sung các cơ chế bảo mật ở từng lớp thay vì đẩy thẳng dữ liệu lên Blynk Cloud như bản gốc.

Ở giai đoạn hiện tại, lớp Device được **giả lập bằng phần mềm** (Node.js script) thay vì
Arduino/ESP8266 thật, để có thể phát triển và kiểm thử toàn bộ hệ thống mà không cần phần cứng.
Toàn bộ giao thức/cấu trúc dữ liệu được thiết kế sao cho sau này chỉ cần thay script giả lập
bằng firmware ESP32/ESP8266 thật (dùng cùng thư viện PubSubClient/MQTT) là hệ thống vẫn chạy
được nguyên vẹn.

## 1. Sơ đồ kiến trúc tổng quan

```
 ┌──────────────────────────┐
 │   DEVICE LAYER            │   Thiết bị IoT (hiện tại: giả lập phần mềm)
 │                            │   - Cảm biến: MQ135 (CO2/NH3), MQ7 (CO),
 │  device-simulator/         │     GP2Y10 (PM2.5 bụi mịn), DHT11 (nhiệt độ/độ ẩm)
 │  simulate.js               │   - Vi điều khiển (sau này): ESP32 / ESP8266 / Arduino+WiFi
 │                            │   - Mỗi thiết bị có deviceId + mật khẩu MQTT riêng
 └─────────────┬─────────────┘
               │ MQTT over TCP (mqtts trong production), publish mỗi 5s
               │ topic: devices/{deviceId}/telemetry  (QoS 1)
               │ topic: devices/{deviceId}/status      (LWT - last will)
               ▼
 ┌──────────────────────────┐
 │  CONNECTIVITY LAYER       │   Eclipse Mosquitto MQTT Broker (Docker container)
 │                            │   - Xác thực bằng username/password (password_file)
 │  mosquitto/                │   - Phân quyền bằng ACL: mỗi device chỉ được publish
 │                            │     vào đúng topic devices/{deviceId}/#  của chính nó
 │                            │   - Backend subscribe với quyền đọc toàn bộ devices/#
 └─────────────┬─────────────┘
               │ Backend subscribe topic devices/+/telemetry
               ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  BACKEND LAYER (Node.js + Express)                            │
 │                                                                  │
 │  ┌────────────────┐   ┌─────────────────┐   ┌────────────────┐│
 │  │ MQTT Ingest     │   │ REST API         │   │ WebSocket       ││
 │  │ Service         │   │ (JWT/API-Key)    │   │ (Socket.IO)     ││
 │  │ - validate      │   │ /api/auth/*      │   │ - đẩy dữ liệu   ││
 │  │ - tính AQI       │   │ /api/devices/*   │   │   realtime cho  ││
 │  │ - lưu Mongo      │   │ /api/readings/*  │   │   web sau khi   ││
 │  │ - kiểm tra       │   │                   │   │   ingest xong   ││
 │  │   ngưỡng cảnh báo│   │                   │   │                 ││
 │  └───────┬─────────┘   └────────┬─────────┘   └────────┬───────┘│
 │          │                       │                        │       │
 │          └───────────┬───────────┴────────────────────────┘       │
 │                       ▼                                            │
 │              ┌─────────────────┐                                  │
 │              │   MongoDB         │  Users, Devices, Readings,      │
 │              │   (Mongoose)       │  RefreshTokens, Alerts          │
 │              └─────────────────┘                                  │
 └─────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS REST (JWT Bearer) + WSS (Socket.IO, JWT handshake)
                                ▼
 ┌──────────────────────────┐
 │  APPLICATION LAYER        │   Web App (React + Vite)
 │                            │   - Đăng ký / Đăng nhập (JWT access + refresh token)
 │  web/                      │   - Dashboard realtime (gauge, chart) qua Socket.IO
 │                            │   - Quản lý thiết bị, xem lịch sử, cấu hình ngưỡng cảnh báo
 └──────────────────────────┘
```

## 2. Mô tả các thành phần & công nghệ sử dụng

| Lớp | Thành phần | Công nghệ | Vai trò |
|---|---|---|---|
| Device | Thiết bị cảm biến | (Giả lập) Node.js `device-simulator/simulate.js`. Thực tế: ESP32/ESP8266 + MQ135 + MQ7 + GP2Y10 + DHT11 | Sinh / đọc dữ liệu cảm biến, đóng gói JSON, publish lên broker |
| Connectivity | Message Broker | Eclipse **Mosquitto** (Docker) | Trung gian pub/sub giữa thiết bị và backend, tách rời (decouple) thiết bị khỏi backend |
| Backend | API Server | **Node.js + Express** | Xử lý nghiệp vụ, expose REST API |
| Backend | MQTT client (subscriber) | **mqtt.js** (npm package) chạy nhúng trong backend | Lắng nghe dữ liệu telemetry, ingest vào DB |
| Backend | Realtime push | **Socket.IO** | Đẩy dữ liệu mới nhất tới web dashboard ngay khi có, không cần polling |
| Backend | Database | **MongoDB** (Mongoose ODM) | Lưu user, device, lịch sử readings (time-series collection), refresh token, alert |
| Backend | Auth | **JWT** (access 15' + refresh 7d), **bcrypt** hash mật khẩu | Xác thực người dùng |
| Backend | Device Auth | API Key (`x-api-key`) cho mỗi device + MQTT username/password riêng | Xác thực thiết bị |
| Application | Web App | **React 18 + Vite**, Recharts, Axios, Socket.IO-client | Giao diện người dùng: dashboard, lịch sử, quản lý thiết bị |
| Hạ tầng | Container | **Docker Compose** (Mosquitto + MongoDB) | Triển khai nhanh môi trường giả lập, dễ tái lập |

## 3. Phương thức giao tiếp & trao đổi dữ liệu

### 3.1. Device ↔ Broker: **MQTT**
Lý do chọn MQTT thay vì HTTP REST cho thiết bị: nhẹ (header nhỏ, phù hợp vi điều khiển tài
nguyên thấp), hỗ trợ publish/subscribe bất đồng bộ, có QoS đảm bảo độ tin cậy, và có cơ chế
**Last Will and Testament (LWT)** để backend biết thiết bị bị mất kết nối đột ngột — đúng với
mô hình mà các thiết bị Arduino/ESP8266 thật ngoài đời sử dụng (thực tế dự án CircuitDigest gốc
dùng Blynk, cũng vận hành trên nền MQTT-like protocol).

- Broker: `mosquitto:1883` (dev, không TLS) / `mosquitto:8883` (production, TLS)
- Xác thực: mỗi device có `deviceId` + `mqttPassword` riêng (lưu trong Mongo khi tạo device,
  đồng thời add vào `mosquitto` password file)
- Phân quyền (ACL): device chỉ được `publish` vào `devices/{deviceId}/telemetry` và
  `devices/{deviceId}/status` của chính nó — không đọc/ghi được dữ liệu thiết bị khác
- Topic & payload:
  ```
  Topic:  devices/AQ-DEVICE-01/telemetry
  QoS:    1
  Payload (JSON):
  {
    "ts": "2026-06-19T10:00:00.000Z",
    "co2_ppm": 612,        // MQ135
    "co_ppm": 4.2,         // MQ7
    "pm25_ugm3": 38,       // GP2Y10
    "temperature_c": 29.5, // DHT11
    "humidity_pct": 68     // DHT11
  }
  ```
  ```
  Topic:   devices/AQ-DEVICE-01/status   (retained, LWT)
  Payload: "online" | "offline"
  ```

### 3.2. Broker ↔ Backend: **MQTT (subscribe)**
Backend subscribe `devices/+/telemetry` và `devices/+/status` bằng tài khoản riêng có quyền
đọc toàn bộ namespace `devices/#`. Khi nhận message: xác thực device đã đăng ký trong DB,
tính chỉ số chất lượng không khí (AQI nội bộ dựa trên ngưỡng CO2/CO/PM2.5), lưu vào MongoDB,
kiểm tra ngưỡng cảnh báo, rồi phát lại qua Socket.IO.

### 3.3. Backend ↔ Web App: **REST API (HTTPS) + WebSocket (WSS)**
- REST API dùng cho: đăng nhập/đăng ký, CRUD thiết bị, truy vấn lịch sử, cấu hình ngưỡng cảnh báo.
  Xác thực bằng **JWT Bearer token** trong header `Authorization`.
- WebSocket (Socket.IO) dùng cho: đẩy dữ liệu cảm biến mới nhất theo thời gian thực tới
  dashboard, không cần client polling liên tục. Handshake Socket.IO cũng yêu cầu kèm JWT token
  hợp lệ (xác thực ở middleware `io.use(...)`), client chỉ nhận được dữ liệu của thiết bị
  thuộc về user đó (room theo `userId`).

### 3.4. Tổng hợp giao thức

| Kết nối | Giao thức | Bảo mật |
|---|---|---|
| Device → Broker | MQTT (mqtts ở production) | Username/password theo device + ACL theo topic |
| Broker → Backend | MQTT (subscribe) | Username/password riêng cho backend, quyền đọc toàn bộ |
| Web/3rd-party → Backend | HTTPS REST (JSON) | JWT Bearer (user) hoặc API Key (device qua HTTP fallback) |
| Backend → Web | WebSocket (WSS, Socket.IO) | JWT xác thực lúc handshake, room theo userId |

## 4. Luồng dữ liệu (data flow) tóm tắt

1. Thiết bị (giả lập) đọc/sinh giá trị cảm biến mỗi 5 giây → publish JSON lên MQTT topic riêng.
2. Mosquitto broker xác thực + áp ACL → chuyển message tới subscriber backend.
3. Backend (`mqttIngestService`) nhận message → validate schema → tính AQI → lưu MongoDB
   (`Reading`) → so sánh ngưỡng cảnh báo của device → nếu vượt ngưỡng, tạo `Alert`.
4. Backend phát sự kiện `reading:new` qua Socket.IO tới đúng room của user sở hữu thiết bị.
5. Web Dashboard (đã đăng nhập, đã subscribe socket) nhận sự kiện → cập nhật gauge/chart realtime.
6. Người dùng cũng có thể chủ động gọi REST API (`GET /api/readings/:deviceId/history`) để xem
   dữ liệu lịch sử dạng biểu đồ theo khoảng thời gian.

## 5. Khả năng mở rộng lên phần cứng thật

Vì lớp Device chỉ giao tiếp với hệ thống qua MQTT với một payload JSON cố định, để thay
`device-simulator` bằng Arduino/ESP8266/ESP32 thật chỉ cần:
1. Nạp firmware dùng thư viện `PubSubClient` (Arduino) hoặc `WiFiClientSecure`, đọc giá trị thật
   từ MQ135/MQ7/GP2Y10/DHT11 qua ADC/Digital pin.
2. Cấu hình cùng `deviceId`/`mqttPassword` đã tạo qua API `/api/devices` (xem `SECURITY.md`).
3. Publish đúng JSON schema ở mục 3.1 lên cùng topic.

Toàn bộ backend, database, web app, và cơ chế bảo mật giữ nguyên không cần thay đổi gì.
