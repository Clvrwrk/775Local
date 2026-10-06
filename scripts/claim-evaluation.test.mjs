import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateClaimAuthority } from "../src/lib/directory/claim-evaluation.mjs";
const complete = {
  identityVerified: true,
  authorityVerified: true,
  listingMatches: true,
  roleMatches: true,
  evidenceCurrent: true,
  conflict: false,
  confidence: 0.96,
  calibration: { validated: true, artifact: "held-out-v1" },
};
test("automatic grants always abstain, including a calibrated candidate above 95%", () => {
  assert.deepEqual(evaluateClaimAuthority(complete), {
    disposition: "human_review",
    automaticGrant: false,
    candidateEligible: true,
    reasons: ["automatic_grants_disabled"],
  });
});
test("95%, unknown, invalid or self-reported confidence does not pass the threshold", () => {
  for (const confidence of [0.95, null, undefined, NaN, Infinity, 1.1, -1, "0.99"])
    assert.equal(evaluateClaimAuthority({ ...complete, confidence }).candidateEligible, false);
  assert.equal(evaluateClaimAuthority({ ...complete, calibration: null }).candidateEligible, false);
  assert.equal(
    evaluateClaimAuthority({ ...complete, calibration: { validated: true } }).candidateEligible,
    false,
  );
});
test("every deterministic gate must be established independently of payment or domain hints", () => {
  for (const gate of [
    "identityVerified",
    "authorityVerified",
    "listingMatches",
    "roleMatches",
    "evidenceCurrent",
  ]) {
    for (const value of [false, undefined, "true"])
      assert.equal(
        evaluateClaimAuthority({ ...complete, [gate]: value, paid: true, domainMatches: true })
          .candidateEligible,
        false,
      );
  }
  for (const conflict of [true, undefined])
    assert.equal(evaluateClaimAuthority({ ...complete, conflict }).candidateEligible, false);
});

test("missing evaluation inputs abstain without a grant", () => {
  for (const input of [null, undefined, [], "unknown", 1]) {
    const result = evaluateClaimAuthority(input);
    assert.equal(result.automaticGrant, false);
    assert.equal(result.candidateEligible, false);
    assert.equal(result.disposition, "human_review");
  }
});
