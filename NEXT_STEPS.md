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

1. ~~Khoá lại CORS~~ — **đã xong**, xác nhận lại bằng `curl` trực tiếp vào backend Render với
   header `Origin` giả (`https://evil.example.com`) → response trả về cố định
   `Access-Control-Allow-Origin: https://iot-air-pollution-monitoring.vercel.app`, không phải
   `*` → `CORS_ORIGIN` trên Render đã được set đúng.

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
- **2026-07-04 (tiếp)** — Kiểm tra lại bằng `curl` trực tiếp (không chỉ đọc doc) xem mục "Khoá lại
  CORS" trong "Còn thiếu" đã làm chưa: gửi header `Origin: https://evil.example.com` tới backend
  Render → response trả cố định `Access-Control-Allow-Origin: https://iot-air-pollution-monitoring.vercel.app`
  → xác nhận **đã khoá xong từ trước** (không phải `*`), chỉ là doc chưa cập nhật — đã sửa mục 1
  trong "Còn thiếu" thành đã xong. Cũng xác nhận `backend/.env` cục bộ chưa có biến `SMTP_*` nào
  (email vẫn tắt) và `device-simulator/.env` chưa có `DEVICE_HMAC_SECRET` (đúng như log trước).
- **2026-07-04 (tiếp, phiên cải thiện lớn)** — Người dùng yêu cầu làm hết các gợi ý cải thiện đã
  đề xuất (trừ mục Wokwi), cộng thêm dashboard hiện nhiều thiết bị hơn. Đã hoàn thành:
  1. **Vá lỗ hổng `nodemailer`** (mức High, nhiều CVE) — nâng `^6.x` → `^9.0.3` qua
     `npm audit fix --force`, xác nhận `mailService.js` vẫn chạy đúng, `npm audit` sạch.
  2. **Bộ lọc ngày `from`/`to` cho trang Lịch sử** — backend đã hỗ trợ sẵn, chỉ thiếu UI; thêm 2 ô
     input ngày + nút xoá bộ lọc vào `History.jsx`, áp dụng cho cả xem lịch sử và xuất CSV.
  3. **CI tối thiểu** (`.github/workflows/ci.yml`) — build backend/web/device-simulator, chạy
     `npm test` (unit test mới cho `calculateAQI`/`levelFromAqi`/`parseTimestamp` bằng
     `node --test`, không cần dependency ngoài) + `npm audit --audit-level=high` cho cả 3.
  4. **Dashboard hiện biểu đồ chung nhiều thiết bị** — thay biểu đồ chỉ vẽ 1 device đang chọn bằng
     `MultiDeviceChart` (tái dùng từ trang Compare) vẽ TẤT CẢ device cùng lúc, có chọn chỉ số.
  5. **Tạo thêm device demo**: phát hiện `AQ-DEVICE-02` đã tồn tại nhưng thuộc **tài khoản khác**
     (dữ liệu test rác từ 20/6) — tạo `AQ-DEVICE-03` và `AQ-DEVICE-04` đúng dưới owner của
     `AQ-DEVICE-01` bằng script Mongo 1 lần (đã xoá sau khi chạy). **Việc còn cần bạn tự làm**: tạo
     credential MQTT cho 2 device này trên HiveMQ Cloud console + chạy thêm instance
     `device-simulator` (mỗi cái 1 `.env` riêng, đổi `DEVICE_ID`/`MQTT_USERNAME`/`MQTT_PASSWORD`)
     để có dữ liệu thật hiện trên dashboard/Compare.
  6. **Sentry error tracking (tuỳ chọn)** — thêm `backend/src/config/sentry.js` và
     `web/src/sentry.js`, chỉ bật khi có `SENTRY_DSN`/`VITE_SENTRY_DSN` (giống pattern SMTP), tắt
     hoàn toàn nếu để trống (đã xác nhận: khi tắt, Vite tree-shake sạch toàn bộ SDK khỏi bundle
     production, không tốn dung lượng). **Việc còn cần bạn tự làm**: tự đăng ký tài khoản Sentry
     (free tier) rồi điền DSN vào `backend/.env`/Render và `VITE_SENTRY_DSN` trên Vercel.
  7. **Chuyển token từ `localStorage` sang cookie `httpOnly`** (thay vì script xoay vòng secret) —
     đổi lớn nhất phiên này: backend set `accessToken`/`refreshToken` là cookie
     `httpOnly; Secure; SameSite=None` (`authController.js`), `requireAuth` đọc từ
     `req.cookies.accessToken`, Socket.IO handshake đọc cookie qua header `Cookie` thô (package
     `cookie`, vì `cookie-parser` không chạy được trên request của engine.io). Frontend
     (`client.js`, `AuthContext.jsx`, `Dashboard.jsx`) bỏ hoàn toàn `localStorage`/`Authorization`
     header, dùng `withCredentials: true`. Đã cập nhật `docs/SECURITY.md` và `CLAUDE.md` (xoá mục
     "gap" localStorage vì đã fix xong).
     **Đã kiểm thử kỹ** (không chỉ tin build pass): test bằng `curl` + cookie jar toàn bộ luồng
     register/me/refresh (xác nhận rotation + revoke token cũ)/logout; sau đó chạy thật 2 dev
     server (backend + web) và dùng Playwright điều khiển Chromium thật để đăng ký → xác nhận
     Dashboard load đúng, cookie đúng `httpOnly`/`Secure`/`SameSite=None`/path, `localStorage`
     rỗng (không rò token), Socket.IO connect thành công (thấy log
     `[socket] user ... connected/disconnected` ở backend), logout xoá cookie + quay lại `/login`
     đúng — có ảnh chụp màn hình xác nhận.
     **Sự cố phụ trong lúc làm (đã tự khắc phục)**: 1 lệnh `npm install @sentry/node` chạy nhầm ở
     thư mục ngoài project (do `cd ..` trước đó) khiến nó cài nhầm vào 1 `package.json` cá nhân
     khác của bạn ở `C:\Users\Rivershen\package.json` (không liên quan tới project này) — đã phát
     hiện qua `npm audit` báo lỗ hổng lạ và gỡ sạch bằng `npm uninstall @sentry/node` ở đúng thư
     mục đó, xác nhận `package.json`/`package-lock.json` khôi phục nguyên trạng trước khi cài lại
     đúng chỗ (`backend/`).
