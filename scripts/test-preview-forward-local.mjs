import assert from "node:assert/strict";
import { execFileSync, spawnSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildForwardPackage, loadManifest, previewRef } from "./preview-forward-package.mjs";

// No hosted URL, credentials, mail, private files or shared data are accepted.
const container = process.argv[2];
const database = process.argv[3] ?? "local775_claims";
if (!/^local775-claims-test(?:-[a-z0-9]+)?$/.test(container ?? ""))
  throw Error("Explicit disposable local container required");
if (!/^local775_[a-z_]+$/.test(database)) throw Error("Explicit local fixture database required");
const config = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
if (
  config.HostConfig.NetworkMode !== "none" ||
  config.Mounts.length ||
  config.Config.Labels["local775.fixture"] !== "combined-preview-rehearsal"
)
  throw Error(
    "Combined rehearsal requires the labelled, network-isolated container without mounts",
  );
const run = (statement, mustPass = true) => {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: statement, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (mustPass && result.status !== 0) throw Error(result.stderr);
  return result;
};
const query = (statement) => run(statement).stdout.trim();
assert.equal(
  query("select count(*) from supabase_migrations.schema_migrations;"),
  "27",
  "Rehearse from the preserved baseline, never reset an existing database",
);
const listing = "f3000000-0000-4000-8000-000000000001";
run(`insert into app.businesses(id,canonical_name) values
 ('f2000000-0000-4000-8000-000000000001','Synthetic preservation fixture');
insert into app.business_listings(id,business_id,current_slug,display_name,city_slug,
 postal_code,website_url,publication_status,published_at) values
 ('${listing}','f2000000-0000-4000-8000-000000000001','synthetic-preservation-fixture',
 'Synthetic preservation fixture','reno','89502','https://fixture.example/','published',now());
insert into app.media_assets(id,listing_id,kind,original_path,public_path,media_type,
 byte_size,sha256,status,created_at) values
 ('f5000000-0000-4000-8000-000000000001','${listing}','logo','fixture/private/old.png',
 'fixture/public/old.png','image/png',10,repeat('a',64),'approved',now()-interval '2 days'),
 ('f5000000-0000-4000-8000-000000000002','${listing}','logo','fixture/private/new.png',
 'fixture/public/new.png','image/png',11,repeat('b',64),'approved',now()-interval '1 day');
insert into app.listing_content(listing_id,about,logo_media_id,services)
 values ('${listing}','Synthetic pre-existing content',
 'f5000000-0000-4000-8000-000000000001',array['Synthetic service']);
update private.listing_intelligence_accounts set capture_status='pending',
 source_inventory='[{"url":"https://fixture.example/","source":"synthetic"}]'::jsonb
 where listing_id='${listing}';`);
const snapshot = () =>
  JSON.parse(
    query(`select jsonb_build_object(
 'ledger',(select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m
  where version in (select value->>'version' from jsonb_array_elements(
  '${JSON.stringify(loadManifest().baselineLedger)}'::jsonb))),
 'listing',(select to_jsonb(bl) from app.business_listings bl where id='${listing}'),
 'content',(select to_jsonb(lc) from app.listing_content lc where listing_id='${listing}'),
 'media',(select jsonb_agg(to_jsonb(m)-array['caption','sort_order','is_brand_primary','updated_at'] order by id)
  from app.media_assets m where listing_id='${listing}'),
 'intelligence',(select to_jsonb(a) from private.listing_intelligence_accounts a where listing_id='${listing}'),
 'outbox',(select count(*) from app.integration_outbox));`),
  );
