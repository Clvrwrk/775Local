#!/usr/bin/env node
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  assessCaptureCompleteness,
  buildDataForSeoOnPageTask,
  buildFirecrawlOperation,
  normalizeListingSources,
} from "./listing-intelligence-lib.mjs";

const args = new Map(
  process.argv
    .slice(2)
    .flatMap((value, index, all) =>
      value.startsWith("--")
        ? [
            [
              value.split("=")[0],
              value.includes("=") ? value.slice(value.indexOf("=") + 1) : all[index + 1],
            ],
          ]
        : [],
    ),
);
const inputPath = resolve(args.get("--input") ?? "");
const outputRoot = resolve(args.get("--output") ?? "artifacts/listing-intelligence-live");
const stage = args.get("--stage") ?? "all";
const websitePageLimit = Number(args.get("--website-page-limit") ?? 500);
const maxFirecrawlCredits = Number(args.get("--max-firecrawl-credits") ?? 50_000);
const maxDataForSeoUsd = Number(args.get("--max-dataforseo-usd") ?? 90);
const concurrency = Number(args.get("--concurrency") ?? 3);
const listingLimit = Number(args.get("--limit") ?? Number.POSITIVE_INFINITY);
if (!inputPath || !["crawl", "audit", "all"].includes(stage)) {
  throw new Error(
    "usage: --input FILE --output DIR [--stage crawl|audit|all] [--website-page-limit 500] [--max-firecrawl-credits 50000] [--max-dataforseo-usd 90]",
  );
}
if (!Number.isInteger(websitePageLimit) || websitePageLimit < 1 || websitePageLimit > 10_000)
  throw new Error("invalid website page limit");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
  throw new Error("invalid concurrency");
if (!(maxFirecrawlCredits >= 0) || !(maxDataForSeoUsd >= 0))
  throw new Error("invalid spend envelope");

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const exists = (path) =>
  stat(path).then(
    () => true,
    () => false,
  );
const atomicJson = async (path, value) => {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
};
const appendLedger = async (event) =>
  appendFile(
    join(outputRoot, "provider-ledger.jsonl"),
    `${JSON.stringify({ recordedAt: new Date().toISOString(), ...event })}\n`,
    { mode: 0o600 },
  );

let privateProviderConfig;
async function providerKey(envName, provider) {
  if (process.env[envName]) return process.env[envName];
  if (!privateProviderConfig) {
    const path = "/Users/chussey/.config/global-web-intel/config.json";
    const fileStat = await stat(path);
    if ((fileStat.mode & 0o077) !== 0)
      throw new Error("Global Web Intel config must be owner-only (0600)");
    privateProviderConfig = JSON.parse(await readFile(path, "utf8"));
  }
  return privateProviderConfig.providers?.[provider]?.apiKey ?? null;
}

