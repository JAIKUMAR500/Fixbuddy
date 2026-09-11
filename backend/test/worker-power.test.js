import test from "node:test";
import assert from "node:assert/strict";
import { km, OPEN_JOB_STATUSES } from "../src/utils/geo.js";
import { hasValidLicense } from "../src/utils/license.js";

test("nearby-job distance is calculated in kilometers", () => {
  const distance = km(11.0168, 76.9558, 11.0268, 76.9658);
  assert.ok(distance > 1 && distance < 2);
});

test("recommended jobs use only open lifecycle statuses", () => {
  assert.deepEqual(OPEN_JOB_STATUSES, ["matching", "open", "requested"]);
  assert.equal(OPEN_JOB_STATUSES.includes("completed"), false);
  assert.equal(OPEN_JOB_STATUSES.includes("cancelled"), false);
});

test("admin license remains valid without an expiry date", () => {
  assert.equal(hasValidLicense({ role: "admin", license: { status: "revoked" } }), true);
});

test("active worker license must not be expired", () => {
  assert.equal(hasValidLicense({ role: "worker", license: { status: "active", expiresAt: new Date(Date.now() + 60_000) } }), true);
  assert.equal(hasValidLicense({ role: "worker", license: { status: "active", expiresAt: new Date(Date.now() - 60_000) } }), false);
});
