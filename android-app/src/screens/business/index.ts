import type { ScreenDef } from "../../config/app";

export const BUSINESS_V1: ScreenDef[] = [
  {
    id: "business-dashboard",
    role: "business",
    title: "Dashboard",
    web: "frontend/src/pages/business/BusinessDashboard.tsx",
    v1: true,
  },
  {
    id: "work-requests",
    role: "business",
    title: "Work requests",
    web: "frontend/src/pages/business/WorkRequests.tsx",
    v1: true,
  },
  {
    id: "business-team",
    role: "business",
    title: "Team",
    web: "frontend/src/pages/business/TeamPage.tsx",
    v1: true,
  },
];

export const BUSINESS_MORE: ScreenDef[] = [
  { id: "earnings", role: "business", title: "Earnings", web: "frontend/src/pages/business/Earnings.tsx", v1: false },
  { id: "business-profile", role: "business", title: "Profile", web: "frontend/src/pages/business/BusinessProfile.tsx", v1: false },
];
