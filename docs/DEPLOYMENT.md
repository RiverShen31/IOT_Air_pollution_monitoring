# Hướng dẫn Deploy lên Cloud (miễn phí, không cần Docker)

Tài liệu này hướng dẫn đưa toàn bộ hệ thống lên Internet với 1 URL public, dùng hoàn toàn các
gói miễn phí, **không cần cài Docker**. So với chạy local bằng `docker compose` (tự host
Mosquitto + MongoDB), cách này dùng dịch vụ managed cho 2 thành phần đó — ổn định hơn về lâu dài
(không lo container bị ngủ/mất dữ liệu do free-tier compute), và **dùng chung 1 bộ hạ tầng cho
cả lúc code/test trên máy lẫn lúc đã deploy thật**, nên không cần duy trì 2 cấu hình song song.

## Kiến trúc sau khi deploy

```
 Wokwi / device-simulator (chạy local hoặc trong Wokwi)
        │  MQTT over TLS (mqtts://, port 8883)
        ▼
 HiveMQ Cloud (broker MQTT managed, free)
        │  MQTT subscribe (backend)
        ▼
 Render — Backend (Node/Express, free Web Service)  ←──── MongoDB Atlas (free M0 cluster)
        │  REST API (HTTPS) + WebSocket (WSS)
        ▼
 Vercel — Web App (React static build, free)
```

