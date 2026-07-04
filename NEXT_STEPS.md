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

## Sự cố 04/07/2026: Dashboard (`/history`) không có dữ liệu mới từ 20/6

**Triệu chứng**: bản ghi cuối cùng trên https://iot-air-pollution-monitoring.vercel.app/history
dừng ở ngày 20/6, không có dữ liệu mới dù backend/Vercel vẫn "deploy live".

**Đã kiểm tra và loại trừ**:
- `GET https://iot-air-pollution-monitoring.onrender.com/health` → `{"status":"ok"}` ngay lập
  tức → Render service vẫn chạy được (không phải do cold-sleep chết hẳn).
- Chạy thử `cd device-simulator && npm start` bằng đúng `.env` đang lưu cục bộ (trỏ
  `AQ-DEVICE-01` vào HiveMQ Cloud cluster `7907f0b393c042ee8addaaade1bbfb52`) → **connect + publish
  thành công ngay**, nghĩa là credential HiveMQ Cloud và pipeline ingest vẫn còn hoạt động bình
  thường, không có gì bị hỏng/hết hạn.

**Root cause thật sự**: không phải lỗi code/hạ tầng — đơn giản là **không có tiến trình
`device-simulator` (hay Wokwi) nào chạy liên tục**. Theo ghi chú ở trên, lần cuối simulator chạy
là ngày 20/6 lúc test end-to-end sau deploy, rồi bị tắt (đóng terminal/tắt máy) và không ai khởi
động lại — khớp chính xác với ngày dữ liệu dừng. Kiến trúc hiện tại coi "device" là tiến trình
chạy tay trên máy local hoặc trong tab trình duyệt Wokwi, không phải một service deploy 24/7, nên
hễ không ai mở máy chạy nó thì hệ thống phía sau (broker/backend/DB) vẫn "sống" nhưng không có gì
để hiển thị.

**Cách xử lý**:
1. Ngắn hạn (demo/báo cáo): chạy lại `cd device-simulator && npm start` (hoặc mở lại Wokwi) mỗi
   khi cần dữ liệu mới — vài giây sau sẽ thấy realtime trên dashboard.
2. Dài hạn (nên làm nếu muốn dashboard luôn có dữ liệu mà không cần mở máy): deploy
   `device-simulator` như một background worker 24/7 (vd Render Background Worker free/Railway/
   Fly.io) thay vì chạy tay trên laptop — xem mục "Gợi ý phát triển" bên dưới.

## Gợi ý phát triển thêm (dùng cho báo cáo)

Xếp theo mức độ ưu tiên/độ khó:

1. **Chạy `device-simulator` như service 24/7** — trực tiếp xử lý gốc rễ sự cố ở trên. Deploy
   thêm 1 Render Background Worker (hoặc Railway/Fly.io free) chạy `node simulate.js` liên tục,
   thay vì phụ thuộc vào việc ai đó mở máy local. Đây là cải tiến "chi phí thấp, giá trị cao"
   nhất vì fix luôn nguyên nhân mất dữ liệu.
2. **Cảnh báo "mất kết nối thiết bị"** — hiện đã có LWT (`devices/{id}/status` → offline) nhưng
   chưa thấy cơ chế chủ động cảnh báo khi *không có bản ghi mới trong X phút* (khác với việc mất
   kết nối MQTT tường minh). Thêm 1 cron job/kiểm tra định kỳ trong backend: nếu
   `lastReadingAt` của device quá cũ → tạo `Alert` loại "device_stale" — tránh tình huống y hệt
   vừa gặp (hệ thống "trông có vẻ ổn" nhưng thực ra im lặng nhiều ngày mà không ai biết).
3. **Giữ Render khỏi ngủ** — đã ghi ở mục "Còn thiếu" phía trên (UptimeRobot ping `/health` mỗi
   5 phút), vẫn chưa làm.
4. **TTL/retention cho `Reading`** — Atlas M0 free chỉ có 512MB, publish mỗi 5s sẽ đầy dần theo
   thời gian chạy liên tục. Thêm Mongo TTL index (vd tự xoá reading > 30 ngày) hoặc downsampling
   dữ liệu cũ, đáng nói trong báo cáo như một cân nhắc vận hành (operations concern).
5. **CI tối thiểu** — hiện chưa có test suite/lint nào (`npm test` không tồn tại). Thêm vài test
   đơn giản cho `parseTimestamp`/`calculateAQI` (logic nghiệp vụ thuần, dễ test, hay bị lỗi âm
   thầm khi đổi ngưỡng) + 1 GitHub Action chạy chúng mỗi lần push, tăng độ tin cậy khi báo cáo.
6. **Đưa vào phần cứng thật qua Wokwi** — `wokwi/sketch.ino` đã sẵn sàng theo `docs/ARCHITECTURE.md`
   mục 5; demo trực tiếp trên Wokwi (thay vì chỉ `device-simulator`) sẽ thuyết phục hơn cho phần
   "khả năng mở rộng lên phần cứng thật" trong báo cáo.
