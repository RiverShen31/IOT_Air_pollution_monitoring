import Device from '../models/Device.js';
import Reading from '../models/Reading.js';
import Alert from '../models/Alert.js';

async function ownedDeviceOrNull(deviceMongoId, userId) {
  return Device.findOne({ _id: deviceMongoId, owner: userId });
}

export async function latestReading(req, res) {
  const device = await ownedDeviceOrNull(req.params.id, req.user.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const reading = await Reading.findOne({ device: device._id }).sort({ ts: -1 });
  res.json({ reading });
}

export async function historyReadings(req, res) {
  const device = await ownedDeviceOrNull(req.params.id, req.user.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const { from, to } = req.query;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  const filter = { device: device._id };
  if (from || to) {
    filter.ts = {};
    if (from) filter.ts.$gte = new Date(from);
    if (to) filter.ts.$lte = new Date(to);
  }

  const readings = await Reading.find(filter).sort({ ts: -1 }).limit(limit);
  res.json({ readings: readings.reverse() });
}

export async function exportReadingsCsv(req, res) {
  const device = await ownedDeviceOrNull(req.params.id, req.user.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const { from, to } = req.query;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  const filter = { device: device._id };
  if (from || to) {
    filter.ts = {};
    if (from) filter.ts.$gte = new Date(from);
    if (to) filter.ts.$lte = new Date(to);
  }

  const readings = await Reading.find(filter).sort({ ts: -1 }).limit(limit);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${device.deviceId}-history.csv"`);
  res.write('ts,co2_ppm,co_ppm,pm25_ugm3,temperature_c,humidity_pct,aqi,aqiLevel\n');
  for (const r of readings.reverse()) {
    res.write(`${r.ts.toISOString()},${r.co2_ppm},${r.co_ppm},${r.pm25_ugm3},${r.temperature_c},${r.humidity_pct},${r.aqi},${r.aqiLevel}\n`);
  }
  res.end();
}

export async function listAlerts(req, res) {
  const devices = await Device.find({ owner: req.user.id }).select('_id');
  const deviceIds = devices.map((d) => d._id);

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const alerts = await Alert.find({ device: { $in: deviceIds } })
    .sort({ createdAt: -1 })
    .limit(limit);

  res.json({ alerts });
}
