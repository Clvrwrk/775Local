import { appendFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  categorySerpQueries,
  chooseBusinessResults,
  extractWebsiteEvidence,
  isCategoryRelevantResult,
  isEvidenceCompleteReceipt,
  normalizeResultUrl,
  planCategoryBatch,
  planReconciliationWindow,
  revalidateSearchResults,
  summarizeCurrentSearchReceipts,
} from "./serp-enrichment-lib.mjs";

const args = new Map(
  process.argv
    .slice(2)
    .map((value, index, all) =>
      value.startsWith("--")
        ? [value, all[index + 1]?.startsWith("--") ? true : all[index + 1]]
        : null,
    )
    .filter(Boolean),
);
const queuePath = args.get("--queue");
const outputRoot = args.get("--output");
const expectedOutputRoot =
  "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment";
const expectedQueuePath = `${expectedOutputRoot}/category-queue.json`;
const stage = args.get("--stage") ?? "all";
const batchSize = Number(args.get("--batch-size") ?? 20);
if (!queuePath || !outputRoot || !["search", "crawl", "all", "reconcile"].includes(stage)) {
  throw new Error(
    "usage: --queue PATH --output PATH [--stage search|crawl|all|reconcile] [--batch-size 1..20]",
  );
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20)
  throw new Error("invalid batch size");
if (queuePath !== expectedQueuePath || outputRoot !== expectedOutputRoot)
  throw new Error("queue and output must use the approved Local775 enrichment paths");

const queueReceipt = JSON.parse(await readFile(queuePath, "utf8"));
const progressPath = join(outputRoot, "progress.json");
const progress = await readFile(progressPath, "utf8").then(JSON.parse, () => ({
  completedPriorities: [],
}));
const completedPriorities = new Set(progress.completedPriorities ?? []);
const blockedPriorities = new Set(progress.blockedPriorities ?? []);
const effectiveQueue = queueReceipt.queue.map((entry) => ({
  ...entry,
  status:
    completedPriorities.has(entry.priority) || blockedPriorities.has(entry.priority)
      ? "complete"
      : "pending",
}));
const batch =
  stage === "reconcile"
    ? planReconciliationWindow(effectiveQueue, batchSize)
    : planCategoryBatch(effectiveQueue, batchSize);
if (batch.length === 0) {
  process.stdout.write(
    `${JSON.stringify({ status: blockedPriorities.size ? "terminal_with_shortfalls" : "complete", categoryCount: queueReceipt.categoryCount, blockedPriorities: [...blockedPriorities] })}\n`,
  );
  process.exit(0);
}
const batchId = `batch-${String(Math.ceil((batch[0]?.priority ?? 1) / batchSize)).padStart(2, "0")}`;
const batchRoot = join(outputRoot, batchId);
const listingsRoot = join(batchRoot, "listings");
const supersededListingsRoot = join(batchRoot, "superseded-listings");
await mkdir(listingsRoot, { recursive: true });

const atomicJson = async (path, value) => {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, path);
};
const appendLedger = async (event) =>
  appendFile(
    join(outputRoot, "provider-ledger.jsonl"),
    `${JSON.stringify({ recordedAt: new Date().toISOString(), ...event })}\n`,
    { mode: 0o600 },
  );
const exists = async (path) =>
  stat(path).then(
    () => true,
    () => false,
  );
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const authorization = () =>
  `Basic ${Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64")}`;
const FILTER_VERSION = "business-controlled-domain-v10";
let privateProviderConfig;

async function providerKey(envName, provider) {
  if (process.env[envName]) return process.env[envName];
  if (!privateProviderConfig) {
    const configPath = "/Users/chussey/.config/global-web-intel/config.json";
    const configStat = await stat(configPath);
    if ((configStat.mode & 0o077) !== 0)
      throw new Error("Global Web Intel config permissions must be owner-only (0600)");
    privateProviderConfig = JSON.parse(await readFile(configPath, "utf8"));
  }
  return privateProviderConfig.providers?.[provider]?.apiKey ?? null;
}

