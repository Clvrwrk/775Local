#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import ExcelJS from "exceljs";
import { readDataForSeoRenoCorpus } from "./dataforseo-corpus.mjs";
import { applyReviewOnlyImport } from "./import-apply-lib.mjs";
import { normalizeCellValue, rowReceipt, validateImportTarget } from "./import-listings-lib.mjs";
import { classifyListingRow } from "./listing-candidate.mjs";

const RAW_SHEET = /^businesses-89\d{3}$/;
const CHUNK_SIZE = 500;

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const expectedArg = argv.find((arg) => arg.startsWith("--expected-sha="));
  const workbookPath = argv.find((arg) => !arg.startsWith("--"));
  if (!workbookPath) {
    throw new Error(
      "Usage: node scripts/import-listings.mjs <workbook.xlsx|DataForSEO-corpus-directory> [--apply --expected-sha=<sha256>]",
    );
  }
  return {
    apply,
    expectedSha: expectedArg?.slice("--expected-sha=".length) ?? "",
    workbookPath: resolve(workbookPath),
  };
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function readRawRows(path) {
  const receipts = [];
  const candidates = [];
  const sheetCounts = {};
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, {
    entries: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
    worksheets: "emit",
  });

  for await (const worksheet of reader) {
    if (!RAW_SHEET.test(worksheet.name)) continue;
    let headers = [];
    let count = 0;
    for await (const row of worksheet) {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      if (row.number === 1) {
        headers = values.map((value) => String(normalizeCellValue(value) ?? "").trim());
        continue;
      }
      if (values.every((value) => value == null || value === "")) continue;
      const rawPayload = {};
      for (const [index, header] of headers.entries()) {
        if (!header) continue;
        rawPayload[header] = normalizeCellValue(values[index]);
      }
      receipts.push(rowReceipt(worksheet.name, row.number, rawPayload));
      const candidate = classifyListingRow(worksheet.name, row.number, rawPayload);
      if (candidate) candidates.push(candidate);
      count += 1;
    }
    sheetCounts[worksheet.name] = count;
  }

  if (Object.keys(sheetCounts).length !== 7) {
    throw new Error(`Expected 7 raw ZIP worksheets; found ${Object.keys(sheetCounts).length}.`);
  }
  return { receipts, candidates, sheetCounts };
}

async function readImportSource(path) {
  const details = await stat(path);
  if (details.isDirectory()) return readDataForSeoRenoCorpus(path);
  const [sourceSha256, workbook] = await Promise.all([sha256File(path), readRawRows(path)]);
  return {
    sourceType: "licensed-seven-sheet-workbook",
    sourceName: basename(path),
    sourceSha256,
    artifacts: [
      {
        kind: "workbook",
        path: basename(path),
        sha256: sourceSha256,
        rowCount: workbook.receipts.length,
      },
    ],
    ...workbook,
  };
}

async function rpc(target, name, body) {
  const response = await fetch(new URL(`/rest/v1/rpc/${name}`, target.url), {
    method: "POST",
    headers: {
      apikey: target.serviceRoleKey,
      Authorization: `Bearer ${target.serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Preview import RPC ${name} failed with HTTP ${response.status}.`);
  }
  return response.json();
}

const args = parseArgs(process.argv.slice(2));
const source = await readImportSource(args.workbookPath);
const plan = {
  mode: args.apply ? "apply" : "dry-run",
  sourceType: source.sourceType,
  sourceName: source.sourceName,
  sourceSha256: source.sourceSha256,
  sourceRowCount: source.receipts.length,
  worksheets: source.sheetCounts,
  artifacts: source.artifacts,
  chunkSize: CHUNK_SIZE,
  chunks: Math.ceil(source.receipts.length / CHUNK_SIZE),
  candidateCount: source.candidates.length,
  candidateChunks: Math.ceil(source.candidates.length / CHUNK_SIZE),
  destinationBoundary: "immutable raw staging and private listing candidate review queue only",
  canonicalListingWrites: false,
  candidateMatrix: Object.values(
    source.candidates.reduce((matrix, candidate) => {
      const key = `${candidate.city_slug}:${candidate.launch_category_slug}`;
      matrix[key] ??= {
        city: candidate.city_slug,
        category: candidate.launch_category_slug,
        candidates: 0,
        eligible: 0,
        needsReview: 0,
        ineligible: 0,
      };
      matrix[key].candidates += 1;
      if (candidate.screening_status === "eligible") matrix[key].eligible += 1;
      if (candidate.screening_status === "needs_review") matrix[key].needsReview += 1;
      if (candidate.screening_status === "ineligible") matrix[key].ineligible += 1;
      return matrix;
    }, {}),
  ).sort((a, b) => `${a.city}:${a.category}`.localeCompare(`${b.city}:${b.category}`)),
};

if (!args.apply) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
if (!/^[a-f0-9]{64}$/.test(args.expectedSha) || args.expectedSha !== source.sourceSha256) {
  throw new Error("--expected-sha must exactly match the source SHA-256 before apply.");
}

const target = validateImportTarget(process.env);
const applied = await applyReviewOnlyImport({
  target,
  sourceName: source.sourceName,
  sourceSha256: source.sourceSha256,
  receipts: source.receipts,
  candidates: source.candidates,
  importedBy: process.env.IMPORT_ACTOR?.trim() || "codex-project-lead",
  notes: JSON.stringify({
    sourceType: source.sourceType,
    scope:
      source.sourceType === "dataforseo-reno-json-corpus"
        ? "CLE-73 four-ZIP Reno corpus; exclusions preserved; no canonical listing writes"
        : "Licensed Local775 seed workbook; immutable raw Preview staging",
    artifacts: source.artifacts,
  }),
  rpc,
  chunkSize: CHUNK_SIZE,
});

console.log(
  JSON.stringify(
    {
      ...plan,
      ...applied,
    },
    null,
    2,
  ),
);
