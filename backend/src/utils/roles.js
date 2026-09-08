export const CUSTOMER_ROLE = "customer";
export const WORKER_ROLE = "worker";
export const BUSINESS_ROLE = "business";
export const ADMIN_ROLE = "admin";

/** Workers seek and fulfill jobs posted by customers or businesses. */
export const SEEKER_ROLES = ["worker"];

/** Customers and businesses create jobs. Admin can also post. */
export const CREATOR_ROLES = ["customer", "business", "provider"];

/** Accounts that keep a provider/business profile. */
export const PROVIDER_ACCOUNT_ROLES = ["worker", "business", "provider"];

export function isSeeker(role) {
  return role === WORKER_ROLE;
}

export function isCreator(role) {
  return CREATOR_ROLES.includes(role) || role === ADMIN_ROLE;
}

export function isAdmin(role) {
  return role === ADMIN_ROLE;
}

export function isCustomer(role) {
  return role === CUSTOMER_ROLE;
}

export function isBusiness(role) {
  return role === BUSINESS_ROLE || role === "provider";
}

export function isProviderAccount(role) {
  return PROVIDER_ACCOUNT_ROLES.includes(role);
}

/** @deprecated use isSeeker — workers (not businesses) fulfill jobs */
export function isFulfiller(role) {
  return isSeeker(role);
}

/** Public signup roles only. Admin is seeded, never self-registered. */
export function normalizeSignupRole(role) {
  const value = String(role || "").toLowerCase();
  if (value === "worker") return WORKER_ROLE;
  if (value === "business" || value === "provider") return BUSINESS_ROLE;
  if (value === "admin") return null;
  return CUSTOMER_ROLE;
}