async function fetchJson(url, options, label) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`);
  return body;
}

async function dataForSeoTask(category, city, query, attempt = 1) {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD)
    throw new Error("DataForSEO credentials are unavailable");
  const body = await fetchJson(
    "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
    {
      method: "POST",
      headers: {
        Authorization: authorization(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword: `${query} ${city} NV`,
          location_name: `${city},Nevada,United States`,
          language_code: "en",
          device: "mobile",
          os: "android",
          depth: 100,
          tag: `cat-76-${category.slug}-${city.toLowerCase()}`,
        },
      ]),
    },
    "DataForSEO SERP",
  );
  const task = body.tasks?.[0];
  if (task?.status_code === 40101 && attempt < 4) {
    await appendLedger({
      type: "category_search_task_retry",
      categoryPriority: category.priority,
      categorySlug: category.slug,
      query,
      city,
      attempt,
      dataforseoTaskId: task.id ?? null,
      dataforseoCostUsd: task.cost == null ? null : Number(task.cost),
      statusCode: task.status_code,
      statusMessage: String(task.status_message ?? "no provider message").slice(0, 200),
      status: "retrying",
    });
    await sleep(2000 * attempt);
    return dataForSeoTask(category, city, query, attempt + 1);
  }
  if (task?.status_code !== 20000) {
    await appendLedger({
      type: "category_search_task_failure",
      categoryPriority: category.priority,
      categorySlug: category.slug,
      query,
      city,
      attempt,
      dataforseoTaskId: task?.id ?? null,
      dataforseoCostUsd: task?.cost == null ? null : Number(task.cost),
      statusCode: task?.status_code ?? null,
      statusMessage: String(task?.status_message ?? "no provider message").slice(0, 200),
      status: "failed",
    });
    throw new Error(
      `DataForSEO task failed with ${task?.status_code ?? "missing status"}: ${String(task?.status_message ?? "no provider message").slice(0, 200)}`,
    );
  }
  const items = task.result?.flatMap((result) => result.items ?? []) ?? [];
  return {
    taskId: task.id,
    costUsd: Number(task.cost ?? 0),
    checkUrl: task.result?.[0]?.check_url ?? null,
    query,
    city,
    results: chooseBusinessResults(
      items
        .map((item) => ({ ...item, serpCity: city }))
        .filter((item) => isCategoryRelevantResult(category, item)),
      20,
    ),
  };
}

async function dataForSeo(category) {
  const tasks = [];
  let results = [];
  for (const query of categorySerpQueries(category)) {
    for (const city of ["Reno", "Sparks"]) {
      if (results.length >= 20) break;
      const task = await dataForSeoTask(category, city, query);
      tasks.push(task);
      results = chooseBusinessResults([...results, ...task.results], 20);
    }
    if (results.length >= 20) break;
  }
  return {
    tasks: tasks.map(({ taskId, costUsd, checkUrl, query, city }) => ({
      taskId,
      costUsd,
      checkUrl,
      query,
      city,
    })),
    costUsd: tasks.reduce((sum, task) => sum + task.costUsd, 0),
    results,
  };
}

async function tavily(category) {
  const apiKey = await providerKey("TAVILY_API_KEY", "tavily");
  if (!apiKey) return { status: "not_configured", results: [] };
  const body = await fetchJson(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${category.query} businesses Reno Sparks Nevada`,
        search_depth: "advanced",
        max_results: 10,
        include_answer: false,
        include_raw_content: false,
      }),
    },
    "Tavily search",
  );
  return {
    status: "complete",
    responseTime: body.response_time ?? null,
    results: chooseBusinessResults(
      (body.results ?? []).map((item, index) => ({
        ...item,
        rank_group: index + 1,
      })),
      10,
    ),
  };
}

