import { getAuthKitContextOrNull } from "@workos/authkit-tanstack-react-start";
import { sniffImage, validateExperience, validateMemberProfile, validUuid } from "./member-validate.mjs";
import { callMemberRpc, photoUrls } from "../supabase/member-commands.mjs";

function currentAccessToken() {
  const auth = getAuthKitContextOrNull()?.auth();
  return auth?.user && "accessToken" in auth ? auth.accessToken : "";
}

/** @param {NodeJS.ProcessEnv} env */
function storageTarget(env) {
  const rawUrl = env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("member_command_not_configured");
  }
  if (serviceRoleKey.length < 24 || serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error("member_command_not_configured");
  }
  return { url, serviceRoleKey };
}

/** @param {unknown} receipt @param {string} baseUrl */
function withPhotos(receipt, baseUrl) {
  if (!receipt || typeof receipt !== "object") return receipt;
  const row = /** @type {Record<string, unknown>} */ (receipt);
  if (Array.isArray(row.experiences)) {
    return {
      ...row,
      experiences: row.experiences.map((experience) => {
        if (!experience || typeof experience !== "object") return experience;
        const item = /** @type {Record<string, unknown>} */ (experience);
        return { ...item, photos: photoUrls(item.photoPaths, baseUrl) };
      }),
    };
  }
  if ("photoPaths" in row) return { ...row, photos: photoUrls(row.photoPaths, baseUrl) };
  return receipt;
}

/** @param {unknown} input @param {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} [options] */
export async function handleSaveLocalMember(input, options = {}) {
  const accessToken = currentAccessToken();
  if (!accessToken) return { ok: false, code: "authentication_required" };
  let profile;
  try {
    profile = validateMemberProfile(input);
  } catch {
    return { ok: false, code: "invalid_member_profile" };
  }
  const result = await callMemberRpc({
    rpc: "save_local_member",
    body: {
      requested_display_name: profile.displayName,
      requested_handle: profile.handle,
      requested_town: profile.town,
      requested_bio: profile.bio,
    },
    accessToken,
    env: options.env,
    fetchImpl: options.fetchImpl,
  });
  return result.ok ? { ok: true, profile: result.receipt } : result;
}

/** @param {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} [options] */
export async function handleGetMyLocalMember(options = {}) {
  const accessToken = currentAccessToken();
  if (!accessToken) return { ok: false, code: "authentication_required" };
  const result = await callMemberRpc({
    rpc: "get_my_local_member",
    body: {},
    accessToken,
    env: options.env,
    fetchImpl: options.fetchImpl,
  });
  if (!result.ok) return result;
  const baseUrl = options.env?.SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  return { ok: true, member: withPhotos(result.receipt, baseUrl) };
}

/** @param {unknown} input @param {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} [options] */
export async function handleSubmitExperience(input, options = {}) {
  const accessToken = currentAccessToken();
  if (!accessToken) return { ok: false, code: "authentication_required" };
  let experience;
  try {
    experience = validateExperience(input);
  } catch {
    return { ok: false, code: "invalid_experience" };
  }
  const result = await callMemberRpc({
    rpc: "submit_experience",
    body: {
      requested_listing_id: experience.listingId,
      requested_rating: experience.rating,
      requested_body: experience.body,
      requested_idempotency_key: experience.idempotencyKey,
    },
    accessToken,
    env: options.env,
    fetchImpl: options.fetchImpl,
    failureCode: "experience_command_failed",
  });
  if (!result.ok) return result;
  const baseUrl = options.env?.SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  return { ok: true, experience: withPhotos(result.receipt, baseUrl) };
}

/** @param {unknown} input @param {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} [options] */
export async function handleWithdrawExperience(input, options = {}) {
  const accessToken = currentAccessToken();
  if (!accessToken) return { ok: false, code: "authentication_required" };
  const listingId =
    input && typeof input === "object" && "listingId" in input ? input.listingId : "";
  if (!validUuid(listingId)) return { ok: false, code: "invalid_experience" };
  return callMemberRpc({
    rpc: "withdraw_experience",
    body: { requested_listing_id: String(listingId).toLowerCase() },
    accessToken,
    env: options.env,
    fetchImpl: options.fetchImpl,
    failureCode: "experience_command_failed",
  });
}

/** @param {unknown} input @param {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} [options] */
export async function handleAttachExperiencePhoto(input, options = {}) {
  const accessToken = currentAccessToken();
  if (!accessToken) return { ok: false, code: "authentication_required" };
  const candidate = /** @type {Record<string, unknown>} */ (input);
  const sort = Number(candidate?.sort);
  const reviewId = String(candidate?.reviewId ?? "");
  const raw = String(candidate?.imageBase64 ?? "").replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  if (!validUuid(reviewId) || !Number.isInteger(sort) || sort < 0 || sort > 3 || raw.length > 1_300_000) {
    return { ok: false, code: "photo_rejected" };
  }
  const bytes = Buffer.from(raw, "base64");
  const image = sniffImage(bytes);
  if (!image) return { ok: false, code: "photo_rejected" };

  const env = options.env ?? process.env;
  const prepared = await callMemberRpc({
    rpc: "prepare_experience_photo",
    body: {
      requested_review_id: reviewId.toLowerCase(),
      requested_sort: sort,
      requested_ext: image.ext,
    },
    accessToken,
    env,
    fetchImpl: options.fetchImpl,
    failureCode: "photo_rejected",
  });
  if (!prepared.ok || typeof prepared.receipt !== "string") {
    return prepared.ok ? { ok: false, code: "photo_rejected" } : prepared;
  }

  let storage;
  try {
    storage = storageTarget(env);
  } catch {
    return { ok: false, code: "member_command_not_configured" };
  }
  const upload = await (options.fetchImpl ?? fetch)(
    new URL(`/storage/v1/object/member-photos/${prepared.receipt}`, storage.url),
    {
      method: "POST",
      headers: {
        apikey: storage.serviceRoleKey,
        Authorization: `Bearer ${storage.serviceRoleKey}`,
        "Content-Type": image.contentType,
        "x-upsert": "true",
      },
      body: bytes,
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!upload.ok) return { ok: false, code: "photo_rejected" };

  const registered = await callMemberRpc({
    rpc: "register_experience_photo",
    body: { requested_review_id: reviewId.toLowerCase(), requested_path: prepared.receipt },
    accessToken,
    env,
    fetchImpl: options.fetchImpl,
    failureCode: "photo_rejected",
  });
  if (!registered.ok) return registered;
  return { ok: true, photoUrl: `${storage.url.origin}/storage/v1/object/public/member-photos/${prepared.receipt}` };
}
