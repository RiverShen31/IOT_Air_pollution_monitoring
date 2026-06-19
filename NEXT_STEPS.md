# Trạng thái deploy — đọc file này để biết tiếp tục từ đâu

File này ghi lại tiến độ deploy lên cloud (theo `docs/DEPLOYMENT.md`) để lần sau mở máy lên có
thể tiếp tục ngay, không cần làm lại từ đầu. **Không chứa secret thật** (mật khẩu/connection
string nằm trong các file `.env` cục bộ, không commit lên git) — chỉ ghi việc gì đã xong, việc
gì còn thiếu, và lệnh cần chạy tiếp.

## Đã xong

- [x] Code toàn bộ hệ thống (backend, web, device-simulator, wokwi, docs) — đã push lên
      `https://github.com/RiverShen31/IOT_Air_pollution_monitoring` (branch `main`).
- [x] **MongoDB Atlas**: cluster M0 free đã tạo, user `Rivershen`, Network Access đã mở
      `0.0.0.0/0`. Connection string đã lưu trong `backend/.env` (`MONGO_URI`).
- [x] **HiveMQ Cloud**: cluster `7907f0b393c042ee8addaaade1bbfb52.s1.eu.hivemq.cloud` (port
      `8883`, TLS) đã chạy. 2 credential đã tạo:
      - `backend` — quyền **Subscribe only** trên `devices/#`
      - `AQ-DEVICE-01` — quyền **Publish only** trên `devices/AQ-DEVICE-01/#`
      Giá trị thật đã lưu trong `backend/.env` (`MQTT_URL`/`MQTT_USERNAME`/`MQTT_PASSWORD`) và
      `device-simulator/.env`.
- [x] `backend/.env` — đã tạo đầy đủ (Mongo + HiveMQ + JWT secrets tự sinh).
- [x] `web/.env` — đã tạo (`VITE_API_URL=http://localhost:4000`).
- [x] `device-simulator/.env` — đã tạo (trỏ vào HiveMQ Cloud, deviceId `AQ-DEVICE-01`).
- [x] `npm install` đã chạy xong cho `backend/` (có `node_modules` + `package-lock.json` đã commit).

## Còn thiếu — làm tiếp theo thứ tự này

1. **Cài dependencies còn lại** (chưa chạy `npm install` cho 2 thư mục này):
   ```powershell
   cd web; npm install
   cd ../device-simulator; npm install
   ```

2. **Chạy thử local để xác minh Atlas + HiveMQ Cloud hoạt động đúng** trước khi deploy thật
   (mở 3 cửa sổ PowerShell riêng, mỗi cái 1 lệnh, để chạy song song):
   ```powershell
   cd backend; npm run dev          # cửa sổ 1 — chờ log "[mongo] connected" và "[mqtt] backend connected to broker"
   cd web; npm run dev              # cửa sổ 2 — mở http://localhost:5173, đăng ký tài khoản, tạo thiết bị "AQ-DEVICE-01"
   cd device-simulator; npm start   # cửa sổ 3 — sau khi đã tạo thiết bị ở web thì mới chạy lệnh này
   ```
   Nếu Dashboard trên web hiện dữ liệu realtime sau vài giây → mọi thứ đúng, qua bước 3.

3. **Deploy Backend lên Render** (`docs/DEPLOYMENT.md` mục "Bước 5"):
   - render.com → đăng nhập GitHub → New Web Service → chọn repo
     `RiverShen31/IOT_Air_pollution_monitoring`, root dir `backend`
   - Copy y nguyên các biến môi trường từ `backend/.env` vào phần Environment Variables trên
     Render (trừ `PORT`, Render tự cấp). Đặt `CORS_ORIGIN=*` tạm thời.
   - Lấy URL Render cấp (vd `https://xxxx.onrender.com`), test `/health`.

4. **Deploy Web lên Vercel** (`docs/DEPLOYMENT.md` mục "Bước 6"):
   - vercel.com → đăng nhập GitHub → New Project → chọn repo, Root Directory = `web`
   - Env var `VITE_API_URL` = URL Render ở bước 3.
   - Lấy URL Vercel cấp (vd `https://xxxx.vercel.app`).

5. **Khoá lại CORS** (`docs/DEPLOYMENT.md` mục "Bước 7"): quay lại Render, sửa `CORS_ORIGIN`
   thành đúng URL Vercel ở bước 4, save (Render tự redeploy).

6. **Test end-to-end**: mở URL Vercel trên máy/mạng khác → đăng ký tài khoản mới (vì DB Atlas
   dùng chung, có thể thấy lại thiết bị/dữ liệu đã tạo ở bước 2 nếu cùng tài khoản) → chạy lại
   `device-simulator` (hoặc Wokwi chế độ B) → xác nhận dữ liệu hiện trên dashboard từ xa.

## Lưu ý bảo mật đã nhắc trong lúc làm

- Đã đổi mật khẩu GitHub + MongoDB Atlas vì lúc đầu bị trùng nhau.
- Đã đổi 2 mật khẩu credential HiveMQ Cloud (`backend`, `AQ-DEVICE-01`) vì lúc đầu trùng nhau.
- Quy tắc chung: **không dùng chung 1 mật khẩu cho 2 dịch vụ/credential khác nhau** — mỗi nơi
  một mật khẩu ngẫu nhiên riêng.
