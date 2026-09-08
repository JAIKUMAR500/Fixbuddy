import { Otp } from "../models/Otp.js";
import { MailJob } from "../models/MailJob.js";
import { sendPendingMail } from "../services/mail.js";

const TICK_MS = 20_000;

async function sweepExpiredOtps() {
  await Otp.deleteMany({ expiresAt: { $lte: new Date() } });
  await MailJob.deleteMany({
    kind: "otp",
    createdAt: { $lte: new Date(Date.now() - 15 * 60_000) },
    status: { $ne: "sent" },
  });
}

async function tick() {
  try {
    const mail = await sendPendingMail();
    await sweepExpiredOtps();
    if (mail.processed) {
      console.log(`OTP/mail cron: processed ${mail.processed}, sent ${mail.sent}`);
    }
  } catch (err) {
    console.log("OTP/mail cron failed:", err instanceof Error ? err.message : err);
  }
}

export function startCron() {
  console.log("OTP/mail cron started (every 20s)");
  void tick();
  setInterval(() => void tick(), TICK_MS);
}
