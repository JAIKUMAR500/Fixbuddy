import { User } from "../models/User.js";

const PREFIX = {
  customer: "FB-CU",
  worker: "FB-WK",
  business: "FB-BZ",
  provider: "FB-BZ",
  admin: "FB-AD",
};

export async function nextUserCode(role) {
  const prefix = PREFIX[role] || "FB-US";
  const rows = await User.find({ userCode: { $regex: `^${prefix}-` } }).select("userCode").lean();
  let max = 0;
  for (const row of rows) {
    const n = Number(String(row.userCode || "").split("-").pop());
    if (Number.isFinite(n) && n > max) max = n;
  }
  for (let i = 1; i <= 200; i++) {
    const code = `${prefix}-${String(max + i).padStart(4, "0")}`;
    const taken = await User.exists({ userCode: code });
    if (!taken) return code;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export async function createUserWithCode(data) {
  let lastErr;
  for (let i = 0; i < 8; i++) {
    try {
      return await User.create({ ...data, userCode: await nextUserCode(data.role) });
    } catch (err) {
      lastErr = err;
      const isCodeClash = err?.code === 11000 && (err?.keyPattern?.userCode || err?.keyValue?.userCode);
      if (!isCodeClash) throw err;
    }
  }
  throw lastErr;
}

export async function ensureUserCode(user) {
  if (user?.userCode) return user;
  for (let i = 0; i < 8; i++) {
    try {
      user.userCode = await nextUserCode(user.role);
      await user.save();
      return user;
    } catch (err) {
      const isCodeClash = err?.code === 11000 && (err?.keyPattern?.userCode || err?.keyValue?.userCode);
      if (!isCodeClash) throw err;
    }
  }
  return user;
}

export async function repairUserCodes() {
  const missing = await User.find({
    $or: [{ userCode: { $exists: false } }, { userCode: null }, { userCode: "" }],
  });
  for (const user of missing) {
    user.userCode = await nextUserCode(user.role);
    await user.save();
  }
  if (missing.length) console.log(`Repaired ${missing.length} missing user IDs`);
}

export function makeLicenseKey() {
  const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LIC-${chunk()}-${chunk()}`;
}

export function buildLicense({ days = 30, plan = "standard", grantedBy = null } = {}) {
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + Number(days) * 86400000);
  return {
    key: makeLicenseKey(),
    plan,
    days: Number(days),
    startsAt,
    expiresAt,
    status: "active",
    grantedBy,
  };
}

export function licenseView(user) {
  const lic = user?.license || {};
  const expiresAt = lic.expiresAt ? new Date(lic.expiresAt) : null;
  const startsAt = lic.startsAt ? new Date(lic.startsAt) : null;
  const now = Date.now();
  let status = lic.status || "none";
  if (status === "active" && expiresAt && expiresAt.getTime() < now) status = "expired";
  const remainingDays = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now) / 86400000)) : 0;
  const totalDays = lic.days || (startsAt && expiresAt ? Math.max(1, Math.round((expiresAt - startsAt) / 86400000)) : 0);
  return {
    key: lic.key || "",
    plan: lic.plan || "none",
    days: totalDays,
    startsAt: startsAt ? startsAt.toISOString() : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    status,
    remainingDays,
    percent: totalDays ? Math.min(100, Math.round((remainingDays / totalDays) * 100)) : 0,
  };
}

export function hasValidLicense(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const view = licenseView(user);
  return view.status === "active" && view.remainingDays > 0;
}
