import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    deviceId: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // 'device_stale' = cảnh báo mất kết nối đột ngột (không phải vượt ngưỡng cảm biến), do
    // deviceStaleCheckService phát hiện; value/threshold khi đó là số phút, không phải đơn vị cảm biến.
    metric: { type: String, enum: ['co2_ppm', 'co_ppm', 'pm25_ugm3', 'device_stale'], required: true },
    value: { type: Number, required: true },
    threshold: { type: Number, required: true },
    message: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('Alert', alertSchema);