async function fetchJson(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
      const text = await response.text();
      const body = text ? JSON.parse(text) : {};
      if (response.ok) return body;
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 4) {
        throw new Error(
          `${label} failed with HTTP ${response.status}: ${String(body?.error ?? body?.status_message ?? "provider error").slice(0, 240)}`,
        );
      }
      lastError = new Error(`${label} transient HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === 4) throw error;
    }
    await sleep(1_500 * attempt);
  }
  throw lastError;
}

function losslessArtifact(value, parsedPayload = null) {
  const original = JSON.stringify(value);
  const wrapper = JSON.stringify({
    encoding: "gzip+base64",
    mediaType: "application/json",
    originalByteCount: Buffer.byteLength(original),
    originalSha256: sha256(original),
    data: gzipSync(Buffer.from(original)).toString("base64"),
  });
  return {
    content_sha256: sha256(wrapper),
    byte_count: Buffer.byteLength(wrapper),
    content_type: "application/json",
    raw_text: wrapper,
    parsed_payload: parsedPayload,
  };
}

const DIRECTORY_DOMAINS = new Map([
  ["facebook.com", "facebook"],
  ["yelp.com", "yelp"],
  ["houzz.com", "houzz"],
  ["instagram.com", "other"],
  ["bbb.org", "directory_landing_page"],
  ["angi.com", "directory_landing_page"],
  ["homeadvisor.com", "directory_landing_page"],
  ["thumbtack.com", "directory_landing_page"],
  ["tripadvisor.com", "directory_landing_page"],
  ["nextdoor.com", "directory_landing_page"],
]);
function directorySource(link) {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const [domain, kind] of DIRECTORY_DOMAINS) {
      if (host === domain || host.endsWith(`.${domain}`)) {
        url.hostname = `www.${domain}`;
        url.hash = "";
        if (domain === "yelp.com") {
          const match = url.pathname.match(/^\/biz\/[^/]+/i);
          if (!match) return null;
          url.pathname = match[0];
          url.search = "";
        } else if (["facebook.com", "instagram.com"].includes(domain)) {
          const segment = url.pathname.split("/").filter(Boolean)[0];
          if (!segment || ["share", "sharer", "plugins", "login"].includes(segment.toLowerCase()))
            return null;
          url.pathname = `/${segment}`;
          url.search = "";
        } else {
          for (const key of [...url.searchParams.keys()])
            if (/^(utm_|fbclid|gclid|ref|source)/i.test(key)) url.searchParams.delete(key);
        }
        return { url: url.href, kind, isPrimary: false };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function linksFromPages(pages) {
  const found = new Map();
  for (const page of pages) {
    for (const link of page.links ?? []) {
      const source = directorySource(link);
      if (source) found.set(source.url, source);
    }
  }
  return [...found.values()].slice(0, 20);
}

function pageText(page) {
  return [page.metadata?.title, page.metadata?.description, page.markdown]
    .filter(Boolean)
    .join("\n");
}
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function extractFacts(pages, terminalStatus) {
  const emails = [];
  const phones = [];
  const addresses = [];
  const serviceAreas = [];
  const services = [];
  const differentiators = [];
  const provenance = {
    emails: {},
    phones: {},
    addresses: {},
    serviceAreas: {},
    services: {},
    keyDifferentiators: {},
  };
  const cityNames = [
    "Reno",
    "Sparks",
    "Carson City",
    "Spanish Springs",
    "Sun Valley",
    "Incline Village",
    "Verdi",
    "Fernley",
    "Washoe County",
  ];
  const differentiatorPattern =
    /\b(family[- ]owned|locally owned|licensed|insured|bonded|certified|award[- ]winning|warranty|guarantee|24\s*\/\s*7|same[- ]day|emergency service|free estimates?|financing|years? of experience)\b/i;
  for (const page of pages) {
    const url = page.metadata?.sourceURL ?? page.metadata?.url ?? page.url ?? null;
    const text = pageText(page);
    for (const email of text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []) {
      const value = email.toLowerCase().replace(/[),.;:]+$/, "");
      emails.push(value);
      (provenance.emails[value] ??= []).push(url);
    }
    for (const match of text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) ?? []) {
      const digits = match.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      if (digits.length === 10) {
        const value = `+1${digits}`;
        phones.push(value);
        (provenance.phones[value] ??= []).push(url);
      }
    }
    for (const line of text
      .split(/\n+/)
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (
        /\b\d{1,6}\s+[A-Z0-9.' -]{2,60}\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|way|highway|hwy\.?|parkway|pkwy\.?)\b/i.test(
          line,
        ) &&
        /\bNV\b|Nevada/i.test(line)
      ) {
        const value = line.slice(0, 240);
        addresses.push({ value, sourceUrl: url });
        provenance.addresses[value] = [url];
      }
      if (differentiatorPattern.test(line) && line.length <= 300) {
        const value = line.replace(/^[-*#\s]+/, "");
        differentiators.push({ value, sourceUrl: url });
        provenance.keyDifferentiators[value] = [url];
      }
    }
    for (const city of cityNames)
      if (new RegExp(`\\b${city.replace(" ", "\\s+")}\\b`, "i").test(text)) {
        serviceAreas.push({ name: city, sourceUrl: url });
        (provenance.serviceAreas[city] ??= []).push(url);
      }
    const title = String(page.metadata?.title ?? "").trim();
    if (
      title &&
      !/^(home|contact|about|gallery|reviews?|blog)$/i.test(title) &&
      title.length <= 160
    ) {
      services.push({ name: title, sourceUrl: url });
      (provenance.services[title] ??= []).push(url);
    }
  }
  const cleanServices = [
    ...new Map(services.map((value) => [value.name.toLowerCase(), value])).values(),
  ].slice(0, 50);
  const cleanDifferentiators = [
    ...new Map(differentiators.map((value) => [value.value.toLowerCase(), value])).values(),
  ].slice(0, 50);
  const top = cleanServices[0] ?? null;
  return {
    emails: unique(emails).slice(0, 100),
    phones: unique(phones).slice(0, 100),
    addresses: [
      ...new Map(addresses.map((value) => [value.value.toLowerCase(), value])).values(),
    ].slice(0, 50),
    serviceAreas: [
      ...new Map(serviceAreas.map((value) => [value.name.toLowerCase(), value])).values(),
    ],
    services: cleanServices,
    keyDifferentiators: cleanDifferentiators,
    topServiceOffering: top
      ? { name: top.name, sourceUrl: top.sourceUrl, method: "first-specific-page-title" }
      : null,
    provenance,
    completenessScore: terminalStatus === "complete" ? 100 : pages.length ? 75 : 0,
  };
}

async function firecrawlBalance(apiKey) {
  return fetchJson(
    "https://api.firecrawl.dev/v2/team/credit-usage",
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "Firecrawl credit usage",
  );
}
async function collectFirecrawl(source, apiKey) {
  const operation = buildFirecrawlOperation(source, { websitePageLimit });
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const startedAt = new Date().toISOString();
  if (operation.endpoint.endsWith("/scrape")) {
    const response = await fetchJson(
      `https://api.firecrawl.dev${operation.endpoint}`,
      { method: "POST", headers, body: JSON.stringify(operation.body) },
      "Firecrawl scrape",
    );
    const page = response.data ?? response;
    return {
      jobId: null,
      pages: page ? [page] : [],
      creditsUsed: 1,
      total: page ? 1 : 0,
      completed: page ? 1 : 0,
      providerStatus: page ? "completed" : "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      operation,
      paginationDrained: true,
    };
  }
  const submitted = await fetchJson(
    `https://api.firecrawl.dev${operation.endpoint}`,
    { method: "POST", headers, body: JSON.stringify(operation.body) },
    "Firecrawl crawl submit",
  );
  if (!submitted.id) throw new Error("Firecrawl did not return a crawl id");
  const deadline = Date.now() + 45 * 60_000;
  let status;
  while (Date.now() < deadline) {
    status = await fetchJson(
      `https://api.firecrawl.dev/v2/crawl/${submitted.id}`,
      { headers },
      "Firecrawl crawl poll",
    );
    if (["completed", "failed", "cancelled"].includes(status.status)) break;
    await sleep(5_000);
  }
  if (!status || !["completed", "failed", "cancelled"].includes(status.status))
    throw new Error(`Firecrawl crawl ${submitted.id} timed out`);
  const pages = [...(status.data ?? [])];
  const seenNext = new Set();
  let next = status.next;
  while (next) {
    if (seenNext.has(next))
      throw new Error(`Firecrawl crawl ${submitted.id} repeated pagination URL`);
    seenNext.add(next);
    const part = await fetchJson(next, { headers }, "Firecrawl crawl pagination");
    pages.push(...(part.data ?? []));
    next = part.next;
  }
  return {
    jobId: submitted.id,
    pages,
    creditsUsed: Number(status.creditsUsed ?? pages.length),
    total: Number(status.total ?? pages.length),
    completed: Number(status.completed ?? pages.length),
    providerStatus: status.status,
    startedAt,
    finishedAt: new Date().toISOString(),
    operation,
    paginationDrained: !next,
  };
}

