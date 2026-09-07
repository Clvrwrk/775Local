const DIRECTORY_HOSTS = new Map([
  ["facebook.com", "facebook"],
  ["yelp.com", "yelp"],
  ["houzz.com", "houzz"],
]);

function hostnameFor(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`Listing source must use HTTPS: ${value}`);
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

export function classifyListingSource(value, { owned = false } = {}) {
  const hostname = hostnameFor(value);
  for (const [domain, kind] of DIRECTORY_HOSTS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return kind;
  }
  return owned ? "website" : "directory_landing_page";
}

export function normalizeListingSources(listing) {
  const candidates = [
    ...(listing.website_url
      ? [{ url: listing.website_url, kind: null, isPrimary: true, owned: true }]
      : []),
    ...(listing.source_urls ?? []).map((source) =>
      typeof source === "string"
        ? { url: source, kind: null, isPrimary: false, owned: false }
        : { ...source, isPrimary: false, owned: source.kind === "website" },
    ),
  ];
  const sources = new Map();
  for (const candidate of candidates) {
    const url = new URL(candidate.url);
    url.hash = "";
    const normalized = url.href;
    const prior = sources.get(normalized);
    sources.set(normalized, {
      url: normalized,
      kind:
        prior?.kind === "website"
          ? "website"
          : (candidate.kind ?? classifyListingSource(normalized, { owned: candidate.owned })),
      isPrimary: prior?.isPrimary === true || candidate.isPrimary,
    });
  }
  return [...sources.values()].sort(
    (left, right) => Number(right.isPrimary) - Number(left.isPrimary),
  );
}

export function buildFirecrawlOperation(source, { websitePageLimit = 500 } = {}) {
  if (!Number.isInteger(websitePageLimit) || websitePageLimit < 1 || websitePageLimit > 10_000) {
    throw new Error("websitePageLimit must be an integer between 1 and 10000");
  }
  if (source.kind !== "website") {
    return {
      endpoint: "/v2/scrape",
      body: {
        url: source.url,
        formats: ["markdown", "html", "links"],
        onlyMainContent: false,
      },
      completenessBasis: "single_landing_page",
      maximumCredits: 1,
    };
  }
  return {
    endpoint: "/v2/crawl",
    body: {
      url: source.url,
      limit: websitePageLimit,
      crawlEntireDomain: true,
      allowSubdomains: false,
      allowExternalLinks: false,
      ignoreQueryParameters: true,
      scrapeOptions: { formats: ["markdown", "html", "links"], onlyMainContent: false },
    },
    completenessBasis: "entire_accessible_site",
    maximumCredits: websitePageLimit,
  };
}

export function buildDataForSeoOnPageTask(source, { maxCrawlPages = 500 } = {}) {
  if (source.kind !== "website") return null;
  if (!Number.isInteger(maxCrawlPages) || maxCrawlPages < 1) {
    throw new Error("maxCrawlPages must be a positive integer");
  }
  return {
    target: source.url,
    max_crawl_pages: maxCrawlPages,
    load_resources: true,
    enable_javascript: true,
    custom_js:
      "meta = {}; meta.links = document.links.length; meta.forms = document.forms.length; meta",
    tag: "local775-listing-intelligence-v1",
  };
}

export function assessCaptureCompleteness({
  sourceKind,
  pageCount,
  failedPageCount = 0,
  hitPageLimit = false,
  paginationDrained = false,
  providerStatus,
  accessBlocked = false,
}) {
  const blockers = [];
  if (accessBlocked) blockers.push("access_blocked");
  if (providerStatus !== "completed") blockers.push(`provider_${providerStatus ?? "unknown"}`);
  if (pageCount === 0) blockers.push("no_accessible_pages");
  if (failedPageCount > 0) blockers.push("page_failures");
  if (hitPageLimit) blockers.push("page_limit_reached");
  if (sourceKind === "website" && !paginationDrained) {
    blockers.push("provider_pagination_not_drained");
  }
  const terminalStatus =
    blockers.length === 0 ? "complete" : accessBlocked || pageCount === 0 ? "blocked" : "partial";
  return {
    terminalStatus,
    completenessBasis: sourceKind === "website" ? "entire_accessible_site" : "single_landing_page",
    blockers,
  };
}

export function estimateListingIntelligenceBudget(
  listings,
  { websitePageLimit = 500, dataForSeoUsdPerPage = 0.0018 } = {},
) {
  if (!Number.isFinite(dataForSeoUsdPerPage) || dataForSeoUsdPerPage <= 0) {
    throw new Error("dataForSeoUsdPerPage must be a positive finite number");
  }
  const plans = listings.map((listing) => {
    const sources = normalizeListingSources(listing);
    const firecrawlCredits = sources.reduce(
      (total, source) =>
        total + buildFirecrawlOperation(source, { websitePageLimit }).maximumCredits,
      0,
    );
    const websiteCount = sources.filter((source) => source.kind === "website").length;
    return {
      listingId: listing.id,
      sources,
      maximumFirecrawlCredits: firecrawlCredits,
      maximumDataForSeoUsd: websiteCount * websitePageLimit * dataForSeoUsdPerPage,
    };
  });
  return {
    listingCount: listings.length,
    sourceCount: plans.reduce((total, plan) => total + plan.sources.length, 0),
    maximumFirecrawlCredits: plans.reduce((total, plan) => total + plan.maximumFirecrawlCredits, 0),
    maximumDataForSeoUsd:
      Math.ceil(plans.reduce((total, plan) => total + plan.maximumDataForSeoUsd, 0) * 1e6) / 1e6,
    plans,
  };
}

export function assertSpendEnvelope(estimate, { maxFirecrawlCredits, maxDataForSeoUsd }) {
  if (
    !Number.isFinite(estimate.maximumFirecrawlCredits) ||
    !Number.isFinite(estimate.maximumDataForSeoUsd) ||
    estimate.maximumFirecrawlCredits < 0 ||
    estimate.maximumDataForSeoUsd < 0
  ) {
    throw new Error("Provider estimate must contain finite non-negative maxima.");
  }
  if (
    !Number.isFinite(maxFirecrawlCredits) ||
    maxFirecrawlCredits < estimate.maximumFirecrawlCredits
  ) {
    throw new Error(
      `Firecrawl envelope ${maxFirecrawlCredits} is below the worst-case estimate ${estimate.maximumFirecrawlCredits}.`,
    );
  }
  if (!Number.isFinite(maxDataForSeoUsd) || maxDataForSeoUsd < estimate.maximumDataForSeoUsd) {
    throw new Error(
      `DataForSEO envelope ${maxDataForSeoUsd} is below the worst-case estimate ${estimate.maximumDataForSeoUsd}.`,
    );
  }
  return true;
}
