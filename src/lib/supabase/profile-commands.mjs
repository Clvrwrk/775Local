import { callClaimRpc } from "./claim-commands.mjs";

/** Profiles never accept an actor id, email, verification or listing role.
 * @param {unknown} input
 */
export function profileCommand(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("invalid_profile");
  const data = /** @type {Record<string, any>} */ (input);
  if (data.action === "get" && Object.keys(data).length === 1)
    return { rpc: "get_my_profile", body: {} };
  const allowed = ["action", "displayName", "city", "bio", "version", "key"];
  if (
    data.action !== "save" ||
    Object.keys(data).some((key) => !allowed.includes(key)) ||
    typeof data.displayName !== "string" ||
    data.displayName.trim().length < 2 ||
    data.displayName.trim().length > 100 ||
    typeof data.city !== "string" ||
    !["", "reno", "sparks", "other"].includes(data.city) ||
    typeof data.bio !== "string" ||
    data.bio.trim().length > 500 ||
    [...data.displayName].some((x) => x.charCodeAt(0) < 32 || x.charCodeAt(0) === 127) ||
    [...data.bio].some((x) => {
      const code = x.charCodeAt(0);
      return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
    }) ||
    !Number.isSafeInteger(data.version) ||
    data.version < 0 ||
    data.version > 2147483646 ||
    typeof data.key !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(data.key)
  )
    throw Error("invalid_profile");
  return {
    rpc: "save_my_profile",
    body: {
      requested_payload: {
        displayName: data.displayName.trim(),
        city: data.city,
        bio: data.bio.trim(),
      },
      requested_version: data.version,
      requested_key: data.key,
    },
  };
}

/** @param {unknown} input @param {import('./claim-commands.mjs').ClaimOptions} options */
export async function runProfileCommand(input, options) {
  let command;
  try {
    command = profileCommand(input);
  } catch {
    return { ok: false, code: "invalid_profile" };
  }
  return callClaimRpc({
    ...options,
    ...command,
    failureCode: "profile_unavailable",
    errorCode: (message, fallback) =>
      [
        "authentication_required",
        "invalid_profile",
        "profile_changed",
        "idempotency_conflict",
      ].includes(message)
        ? message
        : fallback,
  });
}
