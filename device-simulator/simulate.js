// Giả lập thiết bị IoT đo chất lượng không khí (MQ135 + MQ7 + PM2.5/bụi mịn + DHT11).
// Publish dữ liệu lên MQTT broker đúng định dạng JSON mà backend (mqttIngestService) mong đợi.
// Mục tiêu: thay thế tạm thời cho Arduino/ESP32 thật trong lúc chưa có phần cứng
// (xem thêm wokwi/ để chạy bản giả lập có firmware C++ thật trong trình giả lập Wokwi).

import 'dotenv/config';
import mqtt from 'mqtt';

const MQTT_HOST = process.env.MQTT_HOST || 'mqtt://localhost:1883';
const DEVICE_ID = process.env.DEVICE_ID || 'AQ-DEVICE-01';
const MQTT_USERNAME = process.env.MQTT_USERNAME || DEVICE_ID;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
const PUBLISH_INTERVAL_MS = Number(process.env.PUBLISH_INTERVAL_MS || 5000);
const SCENARIO = process.env.SCENARIO || 'normal';

const TELEMETRY_TOPIC = `devices/${DEVICE_ID}/telemetry`;
const STATUS_TOPIC = `devices/${DEVICE_ID}/status`;

// ---- Mô hình giả lập cảm biến: random-walk quanh baseline tuỳ kịch bản ----
// Baseline lấy tham chiếu gần với dữ liệu thực tế của dự án CircuitDigest gốc
// (MQ135 đo CO2/NH3 ppm, MQ7 đo CO ppm, GP2Y10 đo PM2.5 ug/m3, DHT11 đo nhiệt độ/độ ẩm).
const SCENARIOS = {
  normal:    { co2: 500,  co: 2,  pm25: 25,  tempBase: 28, humBase: 65 },
  polluted:  { co2: 1800, co: 40, pm25: 180, tempBase: 32, humBase: 55 },
  rush_hour: { co2: 900,  co: 15, pm25: 90,  tempBase: 30, humBase: 60 },
};

const baseline = SCENARIOS[SCENARIO] || SCENARIOS.normal;

let state = {
  co2_ppm: baseline.co2,
  co_ppm: baseline.co,
  pm25_ugm3: baseline.pm25,
  temperature_c: baseline.tempBase,
  humidity_pct: baseline.humBase,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomWalk(value, step, min, max) {
  const delta = (Math.random() - 0.5) * 2 * step;
  return clamp(value + delta, min, max);
}

function nextReading() {
  state = {
    co2_ppm: Math.round(randomWalk(state.co2_ppm, 40, 350, 5000)),
    co_ppm: Number(randomWalk(state.co_ppm, 1.5, 0, 200).toFixed(1)),
    pm25_ugm3: Math.round(randomWalk(state.pm25_ugm3, 8, 0, 500)),
    temperature_c: Number(randomWalk(state.temperature_c, 0.3, 15, 45).toFixed(1)),
    humidity_pct: Number(randomWalk(state.humidity_pct, 1.5, 20, 95).toFixed(1)),
  };
  return { ts: new Date().toISOString(), ...state };
}

console.log(`[${DEVICE_ID}] Connecting to ${MQTT_HOST} (scenario=${SCENARIO}) ...`);

const client = mqtt.connect(MQTT_HOST, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clientId: `sim-${DEVICE_ID}-${Math.random().toString(16).slice(2, 8)}`,
  will: {
    topic: STATUS_TOPIC,
    payload: 'offline',
    qos: 1,
    retain: true,
  },
  reconnectPeriod: 3000,
});

let timer = null;

client.on('connect', () => {
  console.log(`[${DEVICE_ID}] MQTT connected.`);
  client.publish(STATUS_TOPIC, 'online', { qos: 1, retain: true });

  timer = setInterval(() => {
    const reading = nextReading();
    const payload = JSON.stringify(reading);
    client.publish(TELEMETRY_TOPIC, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[${DEVICE_ID}] Publish error:`, err.message);
      } else {
        console.log(`[${DEVICE_ID}] -> ${TELEMETRY_TOPIC}: ${payload}`);
      }
    });
  }, PUBLISH_INTERVAL_MS);
});

client.on('reconnect', () => console.log(`[${DEVICE_ID}] Reconnecting...`));
client.on('error', (err) => console.error(`[${DEVICE_ID}] MQTT error:`, err.message));
client.on('close', () => console.log(`[${DEVICE_ID}] Connection closed.`));

function shutdown() {
  console.log(`\n[${DEVICE_ID}] Shutting down, publishing offline status...`);
  if (timer) clearInterval(timer);
  client.publish(STATUS_TOPIC, 'offline', { qos: 1, retain: true }, () => {
    client.end(false, {}, () => process.exit(0));
  });
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
