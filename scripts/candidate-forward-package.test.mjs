import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { buildCandidatePackage, loadCandidateManifest } from "./candidate-forward-package.mjs";
import { previewRef } from "./preview-forward-package.mjs";
test("candidate inventory covers every later migration including private profiles", () => {
  const sources = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((x) => x.slice(0, 14) > "20260930131000")
    .sort()
    .map((x) => "supabase/migrations/" + x);
  assert.deepEqual(
    loadCandidateManifest().supplements.map((x) => x.source),
    sources,
  );
  const result = buildCandidatePackage({ targetProjectRef: previewRef });
  assert.equal(result.sha256, buildCandidatePackage({ targetProjectRef: previewRef }).sha256);
  assert.equal((result.sql.match(/^commit;$/gm) ?? []).length, 1);
  assert.match(result.sql, /Candidate receipt inventory changed/);
  assert.match(result.sql, /create table app\.person_profiles/);
  assert.match(result.sql, /Legacy claims or participation require a separate/);
});
test("candidate target, source hashes and inventory remain fail closed", () => {
  for (const targetProjectRef of [undefined, "hcfryjrajqftcnnbnybj", previewRef + ".example"])
    assert.throws(() => buildCandidatePackage({ targetProjectRef }));
  const manifest = loadCandidateManifest();
  manifest.supplements[0].sourceSha256 = "0".repeat(64);
  assert.throws(
    () => buildCandidatePackage({ targetProjectRef: previewRef, manifest }),
    /source changed/,
  );
  const code = readFileSync(new URL("./candidate-forward-package.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(code, /child_process|fetch\(|process\.env|op read/);
});
