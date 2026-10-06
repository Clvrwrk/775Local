// Curated public copy only. These statuses describe accepted work, not deployment or promises.
const curated = [
  {
    slug: "listing-accuracy",
    title: "Clear, accurate business listings",
    summary: "Clean up business names, services and service-area details using verified sources.",
    status: "in_progress",
  },
  {
    slug: "business-claims",
    title: "Claim the right business listing",
    summary: "Give business owners and authorized managers a reviewed path to the correct listing.",
    status: "in_progress",
  },
  {
    slug: "listing-management",
    title: "Useful listing management",
    summary: "Support reviewed edits and scoped team invitations for authorized participants.",
    status: "in_progress",
  },
  {
    slug: "new-listing-requests",
    title: "Request a missing Reno business",
    summary:
      "Review new listing requests for identity, duplicates and local relevance before publication.",
    status: "in_progress",
  },
  {
    slug: "feedback",
    title: "Your ideas and bug reports",
    summary:
      "Add a private review queue for feature requests and bug reports from directory users.",
    status: "in_progress",
  },
  {
    slug: "private-proof",
    title: "Private file evidence",
    summary:
      "Prepare a reviewed file-evidence option for claims after its storage and scanning services are verified.",
    status: "planned",
  },
];

/** Never spread provider or private issue records into public output.
 * @param {Array<Record<string, unknown>>} [entries]
 */
export function publicRoadmap(entries = curated) {
  return entries.map((entry) => {
    if (
      typeof entry.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) ||
      typeof entry.title !== "string" ||
      entry.title.length < 2 ||
      entry.title.length > 120 ||
      typeof entry.summary !== "string" ||
      entry.summary.length < 10 ||
      entry.summary.length > 500 ||
      !["planned", "in_progress", "released"].includes(String(entry.status))
    )
      throw Error("invalid_curated_roadmap");
    return {
      slug: entry.slug,
      title: entry.title,
      summary: entry.summary,
      status: String(entry.status),
    };
  });
}

/** @param {unknown} input */
export function feedbackPayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("invalid_feedback");
  const d = /** @type {Record<string, unknown>} */ (input);
  if (
    Object.keys(d).some(
      (k) => !["kind", "title", "details", "consent", "key", "company"].includes(k),
    ) ||
    !["feature", "bug"].includes(String(d.kind)) ||
    typeof d.title !== "string" ||
    d.title.trim().length < 5 ||
    d.title.length > 120 ||
    typeof d.details !== "string" ||
    d.details.trim().length < 20 ||
    d.details.length > 3000 ||
    d.consent !== true ||
    typeof d.key !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(d.key) ||
    d.company ||
    [...(d.title + d.details)].some((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
    })
  )
    throw Error("invalid_feedback");
  return {
    payload: {
      kind: String(d.kind),
      title: d.title.trim(),
      details: d.details.trim(),
      consent: true,
    },
    key: d.key,
  };
}
