import { createServerFn } from "@tanstack/react-start";
import { pilotFilters, categoryForQuery } from "@/lib/directory/pilot.mjs";
import { CATEGORIES, CITIES } from "@/data/seed";
import {
  fetchDirectoryCategories,
  fetchDirectoryListings,
  fetchListingCaseStudies,
} from "@/lib/supabase/public-directory.mjs";
import type {
  BusinessCard,
  BusinessDetail,
  CampaignRow,
  Category,
  City,
  LeadRow,
  ResidentRow,
} from "./types";

type DirectoryFilters = {
  city?: string;
  category?: string;
  q?: string;
  slug?: string;
  featured?: boolean;
  unclaimed?: boolean;
  limit?: number;
  offset?: number;
};

const LAUNCH_CITIES = new Set(["reno"]);
const LAUNCH_CATEGORIES = new Set([
  "screen-repair",
  "hvac",
  "plumbing",
  "electrical",
  "auto-repair",
  "restaurants",
  "dentists",
  "handyman",
  "roofing",
  "veterinarians",
]);

const cities: City[] = CITIES.filter((city) => LAUNCH_CITIES.has(city.slug)).map((city, index) => ({
  ...city,
  id: index + 1,
}));
const categories: Category[] = CATEGORIES.filter((category) =>
  LAUNCH_CATEGORIES.has(category.slug),
).map((category, index) => ({ ...category, id: index + 1 }));
const cityNames = new Map(CITIES.map((city) => [city.slug, city.name]));
const categoryNames = new Map(categories.map((category) => [category.slug, category.name]));

function enrichCard(raw: Record<string, unknown>): BusinessCard {
  const categorySlugs = Array.isArray(raw.categorySlugs)
    ? raw.categorySlugs.filter((slug): slug is string => typeof slug === "string")
    : [];
  const primaryCategorySlug = categorySlugs[0] ?? String(raw.primaryCategorySlug ?? "");
  return {
    ...(raw as unknown as BusinessCard),
    cityName: cityNames.get(String(raw.citySlug)) ?? String(raw.citySlug),
    primaryCategory:
      categoryNames.get(primaryCategorySlug) ?? String(raw.primaryCategory ?? "Local business"),
    primaryCategorySlug,
  };
}

async function fetchCards(filters: DirectoryFilters = {}): Promise<BusinessCard[]> {
  const rows = await fetchDirectoryListings({ filters: pilotFilters(filters) });
  return rows.map((row) => enrichCard(row));
}

function ownerAccessUnavailable<T>(): T {
  throw new Error("Owner access is unavailable until the WorkOS connection is configured.");
}

export const listCities = createServerFn({ method: "GET" }).handler(async () => cities);

export const listCategories = createServerFn({ method: "GET" }).handler(async () => categories);

export const listPublishedCategories = createServerFn({ method: "GET" })
  .validator((input?: { city?: string }) => ({ city: (input?.city ?? "").trim() }))
  .handler(async () => {
    const rows = await fetchDirectoryCategories({ city: "reno" });
    return rows.map((row, index) => {
      const known = categories.find((category) => category.slug === row.slug);
      return {
        id: known?.id ?? index + 1,
        slug: row.slug,
        name: row.name,
        description: row.description,
        synonyms: known?.synonyms ?? "",
        icon: known?.icon ?? "map-pin",
        listingCount: row.listingCount,
      } satisfies Category;
    });
  });

export const getCity = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(
    async ({ data: slug }) =>
      CITIES.filter((city) => ["reno", "sparks"].includes(city.slug))
        .map((city, index) => ({ ...city, id: index + 1 }))
        .find((city) => city.slug === slug) ?? null,
  );

export const getCategory = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const visible = await fetchDirectoryCategories({ city: "reno" });
    const row = visible.find((category) => category.slug === slug);
    if (!row) return null;
    const known = categories.find((category) => category.slug === slug);
    return {
      id: known?.id ?? 0,
      slug: row.slug,
      name: row.name,
      description: row.description,
      synonyms: known?.synonyms ?? "",
      icon: known?.icon ?? "map-pin",
      listingCount: row.listingCount,
    } satisfies Category;
  });

export type SearchInput = {
  page?: number;
  q?: string;
  city?: string;
  category?: string;
  unclaimed?: boolean;
};

