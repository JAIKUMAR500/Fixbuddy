import test from "node:test";
import assert from "node:assert/strict";
import { assertTransition, canTransition, coordsFromBody } from "../src/utils/jobState.js";

test("valid Rapido-style job transitions are allowed", () => {
  assert.equal(canTransition("requested", "accepted"), true);
  assert.equal(canTransition("accepted", "on_the_way"), true);
  assert.equal(canTransition("on_the_way", "arrived"), true);
  assert.equal(canTransition("arrived", "in_progress"), true);
  assert.equal(canTransition("otp_verified", "in_progress"), true);
  assert.equal(canTransition("in_progress", "completed"), true);
  assert.equal(canTransition("completed", "customer_completed"), true);
});

test("invalid status transitions are rejected", () => {
  assert.equal(canTransition("requested", "in_progress"), false);
  assert.equal(canTransition("requested", "completed"), false);
  assert.equal(canTransition("completed", "in_progress"), false);
  assert.equal(canTransition("cancelled", "in_progress"), false);
  assert.throws(() => assertTransition("open", "completed"), /cannot move/i);
});

test("coordsFromBody accepts lat/lng and latitude/longitude aliases", () => {
  assert.deepEqual(coordsFromBody({ lat: 11.01, lng: 76.95 }), { lat: 11.01, lng: 76.95 });
  assert.deepEqual(coordsFromBody({ latitude: 11.01, longitude: 76.95 }), { lat: 11.01, lng: 76.95 });
  assert.equal(coordsFromBody({ lat: 200, lng: 0 }), null);
  assert.equal(coordsFromBody({}), null);
});
