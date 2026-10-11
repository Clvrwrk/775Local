import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const listing = "43000000-0000-4000-8000-000000000001";
export const otherListing = "43000000-0000-4000-8000-000000000002";
export const actorIds = {
  owner: "41000000-0000-4000-8000-000000000001",
  other: "41000000-0000-4000-8000-000000000002",
  operator: "41000000-0000-4000-8000-000000000003",
  manager: "41000000-0000-4000-8000-000000000004",
  recipient: "41000000-0000-4000-8000-000000000005",
};
export function claimsFor(identity) {
  if (identity === "operator" || identity === "stale" || identity === "wrong_org")
    return {
      sub: "fixture_operator",
      org_id: identity === "wrong_org" ? "other_org" : "fixture_org",
      auth_time: identity === "stale" ? 0 : Math.floor(Date.now() / 1000),
    };
  return identity && actorIds[identity] ? { sub: `fixture_${identity}` } : {};
}
export async function createMediaDb() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema extensions; create schema auth; grant usage on schema auth,extensions to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function extensions.gen_random_uuid() returns uuid language sql as $$ select pg_catalog.gen_random_uuid() $$;
    create schema storage; grant usage on schema storage to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
    alter table storage.objects enable row level security; grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  const root = resolve(import.meta.dirname, "../../..");
  // Only the synthetic local schema: stock Supabase auth/storage shims and PostgreSQL's
  // builtin UUID function replace unavailable pgcrypto; never a production ledger replay.
  for (const file of [
    "20260824194500_initial_directory_foundation.sql",
    "20260824195800_fix_public_projection_policies.sql",
    "20260824201500_fix_rls_identity_recursion.sql",
    "20260824224500_add_workos_identity_projection.sql",
  ]) {
    let sql = await readFile(resolve(root, "supabase/migrations", file), "utf8");
    sql = sql.replace("create extension if not exists pgcrypto with schema extensions;", "");
    await db.exec(sql);
  }
  await db.exec(await readFile(resolve(root, "release/business-images/forward.sql"), "utf8"));
  // Repository baseline supports Listing Managers; this is only a local fixture.
  const managerSql = await readFile(
    resolve(root, "supabase/migrations/20260831120000_add_claim_commands_and_listing_manager.sql"),
    "utf8",
  );
  await db.exec(
    managerSql.slice(
      managerSql.indexOf("alter table app.listing_participations"),
      managerSql.indexOf("alter table private.claim_proofs"),
    ),
  );
  for (const [name, id] of Object.entries(actorIds))
    await db.query(`insert into app.actors(id,workos_user_id,primary_email) values($1,$2,$3)`, [
      id,
      `fixture_${name}`,
      name === "operator" ? "chussey@aia4.io" : `${name}@fixture.invalid`,
    ]);
  await db.query(
    `insert into app.operator_grants(actor_id,allowlisted_email,permissions,status,approved_by,approved_at,workos_organization_id) values($1,'chussey@aia4.io',array['listing_review'],'active','synthetic-local-test',now(),'fixture_org')`,
    [actorIds.operator],
  );
  await db.exec(
    `insert into app.businesses(id,canonical_name) values('42000000-0000-4000-8000-000000000001','Synthetic Local Business');`,
  );
  for (const [id, name] of [
    [listing, "Synthetic Local Business"],
    [otherListing, "Other Synthetic Business"],
  ])
    await db.query(
      `insert into app.business_listings(id,business_id,current_slug,display_name,city_slug,postal_code,publication_status,published_at) values($1,'42000000-0000-4000-8000-000000000001',$2,$3,'reno','89502','published',now())`,
      [id, id === listing ? "synthetic-business" : "other-business", name],
    );
  for (const [name, role, id] of [
    ["owner", "business_owner", listing],
    ["other", "business_owner", otherListing],
    ["manager", "listing_manager", listing],
    ["recipient", "lead_recipient", listing],
  ])
    await db.query(
      `insert into app.listing_participations(actor_id,listing_id,role,status) values($1,$2,$3,'active')`,
      [actorIds[name], id, role],
    );
  const as = async (identity, operation) =>
    db.transaction(async (tx) => {
      await tx.exec(`set local role ${identity ? "authenticated" : "anon"}`);
      await tx.query(`select set_config('request.jwt.claims',$1,true)`, [
        JSON.stringify(claimsFor(identity)),
      ]);
      return operation(tx);
    });
  return { db, as };
}
