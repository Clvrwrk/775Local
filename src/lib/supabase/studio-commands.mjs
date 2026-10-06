import { callClaimRpc } from "./claim-commands.mjs";
import { telephoneHref, safeWebsite } from "../directory/presentation.mjs";
const STUDIO_ERRORS = new Set([
  "authentication_required",
  "listing_access_forbidden",
  "outside_pilot",
  "invalid_listing_proposal",
  "idempotency_conflict",
  "listing_changed_since_proposal",
  "reauth_required",
  "review_forbidden",
  "content_draft_requires_separate_review",
  "invalid_decision",
  "proposal_not_found",
  "request_unavailable",
  "request_already_decided",
  "self_review_forbidden",
  "listing_review_changed",
  "duplicate_review_required",
  "publication_checks_required",
  "publication_forbidden",
  "publication_sources_required",
  "invalid_listing_review",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** @param {unknown} input */
export function studioCommand(input) {
  if (!input || typeof input !== "object") throw new Error("invalid_studio_command");
  const data = /** @type {Record<string, unknown>} */ (input);
  if (
    data.action === "request" &&
    typeof data.name === "string" &&
    data.name.trim().length >= 2 &&
    data.name.trim().length <= 200 &&
    data.citySlug === "reno" &&
    typeof data.categorySlug === "string" &&
    /^[a-z0-9-]{1,80}$/.test(data.categorySlug) &&
    typeof data.zip === "string" &&
    /^895\d{2}$/.test(data.zip) &&
    typeof data.description === "string" &&
    data.description.trim().length >= 10 &&
    data.description.trim().length <= 5000 &&
    typeof data.key === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(data.key)
  ) {
    const phone = telephoneHref(data.phone)?.slice(4);
    const website = data.website ? safeWebsite(data.website) : "";
    if (
      !phone ||
      !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone) ||
      website === null ||
      (website && !website.startsWith("https://"))
    )
      throw Error("invalid_studio_command");
    return {
      rpc: "request_business_listing",
      body: {
        requested_key: data.key,
        requested_payload: {
          name: data.name.trim(),
          citySlug: "reno",
          categorySlug: data.categorySlug,
          zip: data.zip,
          description: data.description.trim(),
          phone,
          website,
        },
      },
    };
  }
  if (data.action === "requests") return { rpc: "get_my_listing_requests", body: {} };
  if (data.action === "account") return { rpc: "pilot_account", body: {} };
  if (data.action === "review") return { rpc: "pilot_review_queue", body: {} };
  if (typeof data.id !== "string" || !uuid.test(data.id)) throw new Error("invalid_studio_command");
  if (data.action === "requestReview")
    return { rpc: "get_listing_request_review", body: { requested_id: data.id } };
  if (data.action === "decideRequest") {
    const original = /** @type {any} */ (data.decision);
    const decision = original && typeof original === "object" ? { ...original } : original;
    if (
      typeof data.key !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(data.key) ||
      !data.scope ||
      typeof data.scope !== "object" ||
      Array.isArray(data.scope) ||
      !decision ||
      typeof decision !== "object" ||
      Array.isArray(decision) ||
      Object.keys(decision).some(
        (x) =>
          ![
            "outcome",
            "reason",
            "sourceUrls",
            "sourceCheckedAt",
            "checks",
            "duplicateDecision",
            "canonical",
          ].includes(x),
      ) ||
      !["approved", "rejected"].includes(decision.outcome) ||
      typeof decision.reason !== "string" ||
      decision.reason.trim().length < 10 ||
      decision.reason.trim().length > 500
    )
      throw Error("invalid_studio_command");
    if (decision.outcome === "approved") {
      const canonical = decision.canonical;
      const checks = decision.checks;
      const required = [
        "nap",
        "activeBusiness",
        "category",
        "reno",
        "rights",
        "privacy",
        "duplicates",
      ];
      if (
        !checks ||
        required.some((x) => checks[x] !== true) ||
        Object.keys(checks).length !== required.length ||
        decision.duplicateDecision !== "no_duplicate" ||
        !Array.isArray(decision.sourceUrls) ||
        decision.sourceUrls.length < 1 ||
        decision.sourceUrls.length > 5 ||
        decision.sourceUrls.some(
          (/** @type {unknown} */ x) =>
            typeof x !== "string" ||
            x.length > 2000 ||
            !x.startsWith("https://") ||
            safeWebsite(x) === null,
        ) ||
        typeof decision.sourceCheckedAt !== "string" ||
        !Number.isFinite(Date.parse(decision.sourceCheckedAt)) ||
        !canonical ||
        Object.keys(canonical).some(
          (x) =>
            ![
              "name",
              "citySlug",
              "categorySlug",
              "phone",
              "zip",
              "description",
              "website",
            ].includes(x),
        )
      )
        throw Error("invalid_studio_command");
      // Reuse the same input boundary as a new request; no residential-address field is accepted.
      const normalized = studioCommand({ ...canonical, action: "request", key: data.key });
      decision.canonical = normalized.body.requested_payload;
    }
    return {
      rpc: "decide_listing_request",
      body: {
        requested_id: data.id,
        requested_decision: decision,
        requested_scope: data.scope,
        requested_key: data.key,
      },
    };
  }
  if (data.action === "workspace")
    return { rpc: "pilot_workspace", body: { requested_listing_id: data.id } };
  if (
    data.action === "decide" &&
    ["approved", "rejected"].includes(String(data.decision)) &&
    typeof data.reason === "string" &&
    data.reason.trim().length >= 3 &&
    data.reason.trim().length <= 500
  ) {
    return {
      rpc: "decide_listing_proposal",
      body: {
        requested_id: data.id,
        requested_decision: data.decision,
        requested_reason: data.reason.trim(),
      },
    };
  }
  if (
    data.action === "propose" &&
    typeof data.baseVersion === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(data.baseVersion) &&
    Number.isFinite(Date.parse(data.baseVersion)) &&
    typeof data.name === "string" &&
    data.name.trim().length >= 2 &&
    data.name.trim().length <= 200 &&
    typeof data.description === "string" &&
    data.description.trim().length >= 10 &&
    data.description.length <= 5000 &&
    typeof data.website === "string" &&
    typeof data.key === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(data.key)
  ) {
    let services;
    if (data.services !== undefined) {
      if (
        !Array.isArray(data.services) ||
        data.services.length > 30 ||
        data.services.some(
          (x) => typeof x !== "string" || x.trim().length < 2 || x.trim().length > 100,
        )
      )
        throw Error("invalid_studio_command");
      services = [...new Set(data.services.map((x) => String(x).trim()))];
    }
    const phone = telephoneHref(data.phone)?.slice(4);
    const website = data.website.trim() ? safeWebsite(data.website.trim()) : "";
    if (
      !phone ||
      !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone) ||
      website === null ||
      (website && !website.startsWith("https://"))
    )
      throw new Error("invalid_studio_command");
    return {
      rpc: "submit_listing_proposal",
      body: {
        requested_listing_id: data.id,
        requested_key: data.key,
        requested_payload: {
          ...(services === undefined ? {} : { services }),
          baseVersion: data.baseVersion,
          name: data.name.trim(),
          description: data.description.trim(),
          phone,
          website,
        },
      },
    };
  }
  throw new Error("invalid_studio_command");
}
/** @param {unknown} input @param {import('./claim-commands.mjs').ClaimOptions} options */
export async function runStudioCommand(input, options) {
  let command;
  try {
    command = studioCommand(input);
  } catch {
    return { ok: false, code: "invalid_studio_command" };
  }
  return callClaimRpc({
    ...options,
    ...command,
    failureCode: "studio_command_failed",
    errorCode: (message, fallback) => (STUDIO_ERRORS.has(message) ? message : fallback),
  });
}
