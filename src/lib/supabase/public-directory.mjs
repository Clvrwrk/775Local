const PUBLIC_COLUMNS = [
  "id",
  "stable_id",
  "current_slug",
  "display_name",
  "tagline",
  "description",
  "phone_e164",
  "website_url",
  "street_address",
  "city_slug",
  "region_code",
  "postal_code",
  "latitude",
  "longitude",
  "is_service_area",
  "google_place_id",
  "information_checked_at",
  "owner_verified_at",
  "published_at",
  "category_slugs",
  "is_featured",
  "offer_title",
  "offer_details",
  "offer_code",
  "offer_ends_at",
  "content_tier",
  "primary_category_slug",
  "primary_category_name",
  "services",
  "faqs",
  "projects",
  "photo_urls",
].join(",");

/** @typedef {{ city?: string, category?: string, q?: string, slug?: string, featured?: boolean, unclaimed?: boolean, limit?: number }} DirectoryFilters */
/** @typedef {{ SUPABASE_URL?: string, SUPABASE_PUBLISHABLE_KEY?: string }} PublicDirectoryEnv */
/** @typedef {{ cityName?: string, categoryName?: string }} DisplayNames */

/** @param {unknown} value */
function safeToken(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : "";
}

/**
 * Build a PostgREST URL that can address only the intentionally exposed
 * `public.directory_listings` projection.
 *
 * @param {string} baseUrl
 * @param {DirectoryFilters} [filters]
 */
export function buildDirectoryUrl(baseUrl, filters = {}) {
  const url = new URL("/rest/v1/directory_listings", baseUrl);
  url.searchParams.set("select", PUBLIC_COLUMNS);

  const city = safeToken(filters.city);
  const category = safeToken(filters.category);
  const slug = safeToken(filters.slug);
  if (city) url.searchParams.set("city_slug", `eq.${city}`);
  if (category) url.searchParams.set("category_slugs", `cs.{${category}}`);
  if (slug) url.searchParams.set("current_slug", `eq.${slug}`);
  if (filters.featured === true) url.searchParams.set("is_featured", "eq.true");
  if (filters.unclaimed === true) url.searchParams.set("owner_verified_at", "is.null");

  const q =
    typeof filters.q === "string"
      ? filters.q
          .normalize("NFKC")
          .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
          .trim()
          .slice(0, 80)
      : "";
  if (q) {
    const pattern = `*${q.replace(/\s+/g, "*")}*`;
    url.searchParams.set(
      "or",
      `(display_name.ilike.${pattern},tagline.ilike.${pattern},description.ilike.${pattern})`,
    );
  }

  const requestedLimit = Number.isFinite(filters.limit) ? Number(filters.limit) : 100;
  url.searchParams.set("limit", String(Math.min(100, Math.max(1, Math.trunc(requestedLimit)))));
  url.searchParams.set("order", "is_featured.desc,display_name.asc");
  return url;
}

/**
 * Translate the public projection to the legacy UI shape while the UI is being
 * migrated. Deliberately absent values stay absent instead of being invented.
 *
 * @param {Record<string, any>} row
 * @param {DisplayNames} [names]
 */
