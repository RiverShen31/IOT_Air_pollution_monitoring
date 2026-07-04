import mongoose from 'mongoose';

// Atlas M0 free tier chỉ có 512MB — tự động xoá reading cũ hơn ngưỡng này để tránh đầy dung lượng.
export const READING_RETENTION_DAYS = 30;

const readingSchema = new mongoose.Schema(
  {
    device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ts: { type: Date, required: true, index: true },
    co2_ppm: { type: Number, required: true },
    co_ppm: { type: Number, required: true },
    pm25_ugm3: { type: Number, required: true },
    temperature_c: { type: Number, required: true },
    humidity_pct: { type: Number, required: true },
    aqi: { type: Number, required: true },
    aqiLevel: {
      type: String,
      enum: ['Good', 'Moderate', 'Unhealthy', 'Very Unhealthy', 'Hazardous'],
      required: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Tối ưu truy vấn lịch sử theo thiết bị + khoảng thời gian
readingSchema.index({ deviceId: 1, ts: -1 });
// TTL: Mongo tự xoá document khi qua mốc expiresAt (cùng pattern với RefreshToken.js)
readingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Reading', readingSchema);
