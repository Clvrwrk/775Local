import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const previewRef = "dpxeldzunfxmjahgvjhm";
const root = resolve(import.meta.dirname, "..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
export function loadManifest() {
  return JSON.parse(readFileSync(resolve(root, "release/preview-claims/manifest.json"), "utf8"));
}

// This creates a reviewable artifact. It cannot connect, apply SQL or obtain credentials.
export function buildForwardPackage({
  targetProjectRef,
  manifest = loadManifest(),
  readSource,
} = {}) {
  if (targetProjectRef !== previewRef || manifest.targetProjectRef !== previewRef)
    throw Error("Exact isolated Preview project reference required");
  if (manifest.format !== 1 || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit))
    throw Error("Invalid source identity");
  if (manifest.baselineLedger.length !== 27 || manifest.changes.length !== 10)
    throw Error("Unexpected migration inventory; reconcile and review again");
  const versions = new Set();
  for (const row of [...manifest.baselineLedger, ...manifest.changes]) {
    const version = row.version ?? row.forwardVersion;
    const name = row.name ?? row.forwardName;
    if (!/^\d{14}$/.test(version) || versions.has(version) || !/^[a-z0-9_]+$/.test(name))
      throw Error("Invalid or duplicate migration identity");
    versions.add(version);
  }
  for (const row of manifest.baselineLedger)
    if (!/^[a-f0-9]{64}$/.test(row.sqlSha256)) throw Error("Invalid ledger fingerprint");
  const bodies = manifest.changes.map((row) => {
    if (!/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/.test(row.source))
      throw Error("Invalid migration source path");
    const bytes = readSource ? readSource(row.source) : readFileSync(resolve(root, row.source));
    if (!/^[a-f0-9]{64}$/.test(row.sourceSha256) || sha256(bytes) !== row.sourceSha256)
      throw Error(`Reviewed source changed: ${row.source}`);
    const sql = bytes.toString("utf8");
    // All ten reviewed files have exactly one outer transaction. Preserve function bodies.
    if (
      (sql.match(/^\s*begin;\s*$/gim) ?? []).length !== 1 ||
      (sql.match(/^\s*commit;\s*$/gim) ?? []).length !== 1 ||
      !/commit;\s*$/i.test(sql)
    )
      throw Error(`Unexpected transaction structure: ${row.source}`);
    return sql
      .replace(/^\s*begin;\s*$/im, "")
      .replace(/^\s*commit;\s*$/im, "")
      .trim();
  });
  const expectedLedger = JSON.stringify(manifest.baselineLedger);
  const ledgerGuard = `
  if (select count(*) from supabase_migrations.schema_migrations) <> 27
    or exists (
      select 1 from jsonb_to_recordset(${quote(expectedLedger)}::jsonb)
        as expected(version text, name text, "sqlSha256" text)
      left join supabase_migrations.schema_migrations actual using(version)
      where actual.version is null or actual.name is distinct from expected.name
        or encode(extensions.digest(convert_to(array_to_string(actual.statements,E'\\n'),'UTF8'),'sha256'),'hex')
          is distinct from expected."sqlSha256"
    ) then raise exception 'Preview ledger changed: stop and reconcile; never repair or reset it'; end if;`;
  const absentTables = [
    "app.case_studies",
    "app.case_study_media",
    "app.listing_proposals",
    "private.lead_destinations",
    "private.inquiry_request_keys",
    "private.claim_evidence",
    "private.claim_authority_reviews",
    "private.listing_invitations",
    "app.listing_requests",
    "private.claim_file_jobs",
    "app.listing_request_receipts",
  ];
  const preflight = `do $preflight$ begin
${ledgerGuard}
  if exists (select 1 from unnest(array[${absentTables.map(quote).join(",")}]) object_name
    where to_regclass(object_name) is not null) then
      raise exception 'Forward schema collision: stop and reconcile'; end if;
  if exists (select 1 from app.media_assets where kind not in
    ('logo','logo_horizontal','logo_vertical','favicon','owner_headshot','storefront','vehicle_wrap','project','product','image','video')) then
      raise exception 'Unsupported existing media kind: review without deleting media'; end if;
  if exists (select 1 from app.claims) or exists (select 1 from app.listing_participations) then
      raise exception 'Legacy claims or participation require a separate data-preserving authority review'; end if;
end $preflight$;`;
  const deltas = bodies.map((body, i) => {
    const row = manifest.changes[i];
    return (
      `-- Reviewed source: ${row.source} sha256:${row.sourceSha256}\n${body}\n` +
      `insert into supabase_migrations.schema_migrations(version,name,statements) values (` +
      `${quote(row.forwardVersion)},${quote(row.forwardName)},array[${quote(body)}]);`
    );
  });
  const finalGuard = ledgerGuard.replace("<> 27", "<> 37");
  const sql =
    `-- GENERATED FOR ${previewRef} ONLY. Verify hosted target binding separately.\n` +
    `-- No historical ledger repair, reset, row export or provider/network operation.\n` +
    `begin;\nset local lock_timeout='5s';\nset local statement_timeout='10min';\n` +
    `select pg_advisory_xact_lock(hashtextextended('local775-preview-claim-forward',0));\n` +
    `lock table supabase_migrations.schema_migrations in share row exclusive mode;\n` +
    `lock table app.claims,app.listing_participations,app.media_assets,app.listing_content in share row exclusive mode;\n` +
    `${preflight}\n${deltas.join("\n\n")}\n` +
    `do $postflight$ begin ${finalGuard}\nend $postflight$;\ncommit;\n`;
  return { sql, sha256: sha256(sql), manifestSha256: sha256(JSON.stringify(manifest)), preflight };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [targetProjectRef, output] = process.argv.slice(2);
  if (!output || process.argv.length !== 4)
    throw Error("Usage: node scripts/preview-forward-package.mjs <exact-preview-ref> <output.sql>");
  const destination = resolve(root, output);
  if (!destination.startsWith(resolve(root, "artifacts") + "/") || !destination.endsWith(".sql"))
    throw Error("Generated package must remain in ignored artifacts/*.sql");
  const result = buildForwardPackage({ targetProjectRef });
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, result.sql);
  console.log(
    JSON.stringify(
      {
        targetProjectRef,
        sqlSha256: result.sha256,
        manifestSha256: result.manifestSha256,
        output,
        applied: false,
      },
      null,
      2,
    ),
  );
}
