import { safeWebsite } from "./presentation.mjs";
import { templateImageUrl, templateLogoUrl } from "./category-art.mjs";

const HOURS_STATEMENT = "Call or visit the business website for current hours.";
const LISTING_IMAGE_SLOT_COUNT = 5;

const STREET_ADDRESS =
  /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?[\p{L}\d.'#-]+(?:\s+[\p{L}\d.'#-]+){0,5}\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|cir|circle|hwy|highway|pkwy|parkway|șt)\b/iu;

/** @param {string} value */
function hasPhoneNumber(value) {
  if (/(?:\+?1[\s.-]*)?\(?[2-9]\d{2}\)?[\s.()-]*[2-9]\d{2}[\s.-]*\d{4}/.test(value)) return true;
  return /(?:\+?1)?[2-9]\d{2}[2-9]\d{6}/.test(value.replace(/\D/g, ""));
}

/** @param {string} value */
function isHoursOfOperation(value) {
  const line = value.trim();
  // "After Hours" is a service name. Only bare schedule labels match here.
  if (/^(hours?|hours of operation|office hours|business hours|hours of ops)$/i.test(line))
    return true;
  if (
    /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b[:\s-].*(?:\d|closed\b)/i.test(
      line,
    )
  )
    return true;
  // "Monday: Open" is a schedule. "Sunday open mic" is a service name.
  if (
    /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b[:\s-].*\bopen$/i.test(
      line,
    )
  )
    return true;
  if (/^\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(line)) return true;
  if (
    /^\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\s*(?:-|–|—|to)\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?$/i.test(
      line,
    )
  )
    return true;
  if (
    line.length <= 80 &&
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(line) &&
    /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(line)
  )
    return true;
  return /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+[A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?$/i.test(
    line,
  );
}

/** @param {string} value */
function isContactFragment(value) {
  const line = value.trim();
  if (hasPhoneNumber(line) || isHoursOfOperation(line) || STREET_ADDRESS.test(line)) return true;
  return /^(?:\d{1,2}\s*[.)]\s*)?(?:reno|sparks)(?:\s*,\s*nv(?:\s+area)?)?$/i.test(line);
}

/** @param {unknown} value */
function isPlaceholderCopy(value) {
  return (
    typeof value === "string" &&
    /lorem|ipsum|loreum|consectetur|adipisicing|eiusmod|incididunt|dolor sit amet/i.test(value)
  );
}

/**
 * @param {{ name?: unknown, primaryCategory?: unknown, cityName?: unknown, description?: unknown }} biz
 */
function resolvedDescription(biz) {
  const name = typeof biz.name === "string" && biz.name.trim() ? biz.name.trim() : "This business";
  const category =
    typeof biz.primaryCategory === "string" && biz.primaryCategory.trim()
      ? biz.primaryCategory.trim()
      : "local services";
  const city = typeof biz.cityName === "string" && biz.cityName.trim() ? biz.cityName.trim() : "Reno";
  const stored = typeof biz.description === "string" ? biz.description.trim() : "";
  if (stored && !isPlaceholderCopy(stored)) return stored;
  return `${name} is listed for ${category.toLowerCase()} in ${city}. Contact the business for current service details.`;
}

/** @param {unknown} values */
function visibleServiceLines(values) {
  const lines = Array.isArray(values) ? values.map(String) : [];
  return [
    ...new Set(
      lines
        .map((value) => value.trim())
        .filter(
          (value) =>
            value.length > 1 &&
            value.length <= 100 &&
            !isContactFragment(value) &&
            !/ready to help/i.test(value) &&
            !/^(everything we offer|our mission|why choose us|about us|contact us|home|gallery|services|read more|learn more|call to|at .+we are guided)\b/i.test(
              value,
            ),
        ),
    ),
  ];
}

/**
 * @param {{
 *   logoUrl?: string | null,
 *   photos?: { id?: unknown, url?: unknown, caption?: unknown }[],
 *   categorySlug?: unknown,
 *   categoryName?: unknown,
 *   businessName?: unknown,
 * }} input
 */
function listingMedia(input) {
  const categoryName =
    typeof input.categoryName === "string" && input.categoryName.trim()
      ? input.categoryName.trim()
      : "Local";
  const businessName =
    typeof input.businessName === "string" && input.businessName.trim()
      ? input.businessName.trim()
      : "This business";
  const illustration = `${categoryName} illustration`;

  /** @type {{ id: string, url: string, alt: string, template: false }[]} */
  const stored = [];
  const seen = new Set();
  for (const photo of input.photos ?? []) {
    const url = safeWebsite(photo?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    stored.push({
      id: `photo-${photo?.id ?? stored.length + 1}`,
      url,
      alt:
        typeof photo?.caption === "string" && photo.caption.trim()
          ? photo.caption.trim()
          : `${businessName}, photo ${stored.length + 1}`,
      template: false,
    });
  }

  const explicitLogo = safeWebsite(input.logoUrl);
  const logo = explicitLogo
    ? { id: "logo", url: explicitLogo, alt: `${businessName} logo`, template: false }
    : {
        id: "logo-template",
        url: templateLogoUrl(input.categorySlug),
        alt: illustration,
        template: true,
      };
  const realImages = stored.filter((image) => image.url !== logo.url);

  /** @type {{ id: string, url: string, alt: string, template: boolean }[]} */
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
    schemaImages: realImages.slice(0, LISTING_IMAGE_SLOT_COUNT).map((image) => image.url),
  };
}

/**
 * Resident-facing shape of one public directory row.
 * The caller has already loaded the row. This module does not fetch.
 *
 * @param {Record<string, any>} row
 * @param {{ cityName?: string, categoryName?: string, categoryNames?: Record<string, string> }} [names]
 */
export function publicListing(row, names = {}) {
  const categorySlugs = Array.isArray(row.category_slugs)
    ? row.category_slugs.filter((value) => typeof value === "string")
    : [];
  const primaryCategorySlug = categorySlugs[0] || String(row.primary_category_slug ?? "");
  const primaryCategory =
    names.categoryName ||
    names.categoryNames?.[primaryCategorySlug] ||
    String((row.primary_category_name ?? primaryCategorySlug) || "Local business");
  const cityName = names.cityName || String(row.city_slug ?? "");
  const name = String(row.display_name ?? "");
  const stableId = Number(row.stable_id);
  const logoUrl = safeWebsite(row.logo_url);
  const photos = Array.isArray(row.photo_urls)
    ? row.photo_urls.map((url, index) => ({
        id: index + 1,
        url: String(url),
        caption: "",
        sortOrder: index,
      }))
    : [];
  const offer = row.offer_title
    ? {
        id: stableId,
        businessId: stableId,
        title: String(row.offer_title),
        details: String(row.offer_details ?? ""),
        code: String(row.offer_code ?? ""),
        expiresOn: row.offer_ends_at ? String(row.offer_ends_at) : null,
        active: true,
      }
    : null;

  return {
    id: stableId,
    sourceId: String(row.id),
    slug: String(row.current_slug),
    name,
    tagline: String(row.tagline ?? ""),
    description: resolvedDescription({
      name,
      primaryCategory,
      cityName,
      description: row.description,
    }),
    phone: String(row.phone_e164 ?? ""),
    street: row.street_address ? String(row.street_address) : "Service area",
    zip: String(row.postal_code ?? ""),
    rating: null,
    reviewCount: null,
    hours: HOURS_STATEMENT,
    featured: row.is_featured === true,
    contentTier: ["basic", "standard", "premium"].includes(row.content_tier)
      ? row.content_tier
      : "basic",
    verified: Boolean(row.information_checked_at),
    ownerVerified: Boolean(row.owner_verified_at),
    citySlug: String(row.city_slug),
    cityName,
    primaryCategory,
    primaryCategorySlug,
    categorySlugs,
    claimedBy: null,
    website: String(row.website_url ?? ""),
    publicEmail: false,
    hideStreet: !row.street_address,
    logoUrl,
    lat: row.latitude == null ? null : Number(row.latitude),
    lng: row.longitude == null ? null : Number(row.longitude),
    categories: categorySlugs.map((slug) => ({
      slug,
      name: names.categoryNames?.[slug] || slug,
    })),
    services: visibleServiceLines(row.services),
    faqs: Array.isArray(row.faqs) ? row.faqs : [],
    projects: Array.isArray(row.projects) ? row.projects : [],
    reviews: [],
    photos,
    media: listingMedia({
      logoUrl,
      photos,
      categorySlug: primaryCategorySlug,
      categoryName: primaryCategory,
      businessName: name,
    }),
    offer,
    informationCheckedAt: row.information_checked_at ? String(row.information_checked_at) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    googlePlaceId: row.google_place_id ? String(row.google_place_id) : null,
  };
}
