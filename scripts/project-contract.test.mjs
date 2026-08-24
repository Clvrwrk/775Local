import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.match(gitignore, /^\.env\.local$/m);
});

test("pull requests run the complete side-effect-free CI gate on Node 24", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /node-version: 24/);
  for (const command of ["npm ci", "npm test", "npm run typecheck", "npm run lint", "npm run build"]) {
    assert.match(workflow, new RegExp(`run: ${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.doesNotMatch(workflow, /migrat|deploy|supabase|vercel|cloudflare/i);
});

test("the application entrypoints contain no inherited preview-platform behavior", () => {
  const buildSurface = [read("vite.config.ts"), read("src/routes/__root.tsx")].join("\n");
  assert.doesNotMatch(buildSurface, /grok/i);
  assert.doesNotMatch(buildSurface, /PreviewHostBridge/);
  assert.match(buildSurface, /runtime:\s*"nodejs24\.x"/);
});
