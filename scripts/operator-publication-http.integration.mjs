import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publishLaunchSelection } from "../src/lib/supabase/operator-publication.mjs";

function localSupabaseEnvironment() {
  const output = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return Object.fromEntries(
    output
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator);
        const quotedValue = line.slice(separator + 1).trim();
        const value = quotedValue.startsWith('"') ? JSON.parse(quotedValue) : quotedValue;
        return [key, value];
      }),
  );
}

function signLocalJwt(secret, claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function databaseQuery(sql, input) {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_local775", "psql", "-U", "postgres", "-d", "postgres", "-Atq"],
    { encoding: "utf8", input: input ?? `${sql}\n` },
  ).trim();
}

const local = localSupabaseEnvironment();
for (const key of ["API_URL", "REST_URL", "PUBLISHABLE_KEY", "ANON_KEY", "JWT_SECRET"]) {
  assert.ok(local[key], `local Supabase did not provide ${key}`);
}

const fixture = readFileSync(
  join(import.meta.dirname, "..", "supabase", "fixtures", "cle104_http_seed.sql"),
  "utf8",
);
databaseQuery("", fixture);

const candidateIds = databaseQuery(`
  select string_agg(id::text, ',' order by id)
  from app.listing_candidates
  where batch_id = '50000000-0000-4000-8000-000000000010';
`).split(",");
assert.equal(candidateIds.length, 100);

const now = Math.floor(Date.now() / 1000);
const operatorClaims = {
  role: "authenticated",
  aud: "authenticated",
  sub: "user_http_publisher",
  org_id: "org_local775_http",
  auth_time: now,
  iat: now,
  exp: now + 300,
};
const accessToken = signLocalJwt(local.JWT_SECRET, operatorClaims);
const commandEnvironment = {
  SUPABASE_URL: local.API_URL,
  SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  SUPABASE_OPERATOR_ALLOW_LOCAL: "true",
};

const publication = await publishLaunchSelection(
  { candidateIds, idempotencyKey: "cle104-http-launch-publication" },
  { accessToken, env: commandEnvironment },
);
assert.equal(publication.ok, true);
assert.equal(publication.receipt.listing_count, 100);
assert.equal(publication.receipt.status, "published");

const replay = await publishLaunchSelection(
  { candidateIds: [...candidateIds].reverse(), idempotencyKey: "cle104-http-launch-publication" },
  { accessToken, env: commandEnvironment },
);
assert.deepEqual(replay, publication);

const wrongOrganization = await publishLaunchSelection(
  { candidateIds, idempotencyKey: "cle104-http-wrong-organization" },
  {
    accessToken: signLocalJwt(local.JWT_SECRET, { ...operatorClaims, org_id: "org_wrong" }),
    env: commandEnvironment,
  },
);
assert.deepEqual(wrongOrganization, { ok: false, code: "reauth_required" });

const publicResponse = await fetch(`${local.REST_URL}/directory_listings?select=id`, {
  headers: {
    apikey: local.ANON_KEY,
    Authorization: `Bearer ${local.ANON_KEY}`,
  },
});
assert.equal(publicResponse.ok, true);
assert.equal((await publicResponse.json()).length, 100);

const evidenceCounts = databaseQuery(`
  select concat_ws('|',
    (select count(*) from app.business_listings where publication_status = 'published'),
    (select count(*) from app.publication_receipts),
    (select count(*) from app.audit_events where action = 'launch_listing_published'),
    (select count(*) from app.integration_outbox where event_type = 'business_listing.published'),
    (select count(*) from app.listing_revisions)
  );
`);
assert.equal(evidenceCounts, "100|100|100|100|300");

process.stdout.write(
  "CLE-104 authenticated HTTP publication contract passed: 100 Listings, receipts, audits, outbox events, and 300 lifecycle revisions.\n",
);
