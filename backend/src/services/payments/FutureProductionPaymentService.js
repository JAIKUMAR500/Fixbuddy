import { PaymentService } from "./PaymentService.js";
import { httpError } from "../../utils/asyncHandler.js";

/** Placeholder only. Do not instantiate — no gateway, no real money. */
export class FutureProductionPaymentService extends PaymentService {
  get mode() {
    return "production";
  }

  async settleJob() {
    throw httpError(501, "Production payments are not enabled.");
  }

  async simulateCancellation() {
    throw httpError(501, "Production payments are not enabled.");
  }
}
