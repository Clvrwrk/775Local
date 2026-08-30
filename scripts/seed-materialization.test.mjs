import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { assignMaterializedTiers } from "./seed-materialization-lib.mjs";

function row(index) {
  return {
    slug: `listing-${index}`,
    description: "A".repeat(index < 50 ? 180 : 20),
    services: index < 50 ? ["one", "two", "three"] : [],
    hours: index < 50 ? "Weekdays" : null,
    faqs: index < 10 ? [{}, {}, {}] : [],
    projects: index < 20 ? [{}, {}] : [],
  };
}

test("materialized seed assigns an exact evidence-bounded 60/30/10 mix", () => {
  const result = assignMaterializedTiers(Array.from({ length: 100 }, (_, index) => row(index)));
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(Object.groupBy(result, (item) => item.contentTier)).map(([tier, rows]) => [
        tier,
        rows.length,
      ]),
    ),
    { premium: 10, standard: 30, basic: 60 },
  );
});

test("materialized seed refuses to overstate thin candidates", () => {
  assert.throws(
    () =>
      assignMaterializedTiers(
        Array.from({ length: 100 }, (_, index) => ({ ...row(index), faqs: [], projects: [] })),
      ),
    /Premium quality/,
  );
});

test("seed publication stays exact, unclaimed, unverified, and idempotent", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20260830162000_add_serp_seed_publication_receipts.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /listing_count_value <> 100 or category_count_value <> 10/);
  assert.match(sql, /tier_mix_value <> '\{"basic": 60, "standard": 30, "premium": 10\}'::jsonb/);
  assert.match(sql, /having count\(\*\) <> 10/);
  assert.match(sql, /information_checked_at, owner_verified_at, published_at/);
  assert.match(sql, /'published', null, null, statement_timestamp\(\)/);
  assert.match(sql, /jsonb_typeof\(item -> 'isServiceArea'\) is distinct from 'boolean'/);
  assert.match(sql, /where receipt_sha256 = receipt_sha_value/);
  assert.match(sql, /receipt_sha_value <> computed_receipt_sha_value/);
  assert.match(
    sql,
    /payload_fingerprint_value <> stored_payload_fingerprint_value|stored_payload_fingerprint_value <> payload_fingerprint_value/,
  );
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(receipt_sha_value, 0\)\)/);
  assert.match(sql, /'idempotent', true/);
  assert.match(sql, /hide_street,[\s\S]*true,/);
  assert.match(
    sql,
    /grant execute on function private\.publish_serp_seed\(jsonb\) to service_role/,
  );
});
