import { licenseView } from "./license.js";

export function publicUser(user) {
  if (!user) return null;
  const p = user.provider;
  return {
    id: String(user._id),
    userCode: user.userCode || "",
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    accountStatus: user.status === "suspended" ? "suspended" : "active",
    role: user.role,
    avatar: user.avatar || "",
    city: user.city || "",
    area: user.area || "",
    address: user.address || "",
    age: user.age ?? null,
    jobType: user.jobType || "",
    studies: user.studies || "",
    aadhaar: user.aadhaar || "",
    pan: user.pan || "",
    lang: user.lang === "ta" ? "ta" : "en",
    profileAsked: !!user.profileAsked,
    lat: user.lat ?? null,
    lng: user.lng ?? null,
    status: user.status,
    walletBalance: user.walletBalance || 0,
    license: licenseView(user),
    createdAt: user.createdAt,
    provider: p
      ? {
          businessName: p.businessName,
          category: p.category,
          services: p.services || [],
          serviceAreas: p.serviceAreas || [],
          hours: p.hours || { from: "08:00", to: "20:00" },
          description: p.description,
          experience: p.experience,
          verified: !!p.verified,
          available: p.available !== false,
          startingPrice: p.startingPrice || 399,
          responseTime: p.responseTime || "~30 mins",
          ratingAvg: p.ratingAvg || 0,
          ratingCount: p.ratingCount || 0,
          completedJobs: p.completedJobs || 0,
          location: p.location || "",
          website: p.website || "",
          photos: p.photos || [],
          coverPhoto: p.coverPhoto || "",
          gstCertificate: p.gstCertificate || "",
          aadhaarCard: p.aadhaarCard || "",
          panCard: p.panCard || "",
          documents: p.documents || [],
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          onboarded: !!p.onboarded,
        }
      : null,
  };
}

export function providerCard(user, extra = {}) {
  if (!user) return null;
  const p = user.provider || {};
  const price = p.startingPrice || 399;
  return {
    id: String(user._id),
    name: p.businessName || user.name,
    avatar: user.avatar || "",
    rating: p.ratingAvg || 0,
    reviews: p.ratingCount || 0,
    completedJobs: p.completedJobs || 0,
    distance: extra.distance || "nearby",
    responseTime: p.responseTime || "~30 mins",
    category: p.category || "",
    price: `₹${price} onwards`,
    available: p.available !== false,
    status: p.available !== false ? "active" : "inactive",
    verified: !!p.verified,
    description: p.description || "",
    experience: p.experience || "",
    location: p.location || `${user.area || ""} ${user.city || ""}`.trim(),
    phone: user.phone || "",
    services: p.services || [],
    photos: p.photos || [],
    coverPhoto: p.coverPhoto || "",
    hours: p.hours || { from: "08:00", to: "20:00" },
    serviceAreas: p.serviceAreas || [],
    website: p.website || "",
    score: extra.score,
    reason: extra.reason,
  };
}

export function formatWhen(date, fallback = "") {
  if (!date) return fallback;
  const d = new Date(date);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function presentRequest(doc, extras = {}) {
  const r = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(r._id),
    code: r.code,
    customerId: r.customerId ? String(r.customerId) : null,
    providerId: r.providerId ? String(r.providerId) : null,
    invitedProviderIds: (r.invitedProviderIds || []).map((id) => String(id)),
    postedByRole: r.postedByRole || "customer",
    description: r.description,
    category: r.category,
    address: r.address,
    area: r.area,
    city: r.city,
    landmark: r.landmark || "",
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    photos: r.photos || [],
    voiceNote: r.voiceNote || "",
    timing: r.timing,
    scheduledAt: r.scheduledAt,
    scheduledLabel: r.scheduledLabel || formatWhen(r.scheduledAt, r.timing),
    budgetMin: r.budgetMin || 0,
    budgetMax: r.budgetMax || 0,
    estimatedAmount: r.estimatedAmount || 0,
    workerQuote: r.workerQuote ?? null,
    tags: r.tags || [],
    publicPost: r.publicPost,
    status: r.status,
    timeline: r.timeline || [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    customer: extras.customer || null,
    provider: extras.provider || null,
    matches: extras.matches || undefined,
  };
}
