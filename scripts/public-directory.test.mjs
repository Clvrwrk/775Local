import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listingLocationStructuredData,
  listingPublicLocationLabel,
} from "../src/lib/directory/structured-data.mjs";
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

test("actual public row locality reaches visible labels and JSON-LD independently from discovery", () => {
  const physical = mapDirectoryListing(
    {
      ...row,
      city_slug: "reno",
      street_address: "1757 Synthetic Avenue",
      is_service_area: false,
      address_locality: "Sparks",
      service_area_names: ["Reno", "Sparks"],
    },
    { cityName: "Reno" },
  );
  assert.equal(physical.cityName, "Reno");
  assert.equal(listingPublicLocationLabel(physical), "1757 Synthetic Avenue, Sparks, NV 89431");
  assert.equal(listingLocationStructuredData(physical).address.addressLocality, "Sparks");
  assert.deepEqual(listingLocationStructuredData(physical).areaServed, [
    "Reno, Nevada",
    "Sparks, Nevada",
  ]);
  const service = mapDirectoryListing(
    { ...row, city_slug: "reno", address_locality: "Reno", service_area_names: ["Reno", "Sparks"] },
    { cityName: "Reno" },
  );
  assert.equal(service.verifiedAddressLocality, null);
  assert.equal(service.zip, "");
  assert.equal(listingLocationStructuredData(service).address, undefined);
  assert.equal(listingPublicLocationLabel(service), "Serving Reno, Sparks, Nevada");
});

test("mapper masks all private location fields when street is absent or service-area privacy applies", () => {
  for (const privateRow of [
    row,
    { ...row, is_service_area: false },
    { ...row, street_address: "Stored private address", address_locality: "Sparks" },
    {
      ...row,
      street_address: "Stored private address",
      is_service_area: false,
      hide_street: true,
      address_locality: "Sparks",
    },
    { ...row, street_address: "   ", is_service_area: false },
    { ...row, street_address: "Service area", is_service_area: false },
  ]) {
    const mapped = mapDirectoryListing(privateRow);
    assert.equal(mapped.street, "Service area");
    assert.equal(mapped.hideStreet, true);
    assert.equal(mapped.zip, "");
    assert.equal(mapped.verifiedAddressLocality, null);
    assert.equal(mapped.lat, null);
    assert.equal(mapped.lng, null);
    assert.doesNotMatch(JSON.stringify(mapped), /Stored private address|39\.53|-119\.75|89431/);
  }
  const physical = mapDirectoryListing({
    ...row,
    street_address: "1757 Synthetic Avenue",
    is_service_area: false,
    address_locality: "Sparks",
  });
  assert.equal(physical.street, "1757 Synthetic Avenue");
  assert.equal(physical.hideStreet, false);
  assert.equal(physical.zip, "89431");
  assert.equal(physical.verifiedAddressLocality, "Sparks");
  assert.equal(physical.lat, 39.53);
  assert.equal(physical.lng, -119.75);
});

test("old schema/cache permits only one safe public GET fallback with identical filters and auth", async () => {
  for (const code of ["42703", "PGRST204"]) {
    const requests = [];
    const result = await fetchDirectoryListings({
      env: {
        SUPABASE_URL: "https://fixture.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
      },
      filters: { slug: "sparks-screen-shop", city: "sparks" },
      fetchImpl: async (url, init) => {
        requests.push({ url: new URL(url), init });
        return requests.length === 1
          ? Response.json(
              { code, message: "column directory_listings.address_locality does not exist" },
              { status: 400 },
            )
          : Response.json([row]);
      },
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].hideStreet, true);
    assert.equal(result[0].street, "Service area");
    assert.equal(result[0].zip, "");
    assert.equal(result[0].verifiedAddressLocality, null);
    assert.equal(result[0].lat, null);
    assert.equal(result[0].lng, null);
    assert.doesNotMatch(JSON.stringify(result), /39\.53|-119\.75|89431/);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].url.searchParams.get("current_slug"), "eq.sparks-screen-shop");
    assert.equal(requests[1].url.searchParams.get("city_slug"), "eq.sparks");
    assert.deepEqual(requests[0].init.headers, requests[1].init.headers);
    assert.doesNotMatch(
      requests[1].url.searchParams.get("select"),
      /hours_text|about_text|address_locality|service_area_names|email|evidence/,
    );
  }
});

