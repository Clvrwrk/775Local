#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildSerpSeed } from "./seed-materialization-lib.mjs";

const root = resolve(process.argv[2] ?? "");
if (!process.argv[2])
  throw new Error("Usage: node scripts/build-serp-seed.mjs <serp-enrichment-root> [--out=<path>]");
const result = await buildSerpSeed(root);
const out = process.argv.find((argument) => argument.startsWith("--out="))?.slice(6);
const counts = Object.groupBy(result.listings, (listing) => listing.contentTier);
const summary = {
  receiptSha256: result.receiptSha256,
  listingCount: result.listings.length,
  categoryCount: new Set(result.listings.map((listing) => listing.categorySlug)).size,
  tiers: Object.fromEntries(Object.entries(counts).map(([tier, rows]) => [tier, rows.length])),
  partialEvidenceCount: result.listings.filter((listing) => listing.evidenceStatus === "partial")
    .length,
};
if (out) await writeFile(resolve(out), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(summary, null, 2));
