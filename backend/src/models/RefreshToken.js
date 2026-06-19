import mongoose from 'mongoose';

// Lưu HASH của refresh token (không lưu plaintext) để có thể thu hồi (revoke) theo từng phiên,
// thay vì chỉ dựa vào chữ ký JWT (vốn không thể thu hồi trước hạn nếu không có blacklist).
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefreshToken', refreshTokenSchema);
