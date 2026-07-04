import { verifyAccessToken } from '../utils/jwt.js';
import Device from '../models/Device.js';

// Xác thực người dùng qua JWT access token — đọc từ cookie httpOnly (set bởi authController),
// không còn nhận qua header Authorization/localStorage để giảm rủi ro bị đánh cắp qua XSS.
export function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ error: 'Missing access token cookie' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Xác thực thiết bị gọi REST API trực tiếp (HTTP fallback, không qua MQTT) bằng API Key
export async function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  const device = await Device.findOne({ apiKey });
  if (!device) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.device = device;
  next();
}
