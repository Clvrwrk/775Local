const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;
const PHOTO_PATH_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-3]\.(jpg|png|webp)$/;
const MAX_PHOTO_BYTES = 900_000;

/** @param {string} value */
export function memberHandle(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
}

/** @param {unknown} input */
export function validateMemberProfile(input) {
  const candidate = /** @type {Record<string, unknown>} */ (input);
  if (!input || typeof input !== "object") throw new Error("invalid_member_profile");
  const displayName = typeof candidate.displayName === "string" ? candidate.displayName.trim() : "";
  const handle = typeof candidate.handle === "string" ? memberHandle(candidate.handle) : "";
  const town = typeof candidate.town === "string" ? candidate.town.trim() : "";
  const bio = typeof candidate.bio === "string" ? candidate.bio.trim() : "";
  if (
    displayName.length < 2 ||
    displayName.length > 40 ||
    displayName.includes("@") ||
    /https?:\/\//i.test(displayName) ||
    !HANDLE_PATTERN.test(handle) ||
    town.length < 2 ||
    town.length > 40 ||
    bio.length > 280
  ) {
    throw new Error("invalid_member_profile");
  }
  return { displayName, handle, town, bio };
}

/** @param {unknown} input */
export function validateExperience(input) {
  const candidate = /** @type {Record<string, unknown>} */ (input);
  const rating = Number(candidate?.rating);
  const body = typeof candidate?.body === "string" ? candidate.body.trim() : "";
  if (
    !input ||
    typeof input !== "object" ||
    !UUID_PATTERN.test(String(candidate.listingId ?? "")) ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    body.length < 20 ||
    body.length > 2000 ||
    !KEY_PATTERN.test(String(candidate.idempotencyKey ?? ""))
  ) {
    throw new Error("invalid_experience");
  }
  return {
    listingId: String(candidate.listingId).toLowerCase(),
    rating,
    body,
    idempotencyKey: String(candidate.idempotencyKey),
  };
}

/** @param {unknown} value */
export function validUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** @param {Uint8Array} bytes */
export function sniffImage(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 12 || bytes.byteLength > MAX_PHOTO_BYTES) {
    return null;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", contentType: "image/png" };
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

/** @param {string} path */
export function safePhotoPath(path) {
  return PHOTO_PATH_PATTERN.test(path) ? path : "";
}
