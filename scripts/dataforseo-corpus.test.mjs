import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DATAFORSEO_RENO_ZIPS, readDataForSeoRenoCorpus } from "./dataforseo-corpus.mjs";
import { REVIEW_ONLY_RPC_NAMES, applyReviewOnlyImport } from "./import-apply-lib.mjs";

function listing(zip, overrides = {}) {
  return {
    type: "business_listing",
    title: `Example HVAC ${zip}`,
    category: "HVAC contractor",
    additional_categories: ["Heating contractor"],
    cid: `cid-${zip}`,
    feature_id: `feature-${zip}`,
    place_id: `place-${zip}`,
    phone: "+1-775-555-0100",
    domain: `example-${zip}.com`,
    url: `https://example-${zip}.com`,
    latitude: 39.5,
    longitude: -119.8,
    is_claimed: true,
    address_info: {
      address: `${zip} Main St`,
      city: "Reno",
      zip,
      region: "Nevada",
      country_code: "US",
    },
    rating: { value: 4.8, votes_count: 12 },
    work_time: { work_hours: { current_status: "open", timetable: {} } },
    contact_info: [{ type: "mail", value: `hello@example-${zip}.com` }],
    check_url: `https://example.invalid/${zip}`,
    ...overrides,
  };
}

async function writeFixture({ wrongIncludedCity = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "local775-cle73-"));
  for (const zip of DATAFORSEO_RENO_ZIPS) {
    const folder = join(root, `dataforseo-reno-${zip}`);
    await mkdir(folder);
    const includedOverrides =
      zip === "89521" ? { category: "Restaurant", additional_categories: [] } : {};
    if (wrongIncludedCity) {
      includedOverrides.address_info = {
        ...listing(zip).address_info,
        city: "Sparks",
      };
    }
    const included = listing(zip, includedOverrides);
    const excluded = listing(zip, {
      cid: `excluded-${zip}`,
      address_info: { ...listing(zip).address_info, city: "Sparks" },
    });
    const manifest = {
      collected_at: "2026-08-23T00:00:00.000Z",
      provider: "DataForSEO Business Listings Search Live",
      endpoint: "https://api.dataforseo.com/v3/business_data/business_listings/search/live",
      query: {
        filters: [["address_info.zip", "=", zip], "and", ["address_info.country_code", "=", "US"]],
      },
      unique_records: 2,
      records_received: 2,
      qualified_records: 1,
      city_mismatch_records_excluded: 1,
      target_city: "Reno",
      target_zip: zip,
      limitations: ["Provider snapshot, not a registry."],
    };
    if (zip === "89502") {
      manifest.qualified_reno_89502_records = 1;
      delete manifest.qualified_records;
      delete manifest.target_city;
      delete manifest.target_zip;
    }
    await writeFile(join(folder, `businesses-${zip}.json`), JSON.stringify([included]));
    await writeFile(join(folder, "excluded-city-mismatch.json"), JSON.stringify([excluded]));
    await writeFile(join(folder, "manifest.json"), JSON.stringify(manifest));
  }
  return root;
}

test("the four-ZIP corpus produces stable raw, exclusion, and review receipts", async () => {
  const root = await writeFixture();
  const first = await readDataForSeoRenoCorpus(root);
  const second = await readDataForSeoRenoCorpus(root);

  assert.equal(first.sourceSha256, second.sourceSha256);
  assert.match(first.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.receipts.length, 8);
  assert.equal(first.candidates.length, 4);
  assert.equal(first.artifacts.length, 12);
  assert.deepEqual(first.sheetCounts, {
    "businesses-89502": 1,
    "excluded-city-mismatch-89502": 1,
    "businesses-89509": 1,
    "excluded-city-mismatch-89509": 1,
    "businesses-89511": 1,
    "excluded-city-mismatch-89511": 1,
    "businesses-89521": 1,
    "excluded-city-mismatch-89521": 1,
  });
  assert.equal(first.candidates[0].street_address, "89502 Main St");
  assert.equal(first.candidates[0].postal_code, "89502");
  assert.equal(
    first.candidates[0].evidence.source_artifact,
    "dataforseo-reno-89502/businesses-89502.json",
  );
  assert.equal(first.candidates.at(-1).launch_category_slug, "restaurants");
});

test("the corpus fails closed when an included row is outside Reno", async () => {
  const root = await writeFixture({ wrongIncludedCity: true });
  await assert.rejects(() => readDataForSeoRenoCorpus(root), /included row must be Reno/);
});

