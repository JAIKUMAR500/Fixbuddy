export type AppUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "customer" | "worker" | "business" | "admin" | "provider";
  city?: string;
  area?: string;
  address?: string;
  avatar?: string;
  lat?: number | null;
  lng?: number | null;
  walletBalance?: number;
  provider?: {
    businessName?: string;
    category?: string;
    available?: boolean;
    rating?: number;
    jobsCompleted?: number;
    dailyTargetAmount?: number;
  };
};

export type JobRequest = {
  id: string;
  code?: string;
  status: string;
  category?: string;
  description?: string;
  address?: string;
  area?: string;
  city?: string;
  estimatedAmount?: number;
  workerQuote?: number;
  timing?: string;
  scheduledLabel?: string;
  jobOtp?: string;
  otpVerified?: boolean;
  photos?: string[];
  voiceNote?: string;
  lat?: number | null;
  lng?: number | null;
  distance?: string | number;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  customer?: { name?: string; phone?: string; rating?: number };
  provider?: { name?: string; businessName?: string; phone?: string; rating?: number; jobsCompleted?: number };
  workPhotos?: { before?: string[]; during?: string[]; after?: string[] };
};