function failedFirecrawl(source, error) {
  const timestamp = new Date().toISOString();
  return {
    jobId: error?.firecrawlJobId ?? null,
    pages: [],
    creditsUsed: 0,
    total: 0,
    completed: 0,
    providerStatus: "failed",
    startedAt: timestamp,
    finishedAt: timestamp,
    operation: buildFirecrawlOperation(source, { websitePageLimit }),
    paginationDrained: true,
    error: String(error?.message ?? error).slice(0, 500),
  };
}

function captureReceipt(listing, source, result) {
  const pageArtifacts = result.pages.map((page, pageIndex) => {
    const providerSourceUrl = page.metadata?.sourceURL ?? page.metadata?.url ?? page.url ?? source.url;
    const sourceUrl = providerSourceUrl.replace(/^http:\/\//i, "https://");
    const artifact = losslessArtifact(page, {
      sourceUrl,
      title: page.metadata?.title ?? null,
      statusCode: page.metadata?.statusCode ?? null,
      description: page.metadata?.description ?? null,
    });
    return {
      page_index: pageIndex,
      source_url: sourceUrl,
      canonical_url: page.metadata?.url?.replace(/^http:\/\//i, "https://") ?? null,
      title: page.metadata?.title ?? null,
      http_status: page.metadata?.statusCode ?? null,
      captured_at: result.finishedAt,
      ...artifact,
    };
  });
  const failedPageCount =
    Math.max(0, result.total - result.completed) +
    result.pages.filter((page) => Number(page.metadata?.statusCode ?? 200) >= 400).length;
  const hitPageLimit = source.kind === "website" && result.pages.length >= websitePageLimit;
  const accessBlocked =
    result.pages.length === 0 ||
    result.pages.every((page) => [401, 403].includes(Number(page.metadata?.statusCode)));
  const completeness = assessCaptureCompleteness({
    sourceKind: source.kind,
    pageCount: result.pages.length,
    failedPageCount,
    hitPageLimit,
    paginationDrained: result.paginationDrained,
    providerStatus: result.providerStatus,
    accessBlocked,
  });
  const manifestSha256 = sha256(pageArtifacts.map((page) => page.content_sha256).join("\n"));
  const providerIdentity = result.jobId ?? sha256(`${source.kind}\n${source.url}`).slice(0, 32);
  return {
    schemaVersion: 1,
    listingId: listing.id,
    source,
    begin: {
      requested_listing_id: listing.id,
      requested_idempotency_key:
        `firecrawl:${providerIdentity}:${manifestSha256}`.slice(0, 200),
      requested_source_url: source.url,
      requested_source_kind: source.kind,
      requested_provider_job_id: result.jobId ?? "",
      requested_terminal_status: completeness.terminalStatus,
      requested_completeness_basis: completeness.completenessBasis,
      requested_expected_page_count: result.pages.length,
      requested_discovered_page_count: result.total,
      requested_failed_page_count: failedPageCount,
      requested_page_limit: source.kind === "website" ? websitePageLimit : 1,
      requested_hit_page_limit: hitPageLimit,
      requested_pagination_drained: result.paginationDrained,
      requested_robots_respected: true,
      requested_manifest_sha256: manifestSha256,
      requested_crawl_config: result.operation.body,
      requested_completeness_blockers: completeness.blockers,
      requested_credits_used: result.creditsUsed,
      requested_started_at: result.startedAt,
      requested_finished_at: result.finishedAt,
    },
    pages: pageArtifacts,
    finalize: {
      requested_extractor_version: "local775-deterministic-v1",
      requested_facts: extractFacts(result.pages, completeness.terminalStatus),
    },
    provider: {
      jobId: result.jobId,
      creditsUsed: result.creditsUsed,
      total: result.total,
      completed: result.completed,
      status: result.providerStatus,
    },
  };
}

function dataForSeoAuth() {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD)
    throw new Error("DataForSEO credentials are unavailable");
  return `Basic ${Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64")}`;
}
async function auditListing(listing, source, priorReceipt = null, persistPending = async () => {}) {
  const requestConfig =
    priorReceipt?.payload?.requested_request_config ??
    buildDataForSeoOnPageTask(source, { maxCrawlPages: websitePageLimit });
  const headers = { Authorization: dataForSeoAuth(), "Content-Type": "application/json" };
  const startedAt = priorReceipt?.payload?.requested_started_at ?? new Date().toISOString();
  let postRequest;
  let postResponse;
  let postedTask;
  let taskId;
  if (priorReceipt?.provider?.taskId) {
    postRequest = [requestConfig];
    taskId = priorReceipt.provider.taskId;
    postedTask = { id: taskId, cost: priorReceipt.provider.costUsd ?? 0 };
  } else {
    postRequest = [
      {
        ...requestConfig,
        target: new URL(source.url).hostname.replace(/^www\./, ""),
        start_url: source.url,
        accept_language: "en-US",
        crawl_delay: 500,
        store_raw_html: false,
      },
    ];
    postResponse = await fetchJson(
      "https://api.dataforseo.com/v3/on_page/task_post",
      { method: "POST", headers, body: JSON.stringify(postRequest) },
      "DataForSEO task post",
    );
    postedTask = postResponse.tasks?.[0];
    if (!postedTask?.id) throw new Error(`DataForSEO did not create a task for ${source.url}`);
    taskId = postedTask.id;
  }
  const priorTaskPost = priorReceipt?.payload?.requested_artifacts?.find(
    (artifact) => artifact.artifact_kind === "task_post",
  );
  const taskPostArtifact = priorTaskPost ?? {
    artifact_kind: "task_post",
    artifact_index: 0,
    ...losslessArtifact(
      { request: postRequest, response: postResponse },
      { taskId, statusCode: postedTask.status_code, cost: postedTask.cost ?? null },
    ),
  };
  if (!priorReceipt) {
    await persistPending({
      schemaVersion: 1,
      listingId: listing.id,
      source,
      payload: {
        requested_listing_id: listing.id,
        requested_request_config: postRequest[0],
        requested_started_at: startedAt,
        requested_artifacts: [taskPostArtifact],
        requested_terminal_status: "pending",
        requested_limitations: ["provider_task_in_progress"],
      },
      provider: { taskId, costUsd: Number(postedTask.cost ?? 0), crawlProgress: "pending" },
    });
  }
  const deadline = Date.now() + 60 * 60_000;
  let summaryResponse;
  let summaryResult;
  while (Date.now() < deadline) {
    summaryResponse = await fetchJson(
      `https://api.dataforseo.com/v3/on_page/summary/${taskId}`,
      { headers },
      "DataForSEO summary",
    );
    summaryResult = summaryResponse.tasks?.[0]?.result?.[0];
    if (summaryResult?.crawl_progress === "finished") break;
    const taskStatus = summaryResponse.tasks?.[0];
    const taskStatusCode = Number(taskStatus?.status_code ?? 0);
    const taskStatusMessage = String(taskStatus?.status_message ?? "");
    if (taskStatusCode >= 40000 && !/queue|progress/i.test(taskStatusMessage)) break;
    await sleep(15_000);
  }
  if (!summaryResult) summaryResult = {};
  const pageResponses = [];
  let searchAfterToken;
  for (let pageNumber = 0; pageNumber < 25; pageNumber += 1) {
    const request = { id: taskId, limit: 100 };
    if (searchAfterToken) request.search_after_token = searchAfterToken;
    const response = await fetchJson(
      "https://api.dataforseo.com/v3/on_page/pages",
      { method: "POST", headers, body: JSON.stringify([request]) },
      "DataForSEO pages",
    );
    pageResponses.push(response);
    const result = response.tasks?.[0]?.result?.[0];
    const items = result?.items ?? [];
    const nextToken = result?.search_after_token;
    if (!nextToken || items.length === 0 || nextToken === searchAfterToken) break;
    searchAfterToken = nextToken;
  }
  const crawledPages = Number(summaryResult.crawl_status?.pages_crawled ?? 0);
  const queue = Number(summaryResult.crawl_status?.pages_in_queue ?? 0);
  const limitations = [];
  if (summaryResult.crawl_progress !== "finished") limitations.push("crawl_not_finished");
  if (crawledPages === 0) limitations.push("zero_pages_crawled");
  if (crawledPages >= websitePageLimit || queue > 0)
    limitations.push("crawl_page_limit_or_queue_remaining");
  const terminalStatus =
    limitations.length === 0 ? "complete" : crawledPages ? "partial" : "failed";
  const artifacts = [
    taskPostArtifact,
    {
      artifact_kind: "task_status",
      artifact_index: 0,
      ...losslessArtifact(summaryResponse ?? {}, {
        crawlProgress: summaryResult.crawl_progress ?? null,
      }),
    },
    {
      artifact_kind: "summary",
      artifact_index: 0,
      ...losslessArtifact(summaryResponse ?? {}, summaryResult),
    },
    {
      artifact_kind: "pages",
      artifact_index: 0,
      ...losslessArtifact(pageResponses, { responseCount: pageResponses.length, crawledPages }),
    },
  ];
  const finishedAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    listingId: listing.id,
    source,
    payload: {
      requested_listing_id: listing.id,
      requested_capture_id: null,
      requested_idempotency_key: `dataforseo:${taskId}`,
      requested_target_url: source.url,
      requested_provider_task_id: taskId,
      requested_terminal_status: terminalStatus,
      requested_max_crawl_pages: websitePageLimit,
      requested_crawled_pages: crawledPages,
      requested_crawl_progress: summaryResult.crawl_progress ?? "unknown",
      requested_onpage_score: summaryResult.onpage_score ?? null,
      requested_cost_usd: Number(postedTask.cost ?? 0),
      requested_request_config: postRequest[0],
      requested_audit_summary: summaryResult,
      requested_limitations: limitations,
      requested_artifacts: artifacts,
      requested_started_at: startedAt,
      requested_finished_at: finishedAt,
    },
    provider: {
      taskId,
      costUsd: Number(postedTask.cost ?? 0),
      crawlProgress: summaryResult.crawl_progress ?? null,
      crawledPages,
    },
  };
}

