import { FINANCIAL_MODE } from "./config.js";
import { DevelopmentPaymentService } from "./DevelopmentPaymentService.js";
import { ProductionPaymentService } from "./ProductionPaymentService.js";
import { gatewayConfig, isGatewayReady } from "./gatewayConfig.js";

const development = new DevelopmentPaymentService();
let production = null;

/**
 * Development simulation is the default. The production service is only
 * constructed when FINANCIAL_MODE=production and the gateway is fully
 * configured, so an incomplete deployment can never move real money.
 */
export function getPaymentService() {
  if (!isGatewayReady()) return development;
  if (!production) production = new ProductionPaymentService({ config: gatewayConfig() });
  return production;
}

export function financialMode() {
  return FINANCIAL_MODE;
}

export function resetPaymentService() {
  production = null;
}

export { DevelopmentPaymentService } from "./DevelopmentPaymentService.js";
export { ProductionPaymentService } from "./ProductionPaymentService.js";
export { FutureProductionPaymentService } from "./FutureProductionPaymentService.js";
export { PaymentService } from "./PaymentService.js";
export * from "./config.js";
export * from "./money.js";
export * from "./gatewayConfig.js";
export * from "./signature.js";
