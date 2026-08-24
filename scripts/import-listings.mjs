#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename, resolve } from "node:path";
import ExcelJS from "exceljs";
import {
  normalizeCellValue,
  rowReceipt,
  validateImportTarget,
} from "./import-listings-lib.mjs";
import { classifyListingRow } from "./listing-candidate.mjs";

const RAW_SHEET = /^businesses-89\d{3}$/;
const CHUNK_SIZE = 500;

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const expectedArg = argv.find((arg) => arg.startsWith("--expected-sha="));
  const workbookPath = argv.find((arg) => !arg.startsWith("--"));
  if (!workbookPath) {
    throw new Error("Usage: node scripts/import-listings.mjs workbook.xlsx [--apply --expected-sha=<sha256>]");
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
const [sourceSha256, workbook] = await Promise.all([
  sha256File(args.workbookPath),
  readRawRows(args.workbookPath),
]);
const plan = {
  mode: args.apply ? "apply" : "dry-run",
  sourceName: basename(args.workbookPath),
  sourceSha256,
  workbookRowCount: workbook.receipts.length,
  worksheets: workbook.sheetCounts,
  chunkSize: CHUNK_SIZE,
  chunks: Math.ceil(workbook.receipts.length / CHUNK_SIZE),
  candidateCount: workbook.candidates.length,
  candidateChunks: Math.ceil(workbook.candidates.length / CHUNK_SIZE),
  candidateMatrix: Object.values(
    workbook.candidates.reduce((matrix, candidate) => {
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
if (!/^[a-f0-9]{64}$/.test(args.expectedSha) || args.expectedSha !== sourceSha256) {
  throw new Error("--expected-sha must exactly match the workbook SHA-256 before apply.");
}

const target = validateImportTarget(process.env);
const batchId = await rpc(target, "register_source_batch", {
  requested_source_name: plan.sourceName,
  requested_source_sha256: sourceSha256,
  requested_workbook_row_count: plan.workbookRowCount,
  requested_imported_by: process.env.IMPORT_ACTOR?.trim() || "codex-project-lead",
  requested_notes: "Licensed Local775 seed workbook; immutable raw Preview staging.",
});
if (typeof batchId !== "string") throw new Error("Preview did not return a source batch id.");

let insertedThisRun = 0;
for (let offset = 0; offset < workbook.receipts.length; offset += CHUNK_SIZE) {
  const requestedRows = workbook.receipts.slice(offset, offset + CHUNK_SIZE);
  const inserted = await rpc(target, "ingest_source_rows", {
    requested_batch_id: batchId,
    requested_rows: requestedRows,
  });
  if (!Number.isInteger(inserted)) throw new Error("Preview returned an invalid inserted-row count.");
  insertedThisRun += inserted;
}

let candidatesInsertedThisRun = 0;
for (let offset = 0; offset < workbook.candidates.length; offset += CHUNK_SIZE) {
  const requestedCandidates = workbook.candidates.slice(offset, offset + CHUNK_SIZE);
  const inserted = await rpc(target, "ingest_listing_candidates", {
    requested_batch_id: batchId,
    requested_candidates: requestedCandidates,
  });
  if (!Number.isInteger(inserted)) throw new Error("Preview returned an invalid candidate count.");
  candidatesInsertedThisRun += inserted;
}

const status = await rpc(target, "source_batch_status", { requested_batch_id: batchId });
if (!status || status.complete !== true || status.stored_row_count !== plan.workbookRowCount) {
  throw new Error("Preview raw import did not reconcile to the workbook row count.");
}
const candidateStatus = await rpc(target, "listing_candidate_batch_status", {
  requested_batch_id: batchId,
});
if (!candidateStatus || candidateStatus.candidate_count !== plan.candidateCount) {
  throw new Error("Preview candidate import did not reconcile to the transformation count.");
}

console.log(JSON.stringify({
  ...plan,
  batchId,
  insertedThisRun,
  candidatesInsertedThisRun,
  status,
  candidateStatus,
}, null, 2));
