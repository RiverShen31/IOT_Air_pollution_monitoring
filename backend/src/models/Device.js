import mongoose from 'mongoose';
import crypto from 'crypto';

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    apiKey: { type: String, required: true, unique: true },
    // Secret riêng để ký/verify HMAC payload MQTT — cố ý tách khỏi apiKey (apiKey còn là bearer
    // credential cho HTTP fallback ingest, trộn 2 vai trò làm lộ 1 cái là lộ cả 2). Có thể null
    // cho các thiết bị chưa bật ký (xem isValidSignature trong mqttIngestService.js).
    hmacSecret: { type: String, default: null },
    mqttUsername: { type: String, required: true },
    location: { type: String, default: '' },
    status: { type: String, enum: ['online', 'offline', 'unknown'], default: 'unknown' },
    lastSeenAt: { type: Date, default: null },
    lastIp: { type: String, default: null },
    // Chống replay: từ chối reading có ts không mới hơn reading gần nhất đã chấp nhận.
    lastReadingTs: { type: Date, default: null },
    // Cooldown gửi email cảnh báo theo từng metric, tránh spam mỗi 5s khi vượt ngưỡng liên tục.
    lastNotifiedAt: {
      co2_ppm: { type: Date, default: null },
      co_ppm: { type: Date, default: null },
      pm25_ugm3: { type: Date, default: null },
    },
    // Ngưỡng cảnh báo riêng cho từng thiết bị (người dùng có thể tuỳ chỉnh)
    alertThresholds: {
      co2_ppm: { type: Number, default: 1500 },
      co_ppm: { type: Number, default: 35 },
      pm25_ugm3: { type: Number, default: 150 },
    },
  },
  { timestamps: true }
);

// Phục vụ quét định kỳ tìm thiết bị mất kết nối đột ngột (deviceStaleCheckService)
deviceSchema.index({ status: 1, lastSeenAt: 1 });

deviceSchema.statics.generateApiKey = function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
};

deviceSchema.statics.generateHmacSecret = function generateHmacSecret() {
  return crypto.randomBytes(32).toString('hex');
};

export default mongoose.model('Device', deviceSchema);
