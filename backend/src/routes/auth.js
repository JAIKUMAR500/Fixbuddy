import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { User } from "../models/User.js";
import { Otp } from "../models/Otp.js";
import { signToken, auth } from "../middleware/auth.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { publicUser } from "../utils/serialize.js";
import { isProviderAccount, normalizeSignupRole } from "../utils/roles.js";
import { buildLicense, hasValidLicense, ensureLoginLicense, createUserWithCode, ensureUserCode } from "../utils/license.js";
import { env } from "../config/env.js";
import { sendMail, enqueueMail, otpEmailHtml, getMailConfig } from "../services/mail.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js";

const router = Router();

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { name, email, phone, password, role, city, area, address, lat, lng, description } = req.body || {};
    if (!name || !email || !password) throw httpError(400, "Name, email and password are required");
    const nextRole = normalizeSignupRole(role);
    if (!nextRole) throw httpError(403, "Admin accounts cannot be created from signup");
    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail, role: nextRole }).lean();
    if (exists) throw httpError(409, `An account with this email already exists for the ${nextRole} role`);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUserWithCode({
      name,
      email: normalizedEmail,
      phone: phone || "",
      city: city || "",
      area: area || "",
      address: address || "",
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      passwordHash,
      role: nextRole,
      license: buildLicense({ days: 7, plan: "trial" }),
      provider: isProviderAccount(nextRole)
        ? { businessName: name, description: String(description || "").trim(), onboarded: false, available: true, services: [], serviceAreas: [], lat: lat != null ? Number(lat) : null, lng: lng != null ? Number(lng) : null }
        : undefined,
    });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user.toObject()) });
  })
);

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roleMatches(userRole, requested) {
  if (!requested) return true;
  if (requested === "business") return userRole === "business" || userRole === "provider";
  return userRole === requested;
}

async function usersMatchingIdent(ident) {
  if (ident.includes("@")) {
    return User.find({ email: ident.toLowerCase() }).select("+passwordHash +googleId");
  }
  const digits = phoneDigits(ident);
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    const pattern = last10.split("").join("[\\s-]*");
    return User.find({ phone: { $regex: `${pattern}$` } }).select("+passwordHash +googleId");
  }
  const code = ident.toUpperCase();
  return User.find({
    $or: [{ userCode: code }, { name: { $regex: `^${escapeRegex(ident)}$`, $options: "i" } }],
  }).select("+passwordHash +googleId");
}

async function pickUserWithPassword(ident, password, role) {
  const candidates = await usersMatchingIdent(ident);
  const matched = [];
  for (const candidate of candidates) {
    if (candidate.passwordHash && (await bcrypt.compare(password, candidate.passwordHash))) {
      matched.push(candidate);
    }
  }
  if (!matched.length) {
    if (candidates.length === 1 && candidates[0].googleId && !candidates[0].passwordHash) {
      throw httpError(401, "This account uses Google. Click Continue with Google.");
    }
    throw httpError(401, "Invalid email or password. Use the same email and password from signup, not your display name.");
  }
  const requested = ["customer", "worker", "business", "provider", "admin"].includes(role) ? role : "";
  if (requested) {
    const preferred = matched.filter((u) => roleMatches(u.role, requested));
    if (preferred.length === 1) return preferred[0];
    if (preferred.length > 1) {
      throw httpError(409, "Select the role used for this account before signing in");
    }
  }
  if (matched.length === 1) return matched[0];
  const roles = [...new Set(matched.map((u) => u.role))].join(", ");
  throw httpError(409, `This email has more than one account (${roles}). Select that role, then login.`);
}

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const ident = String(req.body.email || req.body.phone || req.body.username || "").trim();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "").trim().toLowerCase();
    if (!ident || !password) throw httpError(400, "Email / mobile and password are required");

    const user = await pickUserWithPassword(ident, password, role);
    if (user.status === "suspended") throw httpError(403, "Account suspended");
    await ensureLoginLicense(user);
    if (!hasValidLicense(user)) {
      throw httpError(403, "Login license expired or not assigned. Ask Super Admin to grant access.");
    }
    await ensureUserCode(user);
    const token = signToken(user);
    const lean = user.toObject();
    delete lean.passwordHash;
    res.json({ token, user: publicUser(lean) });
  })
);

