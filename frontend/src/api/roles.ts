import type { AppUser } from "./client";
import type { View } from "../types";

export type AppRole = AppUser["role"];

export function isSeeker(role?: string | null) {
  return role === "worker";
}

export function isCreator(role?: string | null) {
  return role === "customer" || role === "business" || role === "provider" || role === "admin";
}

export function isBusiness(role?: string | null) {
  return role === "business" || role === "provider";
}

export function isFulfiller(role?: string | null) {
  return isSeeker(role);
}

export function roleLabel(role?: string | null) {
  if (role === "admin") return "Super Admin";
  if (role === "worker") return "Worker";
  if (role === "business" || role === "provider") return "Business";
  return "Customer";
}

export function roleHome(user: AppUser): View {
  if (user.role === "admin") return "admin";
  if (user.role === "worker") {
    return user.provider?.onboarded ? "business-dashboard" : "business-onboarding";
  }
  if (isBusiness(user.role)) {
    return user.provider?.onboarded ? "business-dashboard" : "business-onboarding";
  }
  return "customer-home";
}

const PUBLIC_VIEWS: View[] = ["landing", "login", "signup", "business-landing", "admin-login"];

const CUSTOMER_VIEWS: View[] = [
  "customer-home",
  "create-request",
  "finding-solutions",
  "matched-providers",
  "provider-details",
  "request-status",
  "my-requests",
  "customer-messages",
  "customer-profile",
  "customer-settings",
  "customer-notifications",
  "customer-bookings",
  "customer-reviews",
  "customer-wallet",
  "customer-license",
  "customer-support",
  "customer-favorites",
  "ai-recommend",
];

const BUSINESS_VIEWS: View[] = [
  "business-onboarding",
  "business-dashboard",
  "create-request",
  "finding-solutions",
  "matched-providers",
  "provider-details",
  "request-status",
  "my-jobs",
  "job-details",
  "business-calendar",
  "business-messages",
  "reviews",
  "earnings",
  "business-profile",
  "business-notifications",
  "provider-services",
  "provider-settings",
  "business-analytics",
  "business-license",
  "business-wallet",
  "business-team",
  "ai-recommend",
];

const WORKER_VIEWS: View[] = [
  "business-onboarding",
  "business-dashboard",
  "work-requests",
  "my-jobs",
  "job-details",
  "business-calendar",
  "business-messages",
  "reviews",
  "earnings",
  "business-profile",
  "provider-details",
  "business-notifications",
  "provider-services",
  "provider-settings",
  "worker-license",
  "worker-wallet",
  "ai-recommend",
];

const ADMIN_VIEWS: View[] = [
  "admin",
  "admin-customers",
  "admin-providers",
  "admin-workers",
  "admin-verification",
  "admin-requests",
  "admin-reviews",
  "admin-settings",
  "admin-categories",
  "admin-services",
  "admin-jobs",
  "admin-notifications",
  "admin-complaints",
  "admin-transactions",
  "admin-analytics",
  "admin-users",
  "admin-audit",
  "admin-licenses",
];

export function canAccessView(user: AppUser | null, view: View) {
  if (PUBLIC_VIEWS.includes(view)) return true;
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "customer") return CUSTOMER_VIEWS.includes(view);
  if (user.role === "worker") return WORKER_VIEWS.includes(view);
  if (isBusiness(user.role)) return BUSINESS_VIEWS.includes(view);
  return false;
}

export { PUBLIC_VIEWS, CUSTOMER_VIEWS, WORKER_VIEWS, BUSINESS_VIEWS, ADMIN_VIEWS };