async function exa(category) {
  const apiKey = await providerKey("EXA_API_KEY", "exa");
  if (!apiKey) return { status: "not_configured", results: [] };
  const body = await fetchJson(
    "https://api.exa.ai/search",
    {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${category.query} businesses in Reno or Sparks Nevada`,
        type: "auto",
        numResults: 10,
        contents: { text: { maxCharacters: 1000 } },
      }),
    },
    "Exa search",
  );
  return {
    status: "complete",
    requestId: body.requestId ?? null,
    costUsd: body.costDollars?.total ?? null,
    results: chooseBusinessResults(
      (body.results ?? []).map((item, index) => ({
        ...item,
        rank_group: index + 1,
        description: item.text,
      })),
      10,
    ),
  };
}

async function runSearch() {
  for (const category of batch) {
    const path = join(batchRoot, `${category.slug}-search.json`);
    if (await exists(path)) {
      const prior = JSON.parse(await readFile(path, "utf8"));
      if (prior.filterVersion === FILTER_VERSION && prior.shortfall === 0) continue;
      if (prior.filterVersion && prior.filterVersion !== FILTER_VERSION) {
        const archivePath = join(batchRoot, `${category.slug}-search.${prior.filterVersion}.json`);
        if (!(await exists(archivePath))) await atomicJson(archivePath, prior);
        const revalidatedResults = revalidateSearchResults(category, prior.results, 20);
        if (revalidatedResults.length === 20 && Number(prior.shortfall ?? 0) === 0) {
          const revalidatedAt = new Date().toISOString();
          await atomicJson(path, {
            ...prior,
            filterVersion: FILTER_VERSION,
            revalidatedAt,
            revalidatedFromFilterVersion: prior.filterVersion,
            results: revalidatedResults,
          });
          await appendLedger({
            type: "category_search_revalidation",
            categoryPriority: category.priority,
            categorySlug: category.slug,
            fromFilterVersion: prior.filterVersion,
            toFilterVersion: FILTER_VERSION,
            providerCalls: 0,
            dataforseoCostUsd: 0,
            resultCount: revalidatedResults.length,
            status: "complete",
          });
          process.stdout.write(
            `${category.priority}\t${category.category}\t${revalidatedResults.length}\t$0.0000 revalidated\n`,
          );
          continue;
        }
      }
    }
    const [serp, tavilyResult, exaResult] = await Promise.all([
      dataForSeo(category),
      tavily(category),
      exa(category),
    ]);
    const corroboratingDomains = new Set(
      [...tavilyResult.results, ...exaResult.results].map((item) => item.domain),
    );
    const receipt = {
      schemaVersion: 1,
      filterVersion: FILTER_VERSION,
      category,
      researchedAt: new Date().toISOString(),
      providers: {
        dataforseo: { tasks: serp.tasks, costUsd: serp.costUsd },
        tavily: {
          status: tavilyResult.status,
          responseTime: tavilyResult.responseTime ?? null,
        },
        exa: {
          status: exaResult.status,
          requestId: exaResult.requestId ?? null,
          costUsd: exaResult.costUsd ?? null,
        },
      },
      limitations: [
        "Private research candidate only; not reviewed or publication eligible.",
        "Google rank is DataForSEO mobile organic rank; directories and social/search platforms are excluded.",
        "Provider results are snapshots, not a registry.",
      ],
      results: serp.results.map((item) => ({
        ...item,
        corroboratedBySemanticSearch: corroboratingDomains.has(item.domain),
      })),
      shortfall: Math.max(0, 20 - serp.results.length),
    };
    await atomicJson(path, receipt);
    await appendLedger({
      type: "category_search",
      categoryPriority: category.priority,
      categorySlug: category.slug,
      dataforseoCostUsd: serp.costUsd,
      dataforseoTasks: serp.tasks.map(({ taskId, costUsd, query, city }) => ({
        taskId,
        costUsd,
        query,
        city,
      })),
      exaCostUsd: exaResult.costUsd ?? null,
      tavilyStatus: tavilyResult.status,
      resultCount: serp.results.length,
      shortfall: receipt.shortfall,
    });
    process.stdout.write(
      `${category.priority}\t${category.category}\t${serp.results.length}\t$${serp.costUsd.toFixed(4)}\n`,
    );
  }
}

async function collectFirecrawlPages(url) {
  const apiKey = await providerKey("FIRECRAWL_API_KEY", "firecrawl");
  if (!apiKey) throw new Error("Firecrawl is not configured");
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const submitted = await fetchJson(
    "https://api.firecrawl.dev/v2/crawl",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        url,
        limit: 25,
        maxDiscoveryDepth: 3,
        crawlEntireDomain: true,
        allowSubdomains: false,
        allowExternalLinks: false,
        ignoreQueryParameters: true,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    },
    "Firecrawl submit",
  );
  if (!submitted.id) throw new Error("Firecrawl did not return a job id");
  try {
    const deadline = Date.now() + 12 * 60 * 1000;
    let status;
    while (Date.now() < deadline) {
      status = await fetchJson(
        `https://api.firecrawl.dev/v2/crawl/${submitted.id}`,
        { headers },
        "Firecrawl poll",
      );
      if (status.status === "completed") break;
      if (["failed", "cancelled"].includes(status.status))
        throw new Error(`Firecrawl job ${submitted.id} ${status.status}`);
      await sleep(3000);
    }
    if (status?.status !== "completed") throw new Error(`Firecrawl job ${submitted.id} timed out`);
    const pages = [...(status.data ?? [])];
    let next = status.next;
    while (next && pages.length < 25) {
      const page = await fetchJson(next, { headers }, "Firecrawl pagination");
      pages.push(...(page.data ?? []));
      next = page.next;
    }
    return {
      jobId: submitted.id,
      pages: pages.slice(0, 25),
      creditsUsed: status.creditsUsed ?? null,
      expiresAt: status.expiresAt ?? null,
    };
  } catch (error) {
    error.firecrawlJobId = submitted.id;
    throw error;
  }
}

