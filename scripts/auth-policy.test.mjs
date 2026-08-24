import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isWorkosServerConfigured,
  safeReturnPath,
  toAppUser,
  workosConfigurationIssues,
} from "../src/lib/auth/policy.mjs";

const configured = {
  WORKOS_CLIENT_ID: "client_example",
  WORKOS_API_KEY: "test-key-placeholder",
  WORKOS_REDIRECT_URI: "https://preview.example.com/api/auth/callback",
  WORKOS_COOKIE_PASSWORD: "a-secure-cookie-password-with-32-characters",
  WORKOS_COOKIE_MAX_AGE: "604800",
};

test("WorkOS configuration fails closed and enforces the accepted session maximum", () => {
  assert.equal(isWorkosServerConfigured(configured), true);
  assert.equal(isWorkosServerConfigured({}), false);
  assert.ok(
    workosConfigurationIssues({ ...configured, WORKOS_COOKIE_MAX_AGE: "34560000" }).some(
      (issue) => issue.includes("seven-day"),
    ),
  );
});

test("authentication return paths cannot redirect off site", () => {
  assert.equal(safeReturnPath("/studio/example"), "/studio/example");
  assert.equal(safeReturnPath("https://evil.example"), "/account");
  assert.equal(safeReturnPath("//evil.example"), "/account");
});

test("the UI identity projection contains no tokens or provider permissions", () => {
  assert.deepEqual(
    toAppUser({
      id: "user_123",
      email: "owner@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      profilePictureUrl: null,
    }),
    {
      id: "user_123",
      displayName: "Ada Lovelace",
      primaryEmail: "owner@example.com",
      profileImageUrl: null,
    },
  );
});
