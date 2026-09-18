import type { AppRole } from "./app";

export const ROLES: Record<
  AppRole,
  { label: string; home: string; folder: string }
> = {
  customer: {
    label: "Customer",
    home: "customer-home",
    folder: "android-app/src/screens/customer",
  },
  worker: {
    label: "Worker",
    home: "work-requests",
    folder: "android-app/src/screens/worker",
  },
  business: {
    label: "Business",
    home: "business-dashboard",
    folder: "android-app/src/screens/business",
  },
};