async function mapConcurrent(items, concurrency, operation) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await operation(items[index]);
    }
  });
  await Promise.all(workers);
}

async function crawlResult(category, result) {
  const path = join(
    listingsRoot,
    `${category.slug}--${result.domain.replace(/[^a-z0-9.-]/g, "-")}.json`,
  );
  if (await exists(path)) {
    const prior = JSON.parse(await readFile(path, "utf8"));
    if (
      isEvidenceCompleteReceipt(prior) &&
      normalizeResultUrl(prior.serp?.url) === normalizeResultUrl(result.url)
    )
      return;
    if (isEvidenceCompleteReceipt(prior)) {
      await mkdir(supersededListingsRoot, { recursive: true });
      const fingerprint = createHash("sha256")
        .update(String(prior.serp?.url ?? "missing-url"))
        .digest("hex")
        .slice(0, 16);
      const archivePath = join(
        supersededListingsRoot,
        `${category.slug}--${result.domain.replace(/[^a-z0-9.-]/g, "-")}--${fingerprint}.json`,
      );
      if (!(await exists(archivePath))) await atomicJson(archivePath, prior);
    }
  }
  let crawl;
  try {
    crawl = await collectFirecrawlPages(result.url);
    if (crawl.pages.length === 0) throw new Error("Firecrawl returned zero pages");
    const receipt = {
      schemaVersion: 1,
      category: {
        priority: category.priority,
        name: category.category,
        slug: category.slug,
        group: category.group,
      },
      reviewStatus: "private_candidate",
      serp: result,
      crawl: {
        provider: "firecrawl",
        jobId: crawl.jobId,
        pageLimit: 25,
        pageCount: crawl.pages.length,
        hitPageLimit: crawl.pages.length === 25,
        creditsUsed: crawl.creditsUsed,
        expiresAt: crawl.expiresAt,
      },
      evidence: extractWebsiteEvidence(crawl.pages),
      missingFields: [],
      sourcePages: crawl.pages.map((page) => ({
        url: page.metadata?.sourceURL ?? page.url ?? null,
        title: page.metadata?.title ?? page.title ?? null,
        markdown: page.markdown ?? "",
      })),
      limitations: [
        "Automated enrichment only; human review is required before selection or publication.",
        "Website crawl is capped at 25 same-domain pages and may be incomplete because of robots.txt, authentication, JavaScript, or the page cap.",
      ],
    };
    for (const [field, value] of Object.entries({
      title: receipt.evidence.title,
      phone: receipt.evidence.phones[0],
      email: receipt.evidence.emails[0],
      hours: receipt.evidence.hoursEvidence,
    }))
      if (!value) receipt.missingFields.push(field);
    await atomicJson(path, receipt);
    await appendLedger({
      type: "website_crawl",
      categoryPriority: category.priority,
      categorySlug: category.slug,
      domain: result.domain,
      firecrawlJobId: crawl.jobId,
      firecrawlCreditsUsed: crawl.creditsUsed,
      pageCount: crawl.pages.length,
      status: "complete",
    });
    process.stdout.write(`${category.priority}\t${result.domain}\t${crawl.pages.length} pages\n`);
  } catch (error) {
    const failureRecordedAt = new Date().toISOString();
    const failureMessage = String(error.message).slice(0, 200);
    await atomicJson(path, {
      schemaVersion: 1,
      category: {
        priority: category.priority,
        name: category.category,
        slug: category.slug,
      },
      reviewStatus: "crawl_failed",
      serp: result,
      crawl: {
        provider: "firecrawl",
        jobId: crawl?.jobId ?? error.firecrawlJobId ?? null,
        pageLimit: 25,
        pageCount: crawl?.pages.length ?? 0,
        hitPageLimit: false,
        creditsUsed: crawl?.creditsUsed ?? null,
        expiresAt: crawl?.expiresAt ?? null,
      },
      error: failureMessage,
      failedAt: failureRecordedAt,
    });
    await appendLedger({
      type: "website_crawl",
      categoryPriority: category.priority,
      categorySlug: category.slug,
      domain: result.domain,
      firecrawlJobId: crawl?.jobId ?? error.firecrawlJobId ?? null,
      firecrawlCreditsUsed: crawl?.creditsUsed ?? null,
      pageCount: crawl?.pages.length ?? 0,
      status: "failed",
      error: failureMessage,
      failureRecordedAt,
    });
    process.stderr.write(`${category.priority}\t${result.domain}\tFAILED ${failureMessage}\n`);
  }
}

