import { licenseView } from "./license.js";
import { km, etaMinutes, isOnline, TRACKING_STATUSES } from "./geo.js";
import { approxCoord, cancelPolicyFor } from "./jobLock.js";
import { FINANCIAL_MODE, FINANCE_STATUS, SIMULATION_LABEL } from "../services/payments/config.js";
import { paiseToRupees } from "../services/payments/money.js";
import { presentWorkPhotos, workPhotoCount, latestWorkPhotoAt } from "./workPhotos.js";
import { typicalPrice } from "./guidePrices.js";

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
    lang: user.lang === "ta" ? "ta" : user.lang === "hi" ? "hi" : "en",
    profileAsked: !!user.profileAsked,
    lat: user.lat ?? null,
    lng: user.lng ?? null,
    homeLat: user.homeLat ?? null,
    homeLng: user.homeLng ?? null,
    lastSeenAt: user.lastSeenAt || null,
    online: user.lastSeenAt ? Date.now() - new Date(user.lastSeenAt).getTime() < 120000 : false,
    status: user.status,
    walletBalance: paiseToRupees(user.simulatedWalletPaise) || user.walletBalance || 0,
    simulatedWalletPaise: user.simulatedWalletPaise || 0,
    financialMode: FINANCIAL_MODE,
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
        dailyTargetAmount: p.dailyTargetAmount || 1500,
        nextJobAvailable: p.nextJobAvailable !== false,
        languages: p.languages || [],
        passportBio: p.passportBio || "",
        skills: (p.skills || []).map((s) => ({
          id: String(s._id || s.name),
          name: s.name,
          verified: !!s.verified,
          pending: !!s.pending,
        })),
      }
      : null,
  };
}

