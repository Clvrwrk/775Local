const TIER_ORDER = Object.freeze({ basic: 0, standard: 1, premium: 2 });

function count(value) {
  if (Array.isArray(value)) return value.filter(Boolean).length;
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function scoreEnrichment(candidate = {}) {
  const evidence = candidate.evidence ?? candidate.enrichment ?? {};
  const publishablePhotoCount = count(
    evidence.publishablePhotos ?? evidence.rightsClearedPhotos ?? candidate.publishablePhotos,
  );
  const faqCount = count(evidence.faqs ?? candidate.faqs);
  const projectCount = count(evidence.projects ?? candidate.projects);
  const serviceCount = count(evidence.services ?? candidate.services);
  const descriptionLength = text(evidence.description ?? candidate.description).length;
  const hasPhone = Boolean(text(evidence.phone ?? candidate.phone) || count(evidence.phones));
  const hasWebsite = Boolean(text(evidence.website ?? candidate.website ?? candidate.serp?.url));
  const hasAddress = Boolean(text(evidence.address ?? candidate.address));
  const hasHours = Boolean(text(evidence.hours ?? evidence.hoursEvidence ?? candidate.hours));
  const hasIdentity =
    Boolean(text(candidate.name ?? candidate.displayName ?? evidence.title)) &&
    (hasPhone || hasWebsite || hasAddress);

  const modules = {
    description: descriptionLength >= 120,
    services: serviceCount >= 3,
    hours: hasHours,
    faqs: faqCount >= 3,
    projects: projectCount >= 2,
    photos: publishablePhotoCount >= 3,
  };
  const moduleCount = Object.values(modules).filter(Boolean).length;
  const score = Math.min(
    100,
    (hasIdentity ? 20 : 0) +
      (modules.description ? 10 : 0) +
      (modules.services ? 10 : 0) +
      (modules.hours ? 10 : 0) +
      (modules.faqs ? 15 : 0) +
      (modules.projects ? 15 : 0) +
      (modules.photos ? 20 : 0),
  );

  return {
    score,
    hasIdentity,
    moduleCount,
    publishablePhotoCount,
    faqCount,
    projectCount,
    standardEligible: hasIdentity && moduleCount >= 2 && score >= 40,
    premiumEligible:
      hasIdentity && modules.photos && modules.faqs && modules.projects && score >= 75,
    modules,
  };
}

function quota(total, ratio) {
  return Math.round(total * ratio);
}

function stableKey(candidate, index) {
  return String(
    candidate.stableId ?? candidate.id ?? candidate.slug ?? candidate.serp?.domain ?? index,
  );
}

export function assignSeedTierMix(
  candidates,
  ratios = { basic: 0.6, standard: 0.3, premium: 0.1 },
) {
  const rows = (candidates ?? []).map((candidate, index) => ({
    candidate,
    index,
    key: stableKey(candidate, index),
    enrichment: scoreEnrichment(candidate),
  }));
  const total = rows.length;
  const target = {
    premium: quota(total, ratios.premium),
    standard: quota(total, ratios.standard),
  };
  target.basic = Math.max(0, total - target.premium - target.standard);

  const ranked = [...rows].sort(
    (left, right) =>
      right.enrichment.score - left.enrichment.score ||
      Number(left.candidate.serpRank ?? Number.MAX_SAFE_INTEGER) -
        Number(right.candidate.serpRank ?? Number.MAX_SAFE_INTEGER) ||
      left.key.localeCompare(right.key),
  );
  const assigned = new Map(rows.map((row) => [row.index, "basic"]));
  const premium = ranked.filter((row) => row.enrichment.premiumEligible).slice(0, target.premium);
  for (const row of premium) assigned.set(row.index, "premium");
  const premiumIndexes = new Set(premium.map((row) => row.index));
  const standard = ranked
    .filter((row) => !premiumIndexes.has(row.index) && row.enrichment.standardEligible)
    .slice(0, target.standard);
  for (const row of standard) assigned.set(row.index, "standard");

  const assignments = rows.map((row) => ({
    ...row.candidate,
    contentTier: assigned.get(row.index),
    tierScore: row.enrichment.score,
    tierEvidence: row.enrichment,
  }));
  const actual = assignments.reduce(
    (counts, row) => ({ ...counts, [row.contentTier]: counts[row.contentTier] + 1 }),
    { basic: 0, standard: 0, premium: 0 },
  );

  return {
    assignments,
    target,
    actual,
    shortfalls: {
      premium: Math.max(0, target.premium - actual.premium),
      standard: Math.max(0, target.standard - actual.standard),
    },
  };
}

export function defaultImportedTier(listing) {
  return {
    ...listing,
    contentTier: "basic",
    informationStatus: "unverified",
    claimed: false,
  };
}

export function compareContentTiers(left, right) {
  return (TIER_ORDER[left] ?? -1) - (TIER_ORDER[right] ?? -1);
}
