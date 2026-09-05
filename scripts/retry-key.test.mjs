import test from "node:test";
import assert from "node:assert/strict";
import { retryIdentity } from "../src/lib/directory/retry-key.mjs";
import { studioFeedback } from "../src/lib/directory/studio-feedback.mjs";
test("uncertain decision retry keeps its key while changed reason, decision or claim gets a new key", () => {
  let count = 0;
  const key = () => `key-${++count}`;
  const command = {
    kind: "claim",
    id: "claim-1",
    decision: "rejected",
    reason: "Missing evidence",
  };
  const original = retryIdentity(null, command, key);
  assert.strictEqual(retryIdentity(original, { ...command }, key), original);
  for (const change of [
    { reason: "Evidence differs" },
    { decision: "approved" },
    { id: "claim-2" },
  ]) {
    assert.notEqual(retryIdentity(original, { ...command, ...change }, key).key, original.key);
  }
  assert.equal(count, 4);
});
test("Studio guidance distinguishes stale data, sign-in, access and transport failures", () => {
  assert.match(studioFeedback("listing_changed_since_proposal"), /Reload Studio/);
  assert.match(studioFeedback("reauth_required"), /Sign in again/);
  assert.match(studioFeedback("listing_access_forbidden"), /permission/);
  assert.doesNotMatch(studioFeedback("authorization_forbidden"), /Sign in again/);
  assert.match(studioFeedback("studio_command_failed"), /Retry safely/);
});
