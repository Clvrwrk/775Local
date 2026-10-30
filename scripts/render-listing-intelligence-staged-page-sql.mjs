#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [operation, file, captureIdText, pageIndexText, chunkIndexText, chunkSizeText] =
  process.argv.slice(2);
const captureId = Number(captureIdText);
const pageIndex = Number(pageIndexText);
const chunkIndex = Number(chunkIndexText ?? 0);
const chunkSize = Number(chunkSizeText ?? 300000);
if (!operation || !file || !Number.isInteger(captureId) || captureId < 1 || !Number.isInteger(pageIndex))
  throw new Error("usage: OPERATION FILE CAPTURE_ID PAGE_INDEX [CHUNK_INDEX] [CHUNK_SIZE]");

const record = JSON.parse(await readFile(resolve(file), "utf8"));
const page = record.pages[pageIndex];
if (!page) throw new Error("page index is unavailable");
const encoded = Buffer.from(JSON.stringify(page), "utf8").toString("base64");
const sessionKey = `page:${captureId}:${pageIndex}:${createHash("sha256").update(encoded).digest("hex")}`;
const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;

if (operation === "meta") {
  process.stdout.write(`${JSON.stringify({ sessionKey, encodedLength: encoded.length, chunks: Math.ceil(encoded.length / chunkSize), chunkSize })}\n`);
} else if (operation === "chunk") {
  const chunk = encoded.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize);
  if (!chunk) throw new Error("chunk index is unavailable");
  process.stdout.write(
    `select public.stage_listing_intelligence_page_chunk(${sqlText(sessionKey)}, ${chunkIndex}, ${sqlText(chunk)});\n`,
  );
} else if (operation === "finalize") {
  process.stdout.write(
    `select public.finalize_listing_intelligence_staged_page(${captureId}::bigint, ${sqlText(sessionKey)});\n`,
  );
} else {
  throw new Error(`unknown operation: ${operation}`);
}
