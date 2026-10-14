import { safeWebsite } from "./presentation.mjs";

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

export const LISTING_IMAGE_SLOT_COUNT = 5;

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

/**
 * One logo slot and five image slots. Real enriched media fills first.
 * Template slots never replace a real asset and never pad past five images.
 *
 * @param {{
 *   logoUrl?: unknown,
 *   photos?: { id?: unknown, url?: unknown, caption?: unknown }[],
 *   coverUrl?: unknown,
 *   categorySlug?: unknown,
 *   categoryName?: unknown,
 *   businessName?: unknown,
 * }} input
 */
export function listingMediaSlots(input) {
  const categoryName =
    typeof input.categoryName === "string" && input.categoryName.trim()
      ? input.categoryName.trim()
      : "Local";
  const businessName =
    typeof input.businessName === "string" && input.businessName.trim()
      ? input.businessName.trim()
      : "This business";
  const illustration = `${categoryName} illustration`;
  const realLogo = safeWebsite(input.logoUrl);
  const logo = realLogo
    ? { id: "logo", url: realLogo, alt: `${businessName} logo`, template: false }
    : { id: "logo-template", url: templateLogoUrl(input.categorySlug), alt: illustration, template: true };

  /** @type {{ id: string, url: string, alt: string, template: false }[]} */
  const realImages = [];
  const seen = new Set();
  for (const photo of input.photos ?? []) {
    const url = safeWebsite(photo?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    realImages.push({
      id: `photo-${photo?.id ?? realImages.length + 1}`,
      url,
      alt:
        typeof photo?.caption === "string" && photo.caption.trim()
          ? photo.caption.trim()
          : `${businessName}, photo ${realImages.length + 1}`,
      template: false,
    });
  }
  if (!realImages.length) {
    const cover = safeWebsite(input.coverUrl);
    if (cover) {
      realImages.push({
        id: "cover",
        url: cover,
        alt: `${businessName}, photo 1`,
        template: false,
      });
    }
  }

  const images = realImages.slice(0, LISTING_IMAGE_SLOT_COUNT);
  let templateIndex = 1;
  while (images.length < LISTING_IMAGE_SLOT_COUNT) {
    images.push({
      id: `template-${String(templateIndex).padStart(2, "0")}`,
      url: templateImageUrl(input.categorySlug, templateIndex),
      alt: illustration,
      template: true,
    });
    templateIndex += 1;
  }

  return {
    logo,
    images,
    more: realImages.slice(LISTING_IMAGE_SLOT_COUNT),
  };
}
