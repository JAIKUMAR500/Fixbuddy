export function roleArt(role?: string | null) {
  if (role === "worker") return "/brand/role-worker.png";
  if (role === "business" || role === "provider") return "/brand/role-business.png";
  if (role === "admin") return "/brand/role-business.png";
  return "/brand/role-customer.png";
}

export function displayName(user?: { name?: string; provider?: { businessName?: string } | null } | null) {
  return user?.name || user?.provider?.businessName || "You";
}

export function serviceLabel(s: string | { name?: string; price?: number } | null | undefined) {
  if (!s) return "";
  if (typeof s === "string") return s;
  return s.name || "";
}

export function servicePrice(s: string | { name?: string; price?: number } | null | undefined, fallback = 0) {
  if (s && typeof s === "object") return Number(s.price || fallback || 0);
  return fallback;
}
