import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCaptureCompleteness,
  assertSpendEnvelope,
  buildDataForSeoOnPageTask,
  buildFirecrawlOperation,
  classifyListingSource,
  estimateListingIntelligenceBudget,
  normalizeListingSources,
} from "./listing-intelligence-lib.mjs";

test("sources distinguish owned sites from known landing-page platforms", () => {
  assert.equal(classifyListingSource("https://example.com/services"), "website");
  assert.equal(classifyListingSource("https://www.facebook.com/example"), "facebook");
  assert.equal(classifyListingSource("https://www.yelp.com/biz/example"), "yelp");
  assert.equal(classifyListingSource("https://www.houzz.com/pro/example"), "houzz");
});

test("source inventories deduplicate and preserve the primary source", () => {
  assert.deepEqual(
    normalizeListingSources({
      website_url: "https://example.com/",
      source_urls: ["https://example.com/#top", "https://www.yelp.com/biz/example"],
    }),
    [
      { url: "https://example.com/", kind: "website", isPrimary: true },
      { url: "https://www.yelp.com/biz/example", kind: "yelp", isPrimary: false },
    ],
  );
});

test("owned sites crawl the accessible domain while platform sources capture one landing page", () => {
  const website = buildFirecrawlOperation(
    { url: "https://example.com/", kind: "website" },
    { websitePageLimit: 250 },
  );
  assert.equal(website.endpoint, "/v2/crawl");
  assert.equal(website.body.limit, 250);
  assert.equal(website.body.crawlEntireDomain, true);
  assert.equal(website.body.allowExternalLinks, false);
  assert.equal(website.maximumCredits, 250);

  const yelp = buildFirecrawlOperation({ url: "https://yelp.com/biz/example", kind: "yelp" });
  assert.equal(yelp.endpoint, "/v2/scrape");
  assert.equal(yelp.completenessBasis, "single_landing_page");
  assert.equal(yelp.maximumCredits, 1);
});

test("DataForSEO OnPage audits apply only to owned sites", () => {
  assert.deepEqual(
    buildDataForSeoOnPageTask(
      { url: "https://example.com/", kind: "website" },
      { maxCrawlPages: 250 },
    ),
    {
      target: "https://example.com/",
      max_crawl_pages: 250,
      load_resources: true,
      enable_javascript: true,
      custom_js:
        "meta = {}; meta.links = document.links.length; meta.forms = document.forms.length; meta",
      tag: "local775-listing-intelligence-v1",
    },
  );
  assert.equal(buildDataForSeoOnPageTask({ url: "https://yelp.com/x", kind: "yelp" }), null);
});

test("completeness is fail-closed when the page cap or pagination prevents a full account", () => {
  assert.deepEqual(
    assessCaptureCompleteness({
      sourceKind: "website",
      pageCount: 25,
      hitPageLimit: true,
      paginationDrained: false,
      providerStatus: "completed",
    }),
    {
      terminalStatus: "partial",
      completenessBasis: "entire_accessible_site",
      blockers: ["page_limit_reached", "provider_pagination_not_drained"],
    },
  );
  assert.equal(
    assessCaptureCompleteness({
      sourceKind: "website",
      pageCount: 6,
      paginationDrained: true,
      providerStatus: "completed",
    }).terminalStatus,
    "complete",
  );
});

test("budget planning is deterministic and execution envelopes fail closed", () => {
  const estimate = estimateListingIntelligenceBudget(
    [
      {
        id: "listing-1",
        website_url: "https://example.com/",
        source_urls: ["https://www.yelp.com/biz/example"],
      },
    ],
    { websitePageLimit: 100, dataForSeoUsdPerPage: 0.0018 },
  );
  assert.equal(estimate.maximumFirecrawlCredits, 101);
  assert.equal(estimate.maximumDataForSeoUsd, 0.18);
  assert.equal(
    assertSpendEnvelope(estimate, { maxFirecrawlCredits: 101, maxDataForSeoUsd: 0.18 }),
    true,
  );
  assert.throws(
    () => assertSpendEnvelope(estimate, { maxFirecrawlCredits: 100, maxDataForSeoUsd: 0.18 }),
    /below the worst-case estimate/,
  );
});
