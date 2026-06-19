import mongoose from 'mongoose';
import crypto from 'crypto';

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    apiKey: { type: String, required: true, unique: true },
    mqttUsername: { type: String, required: true },
    location: { type: String, default: '' },
    status: { type: String, enum: ['online', 'offline', 'unknown'], default: 'unknown' },
    lastSeenAt: { type: Date, default: null },
    lastIp: { type: String, default: null },
    // Ngưỡng cảnh báo riêng cho từng thiết bị (người dùng có thể tuỳ chỉnh)
    alertThresholds: {
      co2_ppm: { type: Number, default: 1500 },
      co_ppm: { type: Number, default: 35 },
      pm25_ugm3: { type: Number, default: 150 },
    },
  },
  { timestamps: true }
);

deviceSchema.statics.generateApiKey = function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
};

export default mongoose.model('Device', deviceSchema);
