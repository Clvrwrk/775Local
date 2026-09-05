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

/** @typedef {{ city?: string, category?: string, q?: string, slug?: string, featured?: boolean, unclaimed?: boolean, limit?: number, offset?: number }} DirectoryFilters */
/** @typedef {{ SUPABASE_URL?: string, SUPABASE_PUBLISHABLE_KEY?: string, DIRECTORY_SUPABASE_URL?: string, DIRECTORY_SUPABASE_PUBLISHABLE_KEY?: string }} PublicDirectoryEnv */
/** @typedef {{ cityName?: string, categoryName?: string }} DisplayNames */

/** Resolve the read-only directory pair atomically, independently of command credentials.
 * @param {PublicDirectoryEnv} env
 */
function directoryTarget(env) {
  const hasDirectoryOverride =
    env.DIRECTORY_SUPABASE_URL !== undefined ||
    env.DIRECTORY_SUPABASE_PUBLISHABLE_KEY !== undefined;
  const baseUrl = (hasDirectoryOverride ? env.DIRECTORY_SUPABASE_URL : env.SUPABASE_URL)?.trim();
  const publishableKey = (
    hasDirectoryOverride ? env.DIRECTORY_SUPABASE_PUBLISHABLE_KEY : env.SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  if (!baseUrl || !publishableKey) throw new Error("Directory data is temporarily unavailable.");
  return { baseUrl, publishableKey };
}

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
  if (Number.isInteger(filters.offset) && Number(filters.offset) >= 0)
    url.searchParams.set("offset", String(filters.offset));
  url.searchParams.set("order", "display_name.asc,stable_id.asc");
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
    zip: String(row.postal_code ?? ""),
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
  const { baseUrl, publishableKey } = directoryTarget(options.env ?? process.env);

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

  try {
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
  } catch {
    throw new Error("Directory data is temporarily unavailable.");
  }
}

/**
 * @param {{
 *   env?: PublicDirectoryEnv,
 *   filters?: DirectoryFilters,
 *   fetchImpl?: typeof fetch
 * }} [options]
 */
export async function fetchDirectoryListings(options = {}) {
  const { baseUrl, publishableKey } = directoryTarget(options.env ?? process.env);

  let url;
  try {
    url = buildDirectoryUrl(baseUrl, options.filters);
  } catch {
    throw new Error("Directory data is temporarily unavailable.");
  }
  if (url.protocol !== "https:") throw new Error("Directory data is temporarily unavailable.");

  try {
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
  } catch {
    throw new Error("Directory data is temporarily unavailable.");
  }
}

const CASE_STUDY_COLUMNS = [
  "id",
  "listing_stable_id",
  "listing_slug",
  "slug",
  "title",
  "summary",
  "client_type",
  "client_location",
  "project_type",
  "started_on",
  "completed_on",
  "investment_range",
  "materials",
  "crew_size",
  "client_need",
  "approach",
  "results",
  "challenges",
  "timeline_note",
  "lessons",
  "future_plans",
  "metrics",
  "testimonial_quote",
  "testimonial_author",
  "testimonial_role",
  "testimonial_rating",
  "before_path",
  "after_path",
  "is_featured",
  "published_at",
].join(",");

/**
 * Storage paths become public object URLs; absolute URLs pass through.
 * @param {string} baseUrl
 * @param {unknown} path
 */
export function mediaUrl(baseUrl, path) {
  if (typeof path !== "string" || !path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/${path.replace(/^\//, "")}`;
}

/**
 * Keyed by listing slug so it can run in parallel with the listing fetch.
 * @param {string} baseUrl
 * @param {string} listingSlug
 */
export function buildCaseStudyUrl(baseUrl, listingSlug) {
  const slug = safeToken(listingSlug);
  if (!slug) throw new Error("listingSlug must be a slug");
  const url = new URL("/rest/v1/directory_case_studies", baseUrl);
  url.searchParams.set("select", CASE_STUDY_COLUMNS);
  url.searchParams.set("listing_slug", `eq.${slug}`);
  url.searchParams.set("order", "is_featured.desc,published_at.desc");
  url.searchParams.set("limit", "4");
  return url;
}

/** @param {unknown} value */
const text = (value) => (value == null ? "" : String(value));

/**
 * Translate a public.directory_case_studies row to the UI shape.
 * @param {Record<string, any>} row
 * @param {string} [baseUrl]
 */
export function mapCaseStudy(row, baseUrl = "") {
  const metrics = Array.isArray(row.metrics)
    ? row.metrics
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          label: text(m.label),
          before: text(m.before),
          after: text(m.after),
          unit: text(m.unit),
        }))
        .filter((m) => m.label)
    : [];
  const quote = text(row.testimonial_quote);
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: text(row.summary),
    clientType: text(row.client_type),
    clientLocation: text(row.client_location),
    projectType: text(row.project_type),
    startedOn: row.started_on ? String(row.started_on) : null,
    completedOn: row.completed_on ? String(row.completed_on) : null,
    investmentRange: text(row.investment_range),
    materials: text(row.materials),
    crewSize: row.crew_size == null ? null : Number(row.crew_size),
    clientNeed: text(row.client_need),
    approach: text(row.approach),
    results: text(row.results),
    challenges: text(row.challenges),
    timelineNote: text(row.timeline_note),
    lessons: text(row.lessons),
    futurePlans: text(row.future_plans),
    metrics,
    testimonial: quote
      ? {
          quote,
          author: text(row.testimonial_author),
          role: text(row.testimonial_role),
          rating: row.testimonial_rating == null ? null : Number(row.testimonial_rating),
        }
      : null,
    beforeUrl: mediaUrl(baseUrl, row.before_path),
    afterUrl: mediaUrl(baseUrl, row.after_path),
    featured: row.is_featured === true,
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

/** Optional project content uses the same anonymous source and a bounded timeout.
 * @param {{ listingSlug: string, env?: PublicDirectoryEnv, fetchImpl?: typeof fetch, timeoutMs?: number }} options
 * @returns {Promise<{status: "available" | "unavailable", studies: ReturnType<typeof mapCaseStudy>[]}>}
 */
export async function fetchListingCaseStudies(options) {
  try {
    const { baseUrl, publishableKey } = directoryTarget(options.env ?? process.env);
    const url = buildCaseStudyUrl(baseUrl, options.listingSlug);
    if (url.protocol !== "https:") throw new Error("Invalid directory source");
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: "GET",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? 1_500),
    });
    if (!response.ok) throw new Error("Unavailable");
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid response");
    return { status: "available", studies: rows.map((row) => mapCaseStudy(row, baseUrl)) };
  } catch {
    // Do not leak provider messages, response bodies, credentials or listing identifiers.
    return { status: "unavailable", studies: [] };
  }
}