`mosquitto/` và `docker-compose.yml` ở thư mục gốc **vẫn giữ nguyên** — đó là lựa chọn thay thế
nếu sau này bạn muốn tự host toàn bộ trên máy có Docker (xem README.md mục "Chạy hoàn toàn
local"). Hai cách không xung đột, chỉ khác nguồn Mongo/MQTT mà backend trỏ tới qua biến môi
trường `.env`.

---

## Bước 1 — MongoDB Atlas (database, free M0)

1. Vào https://www.mongodb.com/cloud/atlas/register → đăng ký tài khoản (free, không cần thẻ).
2. Tạo project mới (vd: `iot-air-pollution`) → **Build a Database** → chọn gói **M0 Free**.
3. Chọn nhà cung cấp/region bất kỳ gần bạn → **Create**.
4. Ở bước **Security Quickstart**:
   - Tạo Database User: username/password tự đặt (lưu lại, dùng ở Bước 5) — KHÔNG dùng ký tự
     đặc biệt khó escape trong URL như `@`, `/`, `:` để đỡ phải URL-encode.
   - Network Access: chọn **Allow access from anywhere** (`0.0.0.0/0`) — cần thiết vì Render
     không có IP tĩnh cố định trên gói free.
5. Vào **Database** → **Connect** → **Drivers** → copy connection string, dạng:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Thêm tên database vào trước dấu `?`, vd:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/air_pollution_iot?retryWrites=true&w=majority
   ```
   → đây chính là giá trị `MONGO_URI` sẽ dùng ở Bước 3 và Bước 5.

## Bước 2 — HiveMQ Cloud (MQTT broker, free Serverless)

1. Vào https://www.hivemq.com/mqtt-cloud-broker/ → **Get Started Free** → đăng ký tài khoản.
2. Tạo cluster mới, chọn gói **Serverless (Free)** → đợi vài phút để cluster khởi tạo.
3. Vào tab **Overview** của cluster → ghi lại **Cluster URL** (dạng
   `xxxxxxxx.s1.eu.hivemq.cloud`) và port TLS **8883** — đây là `MQTT_URL` dùng ở Bước 3/5,
   ghép thành `mqtts://xxxxxxxx.s1.eu.hivemq.cloud:8883`.
4. Vào tab **Access Management** → **Manage Credentials** → tạo các credential sau (mỗi
   credential gồm username/password do bạn tự đặt + danh sách quyền truy cập topic, đây chính
   là phần thay thế cho `mosquitto/config/password_file` + `acl.conf`):

   | Username | Password | Permission (topic / quyền) |
   |---|---|---|
   | `backend` | tự đặt, lưu lại | `devices/#` → **Subscribe** |
   | `AQ-DEVICE-01` | tự đặt, lưu lại | `devices/AQ-DEVICE-01/#` → **Publish** |
   | `AQ-DEVICE-WOKWI-01` | tự đặt, lưu lại | `devices/AQ-DEVICE-WOKWI-01/#` → **Publish** |

   Mỗi khi tạo thiết bị mới qua web app sau này, quay lại đây thêm 1 credential tương ứng —
   đây là bước thủ công thay thế cho script `mosquitto/config/add-device.sh` ở bản tự host.

## Bước 3 — Chạy thử trên máy bằng cloud Mongo/MQTT (trước khi deploy)

Việc này vừa để kiểm tra Atlas/HiveMQ đã cấu hình đúng, vừa là cách chạy giả lập **không cần
Docker** (xem thêm phần "Chạy giả lập step-by-step" ở README.md — phiên bản này thay
`MONGO_URI`/`MQTT_URL` bằng giá trị cloud thay vì `localhost`).

```powershell
cd backend
Copy-Item .env.example .env
# Mở backend/.env, sửa 3 dòng:
#   MONGO_URI=<connection string Atlas ở Bước 1>
#   MQTT_URL=mqtts://xxxxxxxx.s1.eu.hivemq.cloud:8883
#   MQTT_USERNAME=backend
#   MQTT_PASSWORD=<password credential "backend" ở Bước 2>
npm install
npm run dev
```
Log phải in `[mongo] connected` và `[mqtt] backend connected to broker`. Nếu lỗi, xem bảng
khắc phục sự cố ở README.md.

```powershell
cd web
Copy-Item .env.example .env
npm install
npm run dev
```
Đăng ký tài khoản, tạo thiết bị `AQ-DEVICE-01` trên web app (`http://localhost:5173`).

```powershell
cd device-simulator
Copy-Item .env.example .env
# Sửa device-simulator/.env:
#   MQTT_HOST=mqtts://xxxxxxxx.s1.eu.hivemq.cloud:8883
#   DEVICE_ID=AQ-DEVICE-01
#   MQTT_USERNAME=AQ-DEVICE-01
#   MQTT_PASSWORD=<password credential "AQ-DEVICE-01" ở Bước 2>
npm install
npm run start
```
Quay lại Dashboard trên web — dữ liệu phải hiện realtime sau vài giây. Nếu chạy được tới đây,
nghĩa là Atlas + HiveMQ Cloud đã đúng, có thể deploy thật.

## Bước 4 — Đẩy code lên GitHub

```powershell
git init
git add -A
git commit -m "Initial commit"
```
Vào https://github.com/new → tạo repository mới (Public hoặc Private đều được, không cần
README/gitignore mặc định vì repo đã có sẵn) → copy URL repo (dạng
`https://github.com/<username>/<repo>.git`), rồi:

```powershell
git remote add origin https://github.com/<username>/<repo>.git
git branch -M main
git push -u origin main
```
Lệnh `push` sẽ mở cửa sổ đăng nhập GitHub trên trình duyệt (Git Credential Manager) — đăng nhập
1 lần, các lần push sau không cần lặp lại.

## Bước 5 — Deploy Backend lên Render

1. Vào https://render.com → đăng ký bằng tài khoản GitHub (để Render có quyền đọc repo).
2. **New** → **Web Service** → chọn repo vừa push.
3. Điền cấu hình:
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Mục **Environment Variables**, thêm (copy giá trị từ `backend/.env` bạn đã test ở Bước 3):
   | Key | Value |
   |---|---|
   | `MONGO_URI` | connection string Atlas |
   | `MQTT_URL` | `mqtts://xxxxxxxx.s1.eu.hivemq.cloud:8883` |
   | `MQTT_USERNAME` | `backend` |
   | `MQTT_PASSWORD` | password credential `backend` |
   | `JWT_ACCESS_SECRET` | chuỗi ngẫu nhiên dài (vd tạo bằng `openssl rand -hex 32`) |
   | `JWT_REFRESH_SECRET` | chuỗi ngẫu nhiên dài khác |
   | `JWT_ACCESS_EXPIRES` | `15m` |
   | `JWT_REFRESH_EXPIRES_DAYS` | `7` |
   | `CORS_ORIGIN` | tạm thời để `*` — sẽ sửa lại ở Bước 7 sau khi có URL Vercel |
   | `NODE_ENV` | `production` |

   (`PORT` không cần khai báo — Render tự inject, code đã đọc `process.env.PORT`.)
