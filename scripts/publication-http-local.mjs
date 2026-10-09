import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { runStudioCommand } from "../src/lib/supabase/studio-commands.mjs";
const container = process.argv[2];
if (!/^local775-claims-test(?:-[a-z0-9]+)?$/.test(container ?? ""))
  throw Error("explicit disposable local container required");
const quote = (x) => "'" + String(x).replaceAll("'", "''") + "'";
const json = (x) => quote(JSON.stringify(x)) + "::jsonb";
async function sql(statement) {
  return new Promise((resolve, reject) => {
    const p = spawn(
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
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "",
      stderr = "";
    p.stdout.on("data", (x) => (stdout += x));
    p.stderr.on("data", (x) => (stderr += x));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve(
            stdout
              .trim()
              .split("\n")
              .filter((x) => /^[{[]/.test(x))
              .at(-1),
          )
        : reject(Error(stderr.match(/ERROR:\s+([a-z_]+)/)?.[1] ?? "fixture_command_failed")),
    );
    p.stdin.end(statement);
  });
}
const prefix = "request_http_" + randomUUID().replaceAll("-", "");
const ids = { owner: randomUUID(), other: randomUUID(), operator: randomUUID() };
const identities = {
  owner: { sub: prefix + "_owner" },
  other: { sub: prefix + "_other" },
  operator: { sub: prefix + "_operator", org_id: "org_publication_http" },
};
await sql(
  `insert into app.actors(id,workos_user_id,primary_email) values(${quote(ids.owner)},${quote(identities.owner.sub)},'owner@fixture.example'),(${quote(ids.other)},${quote(identities.other.sub)},'other@fixture.example'),(${quote(ids.operator)},${quote(identities.operator.sub)},'chussey@aia4.io');insert into app.operator_grants(actor_id,allowlisted_email,permissions,status,approved_at,workos_organization_id) values(${quote(ids.operator)},'chussey@aia4.io',array['listing_review','listing_publish'],'active',statement_timestamp(),'org_publication_http');insert into app.categories(slug,name) values(${quote(prefix.replaceAll("_", "-"))},${quote("Synthetic Category " + prefix)});`,
);
const payload = {
  name: "Synthetic Request Shop " + prefix,
  citySlug: "reno",
  categorySlug: prefix.replaceAll("_", "-"),
  phone: "+1775555" + String(Math.floor(Math.random() * 10000)).padStart(4, "0"),
  zip: "89502",
  description: "Synthetic home repair services for isolated local acceptance.",
  website: "https://" + prefix.replaceAll("_", "-") + ".example",
};
const env = {
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only_not_a_credential",
};
async function fetchFixture(url, init) {
  const name = new URL(url).pathname.split("/").at(-1);
  const body = JSON.parse(init.body);
  const identity = init.headers.Authorization.replace("Bearer fixture-", "");
  if (!identities[identity])
    return Response.json({ message: "authentication_required" }, { status: 401 });
  let args;
  if (name === "request_business_listing")
    args = [json(body.requested_payload), quote(body.requested_key)];
  else if (name === "get_listing_request_review") args = [quote(body.requested_id)];
  else if (name === "get_my_listing_requests") args = [];
  else if (name === "decide_listing_request")
    args = [
      quote(body.requested_id),
      json(body.requested_decision),
      json(body.requested_scope),
      quote(body.requested_key),
    ];
  else return Response.json({ message: "invalid_studio_command" }, { status: 400 });
  try {
    const claims = { ...identities[identity], auth_time: Math.floor(Date.now() / 1000) };
    const result = await sql(
      "begin;select set_config('request.jwt.claims'," +
        json(claims) +
        "::text,true);set local role authenticated;select public." +
        name +
        "(" +
        args.join(",") +
        ");commit;",
    );
    return Response.json(JSON.parse(result));
  } catch (error) {
    return Response.json({ message: error.message }, { status: 400 });
  }
}
const server = createServer(async (req, res) => {
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    const result = await runStudioCommand(JSON.parse(Buffer.concat(chunks).toString()), {
      env,
      fetchImpl: fetchFixture,
      accessToken: req.headers.authorization?.replace("Bearer ", "") ?? "",
    });
    res.writeHead(result.ok ? 200 : 400, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(result));
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ ok: false, code: "invalid_studio_command" }));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = "http://127.0.0.1:" + server.address().port;
async function command(data, identity) {
  const r = await fetch(url, {
    method: "POST",
    headers: identity ? { Authorization: "Bearer fixture-" + identity } : {},
    body: JSON.stringify(data),
  });
  return r.json();
}
try {
  assert.equal((await command({ action: "requests" })).code, "authentication_required");
  const requested = await command(
    { action: "request", ...payload, key: prefix + "_submit" },
    "owner",
  );
  assert.equal(requested.ok, true);
  const id = requested.receipt.id;
  assert.equal((await command({ action: "requests" }, "other")).receipt.length, 0);
  assert.equal((await command({ action: "requestReview", id }, "owner")).ok, false);
  const review = await command({ action: "requestReview", id }, "operator");
  assert.equal(review.ok, true);
  assert.equal(review.receipt.canPublish, true);
  const decision = {
    outcome: "approved",
    reason: "Independent synthetic public identity and legitimacy checks complete.",
    canonical: payload,
    sourceUrls: [payload.website],
    sourceCheckedAt: new Date(Date.now() - 1000).toISOString(),
    duplicateDecision: "no_duplicate",
    checks: {
      nap: true,
      activeBusiness: true,
      category: true,
      reno: true,
      rights: true,
      privacy: true,
      duplicates: true,
    },
  };
  const input = {
    action: "decideRequest",
    id,
    key: prefix + "_publish",
    scope: review.receipt.scope,
    decision,
  };
  const [a, b] = await Promise.all([command(input, "operator"), command(input, "operator")]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.ok(a.receipt.idempotent !== b.receipt.idempotent);
  const status = await command({ action: "requests" }, "owner");
  assert.equal(status.receipt[0].status, "approved");
  assert.ok(status.receipt[0].slug);
  const created = await sql(
    `select jsonb_build_object('listings',(select count(*) from app.business_listings where id=${quote(a.receipt.listing_id)}),'participants',(select count(*) from app.listing_participations where listing_id=${quote(a.receipt.listing_id)}),'outbox',(select count(*) from app.integration_outbox where aggregate_id=${quote(a.receipt.listing_id)}));`,
  );
  const counts = JSON.parse(created);
  assert.equal(counts.listings, 1);
  assert.equal(counts.participants, 0);
  assert.equal(counts.outbox, 1);
  // Two new requests for the same independently reviewed candidate compete after both snapshots are read.
  const candidate = {
    ...payload,
    name: "Synthetic Competing Shop " + prefix,
    phone: "+1775556" + String(Math.floor(Math.random() * 10000)).padStart(4, "0"),
    website: "https://competing-" + prefix.replaceAll("_", "-") + ".example",
  };
  const r1 = await command({ action: "request", ...candidate, key: prefix + "_compete1" }, "owner");
  const r2 = await command({ action: "request", ...candidate, key: prefix + "_compete2" }, "other");
  const [s1, s2] = await Promise.all([
    command({ action: "requestReview", id: r1.receipt.id }, "operator"),
    command({ action: "requestReview", id: r2.receipt.id }, "operator"),
  ]);
  const [c1, c2] = await Promise.all([
    command(
      {
        ...input,
        id: r1.receipt.id,
        key: prefix + "_decision1",
        scope: s1.receipt.scope,
        decision: { ...decision, canonical: candidate, sourceUrls: [candidate.website] },
      },
      "operator",
    ),
    command(
      {
        ...input,
        id: r2.receipt.id,
        key: prefix + "_decision2",
        scope: s2.receipt.scope,
        decision: { ...decision, canonical: candidate, sourceUrls: [candidate.website] },
      },
      "operator",
    ),
  ]);
  assert.equal([c1, c2].filter((x) => x.ok).length, 1);
  assert.equal([c1, c2].find((x) => !x.ok).code, "listing_review_changed");
  writeFileSync(
    "artifacts/continuation/publication-http-receipt.json",
    JSON.stringify(
      {
        kind: "synthetic_http_command_adapter_to_local_database",
        identity: "fake HTTP identity; real SQL authorization and locks",
        provider: "intercepted fake REST transport, no hosted call",
        results: {
          authentication: true,
          requestIsolation: true,
          reviewPermission: true,
          duplicateClick: true,
          concurrentPublication: true,
          requesterStatus: true,
          noGrant: true,
          durableOutboxOnly: true,
        },
      },
      null,
      2,
    ),
  );
  console.log(
    "Synthetic publication HTTP/database concurrency passed; no live publication or grant.",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
