#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { estimateListingIntelligenceBudget } from "./listing-intelligence-lib.mjs";

const args = process.argv.slice(2);
const input = args.find((argument) => !argument.startsWith("--"));
const pageLimit = Number(
  args.find((argument) => argument.startsWith("--website-page-limit="))?.split("=")[1] ?? 500,
);
if (!input) {
  throw new Error(
    "Usage: node scripts/plan-listing-intelligence.mjs <listing-sources.json> [--website-page-limit=500]",
  );
}
const listings = JSON.parse(await readFile(resolve(input), "utf8"));
if (!Array.isArray(listings))
  throw new Error("Input must be a JSON array of Listing source records.");
const estimate = estimateListingIntelligenceBudget(listings, { websitePageLimit: pageLimit });
console.log(
  JSON.stringify(
    { mode: "plan-only", providerCalls: false, databaseWrites: false, ...estimate },
    null,
    2,
  ),
);
