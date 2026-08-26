import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  categorySerpQueries,
  chooseBusinessResults,
  completionEstimate,
  extractWebsiteEvidence,
  isCategoryRelevantResult,
  isEvidenceCompleteReceipt,
  planCategoryBatch,
} from "./serp-enrichment-lib.mjs";

test("zero-page crawls never count as enriched candidates", () => {
  assert.equal(
    isEvidenceCompleteReceipt({
      reviewStatus: "private_candidate",
      crawl: { pageCount: 0 },
      sourcePages: [],
    }),
    false,
  );
  assert.equal(
    isEvidenceCompleteReceipt({
      reviewStatus: "private_candidate",
      crawl: { pageCount: 1 },
      sourcePages: [{ url: "https://example.com" }],
    }),
    true,
  );
});

test("runner imports query planning from the local library, not node fs", async () => {
  const source = await readFile(new URL("./serp-enrichment.mjs", import.meta.url), "utf8");
  const fsImport = source.match(/import \{[\s\S]*?\} from "node:fs\/promises";/)?.[0] ?? "";
  const libraryImport =
    source.match(/import \{[\s\S]*?\} from "\.\/serp-enrichment-lib\.mjs";/)?.[0] ?? "";
  assert.doesNotMatch(fsImport, /categorySerpQueries/);
  assert.match(libraryImport, /categorySerpQueries/);
});

test("completion accounting reads only the current SERP result receipts", async () => {
  const source = await readFile(new URL("./serp-enrichment.mjs", import.meta.url), "utf8");
  assert.match(source, /search\.results\.map/);
  assert.doesNotMatch(source, /listingFiles\.filter/);
  assert.match(source, /completedPriorities\.delete/);
});

test("failed crawl retries are appended to the provider ledger", async () => {
  const source = await readFile(new URL("./serp-enrichment.mjs", import.meta.url), "utf8");
  assert.match(source, /status: "failed"/);
  assert.match(source, /failureRecordedAt/);
  assert.match(source, /error\.firecrawlJobId/);
  assert.match(source, /crawl\?\.creditsUsed/);
});

test("SERP query aliases are explicit, unique, and bounded", () => {
  assert.deepEqual(
    categorySerpQueries({
      query: "window screen repair service",
      queryAliases: [
        "screen door repair service",
        "screen door repair service",
        "patio screen repair",
      ],
    }),
    ["window screen repair service", "screen door repair service", "patio screen repair"],
  );
  assert.throws(
    () =>
      categorySerpQueries({
        query: "plumber",
        queryAliases: ["one", "two", "three"],
      }),
    /at most two aliases/,
  );
});

test("SERP selection excludes aggregators, social networks, duplicates, and unsafe URLs", () => {
  const items = [
    {
      rank_group: 1,
      title: "Yelp",
      url: "https://www.yelp.com/search?find_desc=plumber",
    },
    { rank_group: 2, title: "Alpha", url: "https://alpha.example/services" },
    {
      rank_group: 3,
      title: "Alpha duplicate",
      url: "https://www.alpha.example/about",
    },
    { rank_group: 4, title: "Facebook", url: "https://facebook.com/alpha" },
    { rank_group: 5, title: "Beta", url: "http://beta.example/" },
    { rank_group: 6, title: "Unsafe", url: "ftp://unsafe.example/" },
    {
      rank_group: 7,
      title: "Restaurant guide",
      url: "https://vegas.eater.com/maps/best-restaurants-reno",
    },
    {
      rank_group: 8,
      title: "Attorney directory",
      url: "https://www.justia.com/lawyers/nevada/reno",
    },
  ];
  assert.deepEqual(
    chooseBusinessResults(items, 20).map((item) => item.domain),
    ["alpha.example", "beta.example"],
  );
});

test("screen repair candidates exclude phone, auto-glass, and generic window results", () => {
  const category = { slug: "screen-repair" };
  assert.equal(
    isCategoryRelevantResult(category, {
      title: "Patio Screen Door Repair in Reno",
      description: "Window rescreening and retractable screens",
    }),
    true,
  );
  assert.equal(
    isCategoryRelevantResult(category, {
      title: "Cracked iPhone Screen Repair",
      description: "Phone and tablet service",
    }),
    false,
  );
  assert.equal(
    isCategoryRelevantResult(category, {
      title: "Windshield Repair and Replacement",
      description: "Auto glass service",
    }),
    false,
  );
  assert.equal(
    isCategoryRelevantResult(category, {
      title: "Window Replacement in Reno",
      description: "Install new windows",
    }),
    false,
  );
});

test("category batches stay in a fixed 20-category window until retries finish", () => {
  const queue = Array.from({ length: 45 }, (_, index) => ({
    priority: index + 1,
    category: `Category ${index + 1}`,
    status: index < 3 ? "complete" : "pending",
  }));
  const batch = planCategoryBatch(queue, 20);
  assert.equal(batch.length, 17);
  assert.equal(batch[0].priority, 4);
  assert.equal(batch.at(-1).priority, 20);

  const next = planCategoryBatch(
    queue.map((entry) => ({
      ...entry,
      status: entry.priority <= 20 ? "complete" : "pending",
    })),
    20,
  );
  assert.equal(next.length, 20);
  assert.equal(next[0].priority, 21);
  assert.equal(next.at(-1).priority, 40);
});

test("website evidence aggregates pages without inventing missing fields", () => {
  const evidence = extractWebsiteEvidence([
    {
      url: "https://alpha.example/",
      title: "Alpha Plumbing",
      markdown: "Call (775) 555-0100. Open Mon-Fri 8am-5pm. Serving Reno and Sparks.",
    },
    {
      url: "https://alpha.example/contact",
      markdown: "Email hello@alpha.example, 10 Main St, Reno, NV 89501",
    },
  ]);
  assert.equal(evidence.title, "Alpha Plumbing");
  assert.deepEqual(evidence.phones, ["(775) 555-0100"]);
  assert.deepEqual(evidence.emails, ["hello@alpha.example"]);
  assert.match(evidence.hoursEvidence, /Mon-Fri 8am-5pm/);
  assert.equal(evidence.sourceUrls.length, 2);
});

test("completion estimate counts the current batch and includes retry allowance", () => {
  const estimate = completionEstimate({
    categoryCount: 232,
    batchSize: 20,
    currentBatch: 1,
  });
  assert.equal(estimate.totalBatches, 12);
  assert.equal(estimate.nightlyRunsRemaining, 11);
  assert.equal(estimate.retryAllowanceDays, 2);
});
