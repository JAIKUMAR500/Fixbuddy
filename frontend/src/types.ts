export type View =
  | "landing"
  | "login"
  | "signup"
  | "business-landing"
  | "customer-home"
  | "create-request"
  | "finding-solutions"
  | "matched-providers"
  | "provider-details"
  | "request-status"
  | "my-requests"
  | "customer-messages"
  | "customer-profile"
  | "customer-settings"
  | "customer-notifications"
  | "customer-bookings"
  | "customer-reviews"
  | "customer-wallet"
  | "customer-license"
  | "customer-support"
  | "customer-favorites"
  | "business-onboarding"
  | "business-dashboard"
  | "work-requests"
  | "my-jobs"
  | "business-calendar"
  | "business-messages"
  | "reviews"
  | "earnings"
  | "business-profile"
  | "business-notifications"
  | "provider-services"
  | "provider-settings"
  | "business-analytics"
  | "business-license"
  | "business-wallet"
  | "business-team"
  | "ai-recommend"
  | "worker-license"
  | "worker-wallet"
  | "worker-target"
  | "worker-next-jobs"
  | "worker-crews"
  | "worker-passport"
  | "worker-safety"
  | "public-passport"
  | "find-crew"
  | "active-job"
  | "family-watch"
  | "admin"
  | "admin-login"
  | "admin-customers"
  | "admin-providers"
  | "admin-workers"
  | "admin-verification"
  | "admin-requests"
  | "admin-reviews"
  | "admin-settings"
  | "admin-categories"
  | "admin-services"
  | "admin-jobs"
  | "admin-notifications"
  | "admin-complaints"
  | "admin-transactions"
  | "admin-analytics"
  | "admin-users"
  | "admin-audit"
  | "admin-licenses"
  | "admin-safety"
  | "admin-crews"
  | "job-details";

export type UserType = "customer" | "worker" | "business" | null;

export interface Provider {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviews: number;
  completedJobs: number;
  distance: string;
  responseTime: string;
  category: string;
  price: string;
  available: boolean;
  verified: boolean;
  description: string;
  experience: string;
  location: string;
  phone: string;
  services: string[];
  photos?: string[];
  coverPhoto?: string;
  hours?: { from: string; to: string };
  serviceAreas?: string[];
  website?: string;
}

export interface RequestData {
  description: string;
  category: string;
  address: string;
  area: string;
  city: string;
  timing: string;
  date?: string;
  photos?: string[];
  voiceNote?: string;
  lat?: number | null;
  lng?: number | null;
  landmark?: string;
  estimatedAmount?: number;
  scheduledAt?: string;
  scheduledLabel?: string;
  priority?: "normal" | "urgent" | "emergency";
}

export interface AppState {
  view: View;
  userType: UserType;
  requestData: Partial<RequestData>;
  selectedProvider: Provider | null;
}
