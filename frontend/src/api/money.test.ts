import { describe, expect, it } from "vitest";
import { formatRupees, jobAmountRupees, typicalPrice } from "./money";

describe("jobAmountRupees", () => {
  it("uses the quoted or estimated amount when present", () => {
    expect(jobAmountRupees({ workerQuote: 900, estimatedAmount: 400, category: "Plumbing" })).toBe(900);
    expect(jobAmountRupees({ estimatedAmount: 400, category: "Plumbing" })).toBe(400);
  });

  it("falls back to the static category price instead of a blank dash", () => {
    expect(jobAmountRupees({ category: "Plumbing", estimatedAmount: 0 })).toBe(499);
    expect(typicalPrice("AC Repair")).toBe(799);
    expect(formatRupees(0)).toBe("₹0");
    expect(formatRupees(499)).toMatch(/₹499/);
  });
});
