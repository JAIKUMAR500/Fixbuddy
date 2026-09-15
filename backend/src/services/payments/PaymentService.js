/**
 * Payment provider interface.
 * DevelopmentPaymentService is the only active implementation.
 * FutureProductionPaymentService is a placeholder and must not be constructed in this phase.
 */
export class PaymentService {
  get mode() {
    return "unknown";
  }

  async settleJob(_request, _options) {
    throw new Error("PaymentService.settleJob is not implemented");
  }

  async simulateCancellation(_request, _options) {
    throw new Error("PaymentService.simulateCancellation is not implemented");
  }
}
