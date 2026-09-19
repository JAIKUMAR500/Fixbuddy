import test from "node:test";
import assert from "node:assert/strict";
import { assertWorkPhotoUploadAllowed, canUploadWorkPhotos, presentWorkPhotos, workPhotoLimit } from "../src/utils/workPhotos.js";
import { commissionContextOf, commissionPercentForRequest, commissionPaise, netPaise } from "../src/services/payments/index.js";

test("work photo limits match product caps", () => {
  assert.equal(workPhotoLimit("before"), 3);
  assert.equal(workPhotoLimit("during"), 6);
  assert.equal(workPhotoLimit("after"), 3);
});

test("legacy string work photos normalize to metadata objects", () => {
  const presented = presentWorkPhotos({ before: ["/a.jpg"], during: [], after: [{ url: "/b.jpg", caption: "done" }] });
  assert.equal(presented.before[0].url, "/a.jpg");
  assert.equal(presented.after[0].caption, "done");
});

test("crew members can upload; strangers cannot", () => {
  const doc = { providerId: "lead", crewMemberIds: ["m1"], status: "in_progress" };
  assert.equal(canUploadWorkPhotos("lead", doc), true);
  assert.equal(canUploadWorkPhotos("m1", doc), true);
  assert.equal(canUploadWorkPhotos("x", doc), false);
  assert.equal(assertWorkPhotoUploadAllowed({ status: "reviewed" }, "after").ok, false);
});

test("demo commission examples match product math", () => {
  assert.equal(commissionPaise(100000, 10), 10000);
  assert.equal(netPaise(100000, 10000), 90000);
  assert.equal(commissionPaise(500000, 10), 50000);
  assert.equal(netPaise(500000, 50000), 450000);
  assert.equal(commissionPaise(200000, 8), 16000);
  assert.equal(netPaise(200000, 16000), 184000);
});

test("commission rates by assignment context", () => {
  const settings = {
    commissionPercent: 10,
    commissionRates: { independent: 10, crew: 10, businessMarketplace: 8, businessManaged: 8 },
  };
  assert.equal(commissionContextOf({ assignmentMode: "solo" }), "independent");
  assert.equal(commissionPercentForRequest({ assignmentMode: "business_team" }, settings), 8);
  assert.equal(commissionPercentForRequest({ crewId: "c1" }, settings), 10);
});
