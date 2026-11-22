import nodemailer from 'nodemailer';

let transporter;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function getTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass) return null;
  if (!transporter) transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export async function sendRegistrationOtp({ email, fullName, registrationNo, otp }) {
  const mailer = getTransporter();
  if (!mailer) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured.');
    console.log(`Development OTP for ${registrationNo}: ${otp}`);
    return { delivered: false, development: true };
  }
  await mailer.sendMail({
    from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER.trim(),
    to: email,
    subject: 'GradFlow — Account Activation Code',
    text: `Dear ${fullName}, your GradFlow activation code is ${otp}. It expires in 10 minutes. Do not share this code.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><div style="background:#062b1a;color:white;padding:20px"><strong>GradFlow Academic Operations Platform</strong></div><div style="padding:24px;border:1px solid #e2e8f0"><p>Dear ${escapeHtml(fullName)},</p><p>Use the following one-time code to activate your student account:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#0b4d2c">${escapeHtml(otp)}</p><p>This code expires in 10 minutes. Do not share it with anyone.</p><small>Registration: ${escapeHtml(registrationNo)}</small></div></div>`,
  });
  return { delivered: true, development: false };
}

export async function sendPasswordResetOtp({ email, fullName, otp }) {
  const mailer = getTransporter();
  if (!mailer) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured.');
    console.log(`Development password reset OTP for ${email}: ${otp}`);
    return { delivered: false, development: true };
  }
  await mailer.sendMail({
    from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER.trim(),
    to: email,
    subject: 'GradFlow — Password Reset Code',
    text: `Dear ${fullName}, your GradFlow password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this message.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><div style="background:#062b1a;color:white;padding:20px"><strong>GradFlow Academic Operations Platform</strong></div><div style="padding:24px;border:1px solid #e2e8f0"><p>Dear ${escapeHtml(fullName)},</p><p>Use this one-time code to continue your password reset:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#0b4d2c">${escapeHtml(otp)}</p><p>The code expires in 10 minutes. If you did not request a reset, you can safely ignore this message.</p></div></div>`,
  });
  return { delivered: true, development: false };
}

export async function sendPasswordChanged({ email, fullName }) {
  const mailer = getTransporter();
  if (!mailer) return { delivered: false, development: process.env.NODE_ENV !== 'production' };
  await mailer.sendMail({
    from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER.trim(),
    to: email,
    subject: 'GradFlow — Password Changed',
    text: `Dear ${fullName}, your GradFlow password was changed successfully. Contact your administrator immediately if this was not you.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><div style="background:#062b1a;color:white;padding:20px"><strong>GradFlow Security Notice</strong></div><div style="padding:24px;border:1px solid #e2e8f0"><p>Dear ${escapeHtml(fullName)},</p><p>Your password was changed successfully and existing signed-in sessions were invalidated.</p><p>If this was not you, contact your administrator immediately.</p></div></div>`,
  });
  return { delivered: true, development: false };
}