test("auth, unrelated schema, transport and a second cache failure abstain without extra retries", async () => {
  for (const [status, code, message] of [
    [401, "42703", "hours_text"],
    [400, "42501", "hours_text"],
    [400, "42703", "private_evidence"],
    [503, "42703", "hours_text"],
  ]) {
    let calls = 0;
    await assert.rejects(
      fetchDirectoryListings({
        env: {
          SUPABASE_URL: "https://fixture.supabase.co",
          SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
        },
        fetchImpl: async () => {
          calls++;
          return Response.json({ code, message }, { status });
        },
      }),
      /temporarily unavailable/,
    );
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(
    fetchDirectoryListings({
      env: {
        SUPABASE_URL: "https://fixture.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
      },
      fetchImpl: async () => {
        calls++;
        return Response.json({ code: "42703", message: "hours_text" }, { status: 400 });
      },
    }),
    /temporarily unavailable/,
  );
  assert.equal(calls, 2);
});

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

test("reviewed hours survive the public projection and mapper with their original scope", () => {
  const hours = "Office hours: Monday–Friday 9am–4pm. Service appointments require confirmation.";
  const listing = mapDirectoryListing({ ...row, hours_text: hours });
  assert.equal(listing.hours, hours);
  assert.ok(
    buildDirectoryUrl("https://preview.supabase.co")
      .searchParams.get("select")
      .split(",")
      .includes("hours_text"),
  );
});

test("unknown or malformed hours retain a truthful confirmation fallback", () => {
  for (const value of [undefined, null, "", "   ", {}, ["Monday"]]) {
    assert.equal(
      mapDirectoryListing({ ...row, hours_text: value }).hours,
      "Call or visit the business website for current hours.",
    );
  }
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

test("missing directory configuration is an error, never an empty result", async () => {
  for (const fetcher of [fetchDirectoryListings, fetchDirectoryCategories]) {
    await assert.rejects(
      fetcher({
        env: {},
        fetchImpl: async () => {
          assert.fail("missing configuration must not call a provider");
        },
      }),
      /Directory data is temporarily unavailable/,
    );
  }
});

test("public preview reads use their own complete pair without changing command configuration", async () => {
  const env = {
    DIRECTORY_SUPABASE_URL: "https://published.supabase.co",
    DIRECTORY_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_directory_only",
    SUPABASE_URL: "https://isolated-preview.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_protected_preview",
  };
  for (const fetcher of [fetchDirectoryListings, fetchDirectoryCategories]) {
    let called = false;
    await fetcher({
      env,
      fetchImpl: async (url, init) => {
        called = true;
        assert.equal(url.origin, "https://published.supabase.co");
        assert.equal(init.headers.apikey, env.DIRECTORY_SUPABASE_PUBLISHABLE_KEY);
        assert.equal(
          init.headers.Authorization,
          `Bearer ${env.DIRECTORY_SUPABASE_PUBLISHABLE_KEY}`,
        );
        return new Response("[]");
      },
    });
    assert.equal(called, true);
    for (const missing of ["DIRECTORY_SUPABASE_URL", "DIRECTORY_SUPABASE_PUBLISHABLE_KEY"]) {
      await assert.rejects(
        fetcher({
          env: { ...env, [missing]: "" },
          fetchImpl: async () => {
            assert.fail("a partial public pair must not mix with the protected pair");
          },
        }),
        /Directory data is temporarily unavailable/,
      );
    }
  }
  const { callClaimRpc } = await import("../src/lib/supabase/claim-commands.mjs");
  let commandCalled = false;
  const protectedResult = await callClaimRpc({
    rpc: "get_my_listing_claim",
    body: {},
    accessToken: "test-user-token",
    env,
    fetchImpl: async (url, init) => {
      commandCalled = true;
      assert.equal(url.origin, "https://isolated-preview.supabase.co");
      assert.equal(init.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
      return new Response("{}");
    },
  });
  assert.equal(commandCalled, true);
  assert.equal(protectedResult.ok, true);
  const result = await callClaimRpc({
    rpc: "get_my_listing_claim",
    body: {},
    accessToken: "test-user-token",
    env: {
      DIRECTORY_SUPABASE_URL: env.DIRECTORY_SUPABASE_URL,
      DIRECTORY_SUPABASE_PUBLISHABLE_KEY: env.DIRECTORY_SUPABASE_PUBLISHABLE_KEY,
    },
    fetchImpl: async () => {
      assert.fail("public read configuration must not activate commands");
    },
  });
  assert.equal(result.code, "claim_command_not_configured");
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

test("primary directory queries normalize transport and malformed response errors", async () => {
  const env = {
    DIRECTORY_SUPABASE_URL: "https://public.example",
    DIRECTORY_SUPABASE_PUBLISHABLE_KEY: "public-key",
  };
  for (const query of [fetchDirectoryCategories, fetchDirectoryListings]) {
    for (const fetchImpl of [
      async () => {
        throw new Error("private-provider-detail");
      },
      async () => new Response("{"),
    ]) {
      let calls = 0;
      await assert.rejects(
        query({
          env,
          fetchImpl: async (...args) => {
            calls++;
            return fetchImpl(...args);
          },
        }),
        {
          message: "Directory data is temporarily unavailable.",
        },
      );
      assert.equal(calls, 1, "the failing provider mock was actually reached");
    }
  }
});

test("legacy fallback rejects unprovable ownership while current projection retains reviewed owners", async () => {
  const env = {
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
  };
  const owned = { ...row, owner_verified_at: "2026-09-30T12:00:00Z" };
  let requests = 0;
  await assert.rejects(
    fetchDirectoryListings({
      env,
      fetchImpl: async () => {
        requests++;
        return requests === 1
          ? Response.json(
              {
                code: "42703",
                message: "column directory_listings.address_locality does not exist",
              },
              { status: 400 },
            )
          : Response.json([owned]);
      },
    }),
    /Directory data is temporarily unavailable/,
  );
  assert.equal(requests, 2);
  requests = 0;
  const current = await fetchDirectoryListings({
    env,
    fetchImpl: async () => {
      requests++;
      return Response.json([owned]);
    },
  });
  assert.equal(requests, 1);
  assert.equal(current[0].ownerVerified, true);
});

test("legacy project images are withheld from public payloads while reviewed narrative is preserved", () => {
  const mapped = mapDirectoryListing({
    ...row,
    projects: [
      {
        title: "Reviewed project title",
        description: "Retained reviewed narrative",
        imageUrl: "https://fixture.example/unreviewed.png",
        image_url: "https://fixture.example/alternate.png",
      },
    ],
  });
  assert.deepEqual(mapped.projects, [
    { title: "Reviewed project title", description: "Retained reviewed narrative" },
  ]);
});

test("public About and short search description remain independent", () => {
  const mapped = mapDirectoryListing({
    ...row,
    description: "Exact short summary.",
    about_text: "Exact longer approved About copy.",
  });
  assert.equal(mapped.description, "Exact short summary.");
  assert.equal(mapped.about, "Exact longer approved About copy.");
});
