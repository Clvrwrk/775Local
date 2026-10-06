import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import {
  createSyntheticProofService,
  handleProofRequest,
} from "../src/lib/directory/claim-proof-processing.mjs";
const container = process.argv[2];
if (!/^local775-claims-test(?:-[a-z0-9]+)?$/.test(container ?? ""))
  throw Error("explicit disposable local container required");
const quote = (x) => "'" + String(x).replaceAll("'", "''") + "'";
const json = (x) => quote(JSON.stringify(x)) + "::jsonb";
const sql = (statement) =>
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
    { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 1024 * 1024 },
  )
    .trim()
    .split("\n")
    .filter((x) => x.startsWith("{") || x.startsWith("[") || x === "true")
    .at(-1);
const ids = {
  owner: randomUUID(),
  other: randomUUID(),
  operator: randomUUID(),
  business: randomUUID(),
  listing: randomUUID(),
};
const prefix = "proof_http_" + randomUUID().replaceAll("-", "");
const identities = {
  owner: { sub: prefix + "_owner" },
  other: { sub: prefix + "_other" },
  operator: { sub: prefix + "_operator", org_id: "org_proof_http" },
};
const rpc = (name, args, identity, worker = false) => {
  const claims = identity
    ? { ...identities[identity], auth_time: Math.floor(Date.now() / 1000) }
    : {};
  return JSON.parse(
    sql(
      "begin; select set_config('request.jwt.claims'," +
        json(claims) +
        "::text,true); set local role " +
        (worker ? "service_role" : "authenticated") +
        "; select to_jsonb(public." +
        name +
        "(" +
        args.join(",") +
        ")); commit;",
    ),
  );
};
sql(
  `insert into app.actors(id,workos_user_id,primary_email) values(${quote(ids.owner)},${quote(identities.owner.sub)},'owner@fixture.example'),(${quote(ids.other)},${quote(identities.other.sub)},'other@fixture.example'),(${quote(ids.operator)},${quote(identities.operator.sub)},'chussey@aia4.io'); insert into app.operator_grants(actor_id,allowlisted_email,permissions,status,approved_at,workos_organization_id) values(${quote(ids.operator)},'chussey@aia4.io',array['claim_review'],'active',statement_timestamp(),'org_proof_http'); insert into app.businesses(id,canonical_name) values(${quote(ids.business)},'Synthetic HTTP Proof Shop'); insert into app.business_listings(id,business_id,current_slug,display_name,city_slug,postal_code,publication_status,published_at) values(${quote(ids.listing)},${quote(ids.business)},${quote("synthetic-http-" + prefix.replaceAll("_", "-"))},'Synthetic HTTP Proof Shop','reno','89502','published',statement_timestamp());`,
);
const claim = rpc(
  "submit_listing_claim",
  [quote(ids.listing), "'document'", quote(prefix + "_submit"), "'listing_manager'"],
  "owner",
);
const state = rpc("get_my_listing_claim", [quote(ids.listing)], "owner");
const input = {
  claimId: claim.claim_id,
  challenge: state.challenge,
  key: prefix + "_proof",
  mediaType: "application/pdf",
  explanation: "Synthetic manager authorization for exact fixture location.",
};
let deleteFails = false;
const objects = new Map();
const tombstones = new Set();
const gateway = {
  mode: "synthetic",
  reserve: async (session, i) =>
    rpc(
      "reserve_synthetic_claim_proof",
      [
        quote(i.claimId),
        quote(i.challenge),
        quote(i.sha256),
        String(i.byteSize),
        quote(i.mediaType),
        quote(i.explanation),
        quote(i.key),
      ],
      session,
    ),
  acquire: async (id) => rpc("acquire_synthetic_claim_proof", [quote(id)], null, true),
  finish: async (id, lease, receipt) =>
    rpc("finish_synthetic_claim_proof", [quote(id), quote(lease), json(receipt)], null, true),
  authorizeDownload: async (session, id) =>
    rpc("authorize_synthetic_claim_proof_download", [quote(id)], session),
  describe: async (id) => rpc("describe_synthetic_claim_proof", [quote(id)], null, true),
  leaseDeletions: async () => rpc("lease_synthetic_proof_deletions", [], null, true),
  confirmDeletion: async (id, lease) =>
    rpc("confirm_synthetic_proof_deleted", [quote(id), quote(lease)], null, true),
};
const service = createSyntheticProofService({
  gateway,
  objects: {
    mode: "synthetic",
    supportsTombstones: true,
    tombstone: async (key) => {
      tombstones.add(key);
    },
    put: async (key, bytes, hash, { signal }) => {
      if (signal.aborted || tombstones.has(key)) throw Error("cancelled object write");
      if (objects.has(key)) assert.equal(objects.get(key).hash, hash);
      else objects.set(key, { bytes: Uint8Array.from(bytes), hash });
    },
    read: async (key) => objects.get(key)?.bytes,
    delete: async (key) => {
      if (deleteFails) throw Error("synthetic unavailable storage");
      objects.delete(key);
    },
  },
  scanner: {
    mode: "synthetic",
    scan: async (bytes, { sha256 }) => ({
      verdict: "clean",
      sha256,
      engine: "synthetic-fixture",
      version: "1",
      signaturesAt: new Date().toISOString(),
    }),
  },
  decoder: {
    mode: "synthetic",
    validate: async (bytes, { sha256, mediaType }) => ({
      valid: true,
      sha256,
      mediaType,
      pages: 1,
    }),
  },
});
const server = createServer(async (req, res) => {
  try {
    const request = new Request("http://127.0.0.1" + req.url, {
      method: req.method,
      headers: req.headers,
      ...(req.method === "POST" ? { body: req, duplex: "half" } : {}),
    });
    const response = await handleProofRequest(request, {
      service,
      input,
      proofId: new URL(request.url).searchParams.get("id"),
      authenticate: async (r) => {
        const identity = r.headers.get("authorization")?.replace("Bearer fixture-", "");
        return identities[identity] ? identity : null;
      },
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end("fixture failure");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = "http://127.0.0.1:" + server.address().port + "/proof";
const bytes = Buffer.from("%PDF-1.7\nSynthetic fixture; not a real validated PDF\n%%EOF");
try {
  let response = await fetch(url, { method: "POST", body: bytes });
  assert.equal(response.status, 401);
  response = await fetch(url, {
    method: "POST",
    body: bytes,
    headers: { Authorization: "Bearer fixture-owner" },
  });
  const receipt = await response.json();
  assert.equal(response.status, 200);
  assert.equal(receipt.receipt.status, "synthetic_clean");
  const id = receipt.receipt.id;
  response = await fetch(url, {
    method: "POST",
    body: bytes,
    headers: { Authorization: "Bearer fixture-owner" },
  });
  assert.equal((await response.json()).receipt.idempotent, true);
  response = await fetch(url + "?id=" + id, { headers: { Authorization: "Bearer fixture-other" } });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "proof_unavailable");
  response = await fetch(url + "?id=" + id, { headers: { Authorization: "Bearer fixture-owner" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  sql(
    `update private.claim_file_jobs set delete_after=statement_timestamp()-interval '1 second' where id=${quote(id)};`,
  );
  deleteFails = true;
  assert.equal((await service.deleteDue()).receipt.failed, 1);
  assert.equal((await service.deleteDue()).receipt.deleted, 0);
  sql(
    `update private.claim_file_jobs set lease_until=statement_timestamp()-interval '1 second' where id=${quote(id)};`,
  );
  deleteFails = false;
  assert.equal((await service.deleteDue()).receipt.deleted, 1);
  assert.equal((await service.deleteDue()).receipt.deleted, 0);
  assert.equal(objects.size, 0);
  response = await fetch(url + "?id=" + id, { headers: { Authorization: "Bearer fixture-owner" } });
  assert.equal(response.status, 404);
  writeFileSync(
    "artifacts/continuation/proof-http-receipt.json",
    JSON.stringify(
      {
        kind: "synthetic_http_to_local_database",
        identity: "isolated fake HTTP identity; database authorization exercised",
        scanner: "explicit synthetic fixture, no real scan certification",
        objectStorage: "in-memory fixture only",
        localOnly: true,
        noGrant: true,
        results: {
          anonymousDenied: true,
          ownerRetry: true,
          otherUserDenied: true,
          privateDownload: true,
          deletionRetry: true,
          deletedUnavailable: true,
        },
      },
      null,
      2,
    ),
  );
  console.log(
    "Synthetic proof HTTP/database/storage lifecycle passed; no live adapters or private files used.",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
