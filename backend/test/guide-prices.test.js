import test from "node:test";
import assert from "node:assert/strict";
import { guidePriceText, typicalPrice } from "../src/utils/guidePrices.js";

test("static category prices fill the blank rupee dash", () => {
  assert.equal(typicalPrice("Plumbing"), 499);
  assert.equal(typicalPrice("AC Repair"), 799);
  assert.equal(typicalPrice("unknown-service"), 499);
  assert.match(guidePriceText("Plumbing"), /₹299–₹899/);
});
