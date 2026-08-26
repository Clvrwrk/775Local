const BLOCKED_HOSTS = Object.freeze([
  "aaa.com",
  "angi.com",
  "bestlawyers.com",
  "bbb.org",
  "bing.com",
  "booksy.com",
  "carfax.com",
  "chamberofcommerce.com",
  "cityof.com",
  "clearlyrated.com",
  "consumeraffairs.com",
  "craigslist.org",
  "davestravelcorner.com",
  "deltadental.com",
  "downtobid.com",
  "eater.com",
  "ediblerenotahoe.com",
  "facebook.com",
  "fresha.com",
  "gaf.com",
  "homeadvisor.com",
  "homeguide.com",
  "hotels.com",
  "houzz.com",
  "hirerush.com",
  "instagram.com",
  "indeed.com",
  "justia.com",
  "law.cornell.edu",
  "linkedin.com",
  "local.yahoo.com",
  "mapquest.com",
  "modernize.com",
  "nextdoor.com",
  "opentable.com",
  "reno.gov",
  "renotahoecoffee.com",
  "renothisweek.com",
  "restaurant.com",
  "rgj.com",
  "reddit.com",
  "resy.com",
  "simon.com",
  "taskrabbit.com",
  "taxbuzz.com",
  "theadventuristmagazine.com",
  "thumbtack.com",
  "tiktok.com",
  "tripadvisor.com",
  "ubereats.com",
  "vagaro.com",
  "visitrenotahoe.com",
  "x.com",
  "yellowpages.com",
  "yelp.com",
  "youtube.com",
]);

export function isCategoryRelevantResult(category, item) {
  if (category?.slug !== "screen-repair") return true;
  const text = [item?.title, item?.description, item?.url].filter(Boolean).join(" ").toLowerCase();
  const hasScreenService = /\b(screen|screens|rescreen|rescreening)\b/.test(text);
  const isDeviceOrAutoGlass =
    /\b(phone|iphone|ipad|tablet|samsung|device|windshield|auto glass)\b/.test(text);
  return hasScreenService && !isDeviceOrAutoGlass;
}

export function normalizeDomain(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function normalizeResultUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return null;
  }
}

function isBlocked(domain) {
  return BLOCKED_HOSTS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

export function chooseBusinessResults(items, limit = 20) {
  const domains = new Set();
  const selected = [];
  for (const item of items ?? []) {
    if (item.type && item.type !== "organic") continue;
    const domain = normalizeDomain(item.url);
    if (!domain || isBlocked(domain) || domains.has(domain)) continue;
    domains.add(domain);
    selected.push({
      serpRank: Number(
        item.serpRank ?? item.rank_group ?? item.rank_absolute ?? selected.length + 1,
      ),
      title: String(item.title ?? "").trim() || null,
      description: String(item.description ?? "").trim() || null,
      url: item.url,
      domain,
      serpCity: item.serpCity ?? null,
    });
    if (selected.length === limit) break;
  }
  return selected;
}

export function planCategoryBatch(queue, batchSize = 20) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) {
    throw new Error("batchSize must be an integer from 1 through 20");
  }
  const pending = [...(queue ?? [])]
    .filter((entry) => entry.status !== "complete")
    .sort((left, right) => left.priority - right.priority);
  if (pending.length === 0) return [];
  const batchNumber = Math.ceil(pending[0].priority / batchSize);
  return pending.filter((entry) => Math.ceil(entry.priority / batchSize) === batchNumber);
}

export function planReconciliationWindow(queue, batchSize = 20) {
  const pending = planCategoryBatch(queue, batchSize);
  if (pending.length === 0) return [];
  const batchNumber = Math.ceil(pending[0].priority / batchSize);
  return [...(queue ?? [])]
    .filter((entry) => Math.ceil(entry.priority / batchSize) === batchNumber)
    .sort((left, right) => left.priority - right.priority);
}

