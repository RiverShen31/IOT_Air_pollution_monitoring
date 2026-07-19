import crypto from 'crypto';
import Device from '../models/Device.js';
import Reading, { READING_RETENTION_DAYS } from '../models/Reading.js';
import Alert from '../models/Alert.js';
import User from '../models/User.js';
import { calculateAQI } from '../utils/airQualityIndex.js';
import { sendAlertEmail } from './mailService.js';
import { captureException } from '../config/sentry.js';

const TELEMETRY_TOPIC_FILTER = 'devices/+/telemetry';
const STATUS_TOPIC_FILTER = 'devices/+/status';

// Không gửi lại email cho cùng 1 device+metric quá dày trong lúc còn vượt ngưỡng liên tục.
const EMAIL_COOLDOWN_MS = 30 * 60 * 1000;

// Cửa sổ chấp nhận ts của reading so với giờ server, và giới hạn phải mới hơn reading gần nhất
// đã chấp nhận — chống replay (gửi lại 1 payload đã capture trước đó).
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function deviceIdFromTopic(topic) {
  // devices/{deviceId}/telemetry  ->  {deviceId}
  const parts = topic.split('/');
  return parts[1];
}

export function parseTimestamp(ts) {
  if (ts === undefined || ts === null) return new Date();
  if (typeof ts === 'number') {
    // Wokwi firmware gửi epoch giây (millis()/1000); chuẩn hoá sang epoch ms.
    return new Date(ts < 1e12 ? ts * 1000 : ts);
  }
  const parsed = new Date(ts);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isValidTelemetryPayload(payload) {
  const requiredNumericFields = ['co2_ppm', 'co_ppm', 'pm25_ugm3', 'temperature_c', 'humidity_pct'];
  return requiredNumericFields.every((field) => typeof payload[field] === 'number' && !Number.isNaN(payload[field]));
}

// Chuỗi cố định thứ tự để ký/verify HMAC — không ký JSON.stringify trực tiếp vì ArduinoJson và
// JS JSON.stringify có thể format số khác nhau. Làm tròn 1 chữ số thập phân ở mọi nơi ký/verify
// (JS .toFixed(1) / C %.1f) để tránh lệch định dạng số giữa các bên.
function buildCanonicalString(deviceId, payload) {
  const round1 = (n) => Number(n).toFixed(1);
  return [
    deviceId,
    payload.ts,
    round1(payload.co2_ppm),
    round1(payload.co_ppm),
    round1(payload.pm25_ugm3),
    round1(payload.temperature_c),
    round1(payload.humidity_pct),
  ].join('|');
}

// Chỉ verify khi device.hmacSecret đã được set — thiết bị chưa bật ký HMAC (vd thiết bị cũ) vẫn
// được chấp nhận (soft-accept), xem cách gọi ở message handler bên dưới.
function isValidSignature(device, payload) {
  if (typeof payload.sig !== 'string') return false;

  const canonical = buildCanonicalString(device.deviceId, payload);
  const expectedHex = crypto.createHmac('sha256', device.hmacSecret).update(canonical).digest('hex');
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(payload.sig, 'hex');
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

// Dùng chung cho cả luồng MQTT (topic devices/+/telemetry) và luồng HTTP fallback
// (POST /api/ingest, xác thực bằng x-api-key) — cùng một nghiệp vụ ingest, khác đường vào.
export async function ingestTelemetry(device, payload, io) {
  if (!isValidTelemetryPayload(payload)) {
    const err = new Error('Invalid telemetry payload');
    err.status = 400;
    throw err;
  }

  const ts = parseTimestamp(payload.ts);

  if (Math.abs(Date.now() - ts.getTime()) > REPLAY_WINDOW_MS) {
    const err = new Error('Reading timestamp outside acceptable freshness window');
    err.status = 400;
    throw err;
  }
  // Bỏ qua kiểm tra đơn điệu cho reading đầu tiên của thiết bị (lastReadingTs === null) để
  // không chặn nhầm thiết bị mới đăng ký.
  if (device.lastReadingTs && ts <= device.lastReadingTs) {
    const err = new Error('Reading timestamp not newer than last accepted reading (possible replay)');
    err.status = 409;
    throw err;
  }

  const { aqi, aqiLevel } = calculateAQI(payload);

  const reading = await Reading.create({
    device: device._id,
    deviceId: device.deviceId,
    owner: device.owner,
    ts,
    co2_ppm: payload.co2_ppm,
    co_ppm: payload.co_ppm,
    pm25_ugm3: payload.pm25_ugm3,
    temperature_c: payload.temperature_c,
    humidity_pct: payload.humidity_pct,
    aqi,
    aqiLevel,
    expiresAt: new Date(ts.getTime() + READING_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  });

  device.status = 'online';
  device.lastSeenAt = new Date();
  device.lastReadingTs = ts;
  await device.save();

  io.to(`user:${device.owner}`).emit('reading:new', reading);
  await checkAndCreateAlerts(device, reading, io);

  return reading;
}

async function checkAndCreateAlerts(device, reading, io) {
  const checks = [
    { metric: 'co2_ppm', label: 'CO2', unit: 'ppm' },
    { metric: 'co_ppm', label: 'CO', unit: 'ppm' },
    { metric: 'pm25_ugm3', label: 'PM2.5', unit: 'µg/m³' },
  ];

  let user = null;
  let shouldSaveDevice = false;

  for (const check of checks) {
    const value = reading[check.metric];
    const threshold = device.alertThresholds[check.metric];
    if (value > threshold) {
      const alert = await Alert.create({
        device: device._id,
        deviceId: device.deviceId,
        owner: device.owner,
        metric: check.metric,
        value,
        threshold,
        message: `${check.label} = ${value}${check.unit} vượt ngưỡng cảnh báo (${threshold}${check.unit}) trên thiết bị "${device.name}"`,
      });
      io.to(`user:${device.owner}`).emit('alert:new', alert);

      // Email bị giới hạn tần suất theo cooldown (không phải mỗi reading vượt ngưỡng) — Alert
      // doc + socket emit ở trên vẫn xảy ra bình thường, không đổi hành vi dashboard.
      const lastNotified = device.lastNotifiedAt?.[check.metric];
      if (!lastNotified || Date.now() - new Date(lastNotified).getTime() > EMAIL_COOLDOWN_MS) {
        if (!user) user = await User.findById(device.owner);
        if (user) await sendAlertEmail(user, alert);
        device.lastNotifiedAt[check.metric] = new Date();
        shouldSaveDevice = true;
      }
    }
  }

  if (shouldSaveDevice) await device.save();
}

export function startMqttIngestService(mqttClient, io) {
  mqttClient.on('connect', () => {
    mqttClient.subscribe([TELEMETRY_TOPIC_FILTER, STATUS_TOPIC_FILTER], { qos: 1 }, (err) => {
      if (err) console.error('[mqtt-ingest] subscribe error:', err.message);
      else console.log(`[mqtt-ingest] subscribed to ${TELEMETRY_TOPIC_FILTER}, ${STATUS_TOPIC_FILTER}`);
    });
  });

  mqttClient.on('message', async (topic, messageBuf) => {
    const deviceId = deviceIdFromTopic(topic);

    try {
      const device = await Device.findOne({ deviceId });
      if (!device) {
        console.warn(`[mqtt-ingest] message from unknown device "${deviceId}", ignored`);
        return;
      }

      if (topic.endsWith('/status')) {
        const status = messageBuf.toString();
        device.status = status === 'online' ? 'online' : 'offline';
        device.lastSeenAt = new Date();
        await device.save();
        io.to(`user:${device.owner}`).emit('device:status', {
          deviceId: device.deviceId,
          status: device.status,
          lastSeenAt: device.lastSeenAt,
        });
        return;
      }

      // /telemetry
      let payload;
      try {
        payload = JSON.parse(messageBuf.toString());
      } catch {
        console.warn(`[mqtt-ingest] invalid JSON from device "${deviceId}"`);
        return;
      }

      if (!isValidTelemetryPayload(payload)) {
        console.warn(`[mqtt-ingest] invalid telemetry schema from device "${deviceId}"`);
        return;
      }

      if (!device.hmacSecret) {
        console.warn(`[mqtt-ingest] device "${deviceId}" has no hmacSecret set, accepting unsigned payload`);
      } else if (!isValidSignature(device, payload)) {
        console.warn(`[mqtt-ingest] signature check failed for device "${deviceId}"`);
        return;
      }

      await ingestTelemetry(device, payload, io);
    } catch (err) {
      // Lỗi validate (freshness/replay) đã có err.status — log warn thay vì error để phân biệt
      // với lỗi hạ tầng thật sự (DB down, v.v.)
      if (err.status) {
        console.warn(`[mqtt-ingest] rejected reading from device "${deviceId}": ${err.message}`);
      } else {
        console.error('[mqtt-ingest] processing error:', err.message);
        captureException(err);
      }
    }
  });
}
