import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("the production build is deterministic and has no migration side effect", () => {
  assert.equal(packageJson.scripts.build, "vite build");
  assert.doesNotMatch(packageJson.scripts.build, /migrat|database|supabase|provider/i);
});

test("the package identifies Local775 and requires the production Node runtime", () => {
  assert.equal(packageJson.name, "local775-directory");
  assert.equal(packageJson.engines.node, "24.x");
  assert.match(String(packageJson.packageManager), /^npm@10\./);
  assert.equal(read(".nvmrc").trim(), "24");
  assert.equal(read(".node-version").trim(), "24");
  assert.doesNotMatch(
    [packageJson.scripts.dev, packageJson.scripts.build, packageJson.scripts.preview].join(" "),
    /grok|with-app-env/i,
  );
});

test("repository instructions establish Local775 authority without inherited Grok rules", () => {
  const instructions = read("AGENTS.md");
  assert.match(instructions, /^# 775 Directory/m);
  assert.match(instructions, /docs\/SPEC\.md/);
  assert.match(instructions, /production acceptance/i);
  assert.doesNotMatch(instructions, /grok/i);
});

test("local provider state is excluded from version control", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /^supabase\/\.temp\/$/m);
});

test("pull requests run the side-effect-free foundation gate on Node 24", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /node-version: 24/);
  for (const command of [
    "npm ci",
    "npm audit --omit=dev --audit-level=moderate",
    "npm run security:secrets",
    "npm test",
    "npm run typecheck",
    "npm run lint",
    "npm run build",
  ]) {
    assert.match(workflow, new RegExp(`run: ${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.doesNotMatch(workflow, /migrat|deploy|supabase|vercel|cloudflare/i);
});

test("database delivery is a separate target-explicit Preview workflow", () => {
  const workflow = read(".github/workflows/database-preview.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment:\s*local775-preview/);
  assert.match(workflow, /supabase db push --dry-run/);
  assert.match(workflow, /supabase db push --linked/);
  assert.doesNotMatch(workflow, /production|hcfryjrajqftcnnbnybj/i);
});

test("the application entrypoints contain no inherited preview-platform behavior", () => {
  const buildSurface = [read("vite.config.ts"), read("src/routes/__root.tsx")].join("\n");
  assert.doesNotMatch(buildSurface, /grok/i);
  assert.doesNotMatch(buildSurface, /PreviewHostBridge/);
  assert.match(buildSurface, /runtime:\s*"nodejs24\.x"/);
});

test("the runtime has no inherited embedded database or synthetic auth fallback", () => {
  for (const dependency of ["@electric-sql/pglite", "better-auth", "kysely", "pg"]) {
    assert.equal(packageJson.dependencies?.[dependency], undefined, `${dependency} must be removed`);
  }
  for (const path of [
    "src/lib/db.ts",
    "src/lib/auth/server.ts",
    "src/lib/auth/pglite-dialect.ts",
    "scripts/migrate.mjs",
    "scripts/migration-plan.mjs",
  ]) {
    assert.equal(existsSync(join(root, path)), false, `${path} must be removed`);
  }
  assert.doesNotMatch(read("src/lib/auth/use-current-user.ts"), /DEV_USER|dev-user|synthetic/i);
});
