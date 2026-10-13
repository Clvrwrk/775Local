import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/** @param {string} path */
export async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/** @param {unknown} value */
export function normalizeCellValue(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  return JSON.parse(JSON.stringify(value));
}

/** @param {unknown} value */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * @param {string} worksheet
 * @param {number} sourceRow
 * @param {Record<string, unknown>} rawPayload
 */
export function rowReceipt(worksheet, sourceRow, rawPayload) {
  const rowSha256 = createHash("sha256")
    .update(stableJson({ worksheet, sourceRow, rawPayload }))
    .digest("hex");
  const sourceBusinessId = rawPayload.cid ?? rawPayload.place_id ?? rawPayload.feature_id ?? null;
  return {
    worksheet,
    source_row: sourceRow,
    source_business_id: sourceBusinessId == null ? null : String(sourceBusinessId),
    row_sha256: rowSha256,
    raw_payload: rawPayload,
  };
}

const PRODUCTION_PROJECT_REF = "hcfryjrajqftcnnbnybj";
const LOCAL_REHEARSAL_PROJECT_ID = "local775cli";
const LOCAL_REHEARSAL_PORT = "55421";

/**
 * @param {URL} url
 */
function assertNotProduction(url) {
  if (url.hostname === `${PRODUCTION_PROJECT_REF}.supabase.co` || url.href.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error("Workbook apply cannot target production.");
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {URL} url
 * @param {string} serviceRoleKey
 */
function validateLocalRehearsal(env, url, serviceRoleKey) {
  if (env.LOCAL_SUPABASE_PROJECT_ID?.trim() !== LOCAL_REHEARSAL_PROJECT_ID) {
    throw new Error("LOCAL_SUPABASE_PROJECT_ID must name the local CLI rehearsal.");
  }
  assertNotProduction(url);
  if (url.protocol !== "http:") throw new Error("Local rehearsal SUPABASE_URL must use HTTP.");
  if (url.hostname !== "127.0.0.1" || url.port !== LOCAL_REHEARSAL_PORT) {
    throw new Error("Local rehearsal SUPABASE_URL must be the isolated CLI loopback.");
  }
  return { url, projectRef: LOCAL_REHEARSAL_PROJECT_ID, serviceRoleKey };
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function validateImportTarget(env) {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (serviceRoleKey.length < 24 || serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error("A service-role key is required for private raw import.");
  }

  let url;
  try {
    url = new URL(env.SUPABASE_URL ?? "");
  } catch {
    throw new Error("SUPABASE_URL must be the rehearsal or Preview project URL.");
  }
  assertNotProduction(url);

  if (env.IMPORT_TARGET === "local") {
    return validateLocalRehearsal(env, url, serviceRoleKey);
  }
  if (env.IMPORT_TARGET !== "preview") {
    throw new Error("Raw workbook apply is allowed only when IMPORT_TARGET=preview or IMPORT_TARGET=local.");
  }

  const expectedRef = env.PREVIEW_SUPABASE_PROJECT_REF?.trim();
  if (!expectedRef || !/^[a-z0-9]{8,32}$/.test(expectedRef)) {
    throw new Error("PREVIEW_SUPABASE_PROJECT_REF is required.");
  }
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS.");
  const projectRef = url.hostname.endsWith(".supabase.co")
    ? url.hostname.slice(0, -".supabase.co".length)
    : "";
  if (projectRef !== expectedRef) {
    throw new Error("SUPABASE_URL project ref does not match PREVIEW_SUPABASE_PROJECT_REF.");
  }
  return { url, projectRef, serviceRoleKey };
}