5. **Create Web Service** → đợi build xong → Render cấp 1 URL dạng
   `https://<tên-service>.onrender.com`. Mở `https://<tên-service>.onrender.com/health` để xác
   nhận trả về `{"status":"ok",...}`. **Ghi lại URL này, dùng ở Bước 6.**

> **Lưu ý gói free của Render**: service sẽ "ngủ" sau ~15 phút không có request, lần truy cập
> tiếp theo mất khoảng 30-50s để khởi động lại (cold start) — trong lúc ngủ, backend cũng ngắt
> kết nối MQTT nên sẽ bỏ lỡ dữ liệu thiết bị gửi lên trong khoảng đó. Cách khắc phục miễn phí:
> dùng [UptimeRobot](https://uptimerobot.com/) (free) tạo 1 monitor HTTP ping
> `https://<tên-service>.onrender.com/health` mỗi 5 phút để giữ service luôn awake.

## Bước 6 — Deploy Web App lên Vercel

1. Vào https://vercel.com → đăng ký bằng tài khoản GitHub.
2. **Add New** → **Project** → chọn repo vừa push.
3. Ở bước cấu hình:
   - **Root Directory**: bấm **Edit** → chọn thư mục `web`
   - Framework Preset: Vercel tự nhận diện **Vite**
4. Mục **Environment Variables**, thêm:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | URL backend Render ở Bước 5, vd `https://air-pollution-backend.onrender.com` |
5. **Deploy** → đợi build xong → Vercel cấp 1 URL dạng `https://<tên-project>.vercel.app`.

## Bước 7 — Khoá lại CORS (bảo mật)

Quay lại Render → service backend → **Environment** → sửa `CORS_ORIGIN` từ `*` thành đúng URL
Vercel, vd `https://<tên-project>.vercel.app` (không có dấu `/` ở cuối) → **Save Changes**
(Render tự redeploy). Việc này đảm bảo chỉ web app của bạn mới gọi được API/WebSocket, đúng như
thiết kế CORS trong `docs/SECURITY.md`.

## Bước 8 — Kiểm tra end-to-end

1. Mở `https://<tên-project>.vercel.app` → đăng ký tài khoản mới (database giờ là Atlas, không
   còn dữ liệu test ở Bước 3 nếu bạn dùng database name khác — tạo lại thiết bị `AQ-DEVICE-01`
   nếu cần).
2. Trên máy local, chạy lại `device-simulator` (trỏ `MQTT_HOST` vào HiveMQ Cloud như Bước 3) —
   dữ liệu phải hiện trên web Vercel sau vài giây.
3. Hoặc dùng Wokwi (xem `wokwi/README.md`, chế độ B) — sửa `MQTT_HOST`/`MQTT_PORT`/`MQTT_USER`/
   `MQTT_PASS` trong `sketch.ino` trỏ thẳng vào HiveMQ Cloud (không cần ngrok vì broker đã public).

## Tổng hợp giới hạn gói free (tham khảo khi báo cáo)

| Dịch vụ | Giới hạn free tier đáng chú ý |
|---|---|
| MongoDB Atlas M0 | 512MB storage, shared CPU, đủ cho demo/đồ án |
| HiveMQ Cloud Serverless | 100 kết nối đồng thời, 10GB traffic/tháng |
| Render Free Web Service | Ngủ sau ~15' idle, 750 giờ chạy/tháng |
| Vercel Hobby | Băng thông 100GB/tháng, build không giới hạn cho project cá nhân |

## Cập nhật code sau khi đã deploy

Mỗi lần `git push` lên nhánh `main`, cả Render và Vercel tự động build & deploy lại (CI/CD có
sẵn, không cần cấu hình thêm gì).
