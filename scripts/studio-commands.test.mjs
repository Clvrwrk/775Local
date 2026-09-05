import { test } from "node:test";
import assert from "node:assert/strict";
import { studioCommand, runStudioCommand } from "../src/lib/supabase/studio-commands.mjs";
const id = "83000000-0000-4000-8000-000000000001";
const proposal = {
  action: "propose",
  baseVersion: "2000-01-01T00:00:00Z",
  id,
  key: "proposal-test-1",
  name: "Reno Shop",
  description: "Repair services in Reno.",
  phone: "(775) 333-9880",
  website: "https://reno.example",
};
test("Studio commands cannot select arbitrary RPCs or impersonate an actor", () => {
  assert.throws(() => studioCommand({ action: "delete_listing", id }));
  assert.deepEqual(studioCommand({ action: "account", actorId: id }), {
    rpc: "pilot_account",
    body: {},
  });
  assert.throws(() => studioCommand({ action: "workspace", id: "../other" }));
});
test("listing proposal normalizes contact details and excludes authority fields", () => {
  const command = studioCommand({ ...proposal, owner_verified: true });
  assert.equal(command.body.requested_payload.phone, "+17753339880");
  assert.equal(command.body.requested_payload.owner_verified, undefined);
  for (const change of [
    { phone: "+117753339880" },
    { website: "javascript:alert(1)" },
    { website: "https://user:secret@reno.example" },
    { description: "" },
    { key: "a" },
  ])
    assert.throws(() => studioCommand({ ...proposal, ...change }));
});
test("no auth never contacts the provider", async () => {
  const result = await runStudioCommand(
    { action: "account" },
    {
      accessToken: "",
      fetchImpl: () => {
        throw new Error("must not fetch");
      },
    },
  );
  assert.deepEqual(result, { ok: false, code: "authentication_required" });
});
test("Studio RPC preserves user JWT and idempotency; provider failures are redacted", async () => {
  let request;
  const options = {
    accessToken: "test-user-jwt",
    env: {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_1234567890",
    },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ id: "saved", status: "pending_review" }));
    },
  };
  const result = await runStudioCommand(proposal, options);
  assert.equal(result.ok, true);
  assert.equal(request.init.headers.Authorization, "Bearer test-user-jwt");
  assert.equal(JSON.parse(request.init.body).requested_key, proposal.key);
  assert.equal(request.url.pathname, "/rest/v1/rpc/submit_listing_proposal");
  const failed = await runStudioCommand(proposal, {
    ...options,
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "private provider secret" }), { status: 500 }),
  });
  assert.equal(JSON.stringify(failed).includes("private provider"), false);
});

test("Studio preserves only allowlisted workflow errors and separates auth from permission", async () => {
  const options = {
    accessToken: "jwt",
    env: {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_1234567890",
    },
  };
  for (const [status, message, expected] of [
    [400, "listing_changed_since_proposal", "listing_changed_since_proposal"],
    [400, "listing_access_forbidden", "listing_access_forbidden"],
    [400, "reauth_required", "reauth_required"],
    [400, "review_forbidden", "review_forbidden"],
    [400, "idempotency_conflict", "idempotency_conflict"],
    [401, "private body", "authentication_required"],
    [403, "private body", "authorization_forbidden"],
    [500, "private body", "studio_command_failed"],
  ]) {
    const result = await runStudioCommand(proposal, {
      ...options,
      fetchImpl: async () => new Response(JSON.stringify({ message }), { status }),
    });
    assert.deepEqual(result, { ok: false, code: expected });
  }
  const result = await runStudioCommand(proposal, {
    ...options,
    fetchImpl: async () => {
      throw Error("private transport");
    },
  });
  assert.deepEqual(result, { ok: false, code: "studio_command_failed" });
});
