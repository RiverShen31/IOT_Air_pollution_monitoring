import Device from '../models/Device.js';
import Alert from '../models/Alert.js';

// Đủ lớn hơn PUBLISH_INTERVAL_MS mặc định (5s) để tránh báo nhầm do jitter/reconnect ngắn.
// Bắt trường hợp mất kết nối đột ngột (rớt mạng/mất điện) — khác với ngắt kết nối tử tế
// (Ctrl+C) đã có LWT xử lý ngay qua topic devices/{deviceId}/status.
const STALE_CUTOFF_MS = 3 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

export function startDeviceStaleCheckService(io) {
  setInterval(async () => {
    const cutoff = new Date(Date.now() - STALE_CUTOFF_MS);
    const staleDevices = await Device.find({ status: 'online', lastSeenAt: { $lt: cutoff } });

    for (const device of staleDevices) {
      device.status = 'offline';
      await device.save();

      io.to(`user:${device.owner}`).emit('device:status', {
        deviceId: device.deviceId,
        status: 'offline',
      });

      const minutesSince = Math.round((Date.now() - device.lastSeenAt.getTime()) / 60000);
      const alert = await Alert.create({
        device: device._id,
        deviceId: device.deviceId,
        owner: device.owner,
        metric: 'device_stale',
        value: minutesSince,
        threshold: STALE_CUTOFF_MS / 60000,
        message: `Thiết bị "${device.name}" không phản hồi trong hơn ${minutesSince} phút`,
      });
      io.to(`user:${device.owner}`).emit('alert:new', alert);
    }
  }, CHECK_INTERVAL_MS);
}
