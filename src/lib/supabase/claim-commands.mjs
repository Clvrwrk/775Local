const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;
const CLAIM_METHODS = new Set(["business_domain", "document", "storefront", "vehicle"]);
const CLAIM_DECISIONS = new Set(["approved", "rejected"]);

/** @param {NodeJS.ProcessEnv} env */
function commandTarget(env) {
  const rawUrl = env.SUPABASE_URL?.trim() ?? "";
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("claim_command_not_configured");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("claim_command_not_configured");
  }
  if (publishableKey.length < 24 || !publishableKey.startsWith("sb_publishable_")) {
    throw new Error("claim_command_not_configured");
  }
  return { url, publishableKey };
}

/** @param {unknown} value */
function validUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** @param {unknown} value */
function validIdempotencyKey(value) {
  return typeof value === "string" && IDEMPOTENCY_PATTERN.test(value);
}

/** @param {unknown} input */
export function validateClaimSubmission(input) {
  const candidate = /** @type {Record<string, unknown>} */ (input);
  if (
    !input ||
    typeof input !== "object" ||
    !validUuid(candidate.listingId) ||
    typeof candidate.method !== "string" ||
    !CLAIM_METHODS.has(candidate.method) ||
    !validIdempotencyKey(candidate.idempotencyKey)
  ) {
    throw new Error("invalid_claim_command");
  }
  return {
    listingId: /** @type {string} */ (candidate.listingId).toLowerCase(),
    method: /** @type {string} */ (candidate.method),
    idempotencyKey: /** @type {string} */ (candidate.idempotencyKey),
  };
}

/** @param {unknown} input */
export function validateClaimStatusQuery(input) {
  const candidate = /** @type {Record<string, unknown>} */ (input);
  if (!input || typeof input !== "object" || !validUuid(candidate.listingId)) {
    throw new Error("invalid_claim_query");
  }
  return { listingId: /** @type {string} */ (candidate.listingId).toLowerCase() };
}

/** @param {unknown} input */
export function validateClaimDecision(input) {
  const candidate = /** @type {Record<string, unknown>} */ (input);
  if (
    !input ||
    typeof input !== "object" ||
    !validUuid(candidate.claimId) ||
    typeof candidate.decision !== "string" ||
    !CLAIM_DECISIONS.has(candidate.decision) ||
    typeof candidate.reason !== "string" ||
    candidate.reason.trim().length < 3 ||
    candidate.reason.trim().length > 500 ||
    !validIdempotencyKey(candidate.idempotencyKey)
  ) {
    throw new Error("invalid_claim_decision");
  }
  return {
    claimId: /** @type {string} */ (candidate.claimId).toLowerCase(),
    decision: /** @type {string} */ (candidate.decision),
    reason: /** @type {string} */ (candidate.reason).trim(),
    idempotencyKey: /** @type {string} */ (candidate.idempotencyKey),
  };
}

/** @param {string} message @param {string} fallback */
function stableErrorCode(message, fallback) {
  if (/recent Operator authentication/i.test(message)) return "reauth_required";
  if (/actor projection|authenticated/i.test(message)) return "authentication_required";
  if (/business domain evidence/i.test(message)) return "domain_evidence_not_established";
  if (/invitation/i.test(message)) return "invitation_required";
  if (/not claimable|not found/i.test(message)) return "listing_not_claimable";
  if (/Claim Proof is required/i.test(message)) return "claim_proof_required";
  if (/Business Owner limit/i.test(message)) return "business_owner_limit_reached";
  if (/claim_review permission/i.test(message)) return "claim_review_forbidden";
  if (/terminal decision|idempotency/i.test(message)) return "idempotency_conflict";
  if (/invalid Claim decision/i.test(message)) return "invalid_claim_decision";
  if (/invalid claim command|not ready/i.test(message)) return fallback;
  return fallback;
}

/**
 * @typedef {{accessToken: string, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} ClaimOptions
 * @param {{rpc: string, body: Record<string, unknown>, accessToken: string, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch, errorCode?: (message: string, fallback: string) => string, failureCode?: string}} options
 */
export async function callClaimRpc({
  rpc,
  body,
  accessToken,
  env = process.env,
  fetchImpl = fetch,
  errorCode = stableErrorCode,
  failureCode = "claim_command_failed",
}) {
  if (typeof accessToken !== "string" || !accessToken) {
    return { ok: false, code: "authentication_required" };
  }
  let target;
  try {
    target = commandTarget(env);
  } catch (error) {
    return {
      ok: false,
      code: error instanceof Error ? error.message : "claim_command_not_configured",
    };
  }

  try {
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
        // Provider bodies are never returned to callers.
      }
      if (response.status === 401) return { ok: false, code: "authentication_required" };
      const fallback = response.status === 403 ? "authorization_forbidden" : failureCode;
      return { ok: false, code: errorCode(message, fallback) };
    }
    return { ok: true, receipt: await response.json() };
  } catch {
    return { ok: false, code: failureCode };
  }
}

/** @param {unknown} input @param {ClaimOptions} options */
export async function submitListingClaim(input, options) {
  let command;
  try {
    command = validateClaimSubmission(input);
  } catch {
    return { ok: false, code: "invalid_claim_command" };
  }
  return callClaimRpc({
    ...options,
    rpc: "submit_listing_claim",
    body: {
      requested_listing_id: command.listingId,
      requested_method: command.method,
      requested_idempotency_key: command.idempotencyKey,
    },
  });
}

/** @param {unknown} input @param {ClaimOptions} options */
export async function getMyListingClaim(input, options) {
  let query;
  try {
    query = validateClaimStatusQuery(input);
  } catch {
    return { ok: false, code: "invalid_claim_query" };
  }
  return callClaimRpc({
    ...options,
    rpc: "get_my_listing_claim",
    body: { requested_listing_id: query.listingId },
  });
}

/** @param {unknown} input @param {ClaimOptions} options */
export async function decideListingClaim(input, options) {
  let command;
  try {
    command = validateClaimDecision(input);
  } catch {
    return { ok: false, code: "invalid_claim_decision" };
  }
  return callClaimRpc({
    ...options,
    rpc: "decide_listing_claim",
    body: {
      requested_claim_id: command.claimId,
      requested_decision: command.decision,
      requested_reason: command.reason,
      requested_idempotency_key: command.idempotencyKey,
    },
  });
}
