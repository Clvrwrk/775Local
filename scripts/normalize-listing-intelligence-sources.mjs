#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const inputRoot = resolve(process.argv[2] ?? "artifacts/listing-intelligence/pilot");
const listingsRoot = join(inputRoot, "listings");
const supersededRoot = join(inputRoot, "superseded-captures");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const domains = new Map([
  ["facebook.com", "facebook"], ["yelp.com", "yelp"], ["houzz.com", "houzz"],
  ["instagram.com", "other"], ["bbb.org", "directory_landing_page"],
  ["angi.com", "directory_landing_page"], ["homeadvisor.com", "directory_landing_page"],
  ["thumbtack.com", "directory_landing_page"], ["tripadvisor.com", "directory_landing_page"],
  ["nextdoor.com", "directory_landing_page"],
]);

function normalize(link, fallbackKind) {
  const url = new URL(link);
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const match = [...domains].find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  if (!match) return { url: url.href, kind: fallbackKind, isPrimary: false };
  const [domain, kind] = match;
  url.hostname = `www.${domain}`;
  url.hash = "";
  if (domain === "yelp.com") {
    const business = url.pathname.match(/^\/biz\/[^/]+/i);
    if (business) url.pathname = business[0];
    url.search = "";
  } else if (["facebook.com", "instagram.com"].includes(domain)) {
    const segment = url.pathname.split("/").filter(Boolean)[0];
    if (segment) url.pathname = `/${segment}`;
    url.search = "";
  } else {
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_|fbclid|gclid|ref|source)/i.test(key)) url.searchParams.delete(key);
  }
  return { url: url.href, kind, isPrimary: false };
}

let kept = 0;
let superseded = 0;
for (const directory of (await readdir(listingsRoot)).sort()) {
  const directoryPath = join(listingsRoot, directory);
  const files = (await readdir(directoryPath)).filter((file) => file.includes("-capture-")).sort();
  const registrationPath = join(directoryPath, "000-register.json");
  const registration = JSON.parse(await readFile(registrationPath, "utf8"));
  const primary = registration.requested_sources.find((source) => source.isPrimary);
  const seen = new Set();
  const sources = [primary];
  for (const file of files) {
    const path = join(directoryPath, file);
    const receipt = JSON.parse(await readFile(path, "utf8"));
    for (const page of receipt.pages ?? []) {
      page.source_url = page.source_url.replace(/^http:\/\//i, "https://");
      if (page.canonical_url) page.canonical_url = page.canonical_url.replace(/^http:\/\//i, "https://");
    }
    if (receipt.source?.isPrimary) {
      await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
      continue;
    }
    const source = normalize(receipt.begin.requested_source_url, receipt.begin.requested_source_kind);
    if (seen.has(source.url)) {
      const destinationRoot = join(supersededRoot, directory);
      await mkdir(destinationRoot, { recursive: true });
      await rename(path, join(destinationRoot, file));
      superseded += 1;
      continue;
    }
    seen.add(source.url);
    sources.push(source);
    receipt.source = source;
    receipt.begin.requested_source_url = source.url;
    receipt.begin.requested_source_kind = source.kind;
    if (!receipt.provider?.jobId) {
      const identity = sha256(`${source.kind}\n${source.url}`).slice(0, 32);
      receipt.begin.requested_idempotency_key =
        `firecrawl:${identity}:${receipt.begin.requested_manifest_sha256}`.slice(0, 200);
    }
    await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    kept += 1;
  }
  registration.requested_sources = sources;
  await writeFile(registrationPath, `${JSON.stringify(registration, null, 2)}\n`, { mode: 0o600 });
}

console.log(JSON.stringify({ listingsRoot, kept, superseded, supersededRoot }, null, 2));
