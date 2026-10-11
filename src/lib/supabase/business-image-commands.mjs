import { callClaimRpc } from "./claim-commands.mjs";
import {
  sanitizeBusinessImage,
  validateImageDetails,
  imageHash,
  imageUuid,
  MAX_IMAGE_BYTES,
} from "../directory/business-image-validation.mjs";

const errors = new Set([
  "listing_access_forbidden",
  "reauth_required",
  "review_forbidden",
  "invalid_image",
  "invalid_image_details",
  "image_not_found",
  "review_incomplete",
  "invalid_decision",
  "upload_incomplete",
  "idempotency_conflict",
  "media_limit_reached",
]);
/** @typedef {import('./claim-commands.mjs').ClaimOptions} Options */
/** @param {Options} o */
function enabled(o) {
  return (
    o.env?.BUSINESS_IMAGE_UPLOAD_ENABLED === "true" ||
    (!o.env && process.env.BUSINESS_IMAGE_UPLOAD_ENABLED === "true")
  );
}
/** @param {string} rpc @param {Record<string,unknown>} body @param {Options} o */
async function command(rpc, body, o) {
  if (!enabled(o)) return { ok: false, code: "media_not_configured" };
  if (["published_business_images", "published_business_image"].includes(rpc)) {
    try {
      const { url, key } = target(o);
      const r = await (o.fetchImpl ?? fetch)(new URL(`/rest/v1/rpc/${rpc}`, url), {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      return r.ok
        ? { ok: true, receipt: await r.json() }
        : { ok: false, code: "media_command_failed" };
    } catch {
      return { ok: false, code: "media_command_failed" };
    }
  }
  return callClaimRpc({
    ...o,
    rpc,
    body,
    failureCode: "media_command_failed",
    errorCode: (m, f) => (errors.has(m) ? m : f),
  });
}
/** @param {Options} o */
function target(o) {
  const env = o.env ?? process.env;
  const url = new URL(env.SUPABASE_URL ?? "");
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? "";
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    key.length < 24 ||
    !key.startsWith("sb_publishable_")
  )
    throw new Error("media_not_configured");
  return { url, key };
}
/** @param {string} path @param {Options} o @param {Buffer} [bytes] @param {string} [type] */
async function object(path, o, bytes, type = "image/webp") {
  if (!/^[a-f0-9-]{36}\/(original|sanitized\.webp|approved\.webp)$/.test(path))
    throw new Error("invalid_image_details");
  const { url, key } = target(o);
  const headers = /** @type {Record<string,string>} */ ({ apikey: key });
  if (o.accessToken) headers.Authorization = `Bearer ${o.accessToken}`;
  if (bytes) headers["Content-Type"] = type;
  return (o.fetchImpl ?? fetch)(
    new URL(`/storage/v1/object/${bytes ? "" : "authenticated/"}business-images/${path}`, url),
    {
      method: bytes ? "POST" : "GET",
      headers,
      body: bytes ? new Uint8Array(bytes) : undefined,
      signal: AbortSignal.timeout(10_000),
    },
  );
}
/** @param {string} path @param {Options} o */
async function readObject(path, o) {
  const response = await object(path, o);
  if (!response.ok) throw new Error("media_storage_failed");
  const chunks = [];
  let size = 0;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("media_storage_failed");
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > MAX_IMAGE_BYTES) throw new Error("invalid_image");
      chunks.push(Buffer.from(r.value));
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
/** Immutable keys; interrupted retries verify existing bytes instead of overwriting.
 * @param {string} path @param {Buffer} bytes @param {string} type @param {Options} o
 */
async function putObject(path, bytes, type, o) {
  const r = await object(path, o, bytes, type);
  if (r.ok) return;
  if (r.status === 409 || r.status === 400) {
    const existing = await readObject(path, o);
    if (imageHash(existing) === imageHash(bytes)) return;
    throw new Error("idempotency_conflict");
  }
  throw new Error("media_storage_failed");
}
/** @param {unknown} input @param {Options} o */
export async function uploadBusinessImage(input, o) {
  if (!enabled(o)) return { ok: false, code: "media_not_configured" };
  if (!o.accessToken) return { ok: false, code: "authentication_required" };
  try {
    if (!(input instanceof FormData)) throw new Error("invalid_image_details");
    const file = input.get("file");
    if (!(file instanceof File) || file.size > MAX_IMAGE_BYTES) throw new Error("invalid_image");
    const details = validateImageDetails({
      ...Object.fromEntries(input),
      rightsAttested: input.get("rightsAttested") === "true",
    });
    // Authorize before decoding or sending an object. No service/secret credential.
    const access = await command(
      "business_image_workspace",
      { requested_listing_id: details.listingId },
      o,
    );
    if (!access.ok) return access;
    const original = Buffer.from(await file.arrayBuffer());
    const sanitized = await sanitizeBusinessImage(original, file.type);
    const start = await command(
      "begin_business_image",
      {
        requested_id: details.id,
        requested_listing_id: details.listingId,
        requested_kind: details.kind,
        requested_alt: details.alt,
        requested_rights: details.rightsBasis,
        requested_source: details.source,
        requested_sha: imageHash(original),
        requested_type: file.type,
        requested_size: original.length,
        requested_sanitized_sha: sanitized.sha256,
        requested_width: sanitized.width,
        requested_height: sanitized.height,
      },
      o,
    );
    if (!start.ok) return start;
    const receipt = /** @type {{status:string}} */ (start.receipt);
    if (receipt.status !== "uploaded") return start;
    await putObject(`${details.id}/original`, original, file.type, o);
    await putObject(`${details.id}/sanitized.webp`, sanitized.bytes, "image/webp", o);
    return command("finish_business_image", { requested_id: details.id }, o);
  } catch (error) {
    return {
      ok: false,
      code:
        error instanceof Error && errors.has(error.message)
          ? error.message
          : "media_storage_failed",
    };
  }
}
/** @param {unknown} input @param {Options} o */
export async function runBusinessImageCommand(input, o) {
  if (!enabled(o)) return { ok: false, code: "media_not_configured" };
  const d = /** @type {Record<string,unknown>} */ (input);
  if (d?.action === "review") return command("business_image_review_queue", {}, o);
  if (!d || !imageUuid.test(String(d.id))) return { ok: false, code: "invalid_image_details" };
  if (d.action === "workspace")
    return command("business_image_workspace", { requested_listing_id: d.id }, o);
  if (d.action !== "preview" && d.action !== "decide")
    return { ok: false, code: "invalid_image_details" };
  if (
    d.action === "decide" &&
    (!["approved", "rejected"].includes(String(d.decision)) ||
      typeof d.reason !== "string" ||
      d.reason.trim().length < 3 ||
      d.reason.length > 500 ||
      typeof d.rightsChecked !== "boolean")
  )
    return { ok: false, code: "invalid_decision" };
  try {
    if (d.action === "decide") {
      const review = await command("business_image_review_queue", {}, o);
      if (!review.ok) return review;
      if (d.decision === "rejected")
        return command(
          "decide_business_image",
          {
            requested_id: d.id,
            requested_decision: d.decision,
            requested_reason: String(d.reason).trim(),
            requested_rights_checked: d.rightsChecked,
          },
          o,
        );
      if (d.rightsChecked !== true) return { ok: false, code: "review_incomplete" };
    }
    const inspect = await command("inspect_business_image", { requested_id: d.id }, o);
    if (!inspect.ok) return inspect;
    const m =
      /** @type {{path:string,type:string,sha256:string,status:string,byteSize:number,sanitizedSha:string,width:number,height:number}} */ (
        inspect.receipt
      );
    if (!m) return { ok: false, code: "image_not_found" };
    if (d.action === "decide" && m.status === "approved")
      return command(
        "decide_business_image",
        {
          requested_id: d.id,
          requested_decision: d.decision,
          requested_reason: String(d.reason).trim(),
          requested_rights_checked: d.rightsChecked,
        },
        o,
      );
    const original = await readObject(m.path, o);
    if (imageHash(original) !== m.sha256 || original.length !== m.byteSize)
      throw new Error("idempotency_conflict");
    // Re-decode the actual immutable original on approval; never trust client metadata or a staged derivative.
    const clean = await sanitizeBusinessImage(original, m.type);
    if (clean.sha256 !== m.sanitizedSha || clean.width !== m.width || clean.height !== m.height)
      throw new Error("idempotency_conflict");
    if (d.action === "preview")
      return {
        ok: true,
        receipt: { dataUrl: `data:image/webp;base64,${clean.bytes.toString("base64")}` },
      };
    if (m.status === "pending_review")
      await putObject(`${d.id}/approved.webp`, clean.bytes, "image/webp", o);
    return command(
      "decide_business_image",
      {
        requested_id: d.id,
        requested_decision: d.decision,
        requested_reason: String(d.reason).trim(),
        requested_rights_checked: d.rightsChecked,
      },
      o,
    );
  } catch (error) {
    return {
      ok: false,
      code:
        error instanceof Error && errors.has(error.message)
          ? error.message
          : "media_storage_failed",
    };
  }
}
/** @param {string} listingId @param {Options} [o] */
export async function publishedBusinessImages(listingId, o = { accessToken: "" }) {
  if (!imageUuid.test(listingId) || !enabled(o)) return [];
  const r = await command(
    "published_business_images",
    { requested_listing_id: listingId },
    { ...o, accessToken: "", fetchImpl: o.fetchImpl },
  );
  return r.ok && Array.isArray(r.receipt) ? r.receipt : [];
}
/** Anonymous image bytes always re-check approved state and published listing; no caching of revoked access.
 * @param {string} id @param {Options} [o]
 */
export async function serveBusinessImage(id, o = { accessToken: "" }) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Type": "image/webp",
  };
  if (!imageUuid.test(id) || !enabled(o)) return new Response(null, { status: 404, headers });
  const r = await command(
    "published_business_image",
    { requested_id: id },
    { ...o, accessToken: "" },
  );
  if (!r.ok || !r.receipt) return new Response(null, { status: 404, headers });
  try {
    const bytes = await readObject(/** @type {{path:string}} */ (r.receipt).path, {
      ...o,
      accessToken: "",
    });
    return new Response(new Uint8Array(bytes), { headers });
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
