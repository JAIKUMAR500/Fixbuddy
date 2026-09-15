import test from "node:test";
import assert from "node:assert/strict";
import { km, OPEN_JOB_STATUSES } from "../src/utils/geo.js";
import { hasValidLicense } from "../src/utils/license.js";
import {
  ENGAGED_JOB_STATUSES,
  PENDING_JOB_STATUSES,
  CLOSED_JOB_STATUSES,
  isEngagedJobStatus,
} from "../src/utils/jobLock.js";

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

test("job focus uses existing engaged statuses until paid or cancelled", () => {
  assert.deepEqual(PENDING_JOB_STATUSES, ["matching", "open", "requested"]);
  for (const status of ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed"]) {
    assert.equal(isEngagedJobStatus(status), true);
  }
  for (const status of ["matching", "open", "requested", "payment_collected", "customer_completed", "reviewed", "cancelled", "declined"]) {
    assert.equal(isEngagedJobStatus(status), false);
  }
  assert.equal(ENGAGED_JOB_STATUSES.includes("payment_collected"), false);
  assert.equal(CLOSED_JOB_STATUSES.includes("cancelled"), true);
});