export function categorySerpQueries(category) {
  const primary = String(category?.query ?? "").trim();
  if (!primary) throw new Error("category query is required");
  const aliases = [
    ...new Set((category?.queryAliases ?? []).map((value) => String(value).trim()).filter(Boolean)),
  ];
  if (aliases.length > 2) throw new Error("a category may define at most two aliases");
  return [...new Set([primary, ...aliases])];
}

function uniqueMatches(text, pattern) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0]))].slice(0, 20);
}

export function extractWebsiteEvidence(pages) {
  const normalized = (pages ?? []).map((page) => ({
    url: page.url ?? page.metadata?.sourceURL ?? null,
    title: page.title ?? page.metadata?.title ?? null,
    markdown: String(page.markdown ?? ""),
  }));
  const text = normalized.map((page) => page.markdown).join("\n");
  const hours = text.match(
    /(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)[^\n.]{0,100}(?:am|pm|closed)/i,
  );
  return {
    title: normalized.find((page) => page.title)?.title ?? null,
    phones: uniqueMatches(text, /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g),
    emails: uniqueMatches(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
    hoursEvidence: hours?.[0] ?? null,
    sourceUrls: [...new Set(normalized.map((page) => page.url).filter(Boolean))],
  };
}

export function isEvidenceCompleteReceipt(receipt) {
  return (
    receipt?.reviewStatus === "private_candidate" &&
    Number.isInteger(receipt?.crawl?.pageCount) &&
    receipt.crawl.pageCount > 0 &&
    Array.isArray(receipt.sourcePages) &&
    receipt.sourcePages.length > 0
  );
}

export function summarizeCurrentSearchReceipts(search, receipts, options = {}) {
  const results = Array.isArray(search?.results) ? search.results : [];
  const resultKey = (value) => {
    const domain = value?.domain;
    const url = normalizeResultUrl(value?.url);
    return domain && url ? `${domain}\t${url}` : null;
  };
  const currentTargets = new Set(results.map(resultKey).filter(Boolean));
  const byTarget = new Map(
    (receipts ?? []).map((receipt) => [resultKey(receipt?.serp), receipt]).filter(([key]) => key),
  );
  const currentReceipts = results.map((result) => byTarget.get(resultKey(result)) ?? null);
  const evidenceCompleteCount = currentReceipts.filter(isEvidenceCompleteReceipt).length;
  const failureCount = currentReceipts.filter(
    (receipt) => receipt?.reviewStatus === "crawl_failed",
  ).length;
  const missingReceiptCount = currentReceipts.filter((receipt) => receipt === null).length;
  const invalidReceiptCount = currentReceipts.filter(
    (receipt) =>
      receipt !== null &&
      receipt.reviewStatus !== "crawl_failed" &&
      !isEvidenceCompleteReceipt(receipt),
  ).length;
  const shortfall = Math.max(0, Number(search?.shortfall ?? 20 - results.length));
  const filterVersion = search?.filterVersion ?? null;
  const filterVersionAccepted =
    !options.expectedFilterVersion || filterVersion === options.expectedFilterVersion;

  return {
    resultCount: results.length,
    evidenceCompleteCount,
    failureCount,
    missingReceiptCount,
    invalidReceiptCount,
    staleReceiptCount: (receipts ?? []).filter(
      (receipt) => !currentTargets.has(resultKey(receipt?.serp)),
    ).length,
    shortfall,
    filterVersion,
    filterVersionAccepted,
    complete: filterVersionAccepted && results.length === 20 && evidenceCompleteCount === 20,
    blocked:
      filterVersionAccepted &&
      shortfall > 0 &&
      evidenceCompleteCount === results.length &&
      failureCount === 0 &&
      missingReceiptCount === 0 &&
      invalidReceiptCount === 0,
  };
}

export function completionEstimate({ categoryCount, batchSize, currentBatch }) {
  const totalBatches = Math.ceil(categoryCount / batchSize);
  return {
    totalBatches,
    nightlyRunsRemaining: Math.max(0, totalBatches - currentBatch),
    retryAllowanceDays: 2,
  };
}
