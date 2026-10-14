import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { assignMaterializedTiers, buildSerpSeed } from "./seed-materialization-lib.mjs";

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

test("100-listing seed preserves Home and Gallery service facts while retaining exact tier gates", async () => {
  const root = await mkdtemp(join(tmpdir(), "local775-service-regression-"));
  const categories = [
    "screen-repair",
    "hvac",
    "plumbing",
    "electrical",
    "auto-repair",
    "restaurants",
    "dentists",
    "handyman",
    "roofing",
    "veterinarians",
  ];
  const serviceNames = ["Home Repair", "Home Remodeling", "Gallery Wall Installation"];
  const prose =
    "A synthetic local fixture offers repair and installation services for residents. This is test data only and makes no statement about any real business or publication approval. The service details are included to exercise extraction boundaries.";
  const faq = [
    "How are repair appointments scheduled?",
    "What installation services are offered?",
    "How can residents request service details?",
  ]
    .map(
      (q) =>
        `${q}\n\nContact the fixture for a synthetic answer about appointment details and service scope.`,
    )
    .join("\n\n");
  try {
    await mkdir(join(root, "batch-01/listings"), { recursive: true });
    await writeFile(
      join(root, "category-queue.json"),
      JSON.stringify({ queue: categories.map((slug) => ({ slug })) }),
    );
    for (const [c, category] of categories.entries()) {
      const results = [];
      for (let i = 0; i < 10; i++) {
        const domain = `fixture-${c}-${i}.example`;
        const url = `https://${domain}`;
        results.push({
          domain,
          url,
          title: `Synthetic Fixture ${c}-${i}`,
          description: prose,
          serpRank: i + 1,
          serpCity: "Reno",
        });
        await writeFile(
          join(root, "batch-01/listings", `${category}--${domain}.json`),
          JSON.stringify({
            reviewStatus: "private_candidate",
            sourcePages: [
              {
                url: `${url}/services`,
                markdown: `${prose}\n\n${["Home", "Gallery", "Services", ...serviceNames, "Hours of Operation", "Before", "After"].map((v) => `## ${v}`).join("\n")}`,
              },
              { url: `${url}/faq`, title: "FAQ", markdown: faq },
            ],
            evidence: { sourceUrls: [url] },
          }),
        );
      }
      await writeFile(
        join(root, "batch-01", `${category}-search.json`),
        JSON.stringify({
          filterVersion: "business-controlled-domain-v10",
          revalidatedAt: "2026-10-03T00:00:00Z",
          results,
        }),
      );
    }
    const seed = await buildSerpSeed(root);
    assert.equal(seed.listings.length, 100);
    for (const listing of seed.listings) assert.deepEqual(listing.services, serviceNames);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(Object.groupBy(seed.listings, (l) => l.contentTier)).map(([k, v]) => [
          k,
          v.length,
        ]),
      ),
      { premium: 10, standard: 30, basic: 60 },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

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
  assert.match(
    sql,
    /pg_advisory_xact_lock\(hashtextextended\('local775:serp-seed-publication', 0\)\)/,
  );
  assert.match(sql, /'idempotent', true/);
  assert.match(sql, /hide_street,[\s\S]*true,/);
  assert.match(
    sql,
    /grant execute on function private\.publish_serp_seed\(jsonb\) to service_role/,
  );
});

test("seed tier assignment rejects short or oversized input before assigning a mix", () => {
  for (const length of [99, 101])
    assert.throws(
      () => assignMaterializedTiers(Array.from({ length }, (_, i) => row(i))),
      /exactly 100/,
    );
});
