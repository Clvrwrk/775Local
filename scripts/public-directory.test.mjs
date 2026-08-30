import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDirectoryUrl,
  fetchDirectoryCategories,
  fetchDirectoryListings,
  mapDirectoryListing,
} from "../src/lib/supabase/public-directory.mjs";

const row = {
  id: "00000000-0000-4000-8000-000000000001",
  stable_id: 17,
  current_slug: "sparks-screen-shop",
  display_name: "Sparks Screen Shop",
  tagline: "Local screen repair",
  description: "Repairing screens across Sparks.",
  phone_e164: "+17755550100",
  website_url: "https://example.com",
  street_address: null,
  city_slug: "sparks",
  region_code: "NV",
  postal_code: "89431",
  latitude: 39.53,
  longitude: -119.75,
  is_service_area: true,
  google_place_id: "place-1",
  information_checked_at: "2026-08-24T20:00:00Z",
  owner_verified_at: null,
  published_at: "2026-08-24T20:00:00Z",
  category_slugs: ["screen-repair"],
  is_featured: false,
  content_tier: "standard",
  primary_category_slug: "screen-repair",
  primary_category_name: "Screen Repair",
  services: ["Window screens"],
  faqs: [],
  projects: [],
  photo_urls: [],
  offer_title: null,
  offer_details: null,
  offer_code: null,
  offer_ends_at: null,
};

test("the REST query targets only the reviewed public projection", () => {
  const url = buildDirectoryUrl("https://preview.supabase.co", {
    city: "sparks",
    category: "screen-repair",
    q: "screen shop",
    slug: "sparks-screen-shop",
    unclaimed: true,
    limit: 12,
  });

  assert.equal(url.origin, "https://preview.supabase.co");
  assert.equal(url.pathname, "/rest/v1/directory_listings");
  assert.equal(url.searchParams.get("city_slug"), "eq.sparks");
  assert.equal(url.searchParams.get("category_slugs"), "cs.{screen-repair}");
  assert.equal(url.searchParams.get("current_slug"), "eq.sparks-screen-shop");
  assert.equal(url.searchParams.get("owner_verified_at"), "is.null");
  assert.equal(url.searchParams.get("limit"), "12");
  assert.doesNotMatch(url.toString(), /email|claim|lead|billing|source_payload/i);
});

test("the public row mapper does not invent ratings, reviews, ownership, or a street", () => {
  const listing = mapDirectoryListing(row, {
    cityName: "Sparks",
    categoryName: "Screen Repair",
  });

  assert.equal(listing.id, 17);
  assert.equal(listing.street, "Service area");
  assert.equal(listing.rating, null);
  assert.equal(listing.reviewCount, null);
  assert.equal(listing.claimedBy, null);
  assert.equal(listing.email, undefined);
  assert.equal(listing.verified, true);
  assert.equal(listing.contentTier, "standard");
  assert.equal(listing.primaryCategory, "Screen Repair");
});

test("category discovery returns only non-empty database projections", async () => {
  const requests = [];
  const categories = await fetchDirectoryCategories({
    env: {
      SUPABASE_URL: "https://preview.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
    },
    city: "sparks",
    fetchImpl: async (input) => {
      requests.push(String(input));
      return new Response(
        JSON.stringify([
          {
            city_slug: "sparks",
            slug: "screen-repair",
            name: "Screen Repair",
            description: "Repair services",
            listing_count: 3,
          },
        ]),
      );
    },
  });
  assert.equal(new URL(requests[0]).pathname, "/rest/v1/directory_city_categories");
  assert.equal(new URL(requests[0]).searchParams.get("city_slug"), "eq.sparks");
  assert.deepEqual(categories, [
    {
      slug: "screen-repair",
      name: "Screen Repair",
      description: "Repair services",
      listingCount: 3,
    },
  ]);
});

test("an unconfigured environment fails safe without a synthetic data fallback", async () => {
  let called = false;
  const listings = await fetchDirectoryListings({
    env: {},
    fetchImpl: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });

  assert.deepEqual(listings, []);
  assert.equal(called, false);
});

test("configured requests use only the publishable key and reject provider errors", async () => {
  const requests = [];
  const listings = await fetchDirectoryListings({
    env: {
      SUPABASE_URL: "https://preview.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
    },
    filters: { city: "sparks" },
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), init });
      return new Response(JSON.stringify([row]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(listings.length, 1);
  assert.equal(requests[0].init.headers.apikey, "publishable-test-key");
  assert.equal(requests[0].init.headers.Authorization, "Bearer publishable-test-key");
  assert.doesNotMatch(JSON.stringify(requests[0]), /service.role|service_role/i);

  await assert.rejects(
    fetchDirectoryListings({
      env: {
        SUPABASE_URL: "https://preview.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
      },
      fetchImpl: async () => new Response("provider detail", { status: 500 }),
    }),
    /Directory data is temporarily unavailable/,
  );
});
