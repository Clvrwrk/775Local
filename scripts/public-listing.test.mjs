import assert from "node:assert/strict";
import test from "node:test";
import { publicListing } from "../src/lib/directory/public-listing.mjs";

const HOURS = "Call or visit the business website for current hours.";

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

function listing(overrides = {}, names = {}) {
  return publicListing({ ...row, ...overrides }, names);
}

const photoUrl = (n) => `https://cdn.example/photo-${n}.jpg`;

test("the public listing does not invent ratings, reviews, ownership, or a street", () => {
  const listing = publicListing(row, {
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
  assert.equal(listing.logoUrl, null);
  assert.equal(listing.media.logo.template, true);
});

test("the logo is real only when it is an http address", () => {
  const kept = listing({ logo_url: "https://cdn.example/logo.svg" });
  assert.equal(kept.logoUrl, "https://cdn.example/logo.svg");
  assert.equal(kept.media.logo.template, false);
  assert.equal(kept.media.logo.url, "https://cdn.example/logo.svg");
  assert.equal(kept.media.schemaImages.includes(kept.logoUrl), false);

  const dropped = listing({ logo_url: "javascript:alert(1)" });
  assert.equal(dropped.logoUrl, null);
  assert.equal(dropped.media.logo.template, true);
  assert.equal(dropped.media.schemaImages.length, 0);
});

test("hours are the public sentence, and a stored hours field is ignored", () => {
  const shown = listing({
    hours_text: "Office hours: Monday–Friday 9am–4pm.",
  });
  assert.equal(shown.hours, HOURS);
});

test("empty or placeholder copy becomes one factual sentence, and real copy stays", () => {
  const names = { cityName: "Reno", categoryName: "Restaurants" };
  const base = {
    display_name: "Reno Fine Dining",
    city_slug: "reno",
    category_slugs: ["restaurants"],
    primary_category_slug: "restaurants",
    primary_category_name: "Restaurants",
  };
  const sentence =
    "Reno Fine Dining is listed for restaurants in Reno. Contact the business for current service details.";
  assert.equal(
    listing(
      {
        ...base,
        description:
          "Consectetur adipisicing elit. Cum debitis, ipsum est ipsam vitae vel, quam in sint reprehenderit.",
      },
      names,
    ).description,
    sentence,
  );
  assert.equal(listing({ ...base, description: "" }, names).description, sentence);
  assert.equal(listing({ ...base, description: null }, names).description, sentence);
  assert.equal(
    listing(
      {
        display_name: "Burke Roofing",
        description: "Burke Roofing replaces and repairs roofs in Reno.",
        category_slugs: ["roofing"],
        primary_category_slug: "roofing",
        primary_category_name: "Roofing",
      },
      { cityName: "Reno", categoryName: "Roofing" },
    ).description,
    "Burke Roofing replaces and repairs roofs in Reno.",
  );
});

test("contact fragments stay out of the service lines", () => {
  assert.deepEqual(
    listing({
      services: [
        "Our Mission",
        "Why choose us",
        "Drain cleaning",
        "Drain cleaning",
        "Call to schedule a Service Estimate",
        "(775) 367-7900",
        "Call 775-296-8988 or complete the form below.",
        "Phone (775) 853-3444 Fax (775) 853-3441",
        "Hours of Operation",
        "Monday:7:30-5:00",
        "Saturday:Closed",
        "Monday - Friday 7:30AM - 5:30PM",
        "11:00 AM - 09:00 PM",
        "9 AM - 5 PM",
        "Monday September 7th",
        "7111 S. Virgina Șt. Reno, NV 89511",
        "1121 Corporate Blvd, Reno, NV 89502",
        "225 E Prater Way",
        "450 E Plumb Ln",
        "590 N Virginia St",
        "225 E Prater Way • (775) 356-7500",
        "Reno",
        "Sparks",
        "Reno, NV",
        "01 . Reno, NV",
        "Roof Maintenance and Roof Repair in Reno",
        "Vino Reno",
        "Provide same-day repairs",
        "After Hours",
        "Sunday open mic",
        "Monday: Open",
      ],
    }).services,
    [
      "Drain cleaning",
      "Roof Maintenance and Roof Repair in Reno",
      "Vino Reno",
      "Provide same-day repairs",
      "After Hours",
      "Sunday open mic",
    ],
  );
});

test("a listing with no media gets a logo placeholder and five template images", () => {
  const media = listing(
    {
      display_name: "Burke Roofing",
      category_slugs: ["roofing"],
      primary_category_slug: "roofing",
      primary_category_name: "Roofing",
      photo_urls: [],
      logo_url: null,
    },
    { categoryName: "Roofing" },
  ).media;
  assert.equal(media.logo.template, true);
  assert.equal(media.logo.url, "/category-art/roofing/logo.webp");
  assert.equal(media.logo.alt, "Roofing illustration");
  assert.equal(media.images.length, 5);
  assert.deepEqual(
    media.images.map((image) => image.url),
    [1, 2, 3, 4, 5].map((index) => `/category-art/roofing/${String(index).padStart(2, "0")}.webp`),
  );
  assert.equal(
    media.images.every((image) => image.template && image.alt === "Roofing illustration"),
    true,
  );
  assert.equal(media.more.length, 0);
  assert.deepEqual(media.schemaImages, []);
});

test("a real logo and five real images leave no template slot", () => {
  const media = listing({
    display_name: "Sierra Plumbing",
    logo_url: "https://cdn.example/logo.png",
    photo_urls: [1, 2, 3, 4, 5].map(photoUrl),
    category_slugs: ["plumbing"],
    primary_category_slug: "plumbing",
    primary_category_name: "Plumbing",
  }).media;
  assert.equal(media.logo.template, false);
  assert.equal(media.logo.url, "https://cdn.example/logo.png");
  assert.equal(media.logo.alt, "Sierra Plumbing logo");
  assert.equal(
    media.images.every((image) => image.template === false),
    true,
  );
  assert.equal(media.images.length, 5);
  assert.equal(media.more.length, 0);
  assert.deepEqual(media.schemaImages, [1, 2, 3, 4, 5].map(photoUrl));
  assert.equal(media.schemaImages.includes("https://cdn.example/logo.png"), false);
});

test("a real logo and three real images keep those and fill two template slots", () => {
  const media = listing({
    display_name: "High Desert HVAC",
    logo_url: "https://cdn.example/logo.png",
    photo_urls: [1, 2, 3].map(photoUrl),
    category_slugs: ["hvac"],
    primary_category_slug: "hvac",
    primary_category_name: "HVAC",
  }).media;
  assert.equal(media.logo.template, false);
  assert.deepEqual(
    media.images.map((image) => image.template),
    [false, false, false, true, true],
  );
  assert.equal(media.images[3].url, "/category-art/hvac/01.webp");
  assert.equal(media.images[4].url, "/category-art/hvac/02.webp");
  assert.deepEqual(media.schemaImages, [1, 2, 3].map(photoUrl));
});

test("gallery photos stay in the gallery when the logo column is empty", () => {
  const media = listing({
    display_name: "River Dentists",
    logo_url: null,
    photo_urls: [1, 2, 3, 4, 5, 6].map(photoUrl),
    category_slugs: ["dentists"],
    primary_category_slug: "dentists",
    primary_category_name: "Dentists",
  }).media;
  assert.equal(media.logo.template, true);
  assert.equal(media.logo.url, "/category-art/dentists/logo.webp");
  assert.equal(media.images[0].url, photoUrl(1));
  assert.equal(media.images.length, 5);
  assert.equal(media.more.length, 1);
  assert.equal(media.more[0].url, photoUrl(6));
  assert.deepEqual(media.schemaImages, [1, 2, 3, 4, 5].map(photoUrl));
});

test("a seventh stored image stays behind more-photos", () => {
  const media = listing({
    display_name: "River Dentists",
    photo_urls: [1, 2, 3, 4, 5, 6, 7].map(photoUrl),
    category_slugs: ["dentists"],
    primary_category_slug: "dentists",
    primary_category_name: "Dentists",
  }).media;
  assert.equal(media.logo.template, true);
  assert.equal(media.more.length, 2);
  assert.equal(media.more[0].url, photoUrl(6));
  assert.equal(media.more[1].url, photoUrl(7));
  assert.deepEqual(media.schemaImages, [1, 2, 3, 4, 5].map(photoUrl));
});

test("an unknown category uses the directory art set", () => {
  const media = listing(
    {
      display_name: "Daylight Bakery",
      category_slugs: ["not-a-live-category"],
      primary_category_slug: "not-a-live-category",
      primary_category_name: "Bakeries",
    },
    { categoryName: "Bakeries" },
  ).media;
  assert.equal(media.logo.url, "/category-art/directory/logo.webp");
  assert.equal(media.images[0].url, "/category-art/directory/01.webp");
  assert.equal(media.images[0].alt, "Bakeries illustration");
  assert.deepEqual(media.schemaImages, []);
});

test("an unsafe photo url is ignored and does not count as enrichment", () => {
  const media = listing({
    display_name: "Bright Life Electric",
    logo_url: "javascript:alert(1)",
    photo_urls: ["https://user:pass@cdn.example/a.jpg"],
    category_slugs: ["electrical"],
    primary_category_slug: "electrical",
    primary_category_name: "Electrical",
  }).media;
  assert.equal(media.logo.template, true);
  assert.equal(
    media.images.every((image) => image.template),
    true,
  );
  assert.deepEqual(media.schemaImages, []);
});
