import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listingCorrectionSnapshot,
  applyReviewedListingCorrection,
  rollbackReviewedListingCorrection,
} from "../src/lib/supabase/listing-corrections.mjs";

const listingId = "40000000-0000-4000-8000-000000000001";
const receiptId = "50000000-0000-4000-8000-000000000001";
const options = {
  accessToken: "synthetic.user.jwt",
  env: {
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_fixture",
  },
};

test("correction adapters expose fixed user-scoped RPCs with exact bodies", async () => {
  const cases = [
    [
      listingCorrectionSnapshot,
      { listingId },
      "listing_correction_snapshot",
      { requested_listing_id: listingId },
    ],
    [
      applyReviewedListingCorrection,
      {
        listingId,
        correction: { changes: { hours_text: null } },
        idempotencyKey: "fixture-correction-1",
      },
      "apply_reviewed_listing_correction",
      {
        requested_listing_id: listingId,
        requested_correction: { changes: { hours_text: null } },
        requested_key: "fixture-correction-1",
      },
    ],
    [
      rollbackReviewedListingCorrection,
      {
        listingId,
        receiptId,
        expectedVersion: "a".repeat(64),
        reason: "Restore reviewed prior value",
        idempotencyKey: "fixture-rollback-1",
      },
      "rollback_reviewed_listing_correction",
      {
        requested_listing_id: listingId,
        requested_receipt_id: receiptId,
        requested_expected_version: "a".repeat(64),
        requested_reason: "Restore reviewed prior value",
        requested_key: "fixture-rollback-1",
      },
    ],
  ];
  for (const [command, input, rpc, body] of cases) {
    let count = 0;
    const result = await command(input, {
      ...options,
      fetchImpl: async (url, init) => {
        count++;
        assert.equal(String(url), `https://fixture.supabase.co/rest/v1/rpc/${rpc}`);
        assert.equal(init.headers.Authorization, "Bearer synthetic.user.jwt");
        assert.equal(init.headers.apikey, options.env.SUPABASE_PUBLISHABLE_KEY);
        assert.deepEqual(JSON.parse(init.body), body);
        assert.doesNotMatch(init.body, /synthetic\.user\.jwt|service_role/);
        return Response.json({ receiptId, idempotent: false });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(count, 1);
  }
});

test("actor/token injection, missing identities and oversized UTF8 evidence fail before fetch", async () => {
  const fetchImpl = async () => {
    assert.fail("invalid input must not fetch");
  };
  for (const input of [
    { listingId, actorId: receiptId },
    { listingId, accessToken: "attacker" },
    { listingId: "" },
    null,
  ])
    assert.deepEqual(await listingCorrectionSnapshot(input, { ...options, fetchImpl }), {
      ok: false,
      code: "invalid_operator_command",
    });
  for (const input of [
    { listingId, correction: {}, idempotencyKey: "short" },
    { listingId, correction: { evidence: "🧪".repeat(9000) }, idempotencyKey: "fixture-large-1" },
    { listingId, correction: [], idempotencyKey: "fixture-array-1" },
  ])
    assert.deepEqual(await applyReviewedListingCorrection(input, { ...options, fetchImpl }), {
      ok: false,
      code: "invalid_operator_command",
    });
  assert.deepEqual(
    await rollbackReviewedListingCorrection(
      {
        listingId,
        receiptId,
        expectedVersion: "unknown",
        reason: "Restore",
        idempotencyKey: "fixture-rollback-1",
      },
      { ...options, fetchImpl },
    ),
    { ok: false, code: "invalid_operator_command" },
  );
});

test("auth, replay and evidence failures stay stable and private; transport is never retried", async () => {
  const input = { listingId, correction: {}, idempotencyKey: "fixture-error-1" };
  assert.deepEqual(
    await applyReviewedListingCorrection(input, {
      ...options,
      accessToken: "",
      fetchImpl: async () => assert.fail(),
    }),
    { ok: false, code: "authentication_required" },
  );
  for (const code of [
    "reauth_required",
    "idempotency_conflict",
    "listing_changed_since_correction",
    "correction_evidence_expired",
    "correction_source_identity_conflict",
    "operator_command_failed",
  ]) {
    let calls = 0;
    const result = await applyReviewedListingCorrection(input, {
      ...options,
      fetchImpl: async () => {
        calls++;
        return Response.json(
          {
            message:
              code === "operator_command_failed"
                ? "Private error containing evidence and credentials"
                : code,
          },
          { status: 400 },
        );
      },
    });
    assert.deepEqual(result, { ok: false, code });
    assert.equal(calls, 1);
  }
});
