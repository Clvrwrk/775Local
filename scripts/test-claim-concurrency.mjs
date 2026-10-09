import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
const container = process.argv[2];
if (!/^local775-claims-test(?:-[a-z0-9]+)?$/.test(container ?? ""))
  throw Error("explicit disposable container required");
const sqlRun = (sql) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "local775_claims",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: sql, encoding: "utf8" },
  );
const asyncExec = promisify(execFile);
const parallel = (sql) =>
  asyncExec("docker", [
    "exec",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "local775_claims",
    "-v",
    "ON_ERROR_STOP=1",
    "-Atc",
    sql,
  ]);
const listing = "c3000000-0000-4000-8000-000000000001";
const login = (subject, org = false) =>
  `select set_config('request.jwt.claims',jsonb_build_object('sub','${subject}','auth_time',floor(extract(epoch from statement_timestamp()))::bigint${org ? ",'org_id','org_concurrency'" : ""})::text,false);set role authenticated;`;
try {
  sqlRun(
    `insert into app.actors(id,workos_user_id,primary_email) values ('c1000000-0000-4000-8000-000000000001','concurrent_one','one@fixture.example'),('c1000000-0000-4000-8000-000000000002','concurrent_two','two@fixture.example'),('c1000000-0000-4000-8000-000000000003','concurrent_operator','chussey@aia4.io'); insert into app.operator_grants(actor_id,allowlisted_email,permissions,status,approved_at,workos_organization_id) values('c1000000-0000-4000-8000-000000000003','chussey@aia4.io',array['claim_review'],'active',statement_timestamp(),'org_concurrency'); insert into app.businesses(id,canonical_name) values('c2000000-0000-4000-8000-000000000001','Concurrency Fixture');insert into app.business_listings(id,business_id,current_slug,display_name,city_slug,postal_code,publication_status,published_at) values('${listing}','c2000000-0000-4000-8000-000000000001','concurrency-fixture','Concurrency Fixture','reno','89502','published',statement_timestamp());`,
  );
  const submit =
    login("concurrent_one") +
    `select public.submit_listing_claim('${listing}','document','concurrent-same-key','business_owner');`;
  const dup = await Promise.allSettled([parallel(submit), parallel(submit)]);
  assert.equal(dup.filter((x) => x.status === "fulfilled").length, 2);
  assert.equal(
    sqlRun(`select count(*) from app.claims where listing_id='${listing}';`).trim(),
    "1",
  );
  sqlRun(
    login("concurrent_two") +
      `select public.submit_listing_claim('${listing}','document','concurrent-other-key','business_owner');`,
  );
  const claims = sqlRun(
    `select id from app.claims where listing_id='${listing}' order by claimant_actor_id;`,
  )
    .trim()
    .split("\n");
  for (const [i, claim] of claims.entries()) {
    sqlRun(
      `insert into private.claim_evidence(claim_id,reference,explanation,idempotency_key,challenge,expires_at) select id,'Synthetic independent registry reference','Synthetic exact identity and owner authority evidence','concurrent-evidence-${i}',evidence_challenge,statement_timestamp()+interval '7 days' from app.claims where id='${claim}';`,
    );
    sqlRun(
      login("concurrent_operator", true) +
        `select public.review_claim_authority('${claim}',(public.get_claim_review_evidence('${claim}')->'evidence'->0->>'id')::uuid,'Independent identity verification','Owner authority and exact location verified','Both competing claimants investigated independently',statement_timestamp()+interval '7 days',public.get_claim_review_evidence('${claim}')->'scope');`,
    );
  }
  const approvals = await Promise.allSettled(
    claims.map((claim, i) =>
      parallel(
        login("concurrent_operator", true) +
          `select public.decide_listing_claim('${claim}','approved','Reviewed independent authority','concurrent-decision-${i}');`,
      ),
    ),
  );
  assert.equal(
    approvals.filter((x) => x.status === "fulfilled").length,
    1,
    "one competing approval succeeds; changed conflict/participant snapshot requires re-review",
  );
  const failure = approvals.find((x) => x.status === "rejected");
  assert.match(failure.reason.stderr, /independent_authority_review_required/);
  assert.equal(
    sqlRun(
      `select count(*) from app.listing_participations where listing_id='${listing}' and role='business_owner' and status='active';`,
    ).trim(),
    "1",
  );
  console.log(
    "PASS: two concurrent submissions create one claim; conflicting concurrent approvals create one owner and require fresh human assessment for the other.",
  );
} finally {
  // Preserve synthetic audit receipts. Teardown removes this entire disposable container,
  // never an append-only audit row or a hosted database.
}
