import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { applyCorpusReviewRisks, canSelectForLaunch } from "./listing-review-risk.mjs";

function candidate(overrides = {}) {
  return {
    worksheet: "businesses-89502",
    source_row: 2,
    normalized_name: "Example Plumbing",
    proposed_slug: "example-plumbing-00000001",
    street_address: "100 Main St",
    city_slug: "reno",
    postal_code: "89502",
    diversity_key: "example.com",
    screening_status: "eligible",
    screening_reasons: [],
    review_status: "pending",
    evidence: {},
    ...overrides,
  };
}

test("duplicate title and address rows are explicit review cases", () => {
  const screened = applyCorpusReviewRisks([
    candidate(),
    candidate({ source_row: 3, proposed_slug: "example-plumbing-00000002" }),
  ]);
  for (const item of screened) {
    assert.equal(item.screening_status, "needs_review");
    assert.ok(item.screening_reasons.includes("duplicate_title_address"));
  }
});

test("multi-location and franchise-like domain groups require review", () => {
  const screened = applyCorpusReviewRisks([
    candidate(),
    candidate({
      source_row: 3,
      normalized_name: "Example Plumbing North",
      proposed_slug: "example-plumbing-north-00000002",
      street_address: "200 Main St",
    }),
  ]);
  for (const item of screened) {
    assert.equal(item.screening_status, "needs_review");
    assert.ok(item.screening_reasons.includes("multi_location_chain_or_franchise_review"));
  }
});

test("corpus screening is deterministic and preserves existing reasons", () => {
  const input = [
    candidate({ screening_status: "needs_review", screening_reasons: ["website_missing"] }),
    candidate({
      source_row: 3,
      proposed_slug: "example-plumbing-00000002",
      screening_status: "needs_review",
      screening_reasons: ["website_missing"],
    }),
  ];
  const first = applyCorpusReviewRisks(input);
  const second = applyCorpusReviewRisks(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first[0].screening_reasons, ["website_missing", "duplicate_title_address"]);
});

test("selection requires accepted review plus clean eligible screening", () => {
  assert.equal(
    canSelectForLaunch(
      candidate({
        review_status: "accepted",
        reviewed_by: "00000000-0000-4000-8000-000000000001",
        reviewed_at: "2026-08-25T14:00:00.000Z",
        screening_status: "eligible",
      }),
    ),
    true,
  );
  assert.equal(
    canSelectForLaunch(
      candidate({
        review_status: "accepted",
        screening_status: "needs_review",
        screening_reasons: ["practitioner_entity_review"],
      }),
    ),
    false,
  );
  assert.equal(canSelectForLaunch(candidate({ review_status: "pending" })), false);
  assert.equal(
    canSelectForLaunch(
      candidate({
        review_status: "accepted",
        reviewed_at: "2026-08-25T14:00:00.000Z",
      }),
    ),
    false,
  );
});

test("the database selection constraint matches the private selection contract", () => {
  const migration = readFileSync(
    join(
      import.meta.dirname,
      "..",
      "supabase",
      "migrations",
      "20260825143000_require_clean_review_for_launch_selection.sql",
    ),
    "utf8",
  );
  assert.match(migration, /not selected_for_launch/i);
  assert.match(migration, /review_status = 'accepted'/i);
  assert.match(migration, /reviewed_by is not null/i);
  assert.match(migration, /reviewed_at is not null/i);
  assert.match(migration, /screening_status = 'eligible'/i);
  assert.match(migration, /cardinality\(screening_reasons\) = 0/i);
});

test("screening reconciliation updates only private pending candidates", () => {
  const migration = readFileSync(
    join(
      import.meta.dirname,
      "..",
      "supabase",
      "migrations",
      "20260825144500_add_candidate_screening_reconciliation.sql",
    ),
    "utf8",
  );
  assert.match(migration, /reconcile_listing_candidate_screening/i);
  assert.match(migration, /review_status = 'pending'/i);
  assert.match(migration, /not target\.selected_for_launch/i);
  assert.match(migration, /risk_current_count/i);
  assert.match(migration, /screening_reasons is null/i);
  assert.match(migration, /having count\(\*\) > 1/i);
  assert.match(migration, /insert into app\.audit_events/i);
  assert.match(migration, /launch_category_slug/i);
  assert.doesNotMatch(migration, /app\.business_listings/i);
});
