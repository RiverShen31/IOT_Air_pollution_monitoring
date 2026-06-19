# Các kỹ thuật bảo mật áp dụng trong hệ thống

Tài liệu này mô tả các cơ chế bảo mật đã triển khai trong code (không chỉ lý thuyết), kèm vị
trí trong source để tiện đối chiếu khi báo cáo / vấn đáp.

## 1. Xác thực người dùng (User Authentication)

| Kỹ thuật | Mô tả | Vị trí code |
|---|---|---|
| Hash mật khẩu | `bcrypt` (cost factor 10), không bao giờ lưu plaintext password | `backend/src/models/User.js` |
| JWT Access Token | Thời hạn ngắn (15 phút), ký bằng `JWT_ACCESS_SECRET`, chứa `sub` (userId) + `role` | `backend/src/utils/jwt.js` |
| JWT Refresh Token | Thời hạn dài (7 ngày), lưu hash trong MongoDB (`RefreshToken`) để có thể **thu hồi** (revoke) khi logout — không chỉ tin tưởng JWT signature | `backend/src/models/RefreshToken.js`, `backend/src/controllers/authController.js` |
| Refresh Token Rotation | Mỗi lần `/api/auth/refresh` thành công, token cũ bị revoke và cấp token mới → giảm thiệt hại nếu refresh token bị đánh cắp | `authController.refresh` |
| Chống brute-force | `express-rate-limit` giới hạn số lần gọi `/api/auth/login` (5 lần / 15 phút / IP) | `backend/src/middleware/rateLimiter.js` |
| Khoá tài khoản tạm thời | Đếm `failedLoginAttempts`, khoá 15 phút sau 5 lần sai liên tiếp | `User.js` + `authController.login` |
| Phân quyền (RBAC) | Role `user` / `admin` trong JWT payload, middleware `requireRole('admin')` cho route quản trị | `backend/src/middleware/auth.js` |

## 2. Xác thực API (API Authentication)

| Kỹ thuật | Mô tả | Vị trí code |
|---|---|---|
| JWT Bearer cho REST API | Mọi route `/api/devices`, `/api/readings` yêu cầu header `Authorization: Bearer <accessToken>`, verify bằng middleware | `backend/src/middleware/auth.js` (`requireAuth`) |
| API Key cho thiết bị (HTTP fallback) | Mỗi `Device` có `apiKey` ngẫu nhiên (32 byte, `crypto.randomBytes`) dùng cho việc thiết bị gọi trực tiếp HTTP nếu không qua MQTT | `backend/src/models/Device.js`, `backend/src/middleware/auth.js` (`requireApiKey`) |
| MQTT Authentication | Mỗi thiết bị có `mqttUsername`/`mqttPassword` riêng, broker xác thực qua `password_file` (mã hoá SHA512 bởi `mosquitto_passwd`) | `mosquitto/config/password_file` |
| MQTT Authorization (ACL) | File `acl.conf`: device chỉ `publish` được vào đúng topic `devices/{deviceId}/#` của chính nó; backend có quyền đọc toàn bộ `devices/#` | `mosquitto/config/acl.conf` |
| WebSocket Authentication | Socket.IO middleware xác thực JWT ngay khi handshake (`io.use`), từ chối kết nối nếu token không hợp lệ; client chỉ join được room `user:{userId}` của chính mình | `backend/src/socket.js` |
| CORS | Chỉ cho phép origin của web app (`CORS_ORIGIN` trong `.env`), chặn các origin khác gọi API | `backend/src/server.js` |

## 3. Các cơ chế bảo mật khác trong hệ thống

| Kỹ thuật | Mô tả | Vị trí code |
|---|---|---|
| HTTP Security Headers | `helmet` — bật `X-Content-Type-Options`, `X-Frame-Options`, ẩn `X-Powered-By`, CSP cơ bản | `backend/src/server.js` |
| Input Validation | `express-validator` kiểm tra & sanitize toàn bộ input từ client (email format, độ dài password, kiểu dữ liệu reading...) trước khi vào controller | `backend/src/routes/*.js` |
| Chống NoSQL Injection | Dùng Mongoose schema có kiểu dữ liệu cố định (không nhận object lạ vào field string), input luôn qua validator trước khi build query | toàn bộ `controllers/` |
| Giới hạn rate toàn API | Rate limit chung cho toàn bộ `/api/*` (100 req/phút/IP) chống DoS đơn giản & lạm dụng | `backend/src/middleware/rateLimiter.js` |
| Phân tách quyền theo thiết bị (data isolation) | Mỗi `Device` gắn `ownerId`; mọi truy vấn reading/device đều `filter({ ownerId: req.user.id })` → user A không bao giờ thấy dữ liệu của user B dù đoán được `deviceId` | `controllers/deviceController.js`, `controllers/readingController.js` |
| Audit trail tối thiểu | Lưu `lastSeenAt`, `lastIp` trên mỗi lần ingest dữ liệu từ thiết bị, phục vụ phát hiện bất thường | `services/mqttIngestService.js` |
| Quản lý secret | Toàn bộ secret (JWT secret, Mongo URI, MQTT password) nằm trong `.env`, **không hard-code**, có `.env.example` làm mẫu, `.gitignore` loại trừ `.env` thật | `backend/.env.example`, `.gitignore` |
| Last Will & Testament (MQTT) | Thiết bị khai báo LWT khi connect MQTT → nếu mất kết nối đột ngột, broker tự publish `offline` lên topic status, backend phát hiện thiết bị bị ngắt/giả mạo mất kết nối | `device-simulator/simulate.js`, `wokwi/sketch.ino` |

## 4. Những gì KHÔNG nằm trong phạm vi bản giả lập hiện tại (cần lưu ý khi báo cáo)

Đây là môi trường **giả lập / phát triển**, một số thứ cần bật thêm khi triển khai thật (production):

- **TLS/SSL**: khi chạy **local hoàn toàn bằng Docker** (`docker-compose.yml` + `mosquitto/`),
  hệ thống dùng `http://` và `mqtt://` (không mã hoá) để đơn giản hoá việc chạy thử. Khi **deploy
  lên cloud** theo `docs/DEPLOYMENT.md`, TLS đã được bật sẵn: Render/Vercel tự cấp HTTPS, và
  HiveMQ Cloud bắt buộc `mqtts://` (port 8883) — `backend/src/config/mqtt.js`,
  `device-simulator/simulate.js` (qua thư viện `mqtt.js`, tự nhận diện scheme `mqtts://`) và
  `wokwi/sketch.ino` (chuyển sang `WiFiClientSecure` khi `MQTT_PORT == 8883`) đều đã hỗ trợ sẵn,
  không cần sửa code.
- **Secret rotation**: JWT secret/API key hiện tạo 1 lần thủ công, production nên có cơ chế xoay
  vòng định kỳ.
- **2FA**: chưa triển khai xác thực 2 lớp cho user, có thể bổ sung (TOTP) như hướng phát triển.
- **Lưu token ở client**: web app hiện lưu access/refresh token trong `localStorage`
  (`web/src/api/client.js`) để đơn giản hoá demo. Nhược điểm: dễ bị đánh cắp qua XSS. Production
  nên chuyển sang cookie `httpOnly` + `Secure` + `SameSite=Strict` cho refresh token.

Phần kiến trúc & code đã được thiết kế để các phần này có thể bật thêm mà không cần đổi cấu
trúc hệ thống (chỉ đổi config/env).