export function professionalPublic(user, extra = {}) {
  if (!user) return null;
  const p = user.provider || {};
  return {
    userCode: user.userCode || "",
    name: p.businessName || user.name,
    avatar: user.avatar || "",
    category: p.category || "",
    experience: p.experience || "",
    verified: !!p.verified,
    ratingAvg: extra.ratingAvg ?? p.ratingAvg ?? 0,
    ratingCount: extra.ratingCount ?? p.ratingCount ?? 0,
    completedJobs: extra.completed ?? p.completedJobs ?? 0,
    onTimePct: extra.onTimePct ?? 100,
    cancelPct: extra.cancelPct ?? 0,
    city: user.city || "",
    area: p.location || user.area || "",
    serviceAreas: p.serviceAreas || [],
    languages: p.languages || [],
    bio: p.passportBio || p.description || "",
    skills: (extra.skills || p.skills || []).map((s) => ({
      name: s.name,
      verified: !!s.verified,
      pending: !!s.pending,
    })),
    badges: extra.badges || [],
    byCategory: extra.byCategory || {},
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
    phone: extra.revealPhone ? user.phone || "" : "",
    lat: user.lat ?? p.lat ?? null,
    lng: user.lng ?? p.lng ?? null,
    lastSeenAt: user.lastSeenAt || null,
    online: isOnline(user.lastSeenAt),
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
  const dist = km(r.lat, r.lng, r.workerLat, r.workerLng);
  const revealOtp = extras.revealOtp && r.jobOtp && !r.otpVerified && r.status === "arrived";
  return {
    id: String(r._id),
    code: r.code,
    customerId: r.customerId ? String(r.customerId) : null,
    providerId: r.providerId ? String(r.providerId) : null,
    invitedProviderIds: (r.invitedProviderIds || []).map((id) => String(id)),
    postedByRole: r.postedByRole || "customer",
    description: r.description,
    category: r.category,
    address: extras.hideContact ? "" : r.address,
    area: r.area,
    city: r.city,
    landmark: extras.hideContact ? "" : r.landmark || "",
    lat: extras.hideContact ? approxCoord(r.lat) : r.lat ?? null,
    lng: extras.hideContact ? approxCoord(r.lng) : r.lng ?? null,
    workerLat: TRACKING_STATUSES.includes(r.status) ? r.workerLat ?? null : null,
    workerLng: TRACKING_STATUSES.includes(r.status) ? r.workerLng ?? null : null,
    workerLocationAt: TRACKING_STATUSES.includes(r.status) ? r.workerLocationAt || null : null,
    trackingActive: TRACKING_STATUSES.includes(r.status),
    arrivedAt: r.arrivedAt || null,
    photos: r.photos || [],
    voiceNote: r.voiceNote || "",
    timing: r.timing,
    scheduledAt: r.scheduledAt,
    scheduledLabel: r.scheduledLabel || formatWhen(r.scheduledAt, r.timing),
    budgetMin: r.budgetMin || 0,
    budgetMax: r.budgetMax || 0,
    estimatedAmount: r.estimatedAmount || typicalPrice(r.category),
    workerQuote: r.workerQuote ?? null,
    tags: r.tags || [],
    publicPost: r.publicPost,
    status: r.status,
    timeline: r.timeline || [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    otpVerified: !!r.otpVerified,
    jobOtp: revealOtp ? r.jobOtp : undefined,
    paymentStatus: r.paymentStatus || "unpaid",
    paymentCollectedAt: r.paymentCollectedAt || null,
    customerCompleted: !!r.customerCompleted,
    startedAt: r.startedAt || null,
    completedAt: r.completedAt || null,
    distanceKm: dist,
    etaMinutes: etaMinutes(dist),
    customer: extras.customer || null,
    provider: extras.provider || null,
    matches: extras.matches || undefined,
    crewId: r.crewId ? String(r.crewId) : null,
    crewMemberIds: (r.crewMemberIds || []).map((id) => String(id)),
    workersRequired: r.workersRequired || 1,
    cancelReason: r.cancelReason || "",
    travelCompensation: r.travelCompensation || 0,
    crew: extras.crew || null,
    crewMembers: extras.crewMembers || undefined,
    acceptedAt: r.acceptedAt || null,
    customerLanguage: r.customerLanguage || "en",
    workerLanguage: r.workerLanguage || "en",
    translatedDescription: r.translatedDescription || "",
    workPhotos: presentWorkPhotos(r.workPhotos),
    workPhotoCount: workPhotoCount(r.workPhotos),
    workPhotosUpdatedAt: latestWorkPhotoAt(r.workPhotos),
    assignmentMode: r.assignmentMode || "",
    tower: extras.hideGate || extras.hideContact ? "" : r.tower || "",
    flat: extras.hideGate || extras.hideContact ? "" : r.flat || "",
    gateNote: extras.hideGate || extras.hideContact ? "" : r.gateNote || "",
    visitorName: extras.hideGate || extras.hideContact ? "" : r.visitorName || "",
    delayReason: r.delayReason || "",
    delayNote: r.delayNote || "",
    preferredProviderId: r.preferredProviderId ? String(r.preferredProviderId) : null,
    pinCode: r.pinCode || "",
    cancelledAt: r.cancelledAt || null,
    cancelledBy: r.cancelledBy || "",
    watchActive: !!(r.watchToken && r.watchTokenExpiresAt && new Date(r.watchTokenExpiresAt) > new Date()),
    cancelPolicy: extras.cancelPolicy || cancelPolicyFor(r.status, extras.travelCompensationInr || 75),
    finance: presentFinance(r),
    cancellationFinance: r.cancellationFinance?.recorded
      ? {
        ...r.cancellationFinance,
        label: r.cancellationFinance.label || SIMULATION_LABEL,
      }
      : null,
  };
}

function presentFinance(r) {
  const f = r.finance || {};
  return {
    mode: f.mode || FINANCIAL_MODE,
    status: f.status || FINANCE_STATUS.NOT_APPLICABLE,
    jobPricePaise: f.jobPricePaise || 0,
    commissionPercent: f.commissionPercent || 0,
    commissionPaise: f.commissionPaise || 0,
    workerGrossPaise: f.workerGrossPaise || 0,
    workerNetPaise: f.workerNetPaise || 0,
    calculatedAt: f.calculatedAt || null,
    settled: !!f.settled,
    jobPriceRupees: paiseToRupees(f.jobPricePaise || 0),
    commissionRupees: paiseToRupees(f.commissionPaise || 0),
    workerGrossRupees: paiseToRupees(f.workerGrossPaise || 0),
    workerNetRupees: paiseToRupees(f.workerNetPaise || 0),
    label: SIMULATION_LABEL,
  };
}

export function presentCrew(doc, usersById = {}) {
  const c = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const members = (c.members || []).map((m) => {
    const u = usersById[String(m.userId)];
    const p = u?.provider || {};
    return {
      id: String(m._id || m.userId),
      userId: String(m.userId),
      role: m.role,
      status: m.status,
      sharePercent: m.sharePercent || 0,
      name: p.businessName || u?.name || "Worker",
      avatar: u?.avatar || "",
      category: p.category || "",
      verified: !!p.verified,
      ratingAvg: p.ratingAvg || 0,
      available: p.available !== false,
      userCode: u?.userCode || "",
    };
  });
  const leader = members.find((m) => m.role === "leader") || members[0];
  return {
    id: String(c._id),
    name: c.name,
    description: c.description || "",
    skills: c.skills || [],
    serviceArea: c.serviceArea || "",
    maxMembers: c.maxMembers || 6,
    leaderId: String(c.leaderId),
    leader,
    members,
    activeCount: members.filter((m) => m.status === "active").length,
    splitMode: c.splitMode || "equal",
    status: c.status,
    completedJobs: c.completedJobs || 0,
    ratingAvg: c.ratingAvg || 0,
    ratingCount: c.ratingCount || 0,
    verified:
      members.filter((m) => m.status === "active").length > 0 &&
      members.filter((m) => m.status === "active").every((m) => m.verified),
  };
}