- **2026-07-05** — Người dùng báo lỗi thật trên production sau khi deploy các thay đổi trên:
  1. **404 trên mọi route trừ `/`** (vd `/login`, `/register` refresh trực tiếp) — do Vercel
     preset Vite không tự thêm SPA fallback rewrite. Đã thêm `web/vercel.json`
     (`rewrites: [{ source: "/(.*)", destination: "/index.html" }]`), commit `3326b29`, xác nhận
     lại bằng `curl` trực tiếp: tất cả route trả 200 sau khi deploy.
  2. **Đăng nhập/đăng ký xong bị tự logout ngay** — người dùng gửi log Render, thấy lặp lại
     `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` từ `express-rate-limit`: do chưa cấu hình
     `app.set('trust proxy', 1)` trong khi Render (reverse proxy) luôn thêm header
     `X-Forwarded-For`. Đã thêm dòng này vào `backend/src/server.js`, `node --check` + `npm test`
     pass, commit `5564870` ("Set trust proxy for Render's reverse proxy"), push, xác nhận CI
     pass và backend lên lại bình thường sau 1 khoảng blip SSL ngắn giữa lúc Render redeploy.
  **Chưa xác nhận lại từ người dùng** liệu đăng nhập trên production đã ổn hẳn chưa sau fix này.
- **2026-07-05 (tiếp)** — Người dùng hỏi lại vì sao `AQ-DEVICE-03`/`AQ-DEVICE-04` chưa có dữ liệu.
  Kiểm tra: (a) không có tiến trình `node` nào chạy nền trên máy hiện tại (kể cả cho
  `AQ-DEVICE-01`) — `AQ-DEVICE-01` trong Mongo đang `status: offline`, `lastReadingAt` đã hơn ~18
  tiếng (tiến trình chạy tay trước đó đã dừng khi đóng phiên, đúng như log 2026-07-04 dự đoán);
  (b) `AQ-DEVICE-03`/`04` có field `mqttUsername` trong Mongo (tự sinh khi tạo `Device` qua script)
  nhưng đây **không phải** là credential thật trên HiveMQ Cloud broker — theo đúng thiết kế decoupled
  đã ghi trong `CLAUDE.md`, 2 device này vẫn chưa có credential MQTT thật nào được tạo trên HiveMQ
  console, nên chưa từng có tiến trình `device-simulator` nào publish được cho chúng, kể cả trên
  Render. **Việc còn cần bạn tự làm**: tạo 2 credential PUBLISH_ONLY trên HiveMQ Cloud console cho
  `AQ-DEVICE-03`/`04`, gửi mật khẩu đã đặt; đồng thời cân nhắc chạy lại `device-simulator` cho
  `AQ-DEVICE-01` (local `npm start` hoặc deploy Render Bước 9) vì tiến trình cũ đã dừng.
