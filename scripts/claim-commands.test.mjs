import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  decideListingClaim,
  getMyListingClaim,
  submitListingClaim,
  validateClaimDecision,
  validateClaimSubmission,
} from "../src/lib/supabase/claim-commands.mjs";

const listingId = "10000000-0000-4000-8000-000000000001";
const claimId = "20000000-0000-4000-8000-000000000001";
const env = {
  SUPABASE_URL: "https://preview-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_claim_key",
};

test("Claim submission validates the canonical Listing id, method, and idempotency key", () => {
  assert.deepEqual(
    validateClaimSubmission({
      listingId: listingId.toUpperCase(),
      method: "business_domain",
      idempotencyKey: "claim-submit-1",
    }),
    { listingId, method: "business_domain", idempotencyKey: "claim-submit-1" },
  );
  assert.throws(
    () =>
      validateClaimSubmission({
        listingId: "1",
        method: "domain",
        idempotencyKey: "short",
      }),
    /invalid_claim_command/,
  );
});

test("Claim submission uses the WorkOS bearer token and publishable key at one RPC seam", async () => {
  let request;
  const result = await submitListingClaim(
    {
      listingId,
      method: "storefront",
      idempotencyKey: "claim-submit-2",
    },
    {
      accessToken: "workos.jwt.token",
      env,
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return new Response(
          JSON.stringify({
            claim_id: claimId,
            status: "needs_evidence",
            owner_authority: false,
            requires_evidence: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(request.url, "https://preview-project.supabase.co/rest/v1/rpc/submit_listing_claim");
  assert.equal(request.init.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(request.init.headers.Authorization, "Bearer workos.jwt.token");
  assert.deepEqual(JSON.parse(request.init.body), {
    requested_listing_id: listingId,
    requested_method: "storefront",
    requested_idempotency_key: "claim-submit-2",
  });
  assert.doesNotMatch(request.init.body, /workos\.jwt\.token|service_role/i);
});

test("Claim status query is scoped to one canonical Listing", async () => {
  let body;
  const result = await getMyListingClaim(
    { listingId },
    {
      accessToken: "workos.jwt.token",
      env,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return new Response("null", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );
  assert.deepEqual(result, { ok: true, receipt: null });
  assert.deepEqual(body, { requested_listing_id: listingId });
});

test("Claim decision validates reason and maps the guarded Operator RPC", async () => {
  assert.deepEqual(
    validateClaimDecision({
      claimId,
      decision: "approved",
      reason: " Domain ownership confirmed. ",
      idempotencyKey: "claim-decision-1",
    }),
    {
      claimId,
      decision: "approved",
      reason: "Domain ownership confirmed.",
      idempotencyKey: "claim-decision-1",
    },
  );

  let request;
  const result = await decideListingClaim(
    {
      claimId,
      decision: "approved",
      reason: "Domain ownership confirmed.",
      idempotencyKey: "claim-decision-1",
    },
    {
      accessToken: "operator.jwt.token",
      env,
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return new Response(JSON.stringify({ claim_id: claimId, status: "approved" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(request.url, "https://preview-project.supabase.co/rest/v1/rpc/decide_listing_claim");
  assert.deepEqual(JSON.parse(request.init.body), {
    requested_claim_id: claimId,
    requested_decision: "approved",
    requested_reason: "Domain ownership confirmed.",
    requested_idempotency_key: "claim-decision-1",
  });
});

test("Claim failures return stable redacted codes", async () => {
  const domainFailure = await submitListingClaim(
    { listingId, method: "business_domain", idempotencyKey: "claim-submit-3" },
    {
      accessToken: "workos.jwt.token",
      env,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            message: "business domain evidence was not established: private detail",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
    },
  );
  assert.deepEqual(domainFailure, { ok: false, code: "domain_evidence_not_established" });

  const unknown = await submitListingClaim(
    { listingId, method: "document", idempotencyKey: "claim-submit-4" },
    {
      accessToken: "workos.jwt.token",
      env,
      fetchImpl: async () => new Response("secret provider detail", { status: 500 }),
    },
  );
  assert.deepEqual(unknown, { ok: false, code: "claim_command_failed" });
});

test("Claim contract never equates submission with authority or Lead delivery", async () => {
  const [migration, component, plan] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/20260831120000_add_claim_commands_and_listing_manager.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/components/directory/claim-listing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/CLAIMS-STUDIO-GHL-INTEGRATION-PLAN.md", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /owner_authority', false/);
  assert.match(migration, /Business Owner limit reached/);
  assert.match(migration, /claim\.submitted/);
  assert.match(migration, /listing_participation\.activated/);
  assert.match(migration, /revoke insert, update on app\.claims from authenticated/);
  assert.match(component, /Leads are not routed to you yet/);
  assert.doesNotMatch(component, /Leads now come to you/);
  assert.match(plan, /Listing Owner\s*\| Business Owner\s*\|\s*2/);
  assert.match(plan, /Listing Manager\s*\| Listing Manager\s*\|\s*3/);
  assert.match(plan, /Listing Agency\s*\| Agency Representative\s*\|\s*3/);
});

test("Claim HTTP authentication and authorization failures remain distinct", async () => {
  for (const [status, code] of [
    [401, "authentication_required"],
    [403, "authorization_forbidden"],
  ]) {
    const result = await submitListingClaim(
      { listingId, method: "document", idempotencyKey: "claim-http-test" },
      {
        accessToken: "jwt",
        env,
        fetchImpl: async () => new Response("private details", { status }),
      },
    );
    assert.deepEqual(result, { ok: false, code });
  }
});
