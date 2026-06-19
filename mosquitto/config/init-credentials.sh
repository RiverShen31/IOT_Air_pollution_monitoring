#!/usr/bin/env bash
# Tạo file password_file cho Mosquitto (chạy 1 LẦN DUY NHẤT trước khi `docker compose up` lần đầu,
# hoặc mỗi khi muốn reset toàn bộ mật khẩu thiết bị/backend).
#
# Dùng image eclipse-mosquitto sẵn có để chạy lệnh mosquitto_passwd, không cần cài đặt gì thêm
# ngoài Docker.
#
# Cách chạy (Git Bash / WSL / Linux / macOS):
#   bash mosquitto/config/init-credentials.sh
#
# Cách chạy (PowerShell) xem README.md ở thư mục gốc dự án.

set -e
cd "$(dirname "$0")"

PWFILE="password_file"
rm -f "$PWFILE"
touch "$PWFILE"

docker run --rm -v "$(pwd):/mosquitto/config" eclipse-mosquitto \
  mosquitto_passwd -b -c /mosquitto/config/password_file backend backendpass123

docker run --rm -v "$(pwd):/mosquitto/config" eclipse-mosquitto \
  mosquitto_passwd -b /mosquitto/config/password_file AQ-DEVICE-01 device01pass

docker run --rm -v "$(pwd):/mosquitto/config" eclipse-mosquitto \
  mosquitto_passwd -b /mosquitto/config/password_file AQ-DEVICE-WOKWI-01 wokwidevicepass

echo "Da tao mosquitto/config/password_file voi 3 tai khoan: backend, AQ-DEVICE-01, AQ-DEVICE-WOKWI-01"
echo "LUU Y: day la mat khau DEMO, doi truoc khi dung that."
