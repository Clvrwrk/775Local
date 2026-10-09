import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildForwardPackage, loadManifest, previewRef } from "./preview-forward-package.mjs";

test("forward delivery refuses missing, production and lookalike targets", () => {
  for (const targetProjectRef of [undefined, "hcfryjrajqftcnnbnybj", previewRef + ".example"])
    assert.throws(() => buildForwardPackage({ targetProjectRef }), /Exact isolated Preview/);
});

test("reviewed source tampering and path traversal cannot produce a package", () => {
  assert.throws(
    () =>
      buildForwardPackage({
        targetProjectRef: previewRef,
        readSource: () => Buffer.from("select 1;"),
      }),
    /Reviewed source changed/,
  );
  const manifest = loadManifest();
  manifest.changes[0].source = "supabase/migrations/../../.env";
  assert.throws(
    () => buildForwardPackage({ targetProjectRef: previewRef, manifest }),
    /source path/,
  );
});

test("migration identity collisions or new target history require reconciliation", () => {
  for (const mutate of [
    (m) => m.baselineLedger.pop(),
    (m) => {
      m.changes[0].forwardVersion = m.baselineLedger[0].version;
    },
    (m) => {
      m.baselineLedger[0].sqlSha256 = "unknown";
    },
  ]) {
    const manifest = loadManifest();
    mutate(manifest);
    assert.throws(() => buildForwardPackage({ targetProjectRef: previewRef, manifest }));
  }
});

test("package is deterministic and contains no execution or delivery adapter", () => {
  const a = buildForwardPackage({ targetProjectRef: previewRef });
  const b = buildForwardPackage({ targetProjectRef: previewRef });
  assert.equal(a.sha256, b.sha256);
  const source = readFileSync(new URL("./preview-forward-package.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /child_process|fetch\(|process\.env|op read|op run/);
});

test("Git deployment suppression applies only to this claim branch", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.git.deploymentEnabled, { "codex/claim-proof-publication": false });
});
