import { rupeesToPaise } from "./money.js";
import { isGatewayReady, resolvedFinancialMode } from "./gatewayConfig.js";

/**
 * Mode resolved once at startup. It is only "production" when
 * FINANCIAL_MODE=production AND a gateway is completely configured, so a
 * half-configured deployment can never move real money.
 */
export const FINANCIAL_MODE = isGatewayReady() ? "production" : "development";

export function assertDevelopmentFinance() {
  if (resolvedFinancialMode() !== "development") {
    throw new Error("FINANCIAL_MODE must remain development for this operation.");
  }
  return "development";
}
export const SIMULATION_LABEL = "DEVELOPMENT / SIMULATED — NO REAL MONEY";
export const PRODUCTION_LABEL = "LIVE PAYMENT";

export const DEFAULT_COMMISSION_PERCENT = 10;
export const DEFAULT_TRAVEL_COMPENSATION_INR = 75;
export const MAX_COMMISSION_PERCENT = 40;

export const LEDGER_TYPES = {
  JOB_PAYMENT: "JOB_PAYMENT_SIMULATION",
  COMMISSION: "COMMISSION_SIMULATION",
  WORKER_EARNING: "WORKER_EARNING_SIMULATION",
  COMPENSATION: "CANCELLATION_COMPENSATION_SIMULATION",
};

/** Live-money counterparts. Same one-entry-per-job-and-type uniqueness. */
export const LIVE_LEDGER_TYPES = {
  JOB_PAYMENT: "JOB_PAYMENT_CAPTURED",
  COMMISSION: "COMMISSION_COLLECTED",
  WORKER_EARNING: "WORKER_EARNING_CREDITED",
  COMPENSATION: "CANCELLATION_COMPENSATION_PAID",
};

export function ledgerTypesFor(mode) {
  return mode === "production" ? LIVE_LEDGER_TYPES : LEDGER_TYPES;
}

export const FINANCE_STATUS = {
  NOT_APPLICABLE: "not_applicable",
  PENDING: "pending_simulation",
  SIMULATED: "simulated",
  CANCELLED: "cancelled",
  REFUNDED: "refunded_simulation",
  AWAITING_PAYMENT: "awaiting_payment",
  CAPTURED: "captured",
  FAILED: "failed",
};

export const CANCEL_SCENARIOS = {
  CUSTOMER_BEFORE_ACCEPT: "customer_before_accept",
  CUSTOMER_AFTER_ACCEPT: "customer_after_accept",
  CUSTOMER_AFTER_ARRIVE: "customer_after_arrive",
  CUSTOMER_AFTER_START: "customer_after_start",
  WORKER_AFTER_ACCEPT: "worker_after_accept",
  WORKER_AFTER_ARRIVE: "worker_after_arrive",
  ADMIN_OR_MUTUAL: "admin_or_mutual",
};

/**
 * Compensation amounts are configuration, not scattered business values.
 * Travel compensation uses PlatformSettings.travelCompensationInr when useTravelSettings is true.
 */
export const COMPENSATION_POLICY = {
  [CANCEL_SCENARIOS.CUSTOMER_BEFORE_ACCEPT]: { amountPaise: 0, payer: null, receiver: null },
  [CANCEL_SCENARIOS.CUSTOMER_AFTER_ACCEPT]: { amountPaise: 0, payer: null, receiver: null },
  [CANCEL_SCENARIOS.CUSTOMER_AFTER_ARRIVE]: { amountPaise: 0, useTravelSettings: true, payer: "customer", receiver: "worker" },
  [CANCEL_SCENARIOS.CUSTOMER_AFTER_START]: { amountPaise: 0, useTravelSettings: true, payer: "customer", receiver: "worker" },
  [CANCEL_SCENARIOS.WORKER_AFTER_ACCEPT]: { amountPaise: 0, payer: null, receiver: null },
  [CANCEL_SCENARIOS.WORKER_AFTER_ARRIVE]: { amountPaise: 0, payer: null, receiver: null },
  [CANCEL_SCENARIOS.ADMIN_OR_MUTUAL]: { amountPaise: 0, payer: null, receiver: null },
};

export function travelCompensationPaise(settings) {
  const rupees = settings?.travelCompensationInr ?? settings?.cancellationPolicy?.workerTravelCompensation ?? DEFAULT_TRAVEL_COMPENSATION_INR;
  return rupeesToPaise(rupees);
}

export function commissionPercentFrom(settings) {
  const raw = settings?.commissionPercent ?? DEFAULT_COMMISSION_PERCENT;
  const n = Math.trunc(Number(raw) || 0);
  if (n < 0) return 0;
  if (n > MAX_COMMISSION_PERCENT) return MAX_COMMISSION_PERCENT;
  return n;
}
