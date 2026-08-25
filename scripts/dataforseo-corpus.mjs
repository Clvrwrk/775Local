import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { rowReceipt } from "./import-listings-lib.mjs";
import { classifyListingRow } from "./listing-candidate.mjs";

export const DATAFORSEO_RENO_ZIPS = Object.freeze(["89502", "89509", "89511", "89521"]);

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function readJson(path) {
  let value;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not parse ${path}: ${error.message}`);
  }
  return value;
}

function sourceIdentity(row) {
  const value = row?.cid ?? row?.place_id ?? row?.feature_id;
  return value == null ? "" : String(value).trim();
}

function manifestZip(manifest) {
  if (manifest.target_zip) return String(manifest.target_zip);
  const filters = manifest.query?.filters;
  if (!Array.isArray(filters)) return "";
  const zipFilter = filters.find((item) => Array.isArray(item) && item[0] === "address_info.zip");
  return zipFilter ? String(zipFilter[2]) : "";
}

function qualifiedCount(manifest) {
  return Number(manifest.qualified_records ?? manifest.qualified_reno_89502_records);
}

function assertBusinessRow(row, zip, kind) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error(`${zip} ${kind} row must be an object.`);
  }
  if (!sourceIdentity(row)) throw new Error(`${zip} ${kind} row lacks a stable provider identity.`);
  if (String(row.address_info?.zip ?? "") !== zip) {
    throw new Error(`${zip} ${kind} row has the wrong ZIP.`);
  }
  if (String(row.address_info?.country_code ?? "").toUpperCase() !== "US") {
    throw new Error(`${zip} ${kind} row has the wrong country.`);
  }
  const city = String(row.address_info?.city ?? "")
    .trim()
    .toLowerCase();
  if (kind === "included" && city !== "reno") {
    throw new Error(`${zip} included row must be Reno.`);
  }
  if (kind === "excluded-city-mismatch" && city === "reno") {
    throw new Error(`${zip} excluded city-mismatch row is labeled Reno.`);
  }
}

function candidateInput(row) {
  const sourceCategory = String(row.category ?? "").toLowerCase();
  const inferredGroup = /(restaurant|cafe|coffee shop|diner|food court|bakery|bar & grill)/.test(
    sourceCategory,
  )
    ? "Restaurants & Food"
    : null;
  return {
    ...row,
    street_address: row.street_address ?? row.address_info?.address ?? null,
    city: row.city ?? row.address_info?.city ?? null,
    zip: row.zip ?? row.address_info?.zip ?? null,
    rating_value: row.rating_value ?? row.rating?.value ?? null,
    rating_votes_count: row.rating_votes_count ?? row.rating?.votes_count ?? null,
    group: row.group ?? inferredGroup,
  };
}

/**
 * Read the four saved Reno exports without making a provider request.
 * Excluded city mismatches remain immutable raw rows but never become candidates.
 * @param {string} corpusRoot
 */
export async function readDataForSeoRenoCorpus(corpusRoot) {
  const receipts = [];
  const candidates = [];
  const artifacts = [];
  const sheetCounts = {};
  const identities = new Set();

  for (const zip of DATAFORSEO_RENO_ZIPS) {
    const folder = `dataforseo-reno-${zip}`;
    const definitions = [
      { kind: "qualified", name: `businesses-${zip}.json` },
      { kind: "excluded-city-mismatch", name: "excluded-city-mismatch.json" },
      { kind: "manifest", name: "manifest.json" },
    ];
    const paths = definitions.map((item) => ({
      ...item,
      relativePath: `${folder}/${item.name}`,
      absolutePath: join(corpusRoot, folder, item.name),
    }));
    const [included, excluded, manifest] = await Promise.all(
      paths.map(({ absolutePath }) => readJson(absolutePath)),
    );
    if (!Array.isArray(included) || !Array.isArray(excluded)) {
      throw new Error(`${zip} qualified and exclusion artifacts must be JSON arrays.`);
    }
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error(`${zip} manifest must be a JSON object.`);
    }
    if (manifest.provider !== "DataForSEO Business Listings Search Live") {
      throw new Error(`${zip} manifest provider is not the accepted DataForSEO source.`);
    }
    if (manifestZip(manifest) !== zip)
      throw new Error(`${zip} manifest filter does not match its ZIP.`);
    if (qualifiedCount(manifest) !== included.length) {
      throw new Error(`${zip} qualified count does not reconcile to its manifest.`);
    }
    if (Number(manifest.city_mismatch_records_excluded) !== excluded.length) {
      throw new Error(`${zip} exclusion count does not reconcile to its manifest.`);
    }
    if (Number(manifest.unique_records) !== included.length + excluded.length) {
      throw new Error(`${zip} included and excluded rows do not reconcile to unique_records.`);
    }

    const qualifiedSheet = `businesses-${zip}`;
    const excludedSheet = `excluded-city-mismatch-${zip}`;
    for (const [index, row] of included.entries()) {
      assertBusinessRow(row, zip, "included");
      const identity = sourceIdentity(row);
      if (identities.has(identity))
        throw new Error(`Duplicate provider identity ${identity} in Reno corpus.`);
      identities.add(identity);
      receipts.push(rowReceipt(qualifiedSheet, index + 2, row));
      const candidate = classifyListingRow(qualifiedSheet, index + 2, candidateInput(row));
      if (candidate) {
        candidate.evidence = {
          ...candidate.evidence,
          source_artifact: `${folder}/businesses-${zip}.json`,
          source_scope: "CLE-73-four-zip-reno-corpus",
        };
        candidates.push(candidate);
      }
    }
    for (const [index, row] of excluded.entries()) {
      assertBusinessRow(row, zip, "excluded-city-mismatch");
      const identity = sourceIdentity(row);
      if (identities.has(identity))
        throw new Error(`Duplicate provider identity ${identity} in Reno corpus.`);
      identities.add(identity);
      receipts.push(rowReceipt(excludedSheet, index + 2, row));
    }
    sheetCounts[qualifiedSheet] = included.length;
    sheetCounts[excludedSheet] = excluded.length;

    const hashes = await Promise.all(paths.map(({ absolutePath }) => sha256File(absolutePath)));
    for (const [index, artifact] of paths.entries()) {
      artifacts.push({
        zip,
        kind: artifact.kind,
        path: artifact.relativePath,
        sha256: hashes[index],
        rowCount:
          artifact.kind === "qualified"
            ? included.length
            : artifact.kind === "excluded-city-mismatch"
              ? excluded.length
              : null,
      });
    }
  }

  const sourceSha256 = createHash("sha256")
    .update(JSON.stringify(artifacts.map(({ path, sha256 }) => ({ path, sha256 }))))
    .digest("hex");
  return {
    sourceType: "dataforseo-reno-json-corpus",
    sourceName: "local775-dataforseo-reno-89502-89509-89511-89521",
    sourceSha256,
    receipts,
    candidates,
    artifacts,
    sheetCounts,
  };
}
