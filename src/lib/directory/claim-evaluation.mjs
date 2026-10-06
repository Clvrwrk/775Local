/** Offline evaluation only. This module never creates participation or calls a grant API.
 * A model score cannot establish identity, authority, scope, freshness or calibration.
 * @param {Record<string, any>} input
 */
export function evaluateClaimAuthority(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
  const reasons = [];
  for (const gate of [
    "identityVerified",
    "authorityVerified",
    "listingMatches",
    "roleMatches",
    "evidenceCurrent",
  ]) {
    if (input[gate] !== true) reasons.push(gate);
  }
  if (input.conflict !== false) reasons.push("ownership_conflict_or_unknown");
  if (
    typeof input.confidence !== "number" ||
    !Number.isFinite(input.confidence) ||
    input.confidence <= 0.95 ||
    input.confidence > 1
  )
    reasons.push("confidence_not_strictly_above_95_percent");
  if (
    input.calibration?.validated !== true ||
    typeof input.calibration?.artifact !== "string" ||
    !input.calibration.artifact.trim()
  )
    reasons.push("calibration_not_established");
  return {
    disposition: "human_review",
    automaticGrant: false,
    candidateEligible: reasons.length === 0,
    reasons: [...reasons, "automatic_grants_disabled"],
  };
}
