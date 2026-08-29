import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const host = "775directory.com";
const key = "738605bcc41cbc13f8943448c1bdae49";
const keyLocation = `https://${host}/${key}.txt`;
const endpoint = "https://api.indexnow.org/indexnow";

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>(https:\/\/775directory\.com\/[^<]*)<\/loc>/g)].map(
    (match) => match[1],
  );
}

export function indexNowPayload(urlList) {
  if (!Array.isArray(urlList) || urlList.length === 0) {
    throw new Error("The production sitemap did not contain any canonical URLs.");
  }

  return { host, key, keyLocation, urlList };
}

async function main() {
  const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  const payload = indexNowPayload(sitemapUrls(sitemap));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.text();
  const receipt = {
    submittedAt: new Date().toISOString(),
    endpoint,
    host,
    keyLocation,
    urlCount: payload.urlList.length,
    urlList: payload.urlList,
    status: response.status,
    accepted: response.status === 200 || response.status === 202,
    responseBody: responseBody || null,
  };

  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.accepted) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
