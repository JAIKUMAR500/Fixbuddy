/** Normalize legacy URL strings and metadata objects for Request.workPhotos. */

const STAGES = ["before", "during", "after"];
const STAGE_LIMITS = { before: 3, during: 6, after: 3 };

/** Statuses that allow upload per stage. Terminal jobs never allow uploads. */
const STAGE_STATUSES = {
  before: ["arrived", "otp_verified", "in_progress"],
  during: ["in_progress"],
  after: ["in_progress", "completed"],
};

const TERMINAL = ["cancelled", "declined", "reviewed", "payment_collected", "customer_completed"];

export function workPhotoStages() {
  return STAGES;
}

export function workPhotoLimit(stage) {
  return STAGE_LIMITS[stage] || 3;
}

export function normalizePhotoItem(item, fallback = {}) {
  if (!item) return null;
  if (typeof item === "string") {
    const url = item.trim();
    if (!url) return null;
    return {
      url,
      uploadedBy: fallback.uploadedBy ? String(fallback.uploadedBy) : null,
      uploadedAt: fallback.uploadedAt || null,
      caption: fallback.caption || "",
    };
  }
  const url = String(item.url || item.src || "").trim();
  if (!url) return null;
  return {
    url,
    uploadedBy: item.uploadedBy ? String(item.uploadedBy) : null,
    uploadedAt: item.uploadedAt || null,
    caption: String(item.caption || "").slice(0, 200),
  };
}

export function presentWorkPhotos(workPhotos) {
  const raw = workPhotos || {};
  const out = { before: [], during: [], after: [] };
  for (const stage of STAGES) {
    out[stage] = (raw[stage] || []).map((item) => normalizePhotoItem(item)).filter(Boolean);
  }
  return out;
}

export function workPhotoUrls(workPhotos) {
  const presented = presentWorkPhotos(workPhotos);
  return {
    before: presented.before.map((p) => p.url),
    during: presented.during.map((p) => p.url),
    after: presented.after.map((p) => p.url),
  };
}

export function workPhotoCount(workPhotos) {
  const p = presentWorkPhotos(workPhotos);
  return p.before.length + p.during.length + p.after.length;
}

export function latestWorkPhotoAt(workPhotos) {
  const p = presentWorkPhotos(workPhotos);
  let latest = null;
  for (const stage of STAGES) {
    for (const photo of p[stage]) {
      if (!photo.uploadedAt) continue;
      const t = new Date(photo.uploadedAt).getTime();
      if (!latest || t > latest) latest = t;
    }
  }
  return latest ? new Date(latest).toISOString() : null;
}

export function assertWorkPhotoUploadAllowed(doc, stage) {
  if (!STAGES.includes(stage)) {
    return { ok: false, status: 400, message: "Upload a before, during, or after photo." };
  }
  if (TERMINAL.includes(doc.status)) {
    return { ok: false, status: 409, message: "This job is closed. Proof photos can no longer be uploaded." };
  }
  const allowed = STAGE_STATUSES[stage] || [];
  if (!allowed.includes(doc.status)) {
    return {
      ok: false,
      status: 409,
      message: `Cannot upload ${stage} photos while the job is ${String(doc.status).replace(/_/g, " ")}.`,
    };
  }
  return { ok: true };
}

export function canUploadWorkPhotos(userId, doc) {
  if (!userId || !doc) return false;
  if (String(doc.providerId || "") === String(userId)) return true;
  return (doc.crewMemberIds || []).some((id) => String(id) === String(userId));
}

export function canViewWorkPhotos(req, doc) {
  if (!req?.userId || !doc) return false;
  if (String(doc.customerId) === String(req.userId)) return true;
  if (canUploadWorkPhotos(req.userId, doc)) return true;
  if (req.user?.role === "admin") return true;
  if (req.user?.role === "business" && String(doc.customerId) === String(req.userId)) return true;
  return false;
}
