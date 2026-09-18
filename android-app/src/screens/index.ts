import { AUTH_SCREENS } from "./auth";
import { CUSTOMER_V1 } from "./customer";
import { WORKER_V1 } from "./worker";
import { BUSINESS_V1 } from "./business";
import { SHARED_V1 } from "./shared";

export const V1_SCREENS = [
  ...AUTH_SCREENS,
  ...CUSTOMER_V1,
  ...WORKER_V1,
  ...BUSINESS_V1,
  ...SHARED_V1,
];
