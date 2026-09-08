#!/usr/bin/env node
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const inputRoot = resolve(args.get("--input") ?? "artifacts/listing-intelligence/pilot");
const envFile = resolve(args.get("--env-file") ?? "/private/tmp/local775-preview.env");
const concurrency = Math.max(1, Number(args.get("--concurrency") ?? 3));
const statePath = join(inputRoot, "preview-import-state.json");

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value.replaceAll("\\n", "\n");
  }
  return values;
}

const env = parseEnv(await readFile(envFile, "utf8"));
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Preview SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}
if (!new URL(supabaseUrl).hostname.startsWith("dpxeldzunfxmjahgvjhm.")) {
  throw new Error(`refusing non-Preview Supabase target: ${new URL(supabaseUrl).hostname}`);
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

let state;
try {
  state = await loadJson(statePath);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  state = { version: 1, target: new URL(supabaseUrl).hostname, listings: {} };
}

let stateWrite = Promise.resolve();
function saveState() {
  stateWrite = stateWrite.then(async () => {
    await mkdir(dirname(statePath), { recursive: true });
    const temporary = `${statePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, statePath);
  });
  return stateWrite;
}

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function rpc(functionName, payload, { allowFinalized = false } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      if (response.ok) return text ? JSON.parse(text) : null;
      if (allowFinalized && response.status === 400 && text.includes("unavailable for ingestion")) {
        return { alreadyFinalized: true };
      }
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`${functionName} HTTP ${response.status}: ${text.slice(0, 1000)}`);
      }
      lastError = new Error(`${functionName} HTTP ${response.status}: ${text.slice(0, 1000)}`);
    } catch (error) {
      lastError = error;
      if (String(error.message).includes("HTTP 4") && !String(error.message).includes("HTTP 408") && !String(error.message).includes("HTTP 429")) {
        throw error;
      }
    }
    await wait(Math.min(30_000, 750 * 2 ** (attempt - 1)));
  }
  throw lastError;
}

function pageBatches(pages) {
  const batches = [];
  let current = [];
  let currentBytes = 2;
  for (const page of pages) {
    const pageBytes = Buffer.byteLength(JSON.stringify(page), "utf8") + 1;
    if (current.length && (current.length >= 25 || currentBytes + pageBytes > 1_500_000)) {
      batches.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(page);
    currentBytes += pageBytes;
  }
  if (current.length) batches.push(current);
  return batches;
}

async function importListing(directory, ordinal, total) {
  const directoryPath = join(inputRoot, "listings", directory);
  const files = (await readdir(directoryPath)).sort();
  const registration = await loadJson(join(directoryPath, "000-register.json"));
  const listingId = registration.requested_listing_id;
  const listingState = (state.listings[listingId] ??= {
    directory,
    captures: {},
    registered: false,
    audit: false,
    complete: false,
  });
  if (listingState.complete) {
    console.log(`import ${ordinal}/${total} ${listingId} already complete`);
    return;
  }

  await rpc("register_listing_intelligence_sources", registration);
  listingState.registered = true;
  await saveState();

  let primaryCaptureId = null;
  const captureFiles = files.filter((file) => file.includes("-capture-") && file.endsWith(".json"));
  for (const captureFile of captureFiles) {
    const receipt = await loadJson(join(directoryPath, captureFile));
    const captureState = (listingState.captures[captureFile] ??= {});
    const captureId = await rpc("begin_listing_source_capture", receipt.begin);
    captureState.captureId = Number(captureId);
    if (receipt.begin.requested_source_kind === "website") primaryCaptureId = Number(captureId);
    await saveState();

    if (!captureState.finalized) {
      let alreadyFinalized = false;
      const batches = pageBatches(receipt.pages ?? []);
      for (let batchIndex = captureState.nextBatch ?? 0; batchIndex < batches.length; batchIndex += 1) {
        const result = await rpc(
          "ingest_listing_source_capture_pages",
          { requested_capture_id: Number(captureId), requested_pages: batches[batchIndex] },
          { allowFinalized: true },
        );
        if (result?.alreadyFinalized) {
          alreadyFinalized = true;
          break;
        }
        captureState.nextBatch = batchIndex + 1;
        await saveState();
      }
      if (!alreadyFinalized) {
        const facts = structuredClone(receipt.finalize.requested_facts);
        if (facts.topServiceOffering == null) delete facts.topServiceOffering;
        await rpc("finalize_listing_source_capture", {
          requested_capture_id: Number(captureId),
          requested_extractor_version: receipt.finalize.requested_extractor_version,
          requested_facts: facts,
        });
      }
      captureState.finalized = true;
      await saveState();
    }
  }

  const auditFile = files.find((file) => file === "900-seo-audit.json");
  if (auditFile && !listingState.audit) {
    const audit = await loadJson(join(directoryPath, auditFile));
    const payload = { ...audit.payload };
    if (payload.requested_terminal_status !== "pending") {
      if (primaryCaptureId) payload.requested_capture_id = primaryCaptureId;
      await rpc("record_listing_seo_audit", payload);
      listingState.audit = true;
      await saveState();
    }
  }

  listingState.complete = Boolean(auditFile && listingState.audit);
  await saveState();
  console.log(`import ${ordinal}/${total} ${listingId} captures=${captureFiles.length} audit=${Boolean(auditFile)}`);
}

const listingRoot = join(inputRoot, "listings");
const directories = (await readdir(listingRoot)).sort();
let cursor = 0;
async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= directories.length) return;
    await importListing(directories[index], index + 1, directories.length);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
await stateWrite;
const complete = Object.values(state.listings).filter((listing) => listing.complete).length;
console.log(JSON.stringify({ target: state.target, listings: directories.length, complete }, null, 2));
