import Device from '../models/Device.js';
import Reading from '../models/Reading.js';

export async function getTelemetryDebug(req, res) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const devices = await Device.find({ owner: req.user.id }).sort({ createdAt: -1 });

  const result = {
    fetchedAt: new Date(),
    timeRange: {
      from: oneHourAgo,
      to: new Date(),
    },
    devices: [],
  };

  for (const device of devices) {
    const readings = await Reading.find({
      device: device._id,
      ts: { $gte: oneHourAgo },
    }).sort({ ts: -1 });

    result.devices.push({
      _id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      location: device.location,
      readingCount: readings.length,
      readings: readings.map((r) => ({
        _id: r._id,
        ts: r.ts,
        co2_ppm: r.co2_ppm,
        co_ppm: r.co_ppm,
        pm25_ugm3: r.pm25_ugm3,
        temperature_c: r.temperature_c,
        humidity_pct: r.humidity_pct,
        aqi: r.aqi,
        aqiLevel: r.aqiLevel,
        createdAt: r.createdAt,
      })),
    });
  }

  res.json(result);
}
