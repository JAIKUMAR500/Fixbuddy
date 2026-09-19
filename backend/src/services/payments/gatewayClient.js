import { GATEWAYS } from "./gatewayConfig.js";
import { httpError } from "../../utils/asyncHandler.js";

/**
 * Minimal HTTP clients for the supported gateways. Secrets are only ever sent
 * to the gateway and are never logged or returned to callers.
 */

async function postForm(url, body, headers) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Gateway error text is safe; credentials are not part of the response.
    const message = data?.error?.description || data?.error?.message || "Payment gateway rejected the order.";
    throw httpError(502, message);
  }
  return data;
}

export class RazorpayClient {
  constructor(config) {
    this.config = config;
  }

  get provider() {
    return GATEWAYS.RAZORPAY;
  }

  async createOrder({ amountPaise, currency, receipt, notes }) {
    const auth = Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64");
    const data = await postForm(
      "https://api.razorpay.com/v1/orders",
      {
        amount: String(amountPaise),
        currency,
        receipt,
        "notes[requestId]": notes?.requestId || "",
        payment_capture: "1",
      },
      { Authorization: `Basic ${auth}` }
    );
    return { orderId: String(data.id), amountPaise: Number(data.amount), currency: String(data.currency || currency) };
  }
}

export class StripeClient {
  constructor(config) {
    this.config = config;
  }

  get provider() {
    return GATEWAYS.STRIPE;
  }

  async createOrder({ amountPaise, currency, receipt, notes }) {
    const data = await postForm(
      "https://api.stripe.com/v1/payment_intents",
      {
        amount: String(amountPaise),
        currency: String(currency).toLowerCase(),
        "automatic_payment_methods[enabled]": "true",
        description: receipt,
        "metadata[requestId]": notes?.requestId || "",
      },
      { Authorization: `Bearer ${this.config.keySecret}` }
    );
    return {
      orderId: String(data.id),
      amountPaise: Number(data.amount),
      currency: String(data.currency || currency).toUpperCase(),
      clientSecret: String(data.client_secret || ""),
    };
  }
}

export function gatewayClientFor(config) {
  if (config.provider === GATEWAYS.RAZORPAY) return new RazorpayClient(config);
  if (config.provider === GATEWAYS.STRIPE) return new StripeClient(config);
  throw httpError(503, "Online payments are not enabled on this deployment.");
}