test("repeat apply inserts nothing twice and uses only review-boundary RPCs", async () => {
  const calls = [];
  const storedRows = new Set();
  const storedCandidates = new Map();
  const rpc = async (_target, name, body) => {
    calls.push({ name, body });
    if (name === "register_source_batch") return "batch-1";
    if (name === "ingest_source_rows") {
      let inserted = 0;
      for (const row of body.requested_rows) {
        if (!storedRows.has(row.row_sha256)) inserted += 1;
        storedRows.add(row.row_sha256);
      }
      return inserted;
    }
    if (name === "ingest_listing_candidates") {
      let inserted = 0;
      for (const candidate of body.requested_candidates) {
        if (!storedCandidates.has(candidate.proposed_slug)) {
          inserted += 1;
          storedCandidates.set(candidate.proposed_slug, structuredClone(candidate));
        }
      }
      return inserted;
    }
    if (name === "reconcile_listing_candidate_screening") {
      let updated = 0;
      for (const candidate of body.requested_candidates) {
        const stored = storedCandidates.get(candidate.proposed_slug);
        if (!stored) throw new Error("candidate missing");
        if (
          stored.launch_category_slug !== candidate.launch_category_slug ||
          stored.screening_status !== candidate.screening_status ||
          JSON.stringify(stored.screening_reasons) !==
            JSON.stringify(candidate.screening_reasons) ||
          JSON.stringify(stored.evidence) !== JSON.stringify(candidate.evidence)
        ) {
          storedCandidates.set(candidate.proposed_slug, structuredClone(candidate));
          updated += 1;
        }
      }
      return updated;
    }
    if (name === "source_batch_status") {
      return {
        complete: storedRows.size === 2,
        stored_row_count: storedRows.size,
      };
    }
    if (name === "listing_candidate_batch_status") {
      const matrix = new Map();
      for (const candidate of storedCandidates.values()) {
        const key = `${candidate.city_slug}\u0000${candidate.launch_category_slug}`;
        const row = matrix.get(key) ?? {
          city: candidate.city_slug,
          category: candidate.launch_category_slug,
          candidate_count: 0,
          transform_current_count: 0,
          risk_current_count: 0,
          eligible_count: 0,
          needs_review_count: 0,
          ineligible_count: 0,
        };
        row.candidate_count += 1;
        if (candidate.evidence?.transform_version === "launch-candidate-v2") {
          row.transform_current_count += 1;
        }
        if (candidate.evidence?.corpus_review_risk_version === "entity-risk-v1") {
          row.risk_current_count += 1;
        }
        if (candidate.screening_status === "eligible") row.eligible_count += 1;
        if (candidate.screening_status === "needs_review") row.needs_review_count += 1;
        if (candidate.screening_status === "ineligible") row.ineligible_count += 1;
        matrix.set(key, row);
      }
      return {
        candidate_count: storedCandidates.size,
        transform_current_count: [...storedCandidates.values()].filter(
          (candidate) => candidate.evidence?.transform_version === "launch-candidate-v2",
        ).length,
        risk_current_count: [...storedCandidates.values()].filter(
          (candidate) => candidate.evidence?.corpus_review_risk_version === "entity-risk-v1",
        ).length,
        matrix: [...matrix.values()].sort((left, right) =>
          `${left.city}\u0000${left.category}`.localeCompare(
            `${right.city}\u0000${right.category}`,
          ),
        ),
      };
    }
    throw new Error(`Unexpected RPC ${name}`);
  };

  const input = {
    target: {},
    sourceName: "fixture",
    sourceSha256: "a".repeat(64),
    receipts: [{ row_sha256: "b".repeat(64) }, { row_sha256: "c".repeat(64) }],
    candidates: [
      {
        proposed_slug: "fixture-1",
        city_slug: "reno",
        launch_category_slug: "hvac",
        screening_status: "eligible",
        screening_reasons: [],
        evidence: {
          transform_version: "launch-candidate-v2",
          corpus_review_risk_version: "entity-risk-v1",
        },
      },
    ],
    importedBy: "test",
    notes: "review-only",
    rpc,
    chunkSize: 1,
  };
  const first = await applyReviewOnlyImport(input);
  const second = await applyReviewOnlyImport(input);

  assert.deepEqual(new Set(calls.map(({ name }) => name)), new Set(REVIEW_ONLY_RPC_NAMES));
  assert.equal(
    calls.some(({ name }) => /publish|business_listing|owner|update/i.test(name)),
    false,
  );
  assert.equal(first.insertedThisRun, 2);
  assert.equal(first.candidatesInsertedThisRun, 1);
  assert.equal(first.candidatesReconciledThisRun, 0);
  assert.equal(second.insertedThisRun, 0);
  assert.equal(second.candidatesInsertedThisRun, 0);
  assert.equal(second.candidatesReconciledThisRun, 0);
  assert.ok(
    calls
      .filter(({ name }) => name === "reconcile_listing_candidate_screening")
      .every(({ body }) =>
        /^listing-import:[a-f0-9]{64}:launch-candidate-v2:entity-risk-v1$/.test(
          body.requested_correlation_id,
        ),
      ),
  );

  const changed = { ...input, candidates: structuredClone(input.candidates) };
  changed.candidates[0].launch_category_slug = "electrical";
  changed.candidates[0].screening_status = "needs_review";
  changed.candidates[0].screening_reasons = ["launch_category_ambiguity"];
  const third = await applyReviewOnlyImport(changed);
  assert.equal(third.candidatesInsertedThisRun, 0);
  assert.equal(third.candidatesReconciledThisRun, 1);
  assert.equal(third.candidateStatus.matrix[0].category, "electrical");
});
