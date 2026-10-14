import { validUuid } from "../directory/member-validate.mjs";

/** @param {NodeJS.ProcessEnv} env */
function commandTarget(env) {
  const rawUrl = env.SUPABASE_URL?.trim() ?? "";
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("member_command_not_configured");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("member_command_not_configured");
  }
  if (publishableKey.length < 24 || !publishableKey.startsWith("sb_publishable_")) {
    throw new Error("member_command_not_configured");
  }
  return { url, publishableKey };
}

/** @param {string} message @param {string} fallback */
function stableErrorCode(message, fallback) {
  if (/actor projection|authenticated/i.test(message)) return "authentication_required";
  if (/handle is taken/i.test(message)) return "handle_taken";
  if (/profile is required/i.test(message)) return "profile_required";
  if (/invalid local member profile/i.test(message)) return "invalid_member_profile";
  if (/invalid experience photo/i.test(message)) return "photo_rejected";
  if (/not open for experiences/i.test(message)) return "listing_not_reviewable";
  if (/idempotency conflict/i.test(message)) return "idempotency_conflict";
  if (/was not found/i.test(message)) return "experience_not_found";
  if (/invalid experience/i.test(message)) return "invalid_experience";
  return fallback;
}

/**
 * @param {{rpc: string, body: Record<string, unknown>, accessToken?: string, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch, failureCode?: string}} options
 */
export async function callMemberRpc({
  rpc,
  body,
  accessToken = "",
  env = process.env,
  fetchImpl = fetch,
  failureCode = "member_command_failed",
}) {
  let target;
  try {
    target = commandTarget(env);
  } catch {
    return { ok: false, code: "member_command_not_configured" };
  }
  const token = accessToken || target.publishableKey;
  let response;
  try {
    response = await fetchImpl(new URL(`/rest/v1/rpc/${rpc}`, target.url), {
      method: "POST",
      headers: {
        apikey: target.publishableKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return { ok: false, code: "connection_interrupted" };
  }
  if (response.status === 404) return { ok: false, code: "member_command_unavailable" };
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : "";
    return { ok: false, code: stableErrorCode(message, failureCode) };
  }
  return { ok: true, receipt: payload };
}

/** @param {string} baseUrl @param {string} path */
export function memberPhotoUrl(baseUrl, path) {
  if (!path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-3]\.(jpg|png|webp)$/.test(path)) return "";
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) return "";
  return `${url.origin}/storage/v1/object/public/member-photos/${path}`;
}

/** @param {unknown} paths @param {string} baseUrl */
export function photoUrls(paths, baseUrl) {
  const list = Array.isArray(paths) ? paths : [];
  return list.map((path) => memberPhotoUrl(baseUrl, String(path))).filter(Boolean);
}

/** @param {unknown} value */
export function requireUuid(value) {
  if (!validUuid(value)) throw new Error("invalid_experience");
  return String(value).toLowerCase();
}
