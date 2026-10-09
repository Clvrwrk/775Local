import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prepareReviewedCorrectionPlan } from "./reviewed-correction-plan.mjs";
import {
  listingCorrectionSnapshot,
  applyReviewedListingCorrection,
  rollbackReviewedListingCorrection,
} from "../src/lib/supabase/listing-corrections.mjs";

/**
 * Actual planner → user RPC adapter → SQL/role/projection contract.
 * The caller supplies an isolated synthetic engine, never a hosted connection.
 * Transport and identity are deterministic fakes; this is not a WorkOS/HTTP test.
 * @param {{mode: string, query: (sql: string, params?: any[]) => Promise<{rows: any[]}>}} engine
 */
export async function exerciseReviewedCorrectionDatabase(engine) {
  if (engine?.mode !== "synthetic" || typeof engine.query !== "function")
    throw Error("explicit_synthetic_database_required");
  const query = engine.query;
  const listingId = randomUUID();
  const businessId = randomUUID();
  const operatorId = randomUUID();
  const otherId = randomUUID();
  const subject = `correction-${randomUUID()}`;
  const listingSlug = `correction-${listingId}`;
  await query(
    "insert into app.actors(id,workos_user_id,primary_email) values ($1,$2,'chussey@aia4.io'),($3,$4,'other@fixture.example')",
    [operatorId, subject, otherId, `${subject}-other`],
  );
  await query(
    "insert into app.operator_grants(actor_id,allowlisted_email,permissions,status,approved_by,approved_at,workos_organization_id) values ($1,'chussey@aia4.io',array['listing_review','listing_publish'],'active','synthetic-fixture',statement_timestamp(),'org_correction_fixture')",
    [operatorId],
  );
  await query(
    "insert into app.businesses(id,canonical_name) values($1,'Synthetic Address Fixture')",
    [businessId],
  );
  await query(
    "insert into app.business_listings(id,business_id,current_slug,display_name,description,website_url,city_slug,street_address,postal_code,hide_street,is_service_area,latitude,longitude,publication_status,published_at) values($1,$2,$3,'Synthetic Address Fixture','Synthetic reviewed description.','https://fixture.example','reno','1757 Synthetic Avenue','89431',true,true,39.5296,-119.8138,'published',statement_timestamp())",
    [listingId, businessId, listingSlug],
  );
  await query(
    "insert into app.listing_content(listing_id,about,content_status) values($1,'Synthetic prior About.','approved')",
    [listingId],
  );
  const env = {
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_fixture_only",
  };
  let rpcCalls = 0;
  const fetchImpl = async (url, init) => {
    rpcCalls++;
    assert.equal(new URL(url).origin, env.SUPABASE_URL);
    const rpc = new URL(url).pathname.split("/").at(-1);
    const body = JSON.parse(init.body);
    const actor =
      init.headers.Authorization === "Bearer synthetic-operator" ? subject : `${subject}-other`;
    const claims = {
      sub: actor,
      org_id: "org_correction_fixture",
      auth_time: Math.floor(Date.now() / 1000),
    };
    let sql, params;
    if (rpc === "listing_correction_snapshot") {
      sql = "select public.listing_correction_snapshot($1) as receipt";
      params = [body.requested_listing_id];
    } else if (rpc === "apply_reviewed_listing_correction") {
      sql = "select public.apply_reviewed_listing_correction($1,$2::jsonb,$3) as receipt";
      params = [
        body.requested_listing_id,
        JSON.stringify(body.requested_correction),
        body.requested_key,
      ];
    } else if (rpc === "rollback_reviewed_listing_correction") {
      sql = "select public.rollback_reviewed_listing_correction($1,$2,$3,$4,$5) as receipt";
      params = [
        body.requested_listing_id,
        body.requested_receipt_id,
        body.requested_expected_version,
        body.requested_reason,
        body.requested_key,
      ];
    } else throw Error("unexpected_fixture_rpc");
    await query("begin");
    try {
      await query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims)]);
      await query("set local role authenticated");
      const result = await query(sql, params);
      await query("commit");
      return Response.json(result.rows[0].receipt);
    } catch (error) {
      await query("rollback");
      return Response.json({ message: error.message }, { status: 400 });
    }
  };
  const options = { env, fetchImpl, accessToken: "synthetic-operator" };
  assert.equal(
    (await listingCorrectionSnapshot({ listingId }, { ...options, accessToken: "synthetic-other" }))
      .code,
    "reauth_required",
  );
  const result = await listingCorrectionSnapshot({ listingId }, options);
  assert.equal(result.ok, true);
  const snapshot = result.receipt;
  const targetRef = "dpxeldzunfxmjahgvjhm";
  const inventory = Array.from({ length: 100 }, (_, i) =>
    i === 0
      ? { slug: listingSlug, domain: "fixture.example" }
      : { slug: `fixture-${i}`, domain: `fixture${i}.example` },
  );
  const targetSnapshots = inventory.map((row, i) =>
    i === 0
      ? { ...snapshot, targetRef }
      : { ...row, targetRef, listing_id: randomUUID(), version: "a".repeat(64), values: {} },
  );
  const changes = {
    street_address: "1757 Synthetic Avenue",
    postal_code: "89431",
    address_locality: "Sparks",
    hide_street: false,
    is_service_area: false,
  };
  const fieldProvenance = Object.fromEntries(
    Object.keys(changes).map((field) => [
      field,
      {
        state: "verified",
        url: "https://fixture.example/contact",
        artifactSha256: "b".repeat(64),
        checkedAt: new Date().toISOString(),
        reason: "Synthetic first-party reviewed field",
      },
    ]),
  );
  const plan = prepareReviewedCorrectionPlan({
    targetRef,
    inventory,
    targetSnapshots,
    reviewedDrafts: [
      {
        ...inventory[0],
        artifactSha256: "b".repeat(64),
        certificateSha256: "c".repeat(64),
        changes,
        fieldProvenance,
      },
    ],
  });
  const command = plan.entries[0].command;
  assert.deepEqual(command.correction.changes, changes);
  const applied = await applyReviewedListingCorrection(command, options);
  assert.equal(applied.ok, true, JSON.stringify(applied));
  assert.equal((await applyReviewedListingCorrection(command, options)).receipt.idempotent, true);
  assert.equal(
    (
      await applyReviewedListingCorrection(
        { ...command, idempotencyKey: `stale-${randomUUID()}` },
        options,
      )
    ).code,
    "listing_changed_since_correction",
  );
  const projected = (
    await query(
      "select street_address,postal_code,address_locality,latitude,longitude from public.directory_listings where id=$1",
      [listingId],
    )
  ).rows[0];
  assert.deepEqual(projected, {
    street_address: changes.street_address,
    postal_code: changes.postal_code,
    address_locality: "Sparks",
    latitude: null,
    longitude: null,
  });
  const receipt = (
    await query(
      "select before_values,after_values from app.reviewed_listing_correction_receipts where id=$1",
      [applied.receipt.receiptId],
    )
  ).rows[0];
  assert.equal(Number(receipt.before_values.latitude), 39.5296);
  assert.equal(receipt.after_values.latitude, null);
  const rolledBack = await rollbackReviewedListingCorrection(
    {
      listingId,
      receiptId: applied.receipt.receiptId,
      expectedVersion: applied.receipt.version,
      reason: "Restore hidden address, never old coordinates",
      idempotencyKey: `rollback-${randomUUID()}`,
    },
    options,
  );
  assert.equal(rolledBack.ok, true, JSON.stringify(rolledBack));
  const restored = (
    await query("select hide_street,latitude,longitude from app.business_listings where id=$1", [
      listingId,
    ])
  ).rows[0];
  assert.deepEqual(restored, { hide_street: true, latitude: null, longitude: null });
  assert.equal(
    Number(
      (
        await query(
          "select count(*) as count from app.audit_events where target_id=$1 and action in ('listing.corrected','listing.correction_rolled_back')",
          [listingId],
        )
      ).rows[0].count,
    ),
    2,
  );
  return {
    status: "passed",
    rpcCalls,
    scope:
      "actual planner and RPC adapter with synthetic identity/transport, SQL authorization, replay, persistence, coordinate invalidation, projection, rollback and audit",
    limits: [
      "no real WorkOS",
      "no actual HTTP/PostgREST",
      "no concurrent sessions",
      "synthetic rows retained until isolated database disposal",
    ],
  };
}
