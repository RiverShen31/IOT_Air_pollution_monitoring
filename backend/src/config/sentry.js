import * as Sentry from '@sentry/node';

// Tuỳ chọn: chỉ bật khi có SENTRY_DSN (giống pattern SMTP trong mailService.js) — để trống thì
// không lỗi, chỉ đơn giản là không có error tracking.
export const sentryEnabled = Boolean(process.env.SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
  });
  console.log('[sentry] error tracking enabled');
} else {
  console.warn('[sentry] SENTRY_DSN not set, error tracking disabled');
}

export function captureException(err) {
  if (sentryEnabled) Sentry.captureException(err);
}

// Đăng ký sau khi khai báo hết route, trước error handler của app — Sentry cần thấy route
// nào đã match để gắn exception vào đúng transaction (xem docs setupExpressErrorHandler).
export function setupExpressErrorHandler(app) {
  if (sentryEnabled) Sentry.setupExpressErrorHandler(app);
}

export { Sentry };