async function mapConcurrent(items, limit, operation) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await operation(items[index], index);
    }
  });
  await Promise.all(workers);
}

await mkdir(outputRoot, { recursive: true });
const listings = JSON.parse(await readFile(inputPath, "utf8")).slice(0, listingLimit);
if (!Array.isArray(listings) || listings.some((listing) => !listing.id || !listing.website_url))
  throw new Error("inventory must be an array of listing id and website_url records");
const statePath = join(outputRoot, "state.json");
const state = await readFile(statePath, "utf8").then(JSON.parse, () => ({
  firecrawlCreditsUsed: 0,
  dataForSeoUsd: 0,
  completedCrawls: [],
  completedAudits: [],
  accountedFirecrawlKeys: [],
  accountedDataForSeoTaskIds: [],
}));
state.completedCrawls ??= [];
state.completedAudits ??= [];
state.accountedFirecrawlKeys ??= [];
state.accountedDataForSeoTaskIds ??= [];
const completedCrawls = new Set(state.completedCrawls);
const completedAudits = new Set(state.completedAudits);
const accountedFirecrawlKeys = new Set(state.accountedFirecrawlKeys);
const accountedDataForSeoTaskIds = new Set(state.accountedDataForSeoTaskIds);

if (["crawl", "all"].includes(stage)) {
  const firecrawlKey = await providerKey("FIRECRAWL_API_KEY", "firecrawl");
  if (!firecrawlKey) throw new Error("Firecrawl is not configured");
  const balance = await firecrawlBalance(firecrawlKey);
  const remaining = Number(balance.data?.remainingCredits ?? balance.remainingCredits ?? 0);
  if (remaining < Math.min(maxFirecrawlCredits - state.firecrawlCreditsUsed, listings.length))
    throw new Error("Firecrawl balance is insufficient for even one page per pending listing");
  await mapConcurrent(listings, concurrency, async (listing, index) => {
    if (completedCrawls.has(listing.id)) return;
    const listingRoot = join(
      outputRoot,
      "listings",
      `${String(index + 1).padStart(3, "0")}--${listing.id}`,
    );
    await mkdir(listingRoot, { recursive: true });
    const primary = normalizeListingSources(listing)[0];
    const primaryPath = join(listingRoot, `100-capture-${sha256(primary.url).slice(0, 12)}.json`);
    const registerPath = join(listingRoot, "000-register.json");
    let primaryReceipt;
    let websiteResult;
    if (await exists(primaryPath)) {
      primaryReceipt = JSON.parse(await readFile(primaryPath, "utf8"));
      websiteResult = { pages: primaryReceipt.pages };
    } else {
      if (state.firecrawlCreditsUsed + websitePageLimit > maxFirecrawlCredits)
        throw new Error("Firecrawl reservation would cross approved envelope");
      try {
        websiteResult = await collectFirecrawl(primary, firecrawlKey);
      } catch (error) {
        websiteResult = failedFirecrawl(primary, error);
      }
      primaryReceipt = captureReceipt(listing, primary, websiteResult);
      await atomicJson(primaryPath, primaryReceipt);
    }
    const primaryAccountingKey =
      primaryReceipt.provider.jobId ?? primaryReceipt.begin.requested_manifest_sha256;
    if (!accountedFirecrawlKeys.has(primaryAccountingKey)) {
      state.firecrawlCreditsUsed += Number(primaryReceipt.provider.creditsUsed ?? 0);
      accountedFirecrawlKeys.add(primaryAccountingKey);
      state.accountedFirecrawlKeys = [...accountedFirecrawlKeys];
      await atomicJson(statePath, state);
    }
    const priorRegistration = await readFile(registerPath, "utf8").then(JSON.parse, () => null);
    const discoveredSources = priorRegistration
      ? priorRegistration.requested_sources.filter((source) => !source.isPrimary)
      : linksFromPages(websiteResult.pages);
    const sources = [primary, ...discoveredSources].slice(0, 50);
    await atomicJson(registerPath, {
      requested_listing_id: listing.id,
      requested_sources: sources.map(({ url, kind, isPrimary }) => ({ url, kind, isPrimary })),
    });
    for (let sourceIndex = 0; sourceIndex < discoveredSources.length; sourceIndex += 1) {
      if (state.firecrawlCreditsUsed + 1 > maxFirecrawlCredits)
        throw new Error("Firecrawl envelope exhausted before directory landing pages");
      const source = discoveredSources[sourceIndex];
      const sourcePath = join(
        listingRoot,
        `${200 + sourceIndex}-capture-${sha256(source.url).slice(0, 12)}.json`,
      );
      let sourceReceipt;
      if (await exists(sourcePath)) {
        sourceReceipt = JSON.parse(await readFile(sourcePath, "utf8"));
      } else {
        let result;
        try {
          result = await collectFirecrawl(source, firecrawlKey);
        } catch (error) {
          result = failedFirecrawl(source, error);
        }
        sourceReceipt = captureReceipt(listing, source, result);
        await atomicJson(sourcePath, sourceReceipt);
      }
      const accountingKey =
        sourceReceipt.provider.jobId ?? sourceReceipt.begin.requested_manifest_sha256;
      if (!accountedFirecrawlKeys.has(accountingKey)) {
        state.firecrawlCreditsUsed += Number(sourceReceipt.provider.creditsUsed ?? 0);
        accountedFirecrawlKeys.add(accountingKey);
        state.accountedFirecrawlKeys = [...accountedFirecrawlKeys];
        await atomicJson(statePath, state);
      }
    }
    completedCrawls.add(listing.id);
    state.completedCrawls = [...completedCrawls];
    await atomicJson(statePath, state);
    await appendLedger({
      type: "listing_capture",
      listingId: listing.id,
      sourceCount: sources.length,
      websitePages: websiteResult.pages.length,
      firecrawlCreditsUsed: primaryReceipt.provider.creditsUsed,
      cumulativeFirecrawlCredits: state.firecrawlCreditsUsed,
    });
    process.stdout.write(
      `capture ${completedCrawls.size}/${listings.length} ${listing.id} ${websiteResult.pages.length} pages\n`,
    );
  });
}

