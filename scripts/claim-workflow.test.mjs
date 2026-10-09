import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { claimWorkflowCommand, runClaimWorkflow } from "../src/lib/supabase/claim-commands.mjs";
import { studioCommand } from "../src/lib/supabase/studio-commands.mjs";
import { safeReturnPath } from "../src/lib/auth/policy.mjs";
const id = "b1000000-0000-4000-8000-000000000001";
test("claim lifecycle uses narrow validated commands and no client actor or role override", () => {
  assert.deepEqual(claimWorkflowCommand({ action: "withdraw", claimId: id, actorId: "other" }), {
    rpc: "withdraw_listing_claim",
    body: { requested_claim_id: id },
  });
  assert.throws(
    () => claimWorkflowCommand({ action: "grant", claimId: id }),
    /invalid_claim_command/,
  );
  assert.throws(
    () =>
      claimWorkflowCommand({
        action: "evidence",
        claimId: id,
        challenge: "bad",
        reference: "registry 123",
        explanation: "Authorized listing manager",
        key: "valid-test-key",
      }),
    /invalid_claim_command/,
  );
  const invite = claimWorkflowCommand({
    action: "invite",
    listingId: id,
    email: " Owner@Fixture.Example ",
    role: "listing_manager",
    token: "a".repeat(64),
    key: "valid-test-key",
  });
  assert.equal(invite.body.requested_email, "owner@fixture.example");
  assert.equal(invite.body.requested_role, "listing_manager");
  assert.throws(() =>
    claimWorkflowCommand({
      action: "invite",
      listingId: id,
      email: "owner@fixture.example",
      role: "operator",
      token: "a".repeat(64),
      key: "valid-test-key",
    }),
  );
});
test("authentication fails without contacting proof or invitation providers", async () => {
  let calls = 0;
  assert.deepEqual(
    await runClaimWorkflow(
      { action: "reviewEvidence", claimId: id },
      {
        accessToken: "",
        fetchImpl: async () => {
          calls++;
          throw Error("must not call");
        },
      },
    ),
    { ok: false, code: "authentication_required" },
  );
  assert.equal(calls, 0);
});
test("proof, conflict and stale-auth failures remain stable and redact private details", async () => {
  for (const code of [
    "claim_scope_changed",
    "reauth_required",
    "independent_authority_review_required",
    "invitation_identity_mismatch",
    "people_management_forbidden",
  ]) {
    const result = await runClaimWorkflow(
      { action: "reviewEvidence", claimId: id },
      {
        accessToken: "fixture-jwt",
        env: {
          SUPABASE_URL: "https://fixture.supabase.co",
          SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_fixture_key",
        },
        fetchImpl: async () =>
          new Response(JSON.stringify({ message: code, details: "private proof details" }), {
            status: 400,
          }),
      },
    );
    assert.deepEqual(result, { ok: false, code });
  }
});
test("new listing request stays Reno-scoped and excludes residential street and requested grants", () => {
  const command = studioCommand({
    action: "request",
    name: "Fixture Shop",
    citySlug: "reno",
    categorySlug: "handyman",
    phone: "775 555 0100",
    zip: "89502",
    description: "Synthetic service business.",
    website: "https://fixture.example",
    key: "listing-request-fixture",
    street: "private home",
    owner: true,
  });
  assert.equal(command.rpc, "request_business_listing");
  assert.equal(command.body.requested_payload.street, undefined);
  assert.equal(command.body.requested_payload.owner, undefined);
  assert.throws(() =>
    studioCommand({
      action: "request",
      name: "Fixture Shop",
      citySlug: "sparks",
      categorySlug: "handyman",
      phone: "775 555 0100",
      zip: "89431",
      description: "Synthetic service business.",
      key: "listing-request-fixture",
    }),
  );
});
test("listing services are bounded and reviewed with identity proposals", () => {
  const data = {
    action: "propose",
    id,
    baseVersion: "2026-09-30T00:00:00.000Z",
    name: "Fixture Shop",
    description: "Synthetic service business.",
    phone: "7755550100",
    website: "https://fixture.example",
    key: "proposal-fixture-key",
    services: ["Painting", "Drywall"],
  };
  assert.deepEqual(studioCommand(data).body.requested_payload.services, ["Painting", "Drywall"]);
  assert.throws(() => studioCommand({ ...data, services: ["a".repeat(101)] }));
});
test("mobile and interrupted sign-in return stays local, including invitations", async () => {
  for (const path of ["/\\evil.example", "/foo\nbar", "/%2fevil.example", "/%5cevil.example"])
    assert.equal(safeReturnPath(path), "/account");
  assert.equal(
    safeReturnPath("/invitation?token=" + "a".repeat(64)),
    "/invitation?token=" + "a".repeat(64),
  );
  const signIn = await readFile(
    new URL("../src/routes/api/auth/sign-in.tsx", import.meta.url),
    "utf8",
  );
  assert.match(signIn, /prompt: "login", maxAge: 0/);
  assert.match(signIn, /failed.searchParams.set\(\s*"next",\s*safeReturnPath/);
});
