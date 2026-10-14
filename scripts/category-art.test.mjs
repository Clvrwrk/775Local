import assert from "node:assert/strict";
import test from "node:test";
import { listingMediaSlots, templateImageUrl, templateLogoUrl } from "../src/lib/directory/category-art.mjs";

const real = (n) => ({
  id: n,
  url: `https://cdn.example/photo-${n}.jpg`,
  caption: "",
});

test("a listing with no media gets a logo placeholder and five template images", () => {
  const media = listingMediaSlots({
    categorySlug: "roofing",
    categoryName: "Roofing",
    businessName: "Burke Roofing",
  });
  assert.equal(media.logo.template, true);
  assert.equal(media.logo.url, templateLogoUrl("roofing"));
  assert.equal(media.logo.alt, "Roofing illustration");
  assert.equal(media.images.length, 5);
  assert.deepEqual(
    media.images.map((image) => image.url),
    [1, 2, 3, 4, 5].map((index) => templateImageUrl("roofing", index)),
  );
  assert.equal(
    media.images.every((image) => image.template && image.alt === "Roofing illustration"),
    true,
  );
  assert.equal(media.more.length, 0);
});

test("a real logo and five real images leave no template slot", () => {
  const media = listingMediaSlots({
    logoUrl: "https://cdn.example/logo.png",
    photos: [1, 2, 3, 4, 5].map(real),
    categorySlug: "plumbing",
    categoryName: "Plumbing",
    businessName: "Sierra Plumbing",
  });
  assert.equal(media.logo.template, false);
  assert.equal(media.logo.url, "https://cdn.example/logo.png");
  assert.equal(media.logo.alt, "Sierra Plumbing logo");
  assert.equal(
    media.images.every((image) => image.template === false),
    true,
  );
  assert.equal(media.images.length, 5);
  assert.equal(media.more.length, 0);
});

test("a real logo and three real images keep those and fill two template slots", () => {
  const media = listingMediaSlots({
    logoUrl: "https://cdn.example/logo.png",
    photos: [1, 2, 3].map(real),
    categorySlug: "hvac",
    categoryName: "HVAC",
    businessName: "High Desert HVAC",
  });
  assert.equal(media.logo.template, false);
  assert.deepEqual(
    media.images.map((image) => image.template),
    [false, false, false, true, true],
  );
  assert.equal(media.images[3].url, templateImageUrl("hvac", 1));
  assert.equal(media.images[4].url, templateImageUrl("hvac", 2));
});

test("the first stored image is the company logo and is not repeated in the five", () => {
  const media = listingMediaSlots({
    photos: [1, 2, 3, 4, 5, 6].map(real),
    categorySlug: "dentists",
    categoryName: "Dentists",
    businessName: "River Dentists",
  });
  assert.equal(media.logo.template, false);
  assert.equal(media.logo.url, "https://cdn.example/photo-1.jpg");
  assert.equal(media.logo.alt, "River Dentists logo");
  assert.equal(media.images[0].url, "https://cdn.example/photo-2.jpg");
  assert.equal(media.images.length, 5);
  assert.equal(
    media.images.every((image) => image.template === false && image.url !== media.logo.url),
    true,
  );
  assert.equal(media.more.length, 0);
});

test("a seventh stored image stays behind more-photos after the logo is taken", () => {
  const media = listingMediaSlots({
    photos: [1, 2, 3, 4, 5, 6, 7].map(real),
    categorySlug: "dentists",
    categoryName: "Dentists",
    businessName: "River Dentists",
  });
  assert.equal(media.logo.url, "https://cdn.example/photo-1.jpg");
  assert.equal(media.more.length, 1);
  assert.equal(media.more[0].url, "https://cdn.example/photo-7.jpg");
});

test("an unknown category uses the directory art set", () => {
  const media = listingMediaSlots({
    categorySlug: "not-a-live-category",
    categoryName: "Bakeries",
    businessName: "Daylight Bakery",
  });
  assert.equal(media.logo.url, templateLogoUrl("directory"));
  assert.equal(media.images[0].url, templateImageUrl("directory", 1));
  assert.equal(media.images[0].alt, "Bakeries illustration");
});

test("an unsafe photo url is ignored and does not count as enrichment", () => {
  const media = listingMediaSlots({
    logoUrl: "javascript:alert(1)",
    photos: [{ id: 1, url: "https://user:pass@cdn.example/a.jpg", caption: "" }],
    coverUrl: "not a url",
    categorySlug: "electrical",
    categoryName: "Electrical",
    businessName: "Bright Life Electric",
  });
  assert.equal(media.logo.template, true);
  assert.equal(
    media.images.every((image) => image.template),
    true,
  );
});
