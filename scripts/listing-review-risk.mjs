const CORPUS_RISK_VERSION = "entity-risk-v1";

function normalized(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function addressKey(candidate) {
  const street = normalized(candidate.street_address);
  if (!street) return "";
  return `${street}|${normalized(candidate.city_slug)}|${normalized(candidate.postal_code)}`;
}

function groupedIndexes(candidates, keyFor) {
  const groups = new Map();
  for (const [index, candidate] of candidates.entries()) {
    const key = keyFor(candidate);
    if (!key) continue;
    const indexes = groups.get(key) ?? [];
    indexes.push(index);
    groups.set(key, indexes);
  }
  return groups;
}

function addRisk(risks, indexes, code) {
  for (const index of indexes) risks[index].add(code);
}

/**
 * Add deterministic corpus-level review risks without mutating the caller's candidates.
 * @param {Array<Record<string, any>>} candidates
 */
export function applyCorpusReviewRisks(candidates) {
  const risks = candidates.map(() => new Set());
  const duplicates = groupedIndexes(candidates, (candidate) => {
    const address = addressKey(candidate);
    const name = normalized(candidate.normalized_name);
    return name && address ? `${name}|${address}` : "";
  });
  for (const indexes of duplicates.values()) {
    if (indexes.length > 1) addRisk(risks, indexes, "duplicate_title_address");
  }

  const nameGroups = groupedIndexes(candidates, (candidate) =>
    normalized(candidate.normalized_name),
  );
  const domainGroups = groupedIndexes(candidates, (candidate) =>
    normalized(candidate.diversity_key),
  );
  for (const groups of [nameGroups, domainGroups]) {
    for (const indexes of groups.values()) {
      const distinctAddresses = new Set(
        indexes.map((index) => addressKey(candidates[index])).filter(Boolean),
      );
      if (distinctAddresses.size > 1) {
        addRisk(risks, indexes, "multi_location_chain_or_franchise_review");
      }
    }
  }

  return candidates.map((candidate, index) => {
    const corpusRisks = [...risks[index]];
    const screeningReasons = [...new Set([...(candidate.screening_reasons ?? []), ...corpusRisks])];
    const screeningStatus =
      candidate.screening_status === "ineligible"
        ? "ineligible"
        : screeningReasons.length > 0
          ? "needs_review"
          : "eligible";
    return {
      ...candidate,
      screening_status: screeningStatus,
      screening_reasons: screeningReasons,
      evidence: {
        ...(candidate.evidence ?? {}),
        corpus_review_risk_version: CORPUS_RISK_VERSION,
        corpus_review_risks: corpusRisks,
      },
    };
  });
}

/** @param {Record<string, any>} candidate */
export function canSelectForLaunch(candidate) {
  return (
    candidate.review_status === "accepted" &&
    Boolean(candidate.reviewed_by) &&
    Boolean(candidate.reviewed_at) &&
    candidate.screening_status === "eligible" &&
    Array.isArray(candidate.screening_reasons) &&
    candidate.screening_reasons.length === 0
  );
}
