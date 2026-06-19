#!/usr/bin/env bash
# Thêm 1 thiết bị mới vào Mosquitto: tạo tài khoản MQTT + ACL giới hạn topic.
#
# Dùng sau khi tạo thiết bị qua API backend (POST /api/devices trả về deviceId).
# Trong bản giả lập này, việc cấp quyền MQTT cho broker là bước thủ công (production
# thật nên dùng Mosquitto dynamic-security plugin để backend tự động hoá qua API).
#
# Cách dùng:
#   bash mosquitto/config/add-device.sh <deviceId> <mqttPassword>
#
# Sau khi chạy xong, restart container mosquitto để nạp lại password_file/acl.conf:
#   docker compose restart mosquitto

set -e
cd "$(dirname "$0")"

DEVICE_ID="$1"
DEVICE_PASS="$2"

if [ -z "$DEVICE_ID" ] || [ -z "$DEVICE_PASS" ]; then
  echo "Usage: bash add-device.sh <deviceId> <mqttPassword>"
  exit 1
fi

docker run --rm -v "$(pwd):/mosquitto/config" eclipse-mosquitto \
  mosquitto_passwd -b /mosquitto/config/password_file "$DEVICE_ID" "$DEVICE_PASS"

{
  echo ""
  echo "user $DEVICE_ID"
  echo "topic write devices/$DEVICE_ID/telemetry"
  echo "topic readwrite devices/$DEVICE_ID/status"
} >> acl.conf

echo "Da them thiet bi '$DEVICE_ID' vao password_file va acl.conf."
echo "Chay 'docker compose restart mosquitto' de ap dung."