const baseline = snapshot();
const packageResult = buildForwardPackage({ targetProjectRef: previewRef });
const observations = [];
const refused = (name, sql, pattern) => {
  const result = run(sql, false);
  assert.notEqual(result.status, 0, `${name} must fail`);
  assert.match(result.stderr, pattern);
  assert.deepEqual(snapshot(), baseline, `${name} preserves the baseline`);
  assert.equal(query("select count(*) from supabase_migrations.schema_migrations;"), "27");
  assert.equal(query("select to_regclass('app.case_studies') is null;"), "t");
  observations.push(name);
};
const changedLedger = loadManifest();
changedLedger.baselineLedger[0].sqlSha256 = "0".repeat(64);
refused(
  "ledger drift rejected",
  buildForwardPackage({ targetProjectRef: previewRef, manifest: changedLedger }).sql,
  /Preview ledger changed/,
);
// A DDL failure after several deltas must roll back schema, backfill and all receipts.
const fourth = loadManifest().changes[3].source;
refused(
  "mid-package failure rolls back atomically",
  packageResult.sql.replace(
    `-- Reviewed source: ${fourth}`,
    `select 1/0;\n-- Reviewed source: ${fourth}`,
  ),
  /division by zero/,
);
run(
  "insert into app.actors(id,workos_user_id) values ('f1000000-0000-4000-8000-000000000001','synthetic_legacy_authority'); insert into app.listing_participations(listing_id,actor_id,role,status) values ('" +
    listing +
    "','f1000000-0000-4000-8000-000000000001','business_owner','active');",
);
const legacy = run(packageResult.sql, false);
assert.notEqual(legacy.status, 0);
assert.match(legacy.stderr, /Legacy claims or participation/);
run(
  "delete from app.listing_participations where actor_id='f1000000-0000-4000-8000-000000000001'; delete from app.actors where id='f1000000-0000-4000-8000-000000000001';",
);
assert.deepEqual(snapshot(), baseline);
observations.push("legacy authority requires separate review");
const blocker = spawn(
  "docker",
  [
    "exec",
    "-i",
    container,
    "psql",
    "-X",
    "-U",
    "postgres",
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
  ],
  { stdio: ["pipe", "pipe", "pipe"] },
);
const blockerClosed = once(blocker, "close");
const blockerReady = new Promise((resolve, reject) => {
  let output = "";
  blocker.stdout.on("data", (chunk) => {
    output += chunk;
    if (output.includes("fixture_lock_ready")) resolve();
  });
  blocker.on("error", reject);
  blocker.on("close", () => reject(Error("Fixture lock ended before readiness")));
});
blocker.stdin.end(
  "begin; lock table app.claims in row exclusive mode; select 'fixture_lock_ready'; select pg_sleep(7); rollback;",
);
await blockerReady;
refused(
  "concurrent authority write lock fails closed within bounded timeout",
  packageResult.sql,
  /lock timeout/,
);
assert.equal((await blockerClosed)[0], 0);
run(packageResult.sql);
assert.deepEqual(
  snapshot(),
  baseline,
  "original ledger and synthetic intelligence/content/media retained",
);
assert.equal(query("select count(*) from supabase_migrations.schema_migrations;"), "37");
assert.equal(
  query("select id from app.media_assets where listing_id='" + listing + "' and is_brand_primary;"),
  "f5000000-0000-4000-8000-000000000001",
  "referenced approved logo wins over a newer duplicate",
);
assert.equal(query("select count(*) from app.listing_participations;"), "0");
observations.push("forward package preserves ledger, intelligence, listing, media and references");
observations.push("brand selection preserves both assets and the referenced approved logo");
observations.push("migration grants no listing authority or external outbox delivery");
const replay = run(packageResult.sql, false);
assert.notEqual(replay.status, 0);
assert.match(replay.stderr, /Preview ledger changed/);
assert.deepEqual(snapshot(), baseline);
assert.equal(query("select count(*) from supabase_migrations.schema_migrations;"), "37");
observations.push("replayed package rejected without changes");
mkdirSync("artifacts/combined-preview", { recursive: true });
writeFileSync(
  "artifacts/combined-preview/forward-acceptance.json",
  JSON.stringify(
    {
      mode: "network-isolated synthetic local only",
      targetProjectRef: previewRef,
      sourceCommit: loadManifest().sourceCommit,
      sqlSha256: packageResult.sha256,
      manifestSha256: packageResult.manifestSha256,
      historicalReceiptsPreserved: 27,
      forwardReceipts: 10,
      observations,
      hostedApplied: false,
      externalDelivery: false,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ passed: observations.length, observations }, null, 2));