- **2026-07-05 (tiếp)** — Đã khởi động lại `AQ-DEVICE-01` (`npm start`, PID chạy nền). Người dùng
  tự tạo xong 2 credential `PUBLISH_ONLY` trên HiveMQ Cloud console cho `AQ-DEVICE-03`/`04` và gửi
  mật khẩu. Chạy thêm 2 tiến trình `device-simulator` nền (dùng biến môi trường override thay vì
  sửa `.env` chung: `MQTT_USERNAME`/`MQTT_PASSWORD`/`DEVICE_ID` riêng + `PORT=3001`/`3002` để
  tránh đụng cổng health server 3000 của `AQ-DEVICE-01`) — connect MQTT thành công, publish đều,
  nhưng lần đầu `readingCount` vẫn = 0: phát hiện `AQ-DEVICE-03`/`04` đã có `hmacSecret` set sẵn
  trong Mongo (tự sinh lúc tạo `Device` trước đó) nên backend âm thầm reject payload chưa ký
  (`signature check failed`, chỉ warn log, không lỗi rõ ràng) — đây là lý do `device.status` vẫn
  lên `online` (qua retained `/status` LWT, không qua kiểm tra chữ ký) trong khi `Reading` = 0,
  dễ gây nhầm lẫn. Khắc phục: lấy `hmacSecret` thật của từng device từ Mongo (script 1 lần, đã
  xoá), khởi động lại 2 tiến trình với `DEVICE_HMAC_SECRET` tương ứng để bật ký HMAC đúng theo
  thiết kế bảo mật đã có sẵn (không tắt tính năng ký để né lỗi). Xác nhận lại: cả 3 device đều
  `status: online` và `readingCount` tăng đều theo thời gian thực.
- **2026-07-05 (tiếp)** — Người dùng hỏi rõ nguồn gốc dữ liệu hiện tại (xác nhận: hoàn toàn giả
  lập từ `device-simulator`, không phải phần cứng thật) và muốn thử tích hợp Wokwi (đã có sẵn
  code từ trước, phần "Chế độ B" trong `wokwi/README.md`) để gửi dữ liệu realtime vào backend
  thật. Đã tạo `Device` record `AQ-DEVICE-WOKWI-01` trong Mongo (cùng owner với `AQ-DEVICE-01`,
  script 1 lần đã xoá), sinh sẵn `hmacSecret` để tránh lặp lại đúng lỗi "signature check failed"
  vừa gặp với `AQ-DEVICE-03`/`04`. **Việc còn cần bạn tự làm**: tạo 1 credential `PUBLISH_ONLY`
  trên HiveMQ Cloud console cho username `AQ-DEVICE-WOKWI-01`, rồi làm theo `wokwi/README.md`
  mục "Chế độ B" (dán `sketch.ino`/`diagram.json`/`libraries.txt` vào project mới trên wokwi.com,
  sửa 4 dòng cấu hình `MQTT_HOST`/`MQTT_PORT=8883`/`MQTT_USER`/`MQTT_PASS`, và điền
  `DEVICE_HMAC_SECRET` = giá trị đã sinh) → bấm Play, dữ liệu sẽ vào thẳng Mongo + hiện realtime
  trên dashboard giống 3 device Node.js hiện có.
