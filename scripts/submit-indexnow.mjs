import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const host = "775directory.com";
const key = "738605bcc41cbc13f8943448c1bdae49";
const keyLocation = `https://${host}/${key}.txt`;
const endpoint = "https://api.indexnow.org/indexnow";

/** Extract the canonical 775Directory URLs from the static production sitemap. */
export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>(https:\/\/775directory\.com\/[^<]*)<\/loc>/g)].map(
    (match) => match[1],
  );
}

/** Build the bounded IndexNow payload, refusing an empty URL set. */
export function indexNowPayload(urlList) {
  if (!Array.isArray(urlList) || urlList.length === 0) {
    throw new Error("The production sitemap did not contain any canonical URLs.");
  }

  return { host, key, keyLocation, urlList };
}

/** Submit one bounded URL set and always return a durable, no-secret receipt. */
export async function submitIndexNow(
  urlList,
  { fetchImpl = globalThis.fetch, now = () => new Date() } = {},
) {
  const payload = indexNowPayload(urlList);
  const baseReceipt = {
    submittedAt: now().toISOString(),
    endpoint,
    host,
    keyLocation,
    urlCount: payload.urlList.length,
    urlList: payload.urlList,
  };

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const responseBody = await response.text();

    return {
      ...baseReceipt,
      status: response.status,
      accepted: response.status === 200 || response.status === 202,
      responseBody: responseBody || null,
      failure: null,
    };
  } catch {
    return {
      ...baseReceipt,
      status: null,
      accepted: false,
      responseBody: null,
      failure: "request_or_response_read_failed",
    };
  }
}

/** Read and validate the sitemap while retaining a receipt for pre-request failures. */
export async function runIndexNowSubmission({
  readFileImpl = readFile,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  try {
    const sitemap = await readFileImpl(new URL("../public/sitemap.xml", import.meta.url), "utf8");
    return await submitIndexNow(sitemapUrls(sitemap), { fetchImpl, now });
  } catch {
    return {
      submittedAt: now().toISOString(),
      endpoint,
      host,
      keyLocation,
      urlCount: 0,
      urlList: [],
      status: null,
      accepted: false,
      responseBody: null,
      failure: "sitemap_read_or_validation_failed",
    };
  }
}

/** Read the repository sitemap, submit it, print the receipt, and set the exit status. */
async function main() {
  const receipt = await runIndexNowSubmission();
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.accepted) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
