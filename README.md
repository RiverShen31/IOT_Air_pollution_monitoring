# IoT Air Pollution Monitoring — Đồ án Kiến trúc & Bảo mật cho ứng dụng IoT

Hệ thống giám sát chất lượng không khí (CO2/NH3 qua MQ135, CO qua MQ7, bụi mịn PM2.5, nhiệt
độ/độ ẩm qua DHT11), lấy ý tưởng nghiệp vụ từ
[IoT Air Pollution Monitoring using Arduino (CircuitDigest)](https://circuitdigest.com/microcontroller-projects/iot-air-pollution-monitoring-using-arduino)
nhưng tự xây dựng lại toàn bộ kiến trúc (MQTT broker riêng, backend riêng, web app riêng) và bổ
sung các cơ chế bảo mật ở từng lớp.

**Đọc trước:**
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — sơ đồ kiến trúc, mô tả thành phần, giao thức giao tiếp
- [`docs/SECURITY.md`](docs/SECURITY.md) — chi tiết các kỹ thuật bảo mật đã triển khai + vị trí code
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploy public lên Internet miễn phí (Render + Vercel + MongoDB Atlas + HiveMQ Cloud), không cần Docker

## Demo trực tuyến

Hệ thống đã được deploy public (theo `docs/DEPLOYMENT.md`):

- **Web Dashboard**: https://iot-air-pollution-monitoring.vercel.app — tự đăng ký tài khoản để dùng thử
- **Backend API**: https://iot-air-pollution-monitoring.onrender.com (`/health` để kiểm tra)

> Backend dùng gói free của Render nên sẽ "ngủ" sau ~15 phút không có request — lần truy cập
> đầu tiên sau khi ngủ có thể mất 30-50 giây để khởi động lại (cold start), đây là hành vi bình
> thường của gói free, không phải lỗi.

## Hai cách chạy hệ thống

| | Cách A — Cloud, không cần Docker (khuyến nghị) | Cách B — Local hoàn toàn bằng Docker |
|---|---|---|
| Cần cài | Chỉ Node.js | Node.js + Docker Desktop |
| Mongo/MQTT | MongoDB Atlas + HiveMQ Cloud (free, managed) | Mosquitto + MongoDB tự host qua `docker compose` |
| Phù hợp khi | Muốn chạy nhanh, hoặc sau này deploy public (dùng chung hạ tầng) | Muốn kiểm soát hoàn toàn, không phụ thuộc dịch vụ ngoài, không có mạng |
| Hướng dẫn | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (Bước 1-3 là phần chạy local, Bước 4 trở đi là deploy public) | Phần "1. Khởi động hạ tầng" bên dưới |

README này (từ mục 1 trở xuống) hướng dẫn **Cách B**. Nếu chọn **Cách A**, qua thẳng
`docs/DEPLOYMENT.md`.

## Cấu trúc thư mục

```
project/
├── docs/                  Tài liệu kiến trúc & bảo mật
├── mosquitto/             Cấu hình MQTT broker (auth + ACL)
├── backend/               Express API + MQTT ingest + Socket.IO + MongoDB
├── web/                   React dashboard (Vite)
├── device-simulator/      Giả lập thiết bị bằng Node.js (random sensor data)
├── wokwi/                 Giả lập thiết bị bằng firmware ESP32 thật chạy trong Wokwi
└── docker-compose.yml     Mosquitto + MongoDB
```

## Yêu cầu môi trường

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (chạy Mosquitto + MongoDB)
- [Node.js](https://nodejs.org/) >= 18 (chạy backend, web, device-simulator)
- (Tuỳ chọn) [ngrok](https://ngrok.com/) nếu muốn dùng Wokwi ở "Chế độ B" — xem `wokwi/README.md`

Các lệnh dưới đây viết cho **PowerShell** (Windows). Nếu dùng Git Bash, bỏ phần `;` cuối dòng
copy-env và dùng `cp` thay vì `Copy-Item`.

## 1. Khởi động hạ tầng (MQTT broker + MongoDB)

```powershell
# Bước 1: tạo password_file cho Mosquitto (chỉ cần làm 1 lần)
# Yêu cầu Docker đang chạy. Nếu dùng PowerShell, chạy từng dòng sau (thay cho script .sh):
docker run --rm -v "${PWD}/mosquitto/config:/mosquitto/config" eclipse-mosquitto `
  mosquitto_passwd -b -c /mosquitto/config/password_file backend backendpass123
docker run --rm -v "${PWD}/mosquitto/config:/mosquitto/config" eclipse-mosquitto `
  mosquitto_passwd -b /mosquitto/config/password_file AQ-DEVICE-01 device01pass
docker run --rm -v "${PWD}/mosquitto/config:/mosquitto/config" eclipse-mosquitto `
  mosquitto_passwd -b /mosquitto/config/password_file AQ-DEVICE-WOKWI-01 wokwidevicepass

# (Git Bash / WSL / Linux / macOS có thể chạy gọn hơn bằng):
#   bash mosquitto/config/init-credentials.sh

# Bước 2: khởi động Mosquitto + MongoDB
docker compose up -d

# Kiểm tra cả 2 container đã chạy:
docker compose ps
```

> Mật khẩu ở trên (`backendpass123`, `device01pass`, ...) là **mật khẩu demo**, chỉ dùng để
> chạy giả lập local. Đổi sang giá trị khác khi triển khai thật.

## 2. Chạy Backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

Backend chạy ở `http://localhost:4000`. Kiểm tra nhanh: mở `http://localhost:4000/health` phải
trả về `{"status":"ok",...}`. Log sẽ in `[mongo] connected` và `[mqtt] backend connected to broker`
nếu bước 1 đã thành công.

## 3. Chạy Web Dashboard

Mở terminal mới:

```powershell
cd web
Copy-Item .env.example .env
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`.

## 4. Tạo tài khoản & thiết bị đầu tiên

1. Vào `http://localhost:5173/register` → tạo tài khoản người dùng.
2. Vào trang **Thiết bị** → tạo thiết bị mới với:
   - Device ID: `AQ-DEVICE-01` (khớp với tài khoản MQTT đã tạo ở Bước 1)
   - Tên: `Cảm biến phòng khách` (tuỳ ý)
3. Hệ thống sẽ trả về hướng dẫn cấp quyền MQTT cho thiết bị này — vì đã tạo sẵn ở Bước 1 nên có
   thể bỏ qua bước đó với thiết bị `AQ-DEVICE-01`.

## 5. Chạy thiết bị giả lập để bắt đầu có dữ liệu

### Cách A — Script Node.js (nhanh nhất)

```powershell
cd device-simulator
Copy-Item .env.example .env
npm install
npm run start
```

Script sẽ publish dữ liệu giả lập mỗi 5 giây lên MQTT topic `devices/AQ-DEVICE-01/telemetry`.
Quay lại tab Dashboard trên web — dữ liệu sẽ hiện realtime (qua WebSocket) chỉ sau vài giây.

Muốn thử kịch bản ô nhiễm nặng (để xem cảnh báo kích hoạt), sửa trong `device-simulator/.env`:
```
SCENARIO=polluted
```
rồi chạy lại `npm run start`.

### Cách B — Firmware ESP32 thật chạy trong Wokwi (mô phỏng phần cứng)

Xem hướng dẫn chi tiết ở [`wokwi/README.md`](wokwi/README.md) — chạy một firmware C++ thật
(không phải script giả) trong trình giả lập vi điều khiển Wokwi, có sơ đồ mạch với cảm biến ảo
(potentiometer giả lập MQ135/MQ7/cảm biến bụi, DHT22 ảo), kết nối WiFi + MQTT thật. Có 2 chế độ:
demo nhanh (broker test công khai) hoặc tích hợp đầy đủ với backend của đồ án (qua ngrok).

## 6. Thêm thiết bị thứ 2 (tuỳ chọn, để demo nhiều thiết bị cùng lúc)

```powershell
# Tạo thiết bị "AQ-DEVICE-02" qua web app trước, sau đó cấp quyền MQTT:
bash mosquitto/config/add-device.sh AQ-DEVICE-02 <mat-khau-tuy-chon>
docker compose restart mosquitto
```
Rồi sửa `device-simulator/.env` (`DEVICE_ID`, `MQTT_USERNAME`, `MQTT_PASSWORD`) hoặc chạy thêm
1 bản copy của `device-simulator/` với cấu hình khác để giả lập song song nhiều thiết bị.

## Dừng hệ thống

```powershell
# Ctrl+C ở các terminal đang chạy backend / web / device-simulator
docker compose down       # dừng Mosquitto + MongoDB (giữ lại data)
docker compose down -v    # dừng và XOÁ LUÔN dữ liệu MongoDB (cẩn thận)
```

## Khắc phục sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Backend log `[mqtt] error: Connection refused` | Mosquitto chưa chạy (`docker compose ps`) hoặc sai `MQTT_USERNAME`/`MQTT_PASSWORD` trong `backend/.env` |
| Backend log `[mongo] error` | MongoDB chưa chạy hoặc `MONGO_URI` trong `.env` sai |
| Web không nhận dữ liệu realtime | Kiểm tra Console trình duyệt — lỗi xác thực Socket.IO nghĩa là access token hết hạn (đăng xuất/đăng nhập lại) |
| `device-simulator` không publish được | Sai `DEVICE_ID`/`MQTT_USERNAME`/`MQTT_PASSWORD`, hoặc chưa chạy `init-credentials.sh`/lệnh tạo password_file ở Bước 1 |
| `mosquitto_passwd: command not found` khi chạy trực tiếp | Không cần cài đặt gì — luôn chạy qua `docker run eclipse-mosquitto mosquitto_passwd ...` như hướng dẫn ở Bước 1 |

## Lên kế hoạch tiếp theo (ngoài phạm vi bản giả lập hiện tại)

- Thay `device-simulator`/Wokwi bằng ESP32 thật gắn cảm biến thật (xem mục cuối `wokwi/README.md`)
- Mobile app (nằm ngoài phạm vi đợt triển khai này, web dashboard hiện đáp ứng responsive cơ bản)

> TLS cho MQTT (`mqtts://`, port 8883) và HTTPS cho backend **đã bật** ở bản deploy public (xem
> "Demo trực tuyến" ở trên và mục 4 trong `docs/SECURITY.md`) — chỉ thiếu khi chạy Cách B
> (local Docker) do dùng `mqtt://`/`http://` thuần cho đơn giản.
