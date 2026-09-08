import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { getSettings } from "../models/PlatformSettings.js";
import { MailJob } from "../models/MailJob.js";

export async function getMailConfig() {
  const settings = await getSettings();
  return {
    host: settings.smtpHost || env.smtpHost || "smtp.gmail.com",
    port: Number(settings.smtpPort || env.smtpPort || 465),
    user: String(settings.smtpUser || env.smtpUser || "").trim(),
    pass: String(settings.smtpPass || env.smtpPass || "").trim(),
    support: settings.supportEmail || env.supportEmail,
    fromName: settings.platformName || "FixBuddy",
  };
}

export function supportEmail() {
  return env.supportEmail;
}

export async function sendMail({ to, subject, html }) {
  const cfg = await getMailConfig();
  if (!cfg.user || !cfg.pass) return false;
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.user}>`,
    to,
    replyTo: cfg.support,
    subject,
    html,
  });
  return true;
}

export async function enqueueMail({ to, subject, html, kind = "otp" }) {
  return MailJob.create({
    to: String(to).toLowerCase(),
    subject,
    html,
    kind,
    status: "pending",
    scheduledAt: new Date(),
  });
}

export async function sendPendingMail(limit = 12) {
  const due = await MailJob.find({
    status: { $in: ["pending", "failed"] },
    attempts: { $lt: 8 },
    scheduledAt: { $lte: new Date() },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  let sent = 0;
  for (const job of due) {
    try {
      const ok = await sendMail({ to: job.to, subject: job.subject, html: job.html });
      if (ok) {
        job.status = "sent";
        job.sentAt = new Date();
        job.lastError = "";
        sent += 1;
      } else {
        job.status = "pending";
        job.attempts += 1;
        job.lastError = "Add Gmail SMTP user and app password in Admin → Settings";
        job.scheduledAt = new Date(Date.now() + 30_000);
      }
    } catch (err) {
      job.status = "failed";
      job.attempts += 1;
      job.lastError = err instanceof Error ? err.message : "Send failed";
      job.scheduledAt = new Date(Date.now() + Math.min(5 * 60_000, 20_000 * job.attempts));
    }
    await job.save();
  }
  return { processed: due.length, sent };
}

export function otpEmailHtml(code, support) {
  const inbox = support || env.supportEmail;
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
      <div style="width:40px;height:40px;border-radius:12px;background:#0056D2;color:#fff;font-weight:800;text-align:center;line-height:40px">F</div>
      <h2 style="margin:16px 0 8px">Your FixBuddy code</h2>
      <p style="color:#475569">Use this OTP to reset your password. It expires in 10 minutes.</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:800;color:#0056D2;margin:24px 0">${code}</p>
      <p style="font-size:13px;color:#64748b">If you did not ask for this, you can ignore the email.</p>
      <p style="font-size:12px;color:#94a3b8">Contact support: <a href="mailto:${inbox}">${inbox}</a></p>
    </div>
  `;
}
