const OPERATOR_RPCS = Object.freeze({
  review: "review_listing_candidate",
  publish: "publish_launch_selection",
});

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

/** @param {NodeJS.ProcessEnv} env */
function commandTarget(env) {
  const rawUrl = env.SUPABASE_URL?.trim() ?? "";
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("operator_command_not_configured");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("operator_command_not_configured");
  }
  if (
    publishableKey.length < 16 ||
    publishableKey.startsWith("sb_secret_") ||
    publishableKey.includes("service_role")
  ) {
    throw new Error("operator_command_not_configured");
  }
  return { url, publishableKey };
}

/** @param {unknown} value */
function validIdempotencyKey(value) {
  return typeof value === "string" && value.trim().length >= 8 && value.trim().length <= 200;
}

/** @param {unknown} input */
export function validateCandidateReviewInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("invalid_operator_command");
  }
  const value = /** @type {Record<string, any>} */ (input);
  if (
    !UUID_PATTERN.test(String(value.candidateId ?? "")) ||
    !validIdempotencyKey(value.idempotencyKey)
  ) {
    throw new Error("invalid_operator_command");
  }
  if (!value.decision || typeof value.decision !== "object" || Array.isArray(value.decision)) {
    throw new Error("invalid_operator_command");
  }
  return {
    candidateId: String(value.candidateId),
    decision: value.decision,
    idempotencyKey: String(value.idempotencyKey).trim(),
  };
}

/** @param {unknown} input */
export function validateLaunchPublicationInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("invalid_operator_command");
  }
  const value = /** @type {Record<string, any>} */ (input);
  if (!Array.isArray(value.candidateIds) || value.candidateIds.length !== 100) {
    throw new Error("invalid_operator_command");
  }
  const candidateIds = value.candidateIds.map((candidateId) => String(candidateId));
  if (
    candidateIds.some((candidateId) => !UUID_PATTERN.test(candidateId)) ||
    new Set(candidateIds).size !== candidateIds.length ||
    !validIdempotencyKey(value.idempotencyKey)
  ) {
    throw new Error("invalid_operator_command");
  }
  return {
    candidateIds,
    idempotencyKey: String(value.idempotencyKey).trim(),
  };
}

/** @param {string} message */
function errorCode(message) {
  if (/recent Operator authentication is required/i.test(message)) return "reauth_required";
  if (/idempotency key was already used/i.test(message)) return "idempotency_conflict";
  if (
    /candidate|launch selection|publication evidence|source checks|review decision/i.test(message)
  ) {
    return "invalid_operator_command";
  }
  return "operator_command_failed";
}

/**
 * @param {{rpc: string, body: Record<string, any>, accessToken: string, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} options
 */
async function callOperatorRpc({ rpc, body, accessToken, env = process.env, fetchImpl = fetch }) {
  if (
    (rpc !== OPERATOR_RPCS.review && rpc !== OPERATOR_RPCS.publish) ||
    typeof accessToken !== "string" ||
    !accessToken
  ) {
    return { ok: false, code: "authentication_required" };
  }
  let target;
  try {
    target = commandTarget(env);
  } catch (error) {
    return {
      ok: false,
      code: error instanceof Error ? error.message : "operator_command_not_configured",
    };
  }

  const response = await fetchImpl(new URL(`/rest/v1/rpc/${rpc}`, target.url), {
    method: "POST",
    headers: {
      apikey: target.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    let message = "";
    try {
      const payload = await response.json();
      message = typeof payload?.message === "string" ? payload.message : "";
    } catch {
      // Return a stable redacted failure code when the provider body is not JSON.
    }
    return { ok: false, code: errorCode(message) };
  }
  return { ok: true, receipt: await response.json() };
}

/**
 * @param {unknown} input
 * @param {{accessToken: string, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} options
 */
export async function reviewListingCandidate(input, options) {
  let command;
  try {
    command = validateCandidateReviewInput(input);
  } catch {
    return { ok: false, code: "invalid_operator_command" };
  }
  return callOperatorRpc({
    ...options,
    rpc: OPERATOR_RPCS.review,
    body: {
      requested_candidate_id: command.candidateId,
      requested_decision: command.decision,
      requested_idempotency_key: command.idempotencyKey,
    },
  });
}

/**
 * @param {unknown} input
 * @param {{accessToken: string, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} options
 */
export async function publishLaunchSelection(input, options) {
  let command;
  try {
    command = validateLaunchPublicationInput(input);
  } catch {
    return { ok: false, code: "invalid_operator_command" };
  }
  return callOperatorRpc({
    ...options,
    rpc: OPERATOR_RPCS.publish,
    body: {
      requested_candidate_ids: command.candidateIds,
      requested_idempotency_key: command.idempotencyKey,
    },
  });
}
