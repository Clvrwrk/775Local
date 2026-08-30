import assert from "node:assert/strict";
import { test } from "node:test";
import { assignSeedTierMix, defaultImportedTier, scoreEnrichment } from "./seed-tier-lib.mjs";

function richCandidate(index) {
  return {
    id: `rich-${index}`,
    name: `Rich ${index}`,
    phone: "7755550100",
    description: "A".repeat(180),
    services: ["one", "two", "three"],
    hours: "Mon-Fri 8-5",
    faqs: ["one", "two", "three"],
    projects: ["one", "two"],
    publishablePhotos: ["one", "two", "three"],
  };
}

test("seed tier allocation produces the requested 60/30/10 example mix", () => {
  const result = assignSeedTierMix(Array.from({ length: 100 }, (_, index) => richCandidate(index)));
  assert.deepEqual(result.target, { basic: 60, standard: 30, premium: 10 });
  assert.deepEqual(result.actual, { basic: 60, standard: 30, premium: 10 });
  assert.deepEqual(result.shortfalls, { premium: 0, standard: 0 });
});

test("tier labels never overstate incomplete or unlicensed enrichment", () => {
  const scored = scoreEnrichment({
    name: "Example",
    website: "https://example.com",
    faqs: ["one", "two", "three"],
    projects: ["one", "two"],
    photos: ["discovered-one", "discovered-two", "discovered-three"],
  });
  assert.equal(scored.premiumEligible, false);
  assert.equal(scored.publishablePhotoCount, 0);

  const result = assignSeedTierMix([richCandidate(1), { id: "basic", name: "Basic" }]);
  assert.equal(result.assignments.find((row) => row.id === "basic").contentTier, "basic");
});

test("later imports default to visible Basic and Unverified independently of claims", () => {
  assert.deepEqual(defaultImportedTier({ id: "later" }), {
    id: "later",
    contentTier: "basic",
    informationStatus: "unverified",
    claimed: false,
  });
});
