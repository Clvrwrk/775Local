import assert from "node:assert/strict";
import { test } from "node:test";
import { profileCommand, runProfileCommand } from "../src/lib/supabase/profile-commands.mjs";
const valid = {
  action: "save",
  displayName: " Reno Neighbor ",
  city: "reno",
  bio: " Hello Reno. ",
  version: 0,
  key: "profile-save-001",
};
test("profile accepts only private personal fields, never identity or authority", () => {
  assert.deepEqual(profileCommand(valid).body.requested_payload, {
    displayName: "Reno Neighbor",
    city: "reno",
    bio: "Hello Reno.",
  });
  for (const key of ["actorId", "email", "role", "ownerVerified", "listingId", "status"])
    assert.throws(() => profileCommand({ ...valid, [key]: "forged" }), /invalid_profile/);
  assert.throws(() => profileCommand({ action: "get", actorId: "other" }));
});
test("profile validates required name, optional city, bounded introduction and version", () => {
  for (const input of [
    null,
    [],
    { ...valid, displayName: " " },
    { ...valid, displayName: "x".repeat(101) },
    { ...valid, displayName: "bad\nname" },
    { ...valid, bio: "x".repeat(501) },
    { ...valid, city: "unknown" },
    { ...valid, version: -1 },
    { ...valid, version: 1.5 },
    { ...valid, key: "short" },
  ])
    assert.throws(() => profileCommand(input), /invalid_profile/);
  assert.equal(profileCommand({ ...valid, city: "", bio: "" }).rpc, "save_my_profile");
});
test("profile RPC uses the authenticated bearer and never a requested user id", async () => {
  let request;
  const result = await runProfileCommand(valid, {
    accessToken: "synthetic.jwt",
    env: {
      SUPABASE_URL: "https://fixture.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_profile_key",
    },
    fetchImpl: async (url, init) => {
      request = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
      return new Response(
        JSON.stringify({
          displayName: "Reno Neighbor",
          city: "reno",
          bio: "Hello Reno.",
          version: 1,
        }),
      );
    },
  });
  assert.equal(result.ok, true);
  assert.match(request.url, /\/rpc\/save_my_profile$/);
  assert.equal(request.headers.Authorization, "Bearer synthetic.jwt");
  assert.equal(request.body.requested_version, 0);
  assert.doesNotMatch(JSON.stringify(request.body), /actor|role|email|jwt/);
});
test("profile auth, stale edits and provider failures remain stable and redacted", async () => {
  const env = {
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_profile_key",
  };
  assert.deepEqual(await runProfileCommand(valid, { accessToken: "", env }), {
    ok: false,
    code: "authentication_required",
  });
  for (const [message, expected] of [
    ["profile_changed", "profile_changed"],
    ["private details", "profile_unavailable"],
  ]) {
    assert.deepEqual(
      await runProfileCommand(valid, {
        accessToken: "synthetic.jwt",
        env,
        fetchImpl: async () => new Response(JSON.stringify({ message }), { status: 400 }),
      }),
      { ok: false, code: expected },
    );
  }
});