if (["audit", "all"].includes(stage)) {
  const reservePerListing = websitePageLimit * 0.0018;
  if (listings.length * reservePerListing > maxDataForSeoUsd + 1e-9)
    throw new Error("DataForSEO worst-case estimate crosses approved envelope");
  await mapConcurrent(listings, Math.min(concurrency, 5), async (listing, index) => {
    const primary = normalizeListingSources(listing).find((source) => source.kind === "website");
    if (!primary) {
      completedAudits.add(listing.id);
      state.completedAudits = [...completedAudits];
      await atomicJson(statePath, state);
      return;
    }
    const listingRoot = join(
      outputRoot,
      "listings",
      `${String(index + 1).padStart(3, "0")}--${listing.id}`,
    );
    const auditPath = join(listingRoot, "900-seo-audit.json");
    const priorReceipt = await readFile(auditPath, "utf8").then(JSON.parse, () => null);
    if (
      priorReceipt &&
      ["complete", "partial", "failed"].includes(priorReceipt.payload?.requested_terminal_status) &&
      !priorReceipt.payload?.requested_limitations?.some((limitation) =>
        ["crawl_not_finished", "provider_task_in_progress"].includes(limitation),
      )
    ) {
      completedAudits.add(listing.id);
      state.completedAudits = [...completedAudits];
      return;
    }
    if (
      priorReceipt?.provider?.taskId &&
      completedAudits.has(listing.id) &&
      !accountedDataForSeoTaskIds.has(priorReceipt.provider.taskId)
    ) {
      accountedDataForSeoTaskIds.add(priorReceipt.provider.taskId);
      state.accountedDataForSeoTaskIds = [...accountedDataForSeoTaskIds];
    }
    const receipt = await auditListing(listing, primary, priorReceipt, (pending) =>
      atomicJson(auditPath, pending),
    );
    if (!accountedDataForSeoTaskIds.has(receipt.provider.taskId)) {
      if (state.dataForSeoUsd + receipt.provider.costUsd > maxDataForSeoUsd + 1e-9)
        throw new Error("DataForSEO returned cost crosses approved envelope");
      state.dataForSeoUsd += receipt.provider.costUsd;
      accountedDataForSeoTaskIds.add(receipt.provider.taskId);
      state.accountedDataForSeoTaskIds = [...accountedDataForSeoTaskIds];
    }
    await atomicJson(auditPath, receipt);
    completedAudits.add(listing.id);
    state.completedAudits = [...completedAudits];
    await atomicJson(statePath, state);
    await appendLedger({
      type: "listing_seo_audit",
      listingId: listing.id,
      dataForSeoTaskId: receipt.provider.taskId,
      dataForSeoCostUsd: receipt.provider.costUsd,
      crawledPages: receipt.provider.crawledPages,
      cumulativeDataForSeoUsd: state.dataForSeoUsd,
    });
    process.stdout.write(
      `audit ${completedAudits.size}/${listings.length} ${listing.id} ${receipt.provider.crawledPages} pages $${receipt.provider.costUsd.toFixed(6)}\n`,
    );
  });
}

await atomicJson(join(outputRoot, "summary.json"), {
  schemaVersion: 1,
  sourceInventory: basename(inputPath),
  listingCount: listings.length,
  stage,
  websitePageLimit,
  maxFirecrawlCredits,
  maxDataForSeoUsd,
  ...state,
  finishedAt: new Date().toISOString(),
});
process.stdout.write(
  `${JSON.stringify({ status: "complete", listingCount: listings.length, firecrawlCreditsUsed: state.firecrawlCreditsUsed, dataForSeoUsd: state.dataForSeoUsd })}\n`,
);
