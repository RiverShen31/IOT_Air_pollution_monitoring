# Trạng thái deploy — đọc file này để biết tiếp tục từ đâu

File này ghi lại tiến độ deploy lên cloud (theo `docs/DEPLOYMENT.md`) để lần sau mở máy lên có
thể tiếp tục ngay, không cần làm lại từ đầu. **Không chứa secret thật** (mật khẩu/connection
string nằm trong các file `.env` cục bộ, không commit lên git) — chỉ ghi việc gì đã xong, việc
gì còn thiếu, và lệnh cần chạy tiếp.

## Các trang quản lý (URL, không phải secret)

| Thành phần | Nơi quản lý | URL |
|---|---|---|
| Backend (API + MQTT subscriber + WebSocket) | Render dashboard | https://dashboard.render.com/web/srv-d8qv8pvavr4c73dsgts0 |
| Backend — URL public đang chạy | Render | https://iot-air-pollution-monitoring.onrender.com (health check: `/health`) |
| Frontend (web dashboard) | Vercel dashboard | https://vercel.com/dashboard |
| Frontend — URL public đang chạy | Vercel | https://iot-air-pollution-monitoring.vercel.app |
| Database | MongoDB Atlas | https://cloud.mongodb.com (cluster `cluster0.fqwfzcd.mongodb.net`, db `air_pollution_iot`) |
| MQTT broker (credentials + quyền topic) | HiveMQ Cloud console | https://console.hivemq.cloud/clusters/7907f0b393c042ee8addaaade1bbfb52/access-management |
| Source code | GitHub | https://github.com/RiverShen31/IOT_Air_pollution_monitoring |

Mật khẩu/connection string thật của từng dịch vụ nằm trong `backend/.env` và
`device-simulator/.env` cục bộ (không commit) — không lặp lại ở đây.

## Đã xong

- [x] Code toàn bộ hệ thống (backend, web, device-simulator, wokwi, docs) — đã push lên GitHub
      (branch `main`), kèm `package-lock.json` cho cả 3 subproject (backend/web/device-simulator)
      để build trên Render/Vercel reproducible.
- [x] **MongoDB Atlas**: cluster M0 free, user `Rivershen`, Network Access `0.0.0.0/0`.
- [x] **HiveMQ Cloud**: cluster `7907f0b393c042ee8addaaade1bbfb52.s1.eu.hivemq.cloud` (port
      `8883`, TLS). Lưu ý quan trọng: ở giao diện free tier hiện tại, mỗi credential chỉ có
      đúng 1 dropdown Permission (`PUBLISH_ONLY` / `SUBSCRIBE_ONLY` / `PUBLISH_AND_SUBSCRIBE`)
      áp dụng cho toàn bộ topic — **không có ô nhập topic filter riêng như tài liệu cũ mô tả**,
      và **không sửa được permission tại chỗ, phải xoá rồi tạo lại credential** (password đổi
      mỗi lần tạo lại). 2 credential hiện tại:
      - `backend` — `SUBSCRIBE_ONLY`
      - `AQ-DEVICE-01` — `PUBLISH_ONLY`
- [x] `npm install` xong cho cả `backend/`, `web/`, `device-simulator/`.
- [x] Test local end-to-end thành công: backend (Mongo + MQTT) chạy, web dashboard chạy,
      device-simulator publish → dữ liệu hiện realtime trên dashboard.
- [x] **Backend deployed lên Render** — service `iot-air-pollution-monitoring`, live tại
      https://iot-air-pollution-monitoring.onrender.com, `/health` trả về OK, log xác nhận Mongo +
      MQTT connect + subscribe thành công.
- [x] **Web deployed lên Vercel** — live tại https://iot-air-pollution-monitoring.vercel.app,
      `VITE_API_URL` trỏ đúng về Render.

## Còn thiếu — làm tiếp theo thứ tự này

1. **Khoá lại CORS** (`docs/DEPLOYMENT.md` mục "Bước 7"): trên Render → tab Env → sửa
   `CORS_ORIGIN` từ `*` thành `https://iot-air-pollution-monitoring.vercel.app` (không có `/` ở
   cuối) → Save Changes (Render tự redeploy).

2. **Test end-to-end công khai**: mở URL Vercel trên máy/mạng khác (hoặc nhờ bạn bè) → đăng ký
   tài khoản mới → tạo lại thiết bị `AQ-DEVICE-01` (vì DB dùng chung Atlas, có thể trùng/khác tuỳ
   tài khoản) → chạy lại `device-simulator` trên máy local (hoặc Wokwi chế độ B) → xác nhận dữ
   liệu hiện trên dashboard Vercel.

3. **(Tuỳ chọn) Giữ Render khỏi ngủ**: gói free Render ngủ sau ~15 phút không có request — dùng
   [UptimeRobot](https://uptimerobot.com/) (free) ping `https://iot-air-pollution-monitoring.onrender.com/health`
   mỗi 5 phút nếu muốn bạn bè vào lúc nào cũng có dữ liệu sẵn, không phải chờ cold start 30-50s.

4. **Chia sẻ link cho bạn bè**: gửi `https://iot-air-pollution-monitoring.vercel.app` — mỗi
   người tự đăng ký tài khoản riêng (hệ thống multi-tenant, dữ liệu thiết bị tách theo
   `owner`/user, không nhìn thấy thiết bị của nhau).

## Lưu ý bảo mật đã nhắc trong lúc làm

- Đã đổi mật khẩu GitHub + MongoDB Atlas vì lúc đầu bị trùng nhau.
- Đã đổi mật khẩu credential HiveMQ Cloud (`backend`, `AQ-DEVICE-01`) nhiều lần trong lúc debug
  quyền subscribe — quy tắc chung vẫn giữ: **không dùng chung 1 mật khẩu cho 2 dịch
  vụ/credential khác nhau**, mỗi nơi một mật khẩu ngẫu nhiên riêng.
- JWT secrets dùng cho Render (production) là cặp secret **riêng**, không trùng với cặp dùng khi
  chạy local (`backend/.env`) — đúng nguyên tắc không tái sử dụng secret giữa các môi trường.
- Đã thử nhầm GitHub Pages cho phần web (không khả thi vì cần chạy Node.js backend) — đã tắt,
  dùng đúng Render (backend) + Vercel (frontend) như tài liệu gốc.