7. **Khắc phục các giới hạn bảo mật đã biết** (đã liệt kê trong `docs/SECURITY.md` là chủ đích,
   nhưng có thể nêu như "hướng phát triển tiếp theo" trong báo cáo): xoay vòng secret theo lịch,
   2FA cho user, chuyển token từ `localStorage` sang cookie `httpOnly` để giảm rủi ro XSS.
8. **Xuất dữ liệu lịch sử (CSV/Excel)** và **thông báo alert qua email** (ngoài Socket.IO) — tính
   năng ứng dụng, dễ demo, giá trị thực tế cao cho người dùng cuối.

## Nhật ký xử lý (mỗi bước quan trọng, kèm thời gian)

Từ 04/07/2026: theo yêu cầu của chủ dự án, mọi bước xử lý/thay đổi quan trọng từ giờ đều ghi lại
ở đây kèm mốc thời gian, để phiên làm việc sau biết chính xác đã làm gì, khi nào.

- **2026-07-04 ~08:5x (+07)** — Phát hiện `/history` trên Vercel không có dữ liệu mới từ 20/6.
  Kiểm tra `GET /health` trên Render → OK. Chạy thử `device-simulator` cục bộ với `.env` sẵn có →
  connect + publish thành công vào HiveMQ Cloud ngay lập tức → kết luận root cause là do không có
  tiến trình device nào chạy liên tục kể từ 20/6 (không phải lỗi hạ tầng/credential).
- **2026-07-04 ~08:5x (+07)** — Ghi chẩn đoán sự cố + thêm mục "Gợi ý phát triển" (8 ý) vào file
  này.
- **2026-07-04 ~09:00 (+07)** — Khởi động lại `device-simulator` (`AQ-DEVICE-01`, scenario
  `normal`) chạy nền liên tục trên máy local theo yêu cầu người dùng, để dashboard có dữ liệu mới
  trong lúc demo/báo cáo. **Lưu ý: tiến trình này chỉ sống khi phiên làm việc/máy này còn mở** —
  nếu cần dữ liệu liên tục dài hạn, cần làm mục #1 ở "Gợi ý phát triển" (deploy simulator thành
  service 24/7).
- **2026-07-04 ~09:01 (+07)** — Tạo `docs/LINKS.md` tổng hợp toàn bộ link kiểm tra hệ thống (web,
  health check, console Render/Vercel/Atlas/HiveMQ, GitHub).
- **2026-07-04 ~09:01 (+07)** — Người dùng xác nhận trực tiếp trên console HiveMQ Cloud
  (Access Management) rằng vẫn đúng 2 credential như tài liệu mô tả: `backend` (`SUBSCRIBE_ONLY`)
  và `AQ-DEVICE-01` (`PUBLISH_ONLY`) — khớp với phần "Đã xong" ở trên, không có thay đổi/credential
  lạ nào xuất hiện.