export const searchBusinesses = createServerFn({ method: "GET" })
  .validator((input: SearchInput) => ({
    q: (input.q ?? "").trim(),
    city: (input.city ?? "").trim(),
    category: (input.category ?? "").trim(),
    unclaimed: Boolean(input.unclaimed),
    page: Number.isInteger(input.page)
      ? Math.max(1, Math.min(1000, Number(input.page)))
      : undefined,
  }))
  .handler(async ({ data }) => {
    return fetchCards({
      q: categoryForQuery(data.q) ? "" : data.q,
      city: "reno",
      category: data.category || categoryForQuery(data.q) || "",
      unclaimed: data.unclaimed,
      limit: data.page ? 25 : 100,
      offset: data.page ? (data.page - 1) * 24 : 0,
    });
  });

export const getBusiness = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    // Case studies are optional and keyed by slug, so they load alongside the listing
    // with a 1.5-second ceiling and an explicit unavailable state.
    const [rows, caseStudies] = await Promise.all([
      fetchCards({ slug, limit: 1 }),
      fetchListingCaseStudies({ listingSlug: slug }),
    ]);
    const card = rows[0];
    if (!card) return null;
    return {
      ...card,
      email: "",
      lat: (card as BusinessCard & { lat?: number | null }).lat ?? null,
      lng: (card as BusinessCard & { lng?: number | null }).lng ?? null,
      categories: card.categorySlugs.map((categorySlug) => ({
        slug: categorySlug,
        name: categoryNames.get(categorySlug) ?? categorySlug,
      })),
      reviews: [] as BusinessDetail["reviews"],
      photos: (card as BusinessCard & { photos?: BusinessDetail["photos"] }).photos ?? [],
      services: (card as BusinessCard & { services?: string[] }).services ?? [],
      faqs: (card as BusinessCard & { faqs?: BusinessDetail["faqs"] }).faqs ?? [],
      projects: (card as BusinessCard & { projects?: BusinessDetail["projects"] }).projects ?? [],
      offer: (card as BusinessCard & { offer?: BusinessDetail["offer"] }).offer ?? null,
      caseStudies: caseStudies.studies,
      caseStudiesStatus: caseStudies.status,
    } satisfies BusinessDetail;
  });

export const featuredBusinesses = createServerFn({ method: "GET" }).handler(async () =>
  fetchCards({ featured: true, limit: 8 }),
);

export const homeBusinesses = createServerFn({ method: "GET" }).handler(async () =>
  fetchCards({ limit: 8 }),
);

export const submitLead = createServerFn({ method: "POST" })
  .validator(
    (input: {
      businessId: number;
      name: string;
      phone: string;
      email: string;
      zip: string;
      message: string;
    }) => input,
  )
  .handler(async () => ownerAccessUnavailable<{ ok: true }>());

export const createListing = createServerFn({ method: "POST" })
  .validator(
    (input: {
      name: string;
      citySlug: string;
      categorySlug: string;
      phone: string;
      street: string;
      zip: string;
      description: string;
    }) => input,
  )
  .handler(async () => ownerAccessUnavailable<{ slug: string }>());

export const myListings = createServerFn({ method: "GET" }).handler(
  async () => [] as BusinessCard[],
);

export const myLeads = createServerFn({ method: "GET" }).handler(async () => [] as LeadRow[]);

export const getResident = createServerFn({ method: "GET" }).handler(
  async () => null as ResidentRow | null,
);

export const saveResident = createServerFn({ method: "POST" })
  .validator(
    (input: { displayName: string; zip: string; citySlug: string; interests: string }) => input,
  )
  .handler(async () => ownerAccessUnavailable<{ ok: true }>());

export const myCampaigns = createServerFn({ method: "GET" }).handler(
  async () => [] as CampaignRow[],
);

export const sendCampaign = createServerFn({ method: "POST" })
  .validator(
    (input: {
      businessId: number;
      name: string;
      channel: "virtual" | "direct_mail";
      citySlug: string;
      categorySlug: string;
      message: string;
      includeOffer?: boolean;
    }) => input,
  )
  .handler(async () => ownerAccessUnavailable<{ reach: number; includedOffer: string }>());
