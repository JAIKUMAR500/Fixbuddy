import type { ScreenDef } from "../../config/app";

export const CUSTOMER_V1: ScreenDef[] = [
  {
    id: "customer-home",
    role: "customer",
    title: "Home",
    web: "frontend/src/pages/customer/CustomerHome.tsx",
    v1: true,
  },
  {
    id: "create-request",
    role: "customer",
    title: "Create request",
    web: "frontend/src/pages/customer/CreateRequest.tsx",
    v1: true,
  },
  {
    id: "request-status",
    role: "customer",
    title: "Request status",
    web: "frontend/src/pages/customer/RequestStatus.tsx",
    v1: true,
  },
  {
    id: "active-job",
    role: "customer",
    title: "Active job",
    web: "frontend/src/pages/shared/ActiveJob.tsx",
    v1: true,
  },
  {
    id: "customer-profile",
    role: "customer",
    title: "Profile",
    web: "frontend/src/pages/customer/CustomerProfile.tsx",
    v1: true,
  },
];

export const CUSTOMER_MORE: ScreenDef[] = [
  { id: "my-requests", role: "customer", title: "My requests", web: "frontend/src/pages/customer/MyRequests.tsx", v1: false },
  { id: "customer-messages", role: "customer", title: "Messages", web: "frontend/src/pages/customer/CustomerMessages.tsx", v1: false },
  { id: "customer-notifications", role: "customer", title: "Notifications", web: "frontend/src/pages/customer/CustomerNotifications.tsx", v1: false },
];
