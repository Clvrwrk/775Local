import { createServerFn } from "@tanstack/react-start";
import { CATEGORIES, CITIES } from "@/data/seed";
import {
  fetchDirectoryCategories,
  fetchDirectoryListings,
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
};

const LAUNCH_CITIES = new Set(["reno", "sparks"]);
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
const cityNames = new Map(cities.map((city) => [city.slug, city.name]));
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
  const rows = await fetchDirectoryListings({ filters });
  return rows.map((row) => enrichCard(row));
}

function ownerAccessUnavailable<T>(): T {
  throw new Error("Owner access is unavailable until the WorkOS connection is configured.");
}

export const listCities = createServerFn({ method: "GET" }).handler(async () => cities);

export const listCategories = createServerFn({ method: "GET" }).handler(async () => categories);

export const listPublishedCategories = createServerFn({ method: "GET" })
  .validator((input?: { city?: string }) => ({ city: (input?.city ?? "").trim() }))
  .handler(async ({ data }) => {
    const rows = await fetchDirectoryCategories({ city: data.city });
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
  .handler(async ({ data: slug }) => cities.find((city) => city.slug === slug) ?? null);

export const getCategory = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const visible = await fetchDirectoryCategories();
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
  }))
  .handler(async ({ data }) => {
    return fetchCards({
      q: data.q,
      city: data.city,
      category: data.category,
      unclaimed: data.unclaimed,
      limit: 100,
    });
  });

export const getBusiness = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const rows = await fetchCards({ slug, limit: 1 });
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

export const claimListing = createServerFn({ method: "POST" })
  .validator(
    (input: {
      businessId: number;
      method: "domain" | "card" | "storefront" | "vehicle";
      filename: string;
    }) => input,
  )
  .handler(async () =>
    ownerAccessUnavailable<{
      slug: string;
      already: boolean;
      method: "domain" | "card" | "storefront" | "vehicle";
    }>(),
  );

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
