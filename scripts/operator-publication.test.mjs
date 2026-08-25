import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  publishLaunchSelection,
  reviewListingCandidate,
  validateLaunchPublicationInput,
} from "../src/lib/supabase/operator-publication.mjs";

const candidateId = "40000000-0000-4000-8000-000000000001";
const candidateIds = Array.from(
  { length: 100 },
  (_, index) => `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const env = {
  SUPABASE_URL: "https://preview-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_operator_key",
};

test("candidate review uses only the WorkOS bearer token and publishable Supabase key", async () => {
  const requests = [];
  const result = await reviewListingCandidate(
    {
      candidateId,
      idempotencyKey: "review-command-1",
      decision: { outcome: "accepted" },
    },
    {
      accessToken: "workos.jwt.token",
      env,
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify(candidateId), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );
  assert.deepEqual(result, { ok: true, receipt: candidateId });
  assert.equal(
    requests[0].url,
    "https://preview-project.supabase.co/rest/v1/rpc/review_listing_candidate",
  );
  assert.equal(requests[0].init.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(requests[0].init.headers.Authorization, "Bearer workos.jwt.token");
  assert.doesNotMatch(requests[0].init.body, /workos\.jwt\.token|service_role/i);
});

test("launch publication sends exactly the guarded RPC contract", async () => {
  let request;
  const result = await publishLaunchSelection(
    { candidateIds, idempotencyKey: "launch-command-1" },
    {
      accessToken: "workos.jwt.token",
      env,
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return new Response(
          JSON.stringify({ publication_batch_id: candidateId, listing_count: 100 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(
    request.url,
    "https://preview-project.supabase.co/rest/v1/rpc/publish_launch_selection",
  );
  assert.deepEqual(JSON.parse(request.init.body), {
    requested_candidate_ids: candidateIds,
    requested_idempotency_key: "launch-command-1",
  });
});

test("publication validation rejects partial or duplicated launch sets before fetch", async () => {
  assert.throws(
    () =>
      validateLaunchPublicationInput({
        candidateIds: candidateIds.slice(0, 99),
        idempotencyKey: "launch-1",
      }),
    /invalid_operator_command/,
  );
  const duplicated = [...candidateIds];
  duplicated[99] = duplicated[0];
  assert.throws(
    () => validateLaunchPublicationInput({ candidateIds: duplicated, idempotencyKey: "launch-1" }),
    /invalid_operator_command/,
  );
});

test("database recent-auth failures become a stable reauthentication code", async () => {
  const result = await reviewListingCandidate(
    { candidateId, idempotencyKey: "review-command-2", decision: { outcome: "accepted" } },
    {
      accessToken: "stale.jwt.token",
      env,
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: "recent Operator authentication is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    },
  );
  assert.deepEqual(result, { ok: false, code: "reauth_required" });
});

test("idempotency conflicts and unknown provider failures are redacted", async () => {
  const conflict = await reviewListingCandidate(
    { candidateId, idempotencyKey: "review-command-3", decision: { outcome: "accepted" } },
    {
      accessToken: "workos.jwt.token",
      env,
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: "idempotency key was already used" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
    },
  );
  assert.deepEqual(conflict, { ok: false, code: "idempotency_conflict" });

  const unknown = await reviewListingCandidate(
    { candidateId, idempotencyKey: "review-command-4", decision: { outcome: "accepted" } },
    {
      accessToken: "workos.jwt.token",
      env,
      fetchImpl: async () => new Response("secret provider detail", { status: 500 }),
    },
  );
  assert.deepEqual(unknown, { ok: false, code: "operator_command_failed" });
});

test("operator commands fail closed without an approved target or human token", async () => {
  assert.deepEqual(
    await reviewListingCandidate(
      { candidateId, idempotencyKey: "review-command-5", decision: { outcome: "accepted" } },
      { accessToken: "", env },
    ),
    { ok: false, code: "authentication_required" },
  );
  assert.deepEqual(
    await reviewListingCandidate(
      { candidateId, idempotencyKey: "review-command-6", decision: { outcome: "accepted" } },
      {
        accessToken: "workos.jwt.token",
        env: { ...env, SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden" },
      },
    ),
    { ok: false, code: "operator_command_not_configured" },
  );
});

test("the server boundary derives identity from AuthKit and contains no service-role path", () => {
  const source = readFileSync(
    join(import.meta.dirname, "..", "src", "lib", "directory", "operator-publication.ts"),
    "utf8",
  );
  assert.match(source, /createServerFn\(\{ method: "POST" \}\)/);
  assert.match(source, /getAuthKitContextOrNull/);
  assert.match(source, /accessToken/);
  assert.doesNotMatch(source, /SERVICE_ROLE|serviceRole|SUPABASE_SERVICE_ROLE_KEY/);
});