- **2026-07-05 (tiếp)** — Người dùng chạy thử Wokwi thành công (connect MQTT, publish log đều mỗi
  5s, không lỗi), nhưng dashboard vẫn không hiện dữ liệu. Debug bằng cách gọi trực tiếp
  `parseTimestamp()` (export sẵn từ trước để unit-test) với `ts` mẫu lấy từ log thật (`ts: 28`):
  phát hiện **lỗi thật trong `wokwi/sketch.ino`**, không phải do thao tác của người dùng —
  firmware gửi `tsEpoch = millis()/1000` (thời gian tính từ lúc boot, KHÔNG phải epoch thật), nên
  backend parse ra ngày `1970-01-01` — lệch hàng chục năm so với giờ server thật, bị chặn bởi
  kiểm tra "freshness window" ±5 phút trong `ingestTelemetry()` (`mqttIngestService.js`) → mọi
  reading bị âm thầm reject (chỉ log `console.warn` phía backend, Serial Monitor của Wokwi không
  thấy được nên trông như publish thành công). Đây là lỗi sẽ ảnh hưởng **cả phần cứng ESP32 thật**
  (không có RTC pin sẵn), không chỉ riêng Wokwi. Đã sửa `wokwi/sketch.ino`: thêm hàm
  `syncTimeViaNTP()` (gọi `configTime()` + đợi `time(nullptr)` hợp lệ) chạy 1 lần trong `setup()`
  ngay sau khi có WiFi, và đổi `tsEpoch` sang lấy từ `time(nullptr)` (epoch giây thật) thay vì
  `millis()/1000`. Cũng cập nhật lại đoạn mô tả sai trong `CLAUDE.md` (mục "Data flow") vì trước
  đó ghi nhầm là "Wokwi gửi epoch giây vì millis()-based clocks không có ngày thật" — mô tả đó chỉ
  đúng ở hiện tượng, không đúng ở việc điều này **được backend chấp nhận**; giờ đã sửa để phản ánh
  đúng: firmware phải NTP-sync trước khi gửi. **Việc còn cần bạn tự làm**: dán lại toàn bộ nội
  dung `sketch.ino` đã sửa vào project trên wokwi.com, bấm Play lại — Serial Monitor sẽ in thêm
  dòng "Syncing time via NTP... done, epoch=..." trước khi bắt đầu publish.
- **2026-07-13** — Chủ dự án muốn bàn giao cho người tiếp theo cùng vào làm, nhưng **giữ nguyên
  quyền owner của mình** (chỉ thêm người kia làm admin/collaborator ở từng nơi, không transfer
  ownership). Đã commit + push fix NTP ở trên (`17fab38`) để repo trên GitHub đầy đủ trước khi
  bàn giao. **Việc còn cần bạn tự làm** (đều là thao tác trên web console, không có API/CLI):
  1. **GitHub** (`RiverShen31/IOT_Air_pollution_monitoring`, đang public) — Settings →
     Collaborators and teams → Add people → nhập username/email GitHub của người kia → quyền
     `Write` (đủ push code) hoặc `Admin` (nếu cần họ tự sửa repo settings/CI). Họ phải bấm accept
     invite qua email.
  2. **Render** (backend, service `srv-d8qv8pvavr4c73dsgts0`) — mời ở cấp **Workspace** chứ
     không phải từng service: góc trên trái chọn workspace hiện tại → Settings → Team/Members →
     Invite Member → nhập email → chọn role.
  3. **Vercel** (web) → project Settings → Members → Invite → nhập email. Lưu ý: nếu account
     đang ở gói Hobby cá nhân (không phải Team), Vercel có thể bắt tạo Team trước khi mời được
     thêm người — kiểm tra khi tới bước này, không chắc chắn trước.
  4. **MongoDB Atlas** (project chứa `cluster0.fqwfzcd`) → Access Manager → Project Access →
     Add New User → nhập email → chọn role (vd `Project Data Access Admin` để xem/sửa data mà
     không đụng billing, hoặc `Project Owner` nếu muốn họ ngang quyền bạn).
  5. **HiveMQ Cloud** (cluster `7907f0b393c042ee...`) → kiểm tra mục quản lý team ở cấp
     **account** (không phải cluster). Gói Serverless free có thể giới hạn 1 người dùng/account —
     nếu không mời được, fallback ở mục 6.
  6. **Fallback nếu 1 platform không hỗ trợ mời thêm người ở gói free** (hay gặp ở Vercel
     Hobby / HiveMQ Serverless): đổi mật khẩu tài khoản đó sang mật khẩu mới rồi chia sẻ qua kênh
     an toàn (password manager, không qua chat/email thường), dùng chung tạm thời cho tới khi
     nâng cấp gói hoặc tách account riêng.
  7. **Secret cục bộ** (`backend/.env`, `web/.env`, `device-simulator/.env` — không nằm trong git,
     không nằm trong console nào ở trên) phải gửi trực tiếp qua kênh an toàn: `MONGO_URI`,
     `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, `MQTT_USERNAME`/`MQTT_PASSWORD`, và nếu có dùng thì
     `SMTP_USER`/`SMTP_PASS` (Gmail App Password — nên tạo App Password riêng cho việc này thay vì
     gửi mật khẩu Gmail chính, để có thể thu hồi độc lập) và `SENTRY_DSN`/`VITE_SENTRY_DSN`.
  8. `mosquitto/config/password_file` — không cần gửi (không nằm trong git, chỉ dùng cho path
     Docker local); người tiếp theo tự tạo lại bằng `mosquitto/config/init-credentials.sh` nếu họ
     chọn chạy local thay vì cloud.
