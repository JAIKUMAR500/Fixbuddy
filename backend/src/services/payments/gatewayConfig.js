import { httpError } from "../../utils/asyncHandler.js";

/**
 * Gateway configuration for the production payment architecture.
 *
 * Real money stays OFF unless FINANCIAL_MODE=production AND a supported
 * gateway is fully configured. Development is the default everywhere, and
 * secrets are never returned to clients or written to logs.
 */

export const GATEWAYS = { RAZORPAY: "razorpay", STRIPE: "stripe" };

export function resolvedFinancialMode(source = process.env) {
  const raw = String(source.FINANCIAL_MODE || "development").toLowerCase().trim();
  return raw === "production" ? "production" : "development";
}

export function gatewayConfig(source = process.env) {
  const provider = String(source.PAYMENT_GATEWAY || "").toLowerCase().trim();
  if (provider === GATEWAYS.RAZORPAY) {
    return {
      provider,
      keyId: String(source.RAZORPAY_KEY_ID || "").trim(),
      keySecret: String(source.RAZORPAY_KEY_SECRET || "").trim(),
      webhookSecret: String(source.RAZORPAY_WEBHOOK_SECRET || "").trim(),
      currency: String(source.PAYMENT_CURRENCY || "INR").toUpperCase(),
    };
  }
  if (provider === GATEWAYS.STRIPE) {
    return {
      provider,
      keyId: String(source.STRIPE_PUBLISHABLE_KEY || "").trim(),
      keySecret: String(source.STRIPE_SECRET_KEY || "").trim(),
      webhookSecret: String(source.STRIPE_WEBHOOK_SECRET || "").trim(),
      currency: String(source.PAYMENT_CURRENCY || "INR").toUpperCase(),
    };
  }
  return { provider: "", keyId: "", keySecret: "", webhookSecret: "", currency: "INR" };
}

export function gatewayProblems(source = process.env) {
  const cfg = gatewayConfig(source);
  const problems = [];
  if (!cfg.provider) problems.push("PAYMENT_GATEWAY (razorpay or stripe)");
  if (!cfg.keySecret) problems.push(cfg.provider === GATEWAYS.STRIPE ? "STRIPE_SECRET_KEY" : "RAZORPAY_KEY_SECRET");
  if (!cfg.webhookSecret) {
    problems.push(cfg.provider === GATEWAYS.STRIPE ? "STRIPE_WEBHOOK_SECRET" : "RAZORPAY_WEBHOOK_SECRET");
  }
  if (cfg.provider === GATEWAYS.RAZORPAY && !cfg.keyId) problems.push("RAZORPAY_KEY_ID");
  return problems;
}

/** True only when production mode is requested and the gateway is complete. */
export function isGatewayReady(source = process.env) {
  if (resolvedFinancialMode(source) !== "production") return false;
  return gatewayProblems(source).length === 0;
}

/**
 * Startup guard. Production mode must not boot half-configured, and gateway
 * keys must not sit in the environment while the app runs in development.
 */
export function paymentEnvProblems(source = process.env) {
  const mode = resolvedFinancialMode(source);
  const cfg = gatewayConfig(source);
  if (mode === "production") {
    const problems = gatewayProblems(source);
    return problems.length ? [`FINANCIAL_MODE=production requires: ${problems.join(", ")}`] : [];
  }
  if (cfg.keySecret || cfg.webhookSecret) {
    return [
      "Payment gateway secrets are set but FINANCIAL_MODE is development. Unset them or set FINANCIAL_MODE=production.",
    ];
  }
  return [];
}

export function assertPaymentEnv(source = process.env) {
  const problems = paymentEnvProblems(source);
  if (problems.length) throw new Error(problems.join(" "));
  return resolvedFinancialMode(source);
}

/** Public, non-secret values that the checkout UI is allowed to see. */
export function publicGatewayInfo(source = process.env) {
  const cfg = gatewayConfig(source);
  if (!isGatewayReady(source)) return { enabled: false, provider: "", keyId: "", currency: cfg.currency };
  return { enabled: true, provider: cfg.provider, keyId: cfg.keyId, currency: cfg.currency };
}

export function requireGateway(source = process.env) {
  if (!isGatewayReady(source)) {
    throw httpError(503, "Online payments are not enabled on this deployment.");
  }
  return gatewayConfig(source);
}