async function runCrawl() {
  for (const category of batch) {
    const searchPath = join(batchRoot, `${category.slug}-search.json`);
    if (!(await exists(searchPath)))
      throw new Error(`missing search receipt for ${category.category}`);
    const search = JSON.parse(await readFile(searchPath, "utf8"));
    await mapConcurrent(search.results, 4, (result) => crawlResult(category, result));
  }
}

if (["search", "all"].includes(stage)) await runSearch();
if (["crawl", "all"].includes(stage)) await runCrawl();
const categorySummaries = [];
if (["crawl", "all", "reconcile"].includes(stage)) {
  const listingFiles = await readdir(listingsRoot);
  for (const category of batch) {
    const search = JSON.parse(
      await readFile(join(batchRoot, `${category.slug}-search.json`), "utf8"),
    );
    const receipts = await Promise.all(
      listingFiles
        .filter((name) => name.startsWith(`${category.slug}--`) && name.endsWith(".json"))
        .map((name) => readFile(join(listingsRoot, name), "utf8").then(JSON.parse)),
    );
    const receiptSummary = summarizeCurrentSearchReceipts(search, receipts, {
      expectedFilterVersion: FILTER_VERSION,
    });
    categorySummaries.push({
      priority: category.priority,
      category: category.category,
      slug: category.slug,
      ...receiptSummary,
    });
    if (receiptSummary.complete) completedPriorities.add(category.priority);
    else completedPriorities.delete(category.priority);
    if (receiptSummary.blocked) blockedPriorities.add(category.priority);
    else blockedPriorities.delete(category.priority);
  }
  await atomicJson(progressPath, {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    completedPriorities: [...completedPriorities].sort((a, b) => a - b),
    blockedPriorities: [...blockedPriorities].sort((a, b) => a - b),
    completedCategoryCount: completedPriorities.size,
    blockedCategoryCount: blockedPriorities.size,
    categoryCount: queueReceipt.categoryCount,
  });
}
const summary = {
  schemaVersion: 1,
  batchId,
  generatedAt: new Date().toISOString(),
  categories:
    categorySummaries.length > 0
      ? categorySummaries
      : batch.map(({ priority, category, slug }) => ({ priority, category, slug })),
  stage,
  outputRoot: batchRoot,
};
await atomicJson(join(batchRoot, "run-summary.json"), summary);
process.stdout.write(`${JSON.stringify(summary)}\n`);
