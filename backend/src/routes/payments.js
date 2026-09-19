import { Router } from "express";
import { Request } from "../models/Request.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { rateLimit, clientKey } from "../middleware/rateLimit.js";
import { paramObjectId } from "../middleware/validate.js";
import { getPaymentService } from "../services/payments/index.js";
import { isGatewayReady, publicGatewayInfo } from "../services/payments/gatewayConfig.js";

const router = Router();
router.param("id", paramObjectId("id"));

const orderLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  key: (req) => `pay-order:${req.userId || clientKey(req)}`,
  message: "Too many payment attempts. Try again in a few minutes.",
});

/** Non-secret checkout configuration for the client. */
router.get(
  "/config",
  asyncHandler(async (_req, res) => {
    res.json({ payments: publicGatewayInfo() });
  })
);

/**
 * Creates a gateway order. The amount is derived from the job on the server;
 * any amount supplied by the client is ignored.
 */
router.post(
  "/create-order",
  orderLimit,
  asyncHandler(async (req, res) => {
    if (!isGatewayReady()) throw httpError(503, "Online payments are not enabled on this deployment.");
    const requestId = String(req.body?.requestId || "");
    if (!/^[a-fA-F0-9]{24}$/.test(requestId)) throw httpError(400, "A valid job id is required.");

    const job = await Request.findById(requestId);
    if (!job) throw httpError(404, "Request not found");

    const service = getPaymentService();
    const order = await service.createOrder({ request: job, customerId: req.userId });
    res.status(201).json({ order });
  })
);

/**
 * Gateway webhook. Mounted before the JSON body parser so the raw bytes are
 * available for signature verification, and never trusted without it.
 */
export const paymentWebhook = asyncHandler(async (req, res) => {
  if (!isGatewayReady()) throw httpError(503, "Online payments are not enabled on this deployment.");
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ""));
  const result = await getPaymentService().handleWebhook({ rawBody, headers: req.headers });
  // Always 200 on an accepted event so the gateway stops retrying.
  res.status(200).json(result);
});

export default router;
