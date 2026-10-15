/** Categories with a shipped art set. Any other slug uses the directory set. */
export const CATEGORY_ART_SLUGS = Object.freeze([
  "directory",
  "auto-repair",
  "dentists",
  "electrical",
  "handyman",
  "hvac",
  "plumbing",
  "restaurants",
  "roofing",
  "screen-repair",
  "veterinarians",
]);

const ART_SLUGS = new Set(CATEGORY_ART_SLUGS);

/**
 * @param {unknown} slug
 */
export function categoryArtSlug(slug) {
  return typeof slug === "string" && ART_SLUGS.has(slug) ? slug : "directory";
}

/**
 * @param {unknown} slug
 */
export function templateLogoUrl(slug) {
  return `/category-art/${categoryArtSlug(slug)}/logo.webp`;
}

/**
 * @param {unknown} slug
 * @param {number} index 1 through 5
 */
export function templateImageUrl(slug, index) {
  const slot = String(index).padStart(2, "0");
  return `/category-art/${categoryArtSlug(slug)}/${slot}.webp`;
}
