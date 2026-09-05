const BLOCKED_HOSTS = Object.freeze([
  "2news.com",
  "7axis.agency",
  "aaa.com",
  "ac.gd",
  "angi.com",
  "ask-reno.com",
  "baonail.com",
  "baristamagazine.com",
  "bestlawyers.com",
  "bbb.org",
  "bing.com",
  "booksy.com",
  "carfax.com",
  "cedur.com",
  "chamberofcommerce.com",
  "cityof.com",
  "clearlyrated.com",
  "consumeraffairs.com",
  "cozymeal.com",
  "craigslist.org",
  "cylex.us.com",
  "dailycoffeenews.com",
  "davestravelcorner.com",
  "deltadental.com",
  "dinersdriveinsdiveslocations.com",
  "downtobid.com",
  "eater.com",
  "ediblerenotahoe.com",
  "expertise.com",
  "facebook.com",
  "fresha.com",
  "gaf.com",
  "google.com",
  "getpatioscreenrepair.com",
  "gymswithsauna.com",
  "handy.com",
  "homeadvisor.com",
  "homeguide.com",
  "homes-reno.com",
  "hotels.com",
  "houzz.com",
  "hirerush.com",
  "instagram.com",
  "ibew401.com",
  "indeed.com",
  "justia.com",
  "joe.coffee",
  "law.cornell.edu",
  "lensa.com",
  "linkedin.com",
  "local.yahoo.com",
  "mapquest.com",
  "manta.com",
  "meetahandyman.com",
  "modernize.com",
  "mountainluxury.com",
  "nextdoor.com",
  "napaonline.com",
  "opentable.com",
  "ourtownreno.com",
  "phantomscreens.com",
  "porch.com",
  "procore.com",
  "reno.gov",
  "renohandymanpros.com",
  "renomidtown.com",
  "renotahoecoffee.com",
  "renothisweek.com",
  "restaurant.com",
  "renorestaurantguide.com",
  "rgj.com",
  "reddit.com",
  "resy.com",
  "roveratlas.com",
  "saveur.com",
  "simon.com",
  "screenedporchrepairexperts.com",
  "superpages.com",
  "superlawyers.com",
  "taskrabbit.com",
  "taxbuzz.com",
  "theadventuristmagazine.com",
  "thebuilders.com",
  "thumbtack.com",
  "tiktok.com",
  "tripadvisor.com",
  "ubereats.com",
  "vagaro.com",
  "visitreno.com",
  "visitrenotahoe.com",
  "diningchannel.com",
  "doorscreenreplacement.com",
  "windowscreenrepairpros.com",
  "wolfrunliving.com",
  "x.com",
  "yellowpages.com",
  "yelp.com",
  "youtube.com",
  "zocdoc.com",
  "zoominfo.com",
  "ziprecruiter.com",
]);

const SCREEN_REPAIR_BLOCKED_HOSTS = Object.freeze(["ubreakifix.com"]);

export function isCategoryRelevantResult(category, item) {
  if (category?.slug !== "screen-repair") return true;
  const text = [item?.title, item?.description, item?.url].filter(Boolean).join(" ").toLowerCase();
  const domain = normalizeDomain(item?.url);
  const hasScreenService = /\b(screen|screens|rescreen|rescreening)\b/.test(text);
  const hasRepairOrReplacement =
    /\b(repair|repairs|repairing|rescreen|rescreening|re-screen|replace|replacing|replacement|replacements|fix|fixes|fixed|torn|damaged)\b/.test(
      text,
    );
  const hasLocality = /\b(reno|sparks|northern nevada)\b/.test(text);
  const isDeviceOrAutoGlass =
    /\b(phone|iphone|ipad|tablet|samsung|device|windshield|auto glass|fireplace|chimney)\b/.test(
      text,
    );
  const isGenericWindowReplacement = /\bwindow replacement\b|\/window-replacement(?:\/|$)/.test(
    text,
  );
  const isBlockedHost =
    domain &&
    SCREEN_REPAIR_BLOCKED_HOSTS.some(
      (blocked) => domain === blocked || domain.endsWith(`.${blocked}`),
    );
  const isOffRegion =
    /\b(placer|grass valley|nevada city|roseville|rocklin)\b/.test(text) &&
    !/\b(reno|sparks)\b/.test(text);
  return (
    hasScreenService &&
    hasRepairOrReplacement &&
    hasLocality &&
    !isDeviceOrAutoGlass &&
    !isGenericWindowReplacement &&
    !isBlockedHost &&
    !isOffRegion
  );
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

function containsReservedFictionalPhone(item) {
  const text = [item?.title, item?.description, item?.url].filter(Boolean).join(" ");
  return /\b(?:\d{3}[-.\s])?555[-.\s]01\d{2}\b/.test(text);
}

export function chooseBusinessResults(items, limit = 20) {
  const domains = new Set();
  const selected = [];
  for (const item of items ?? []) {
    if (item.type && item.type !== "organic") continue;
    const domain = normalizeDomain(item.url);
    if (!domain || isBlocked(domain) || containsReservedFictionalPhone(item) || domains.has(domain))
      continue;
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

export function revalidateSearchResults(category, items, limit = 20) {
  const priorByDomain = new Map((items ?? []).map((item) => [normalizeDomain(item.url), item]));
  return chooseBusinessResults(
    (items ?? []).filter((item) => isCategoryRelevantResult(category, item)),
    limit,
  ).map((result) => ({ ...priorByDomain.get(result.domain), ...result }));
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
  const maxCrawlAttempts = Number(options.maxCrawlAttempts ?? 3);
  const exhaustedFailureCount = currentReceipts.filter(
    (receipt) =>
      receipt?.reviewStatus === "crawl_failed" &&
      Number(receipt?.crawl?.attemptCount ?? 1) >= maxCrawlAttempts,
  ).length;
  const retryableFailureCount = failureCount - exhaustedFailureCount;
  const missingReceiptCount = currentReceipts.filter((receipt) => receipt === null).length;
  const invalidReceiptCount = currentReceipts.filter(
    (receipt) =>
      receipt !== null &&
      receipt.reviewStatus !== "crawl_failed" &&
      !isEvidenceCompleteReceipt(receipt),
  ).length;
  const inferredTarget = results.length + Number(search?.shortfall ?? 0);
  const targetResultCount = Math.min(
    20,
    Math.max(1, Number(search?.targetResultCount ?? (inferredTarget || 20))),
  );
  const shortfall = Math.max(0, Number(search?.shortfall ?? targetResultCount - results.length));
  const filterVersion = search?.filterVersion ?? null;
  const filterVersionAccepted =
    !options.expectedFilterVersion || filterVersion === options.expectedFilterVersion;

  const settled =
    results.length > 0 &&
    evidenceCompleteCount + exhaustedFailureCount === results.length &&
    missingReceiptCount === 0 &&
    invalidReceiptCount === 0;
  const complete = filterVersionAccepted && settled;
  const partial = complete && (shortfall > 0 || exhaustedFailureCount > 0);

  return {
    targetResultCount,
    resultCount: results.length,
    evidenceCompleteCount,
    failureCount,
    exhaustedFailureCount,
    retryableFailureCount,
    missingReceiptCount,
    invalidReceiptCount,
    staleReceiptCount: (receipts ?? []).filter(
      (receipt) => !currentTargets.has(resultKey(receipt?.serp)),
    ).length,
    shortfall,
    filterVersion,
    filterVersionAccepted,
    completionStatus: complete ? (partial ? "complete_with_partial_data" : "complete") : "pending",
    complete,
    partial,
    blocked: filterVersionAccepted && results.length === 0,
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
