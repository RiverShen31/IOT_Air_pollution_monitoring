import Device from '../models/Device.js';
import Reading from '../models/Reading.js';
import Alert from '../models/Alert.js';
import { calculateAQI } from '../utils/airQualityIndex.js';

const TELEMETRY_TOPIC_FILTER = 'devices/+/telemetry';
const STATUS_TOPIC_FILTER = 'devices/+/status';

function deviceIdFromTopic(topic) {
  // devices/{deviceId}/telemetry  ->  {deviceId}
  const parts = topic.split('/');
  return parts[1];
}

function parseTimestamp(ts) {
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

// Dùng chung cho cả luồng MQTT (topic devices/+/telemetry) và luồng HTTP fallback
// (POST /api/ingest, xác thực bằng x-api-key) — cùng một nghiệp vụ ingest, khác đường vào.
export async function ingestTelemetry(device, payload, io) {
  if (!isValidTelemetryPayload(payload)) {
    const err = new Error('Invalid telemetry payload');
    err.status = 400;
    throw err;
  }

  const { aqi, aqiLevel } = calculateAQI(payload);

  const reading = await Reading.create({
    device: device._id,
    deviceId: device.deviceId,
    owner: device.owner,
    ts: parseTimestamp(payload.ts),
    co2_ppm: payload.co2_ppm,
    co_ppm: payload.co_ppm,
    pm25_ugm3: payload.pm25_ugm3,
    temperature_c: payload.temperature_c,
    humidity_pct: payload.humidity_pct,
    aqi,
    aqiLevel,
  });

  device.status = 'online';
  device.lastSeenAt = new Date();
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
    }
  }
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

      await ingestTelemetry(device, payload, io);
    } catch (err) {
      console.error('[mqtt-ingest] processing error:', err.message);
    }
  });
}
