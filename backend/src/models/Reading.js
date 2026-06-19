import mongoose from 'mongoose';

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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Tối ưu truy vấn lịch sử theo thiết bị + khoảng thời gian
readingSchema.index({ deviceId: 1, ts: -1 });

export default mongoose.model('Reading', readingSchema);
