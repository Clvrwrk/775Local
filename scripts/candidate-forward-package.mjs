import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildForwardPackage, previewRef } from "./preview-forward-package.mjs";
const root = resolve(import.meta.dirname, "..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const quote = (text) => "'" + text.replaceAll("'", "''") + "'";
export function loadCandidateManifest() {
  return JSON.parse(
    readFileSync(resolve(root, "release/directory-candidate/manifest.json"), "utf8"),
  );
}
// A review artifact only. Preserve the historical package and its exact target guards.
export function buildCandidatePackage({
  targetProjectRef,
  manifest = loadCandidateManifest(),
} = {}) {
  if (targetProjectRef !== previewRef || manifest.targetProjectRef !== previewRef)
    throw Error("Exact isolated Preview project reference required");
  if (manifest.format !== 1 || manifest.supplements.length !== 6)
    throw Error("Candidate inventory changed; reconcile and review again");
  const original = buildForwardPackage({ targetProjectRef });
  const versions = new Set();
  const supplements = manifest.supplements.map((row) => {
    if (
      !/^supabase\/migrations\/(2026\d{10})_[a-z0-9_]+\.sql$/.test(row.source) ||
      !/^2026\d{10}$/.test(row.version) ||
      row.version <= "20260930160009" ||
      versions.has(row.version) ||
      !/^[a-z0-9_]+$/.test(row.name) ||
      !row.source.endsWith(`${row.version}_${row.name}.sql`)
    )
      throw Error("Invalid candidate source identity");
    versions.add(row.version);
    const bytes = readFileSync(resolve(root, row.source));
    if (hash(bytes) !== row.sourceSha256) throw Error("Candidate source changed");
    const source = bytes.toString("utf8");
    if (
      (source.match(/^\s*begin;\s*$/gim) ?? []).length !== 1 ||
      (source.match(/^\s*commit;\s*$/gim) ?? []).length !== 1 ||
      !/commit;\s*$/i.test(source)
    )
      throw Error("Unexpected candidate transaction structure");
    const body = source
      .replace(/^\s*begin;\s*$/im, "")
      .replace(/^\s*commit;\s*$/im, "")
      .trim();
    return (
      `-- Candidate source: ${row.source} sha256:${row.sourceSha256}\n${body}\n` +
      `insert into supabase_migrations.schema_migrations(version,name,statements) values (${quote(row.version)},${quote(row.name)},array[${quote(body)}]);`
    );
  });
  const guard = `do $candidate_guard$ begin
    if (select count(*) from supabase_migrations.schema_migrations) <> 43 then
      raise exception 'Candidate receipt inventory changed';
    end if;
  end $candidate_guard$;`;
  const sql = original.sql.replace(
    /commit;\s*$/,
    supplements.join("\n\n") + "\n" + guard + "\ncommit;\n",
  );
  return {
    sql,
    sha256: hash(sql),
    historicalPackageSha256: original.sha256,
    manifestSha256: hash(JSON.stringify(manifest)),
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [targetProjectRef, output] = process.argv.slice(2);
  if (!output || process.argv.length !== 4)
    throw Error("Exact Preview reference and artifact output required");
  const destination = resolve(root, output);
  if (!destination.startsWith(resolve(root, "artifacts") + "/") || !destination.endsWith(".sql"))
    throw Error("Generated package must remain in ignored artifacts/*.sql");
  const result = buildCandidatePackage({ targetProjectRef });
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, result.sql);
  console.log(
    JSON.stringify(
      {
        targetProjectRef,
        sqlSha256: result.sha256,
        manifestSha256: result.manifestSha256,
        applied: false,
      },
      null,
      2,
    ),
  );
}