router.get(
  "/me",
  auth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

router.patch(
  "/me",
  auth,
  asyncHandler(async (req, res) => {
    const { name, phone, city, area, address, avatar, lat, lng, age, jobType, studies, aadhaar, pan, lang, profileAsked } = req.body || {};
    const set = {
      ...(name != null ? { name } : {}),
      ...(phone != null ? { phone } : {}),
      ...(city != null ? { city } : {}),
      ...(area != null ? { area } : {}),
      ...(address != null ? { address } : {}),
      ...(avatar != null ? { avatar } : {}),
      ...(lat != null ? { lat: Number(lat) } : {}),
      ...(lng != null ? { lng: Number(lng) } : {}),
      ...(age != null && age !== "" ? { age: Number(age) } : {}),
      ...(jobType != null ? { jobType } : {}),
      ...(studies != null ? { studies } : {}),
      ...(aadhaar != null ? { aadhaar } : {}),
      ...(pan != null ? { pan } : {}),
      ...(lang === "en" || lang === "ta" ? { lang } : {}),
      ...(profileAsked != null ? { profileAsked: !!profileAsked } : {}),
    };
    if (name != null && req.user.provider) set["provider.businessName"] = name;
    const user = await User.findByIdAndUpdate(req.userId, { $set: set }, { new: true }).lean();
    res.json({ user: publicUser(user) });
  })
);

function issueAuth(user, res, status = 200) {
  const token = signToken(user);
  const lean = typeof user.toObject === "function" ? user.toObject() : user;
  delete lean.passwordHash;
  res.status(status).json({ token, user: publicUser(lean) });
}

router.post(
  "/forgot",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = ["customer", "worker", "business", "provider", "admin"].includes(req.body.role) ? req.body.role : null;
    if (!email.includes("@")) throw httpError(400, "Enter the email on your account");
    const user = await User.findOne({ email, ...(role ? { role } : {}) }).lean();
    if (!user) throw httpError(404, "No FixBuddy account uses this email");
    const otpFilter = { email, role: role || "", purpose: "reset" };
    const recent = await Otp.findOne({ ...otpFilter, createdAt: { $gt: new Date(Date.now() - 60 * 1000) } });
    if (recent) throw httpError(429, "Wait a minute, then request a new OTP");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    await Otp.deleteMany(otpFilter);
    await Otp.create({
      email,
      role: role || "",
      codeHash,
      purpose: "reset",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const cfg = await getMailConfig();
    const html = otpEmailHtml(code, cfg.support);
    const job = await enqueueMail({
      to: email,
      subject: "FixBuddy password OTP",
      html,
      kind: "otp",
    });
    let mailed = false;
    try {
      mailed = await sendMail({ to: email, subject: job.subject, html });
      if (mailed) {
        job.status = "sent";
        job.sentAt = new Date();
        job.lastError = "";
        await job.save();
      }
    } catch (mailError) {
      job.status = "failed";
      job.attempts += 1;
      job.lastError = mailError instanceof Error ? mailError.message : "Send failed";
      job.scheduledAt = new Date(Date.now() + 20_000);
      await job.save();
      console.log("OTP email failed:", job.lastError);
    }
    if (!mailed) console.log(`FixBuddy password OTP queued for ${email}: ${code}`);
    res.json({
      ok: true,
      queued: !mailed,
      message: mailed
        ? `OTP sent to ${email}`
        : "OTP generated. Mail will send when Gmail SMTP is added in Admin → Settings. Code is shown below.",
      otp: mailed ? undefined : code,
    });
  })
);

router.post(
  "/reset",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = ["customer", "worker", "business", "provider", "admin"].includes(req.body.role) ? req.body.role : null;
    const otp = String(req.body.otp || "").trim();
    const password = String(req.body.password || "");
    if (!email || !otp || password.length < 6) throw httpError(400, "Email, 6-digit OTP and a new password (6+ characters) are required");
    const row = await Otp.findOne({ email, role: role || "", purpose: "reset" });
    if (!row || row.expiresAt.getTime() < Date.now()) throw httpError(400, "OTP expired. Request a new one.");
    if (row.attempts >= 5) throw httpError(429, "Too many attempts. Request a new OTP.");
    const match = await bcrypt.compare(otp, row.codeHash);
    if (!match) {
      row.attempts += 1;
      await row.save();
      throw httpError(400, "OTP does not match");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate({ email, ...(role ? { role } : {}) }, { $set: { passwordHash } }, { new: true });
    if (!user) throw httpError(404, "Account not found");
    await Otp.deleteMany({ email, role: role || "", purpose: "reset" });
    await ensureLoginLicense(user);
    issueAuth(user, res);
  })
);

router.post(
  "/google",
  asyncHandler(async (req, res) => {
    const { getSettings } = await import("../models/PlatformSettings.js");
    const settings = await getSettings();
    const payload = await verifyGoogleIdToken(req.body.credential, [
      settings.googleClientId,
      env.googleClientId,
    ]);
    const email = payload.email;
    const googleRole = ["customer", "worker", "business", "provider"].includes(req.body.role) ? req.body.role : null;
    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }], ...(googleRole ? { role: googleRole } : {}) });
    if (!user) {
      const nextRole = normalizeSignupRole(req.body.role) || "customer";
      user = await createUserWithCode({
        name: payload.name || email.split("@")[0],
        email,
        googleId: payload.sub,
        avatar: payload.picture || "",
        passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10),
        role: nextRole,
        license: buildLicense({ days: 7, plan: "trial" }),
        provider: isProviderAccount(nextRole)
          ? { businessName: payload.name || email.split("@")[0], onboarded: false, available: true, services: [], serviceAreas: [] }
          : undefined,
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      if (!user.avatar && payload.picture) user.avatar = payload.picture;
      await user.save();
    }
    await ensureUserCode(user);
    if (user.status === "suspended") throw httpError(403, "Account suspended");
    await ensureLoginLicense(user);
    if (!hasValidLicense(user)) {
      throw httpError(403, "Login license expired or not assigned. Ask Super Admin to grant access.");
    }
    issueAuth(user, res);
  })
);

export default router;
