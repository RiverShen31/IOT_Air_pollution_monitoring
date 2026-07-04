import nodemailer from 'nodemailer';

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT) !== 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

if (!transporter) {
  console.warn('[mail] SMTP_HOST not set, email alerts disabled (in-app alerts still work)');
}

export async function sendAlertEmail(user, alert) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: `[Cảnh báo chất lượng không khí] ${alert.deviceId}`,
      text: alert.message,
    });
  } catch (err) {
    console.error('[mail] failed to send alert email:', err.message);
  }
}
