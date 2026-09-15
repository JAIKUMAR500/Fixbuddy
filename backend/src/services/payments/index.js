import { FINANCIAL_MODE } from "./config.js";
import { DevelopmentPaymentService } from "./DevelopmentPaymentService.js";

const development = new DevelopmentPaymentService();

/** Always development in this phase. Production provider is never constructed. */
export function getPaymentService() {
  return development;
}

export function financialMode() {
  return FINANCIAL_MODE;
}

export { DevelopmentPaymentService } from "./DevelopmentPaymentService.js";
export { FutureProductionPaymentService } from "./FutureProductionPaymentService.js";
export { PaymentService } from "./PaymentService.js";
export * from "./config.js";
export * from "./money.js";