- **2026-07-04 ~09:46 (+07)** — Cài xong code cho cả 8 tính năng đã chốt trong kế hoạch (xem
  `docs/SECURITY.md` nên đọc lại cùng lúc để cập nhật cho đồng bộ — chưa làm ở bước này):
  1. **TTL Reading** (`Reading.expiresAt` + index, 30 ngày, tính theo `ts`).
  2. **Xuất CSV** (`GET /readings/:id/history/export`, nút "Xuất CSV" ở trang Lịch sử).
  3. **Cảnh báo device-stale** (`deviceStaleCheckService.js`, quét mỗi 60s, cutoff 3 phút,
     `Alert.metric = 'device_stale'`).
  4. **HMAC ký payload** (`Device.hmacSecret`, soft-accept khi thiết bị chưa có secret —
     `AQ-DEVICE-01` hiện tại KHÔNG bị gián đoạn vì chưa có secret). Đã ký ở cả
     `device-simulator/simulate.js` và `wokwi/sketch.ino` (dùng `mbedtls/md.h`), nhưng **chỉ có
     hiệu lực khi set `DEVICE_HMAC_SECRET`** — hiện tại chưa set nên vẫn đang chạy chế độ
     soft-accept không ký.
  5. **Chống replay** (cửa sổ tươi 5 phút + đơn điệu theo `Device.lastReadingTs`).
  6. **Email cảnh báo** (`mailService.js`, cooldown 30 phút/metric) — **cần bạn tự điền
     `SMTP_HOST/PORT/USER/PASS/FROM` vào `backend/.env`** (Gmail App Password hoặc Resend/Brevo),
     nếu để trống thì tính năng tự tắt, không lỗi.
  7. **So sánh nhiều thiết bị** (trang `/compare`, chọn nhiều thiết bị + 1 metric để vẽ chung).
  8. **Health server cho device-simulator** (`simulate.js` nghe thêm cổng HTTP) + thêm service
     `air-pollution-device-simulator` vào `render.yaml` để deploy như Web Service 24/7.

  **Việc còn cần bạn tự làm (không phải code, đọc kỹ trước khi làm)**:
  - Cấu hình SMTP thật vào `backend/.env` (và trên Render nếu muốn email hoạt động ở bản deploy)
    nếu muốn dùng tính năng #6.
  - Nếu muốn bật ký HMAC cho `AQ-DEVICE-01`: gọi lại API tạo device hoặc thêm cơ chế lấy
    `hmacSecret` cho device đã tồn tại (hiện tại `hmacSecret` chỉ được sinh khi TẠO MỚI device —
    device cũ cần cách khác để có secret, vd 1 script migrate 1 lần, chưa làm) — nếu không làm gì
    thêm thì `AQ-DEVICE-01` tiếp tục chạy ở chế độ soft-accept (không ký), vẫn hoạt động bình
    thường, chỉ là chưa có lớp bảo vệ chống giả mạo.
  - Tạo thêm 2-3 device (`AQ-DEVICE-02`, `AQ-DEVICE-03`, ...) qua `POST /api/devices` + tạo
    credential MQTT tương ứng trên HiveMQ Cloud console + chạy thêm instance
    `device-simulator` (mỗi cái 1 `.env` riêng) để demo trang `/compare` có dữ liệu ý nghĩa.
  - Deploy service `air-pollution-device-simulator` mới trên Render (theo `render.yaml` cập
    nhật, hoặc tạo tay Web Service thứ 2 trỏ `rootDir: device-simulator`), rồi thêm URL của nó
    vào UptimeRobot cùng với backend (mục "Còn thiếu" #3 ở trên) — giờ có **2 URL cần ping**
    thay vì 1.
  - Chưa chạy `npm install` cho `web/` sau khi thêm `Compare.jsx` (không có dependency mới nên
    không bắt buộc, nhưng nên `npm run dev` thử để chắc chắn build không lỗi trước khi deploy).
- **2026-07-04 ~09:49 (+07)** — Kiểm thử: `node --check` toàn bộ file backend đã sửa (không lỗi
  cú pháp), `npm run build` ở `web/` thành công. Chạy thử backend cục bộ (trỏ vào Mongo/HiveMQ
  Cloud thật qua `.env`) ~17s: boot sạch, connect Mongo + MQTT bình thường, và **ingest liên tục
  5 reading từ `AQ-DEVICE-01` không lỗi** (xác nhận soft-accept HMAC + check chống-replay không
  làm gãy luồng dữ liệu thật đang chạy) — dừng ngay sau đó để tránh 2 backend cùng subscribe
  trùng gây double-ingest vào Mongo (không nên chạy song song backend cục bộ với bản trên Render
  khi cả hai cùng trỏ vào 1 broker/database). Đã cập nhật `docs/SECURITY.md` thêm 2 mục HMAC
  payload signing + chống replay attack (mục 2) và ghi chú endpoint regenerate `hmacSecret` (mục
  4) để tài liệu khớp với code mới.
- **2026-07-04 ~10:17 (+07)** — Tiến trình `device-simulator` chạy nền (khởi động lúc ~09:00) bị
  hệ thống dừng đột ngột (không phải lỗi code — process bị kill ở tầng ngoài, có thể do phiên làm
  việc/sandbox dọn dẹp). Đây là **minh chứng thực tế** cho đúng lý do đã ghi ở mục "Gợi ý phát
  triển" #1: chạy tay/chạy nền tạm trên máy không phải giải pháp bền vững — tính năng #8 (deploy
  `device-simulator` thành Render Web Service 24/7) đã code xong nhưng **chưa được deploy thật**.
  Đã khởi động lại thủ công (`npm start`), xác nhận connect + publish lại bình thường, log đã in
  dòng `health server on :3000` (xác nhận code Feature 8 đang chạy đúng). Nếu tình trạng này lặp
  lại thường xuyên, nên ưu tiên deploy service Render thứ 2 (`render.yaml` đã có sẵn cấu hình)
  thay vì tiếp tục dựa vào tiến trình chạy nền tạm thời này.
- **2026-07-04 (phiên mới)** — Người dùng hỏi "restore history" (dữ liệu `/history` lại thiếu) —
  kiểm tra lại: không có tiến trình `device-simulator` nào chạy (đúng như dự đoán, tiến trình chạy
  tay lúc 10:17 đã dừng khi đóng phiên trước). Người dùng chọn xử lý gốc rễ thay vì chạy tay lần
  nữa: thêm **Bước 9** vào `docs/DEPLOYMENT.md` hướng dẫn deploy `device-simulator` như Render Web
  Service 24/7 (thủ công qua dashboard, mirror Bước 5, dùng cấu hình có sẵn trong `render.yaml`).
  **Việc còn cần bạn tự làm**: đăng nhập Render dashboard → làm theo Bước 9 → điền env var từ
  `device-simulator/.env` cục bộ đang chạy tốt → thêm URL mới vào UptimeRobot. Không thể tự động
  hoá bước này vì cần đăng nhập/thao tác trên Render dashboard của bạn.
