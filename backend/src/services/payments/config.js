import { rupeesToPaise } from "./money.js";

/** Development-only. Production providers must not be selected from this file. */
export const FINANCIAL_MODE = "development";

export function assertDevelopmentFinance() {
  const mode = String(process.env.FINANCIAL_MODE || FINANCIAL_MODE).toLowerCase();
  if (mode !== "development") {
    throw new Error("FINANCIAL_MODE must remain development. Real payments are not enabled.");
  }
  return FINANCIAL_MODE;
}
export const SIMULATION_LABEL = "DEVELOPMENT / SIMULATED — NO REAL MONEY";

export const DEFAULT_COMMISSION_PERCENT = 10;
export const DEFAULT_TRAVEL_COMPENSATION_INR = 75;
export const MAX_COMMISSION_PERCENT = 40;

export const LEDGER_TYPES = {
  JOB_PAYMENT: "JOB_PAYMENT_SIMULATION",
  COMMISSION: "COMMISSION_SIMULATION",
  WORKER_EARNING: "WORKER_EARNING_SIMULATION",
  COMPENSATION: "CANCELLATION_COMPENSATION_SIMULATION",
};

export const FINANCE_STATUS = {
  NOT_APPLICABLE: "not_applicable",
  PENDING: "pending_simulation",
  SIMULATED: "simulated",
  CANCELLED: "cancelled",
  REFUNDED: "refunded_simulation",
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
