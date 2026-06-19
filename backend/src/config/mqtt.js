import mqtt from 'mqtt';

export function connectMqtt() {
  const url = process.env.MQTT_URL;
  if (!url) throw new Error('MQTT_URL is not set');

  const client = mqtt.connect(url, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: `backend-${Math.random().toString(16).slice(2, 10)}`,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => console.log('[mqtt] backend connected to broker'));
  client.on('reconnect', () => console.log('[mqtt] reconnecting...'));
  client.on('error', (err) => console.error('[mqtt] error:', err.message));

  return client;
}
