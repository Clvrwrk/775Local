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
      serpRank: Number(item.rank_group ?? item.rank_absolute ?? selected.length + 1),
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

export function completionEstimate({ categoryCount, batchSize, currentBatch }) {
  const totalBatches = Math.ceil(categoryCount / batchSize);
  return {
    totalBatches,
    nightlyRunsRemaining: Math.max(0, totalBatches - currentBatch),
    retryAllowanceDays: 2,
  };
}
