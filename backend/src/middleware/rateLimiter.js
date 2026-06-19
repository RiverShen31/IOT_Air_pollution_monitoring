import rateLimit from 'express-rate-limit';

// Giới hạn chung cho toàn bộ /api/* - chống lạm dụng/DoS đơn giản
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Giới hạn chặt hơn cho login/register - chống brute-force dò mật khẩu
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again in 15 minutes.' },
});
