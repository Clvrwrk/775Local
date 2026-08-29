import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("WorkOS middleware preserves CSRF ordering and fails closed when unconfigured", () => {
  const start = read("src/start.ts");
  assert.match(start, /createCsrfMiddleware/);
  assert.match(start, /isWorkosServerConfigured/);
  assert.ok(start.indexOf("csrfMiddleware") < start.indexOf("authkitMiddleware()"));
  assert.doesNotMatch(start, /DEV_USER|synthetic|shared account/i);
});

test("authentication routes use controlled redirects and a minimal identity projection", () => {
  const signIn = read("src/routes/api/auth/sign-in.tsx");
  const callback = read("src/routes/api/auth/callback.tsx");
  const projection = read("src/lib/supabase/identity.server.ts");
  assert.match(signIn, /safeReturnPath/);
  assert.match(signIn, /not_configured/);
  assert.match(callback, /errorRedirectUrl:\s*"\/login\?error=auth_failed"/);
  assert.match(callback, /syncWorkosActor/);
  assert.match(projection, /sync_workos_actor/);
  assert.doesNotMatch(projection, /console\.(?:log|error)|accessToken/);
});

test("database authorization separates login, operator grant, recent auth, and impersonation", () => {
  const migration = read("supabase/migrations/20260824224500_add_workos_identity_projection.sql");
  assert.match(migration, /revoke all on function public\.sync_workos_actor[\s\S]*anon, authenticated/);
  assert.match(migration, /workos_organization_id/);
  assert.match(migration, /operator_recent_auth/);
  assert.match(migration, /auth_time/);
  assert.match(migration, /auth\.jwt\(\)->'act'/);
  assert.match(migration, /impersonator_id/);
  assert.match(
    migration,
    /grant execute on function public\.sync_workos_actor\(text, text, text\) to service_role;/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.sync_workos_actor\([^;]*to authenticated/,
  );
});

test("the environment template contains placeholders only and keeps secrets server-side", () => {
  const example = read(".env.example");
  assert.match(example, /WORKOS_COOKIE_MAX_AGE=604800/);
  assert.match(example, /SUPABASE_SERVICE_ROLE_KEY=/);
  assert.doesNotMatch(example, /VITE_.*(?:SERVICE_ROLE|WORKOS_API_KEY|COOKIE_PASSWORD)/);
  assert.doesNotMatch(example, /sk_(?:live|test)_[A-Za-z0-9]{16,}|sb_secret_[A-Za-z0-9_-]{20,}/);
});
