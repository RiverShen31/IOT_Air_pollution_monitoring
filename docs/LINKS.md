# Danh sách link kiểm tra hệ thống (production)

File tổng hợp toàn bộ link để tự kiểm tra từng thành phần đang chạy ổn không. Xem thêm
`NEXT_STEPS.md` (trạng thái deploy chi tiết) và `docs/DEPLOYMENT.md` (hướng dẫn deploy gốc).

## Cần lưu ý trước

**"Device" (thiết bị) chưa từng được publish/deploy lên đâu cả** — chỉ có **web** (Vercel) và
**backend** (Render) là đã lên cloud thật sự. `device-simulator/` luôn luôn chỉ là 1 script Node.js
chạy tay trên máy local (`npm start`) hoặc trong tab trình duyệt Wokwi — không phải service 24/7.
Đây là lý do dashboard bị "đứng hình" từ 20/6: hôm đó bạn tắt script chạy tay đó đi, còn
web/backend/broker/DB vẫn sống bình thường nhưng không có ai gửi dữ liệu mới. Xem mục "Gợi ý phát
triển" trong `NEXT_STEPS.md` nếu muốn deploy simulator thành service chạy liên tục.

## 1. Ứng dụng chính (những gì người dùng cuối thấy)

| Thành phần | Link | Kiểm tra gì |
|---|---|---|
| Web Dashboard | https://iot-air-pollution-monitoring.vercel.app | Đăng nhập, xem dashboard realtime, trang `/history` |
| Backend health check | https://iot-air-pollution-monitoring.onrender.com/health | Phải trả về `{"status":"ok",...}` |

## 2. Console quản trị hạ tầng (cần đăng nhập bằng tài khoản của bạn)

| Dịch vụ | Link | Dùng để |
|---|---|---|
| Render (backend) | https://dashboard.render.com/web/srv-d8qv8pvavr4c73dsgts0 | Xem log backend (Mongo/MQTT connect, ingest), env vars, redeploy |
| Vercel (frontend) | https://vercel.com/dashboard | Xem build/deploy log web, env vars (`VITE_API_URL`) |
| MongoDB Atlas | https://cloud.mongodb.com | Xem dữ liệu thật trong collection `readings`/`devices`/`alerts` (cluster `cluster0.fqwfzcd.mongodb.net`, db `air_pollution_iot`), dung lượng đã dùng/512MB |
| HiveMQ Cloud | https://console.hivemq.cloud/clusters/7907f0b393c042ee8addaaade1bbfb52/access-management | Xem/sửa credential MQTT (`backend`, `AQ-DEVICE-01`), số kết nối đang mở, traffic đã dùng |
| GitHub (source code) | https://github.com/RiverShen31/IOT_Air_pollution_monitoring | Code, commit history, Actions (nếu có CI) |

## 3. Chạy "thiết bị" để có dữ liệu mới (không có link — chạy lệnh)

Không có URL public cho phần này vì nó chưa được deploy (xem lưu ý ở trên):

```powershell
cd device-simulator
npm start
```
hoặc mở Wokwi theo `wokwi/README.md` (dán `diagram.json`/`sketch.ino`/`libraries.txt` vào wokwi.com).

Cả hai đều publish vào cùng broker/backend production ở trên — chạy xong vài giây sẽ thấy dữ liệu
mới trên Vercel dashboard.
