import test from "node:test";
import assert from "node:assert/strict";
import { studioCommand, runStudioCommand } from "../src/lib/supabase/studio-commands.mjs";
const id = "10000000-0000-4000-8000-000000000001";
const canonical = {
  name: "Synthetic Repair Shop",
  citySlug: "reno",
  categorySlug: "handyman",
  phone: "+17755550100",
  zip: "89502",
  description: "Synthetic repair services for isolated tests.",
  website: "https://fixture.example",
};
const command = {
  action: "decideRequest",
  id,
  key: "request-review-fixture",
  scope: { requestHash: "a".repeat(64), duplicates: [] },
  decision: {
    outcome: "approved",
    reason: "Independent synthetic NAP and legitimacy checks complete.",
    canonical,
    checks: {
      nap: true,
      activeBusiness: true,
      category: true,
      reno: true,
      rights: true,
      privacy: true,
      duplicates: true,
    },
    duplicateDecision: "no_duplicate",
    sourceUrls: ["https://fixture.example"],
    sourceCheckedAt: new Date().toISOString(),
  },
};
test("review adapter maps explicit manual publication and own-request status", () => {
  assert.equal(studioCommand({ action: "requestReview", id }).rpc, "get_listing_request_review");
  assert.equal(studioCommand({ action: "requests" }).rpc, "get_my_listing_requests");
  assert.equal(studioCommand(command).body.requested_decision.outcome, "approved");
});
test("review boundary rejects unknown fields, wrong geography, malformed sources and missing checks", () => {
  for (const c of [
    {
      ...command,
      decision: { ...command.decision, canonical: { ...canonical, street: "private" } },
    },
    {
      ...command,
      decision: { ...command.decision, canonical: { ...canonical, citySlug: "sparks" } },
    },
    {
      ...command,
      decision: { ...command.decision, sourceUrls: ["https://secret@fixture.example"] },
    },
    { ...command, decision: { ...command.decision, checks: { nap: true } } },
  ])
    assert.throws(() => studioCommand(c));
});
test("review permission/state errors are stable and provider narrative never escapes", async () => {
  const env = {
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only_not_a_credential",
  };
  const r = await runStudioCommand(command, {
    accessToken: "fixture",
    env,
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "duplicate_review_required" }), { status: 400 }),
  });
  assert.deepEqual(r, { ok: false, code: "duplicate_review_required" });
  const noauth = await runStudioCommand(command, { accessToken: "", env });
  assert.equal(noauth.code, "authentication_required");
});
