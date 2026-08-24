import { createHash } from "node:crypto";

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

/**
 * @param {Record<string, string | undefined>} env
 */
export function validateImportTarget(env) {
  if (env.IMPORT_TARGET !== "preview") {
    throw new Error("Raw workbook apply is allowed only when IMPORT_TARGET=preview.");
  }
  const expectedRef = env.PREVIEW_SUPABASE_PROJECT_REF?.trim();
  if (!expectedRef || !/^[a-z0-9]{8,32}$/.test(expectedRef)) {
    throw new Error("PREVIEW_SUPABASE_PROJECT_REF is required.");
  }

  let url;
  try {
    url = new URL(env.SUPABASE_URL ?? "");
  } catch {
    throw new Error("SUPABASE_URL must be the Preview project HTTPS URL.");
  }
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS.");
  const projectRef = url.hostname.endsWith(".supabase.co")
    ? url.hostname.slice(0, -".supabase.co".length)
    : "";
  if (projectRef !== expectedRef) {
    throw new Error("SUPABASE_URL project ref does not match PREVIEW_SUPABASE_PROJECT_REF.");
  }

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (serviceRoleKey.length < 24 || serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error("A service-role key is required for private raw import.");
  }
  return { url, projectRef, serviceRoleKey };
}
