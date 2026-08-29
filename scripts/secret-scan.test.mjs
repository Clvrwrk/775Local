import assert from "node:assert/strict";
import { test } from "node:test";
import { secretKinds } from "./secret-scan-lib.mjs";

test("secret scanning detects representative provider credentials", () => {
  assert.deepEqual(secretKinds(["value=sk", "live", "abcdefghijklmnop"].join("_")), [
    "Stripe live secret",
  ]);
  assert.deepEqual(secretKinds(["-----BEGIN", "PRIVATE KEY-----"].join(" ")), ["private key"]);
  assert.deepEqual(secretKinds(["SUPABASE_KEY=sb", "secret", "abcdefghijklmnopqrstuvwxyz"].join("_")), [
    "Supabase secret key",
  ]);
});

test("secret scanning ignores placeholders and publishable identifiers", () => {
  assert.deepEqual(secretKinds("SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"), []);
  assert.deepEqual(secretKinds("SUPABASE_KEY=sb_publishable_example"), []);
});
