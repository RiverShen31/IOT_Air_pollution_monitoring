import * as Sentry from '@sentry/react';

// Tuỳ chọn: chỉ bật khi có VITE_SENTRY_DSN (giống pattern SENTRY_DSN ở backend) — để trống thì
// không lỗi, chỉ đơn giản là không có error tracking phía client.
const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({ dsn, environment: import.meta.env.MODE, tracesSampleRate: 0 });
}

export { Sentry };
