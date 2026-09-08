#!/usr/bin/env node
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const output = resolve(process.argv[2] ?? "artifacts/listing-intelligence/inventory.json");
const baseUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!baseUrl || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");
const url = new URL("/rest/v1/directory_listings", baseUrl);
url.searchParams.set("select", "id,website_url,display_name,primary_category_name");
url.searchParams.set("website_url", "not.is.null");
url.searchParams.set("order", "id.asc");
url.searchParams.set("limit", "1000");
const response = await fetch(url, {
  headers: { apikey: key, authorization: `Bearer ${key}` },
  signal: AbortSignal.timeout(120_000),
});
if (!response.ok) throw new Error(`Preview inventory request failed with HTTP ${response.status}`);
const rows = await response.json();
if (!Array.isArray(rows) || rows.length === 0) throw new Error("Preview inventory is empty");
const listings = rows.map((row) => ({
  id: row.id,
  website_url: row.website_url,
  display_name: row.display_name,
  primary_category_name: row.primary_category_name,
  source_urls: [],
}));
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
await writeFile(temporary, `${JSON.stringify(listings, null, 2)}\n`, { mode: 0o600 });
await rename(temporary, output);
process.stdout.write(`${JSON.stringify({ output, listingCount: listings.length })}\n`);
