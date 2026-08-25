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
  const storedCandidates = new Set();
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
        if (!storedCandidates.has(candidate.proposed_slug)) inserted += 1;
        storedCandidates.add(candidate.proposed_slug);
      }
      return inserted;
    }
    if (name === "source_batch_status") {
      return {
        complete: storedRows.size === 2,
        stored_row_count: storedRows.size,
      };
    }
    if (name === "listing_candidate_batch_status") {
      return { candidate_count: storedCandidates.size };
    }
    throw new Error(`Unexpected RPC ${name}`);
  };

  const input = {
    target: {},
    sourceName: "fixture",
    sourceSha256: "a".repeat(64),
    receipts: [{ row_sha256: "b".repeat(64) }, { row_sha256: "c".repeat(64) }],
    candidates: [{ proposed_slug: "fixture-1" }],
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
  assert.equal(second.insertedThisRun, 0);
  assert.equal(second.candidatesInsertedThisRun, 0);
});