export function mapDirectoryListing(row, names = {}) {
  const categories = Array.isArray(row.category_slugs)
    ? row.category_slugs.filter((value) => typeof value === "string")
    : [];
  const stableId = Number(row.stable_id);
  const primaryCategorySlug = String(row.primary_category_slug ?? categories[0] ?? "");
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
    name: String(row.display_name),
    tagline: String(row.tagline ?? ""),
    description: String(row.description ?? ""),
    phone: String(row.phone_e164 ?? ""),
    street: row.street_address ? String(row.street_address) : "Service area",
    zip: String(row.postal_code),
    rating: null,
    reviewCount: null,
    hours: "Call or visit the business website for current hours.",
    featured: row.is_featured === true,
    contentTier: ["basic", "standard", "premium"].includes(row.content_tier)
      ? row.content_tier
      : "basic",
    verified: Boolean(row.information_checked_at),
    ownerVerified: Boolean(row.owner_verified_at),
    citySlug: String(row.city_slug),
    cityName: names.cityName || String(row.city_slug),
    primaryCategory:
      names.categoryName ||
      String((row.primary_category_name ?? primaryCategorySlug) || "Local business"),
    primaryCategorySlug,
    categorySlugs: categories,
    claimedBy: null,
    website: String(row.website_url ?? ""),
    publicEmail: false,
    hideStreet: !row.street_address,
    coverUrl: Array.isArray(row.photo_urls) && row.photo_urls[0] ? String(row.photo_urls[0]) : null,
    lat: row.latitude == null ? null : Number(row.latitude),
    lng: row.longitude == null ? null : Number(row.longitude),
    categories: categories.map((categorySlug) => ({ slug: categorySlug, name: categorySlug })),
    services: Array.isArray(row.services) ? row.services.map(String) : [],
    faqs: Array.isArray(row.faqs) ? row.faqs : [],
    projects: Array.isArray(row.projects) ? row.projects : [],
    reviews: [],
    photos: Array.isArray(row.photo_urls)
      ? row.photo_urls.map((url, index) => ({
          id: index + 1,
          url: String(url),
          caption: "",
          sortOrder: index,
        }))
      : [],
    offer,
    informationCheckedAt: row.information_checked_at ? String(row.information_checked_at) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    googlePlaceId: row.google_place_id ? String(row.google_place_id) : null,
  };
}

/**
 * Fetch only categories that currently contain a public listing. The database
 * projection enforces the zero-listing exclusion before data reaches the UI.
 *
 * @param {{ env?: PublicDirectoryEnv, city?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchDirectoryCategories(options = {}) {
  const env = options.env ?? process.env;
  const baseUrl = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!baseUrl && !publishableKey) return [];
  if (!baseUrl || !publishableKey) throw new Error("Directory data is temporarily unavailable.");

  const city = safeToken(options.city);
  let url;
  try {
    url = new URL(
      city ? "/rest/v1/directory_city_categories" : "/rest/v1/directory_categories",
      baseUrl,
    );
  } catch {
    throw new Error("Directory data is temporarily unavailable.");
  }
  if (url.protocol !== "https:") throw new Error("Directory data is temporarily unavailable.");
  url.searchParams.set(
    "select",
    city ? "slug,name,description,listing_count,city_slug" : "slug,name,description,listing_count",
  );
  if (city) url.searchParams.set("city_slug", `eq.${city}`);
  url.searchParams.set("order", "listing_count.desc,name.asc");
  url.searchParams.set("limit", "2000");

  const response = await (options.fetchImpl ?? fetch)(url, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Directory data is temporarily unavailable.");
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Directory data is temporarily unavailable.");
  return rows.map((row) => ({
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description ?? "Local businesses serving Northern Nevada."),
    listingCount: Number(row.listing_count ?? 0),
  }));
}

/**
 * @param {{
 *   env?: PublicDirectoryEnv,
 *   filters?: DirectoryFilters,
 *   fetchImpl?: typeof fetch
 * }} [options]
 */
export async function fetchDirectoryListings(options = {}) {
  const env = options.env ?? process.env;
  const baseUrl = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!baseUrl && !publishableKey) return [];
  if (!baseUrl || !publishableKey) {
    throw new Error("Directory data is temporarily unavailable.");
  }

  let url;
  try {
    url = buildDirectoryUrl(baseUrl, options.filters);
  } catch {
    throw new Error("Directory data is temporarily unavailable.");
  }
  if (url.protocol !== "https:") throw new Error("Directory data is temporarily unavailable.");

  const response = await (options.fetchImpl ?? fetch)(url, {
    method: "GET",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Directory data is temporarily unavailable.");

  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Directory data is temporarily unavailable.");
  return rows.map((row) => mapDirectoryListing(row));
}
