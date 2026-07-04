import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id.toString(), role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

// Refresh token: JWT ngẫu nhiên hoá (jti) + lưu hash trong DB (RefreshToken model) để
// có thể revoke từng phiên đăng nhập độc lập, không phụ thuộc hoàn toàn vào chữ ký JWT.
export function generateRefreshTokenValue() {
  return crypto.randomBytes(48).toString('hex');
}

export function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function refreshExpiryDate() {
  const days = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

const DURATION_RE = /^(\d+)(s|m|h|d)$/;
const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

// Chuyển "15m"/"7d" (định dạng dùng cho JWT_ACCESS_EXPIRES) sang ms, dùng làm maxAge cho cookie.
function durationToMs(value, fallbackMs) {
  const match = DURATION_RE.exec(value || '');
  return match ? Number(match[1]) * UNIT_MS[match[2]] : fallbackMs;
}

export function accessTokenCookieMaxAgeMs() {
  return durationToMs(process.env.JWT_ACCESS_EXPIRES, 15 * 60 * 1000);
}

export function refreshTokenCookieMaxAgeMs() {
  const days = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);
  return days * 24 * 60 * 60 * 1000;
}
