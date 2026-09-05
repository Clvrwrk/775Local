import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { serializeStructuredData } from "../src/lib/directory/structured-data.mjs";

const files = [
  "src/routes/index.tsx",
  "src/routes/biz.$slug.tsx",
  "src/components/directory/listing-page.tsx",
  "src/components/directory/listing-gallery.tsx",
  "src/routes/search.tsx",
  "src/routes/about.tsx",
  "src/routes/pricing.tsx",
  "src/components/directory/business-card.tsx",
  "src/components/directory/contact-actions.tsx",
];

async function sources() {
  return (
    await Promise.all(files.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")))
  ).join("\n");
}

test("public design surfaces reject unsupported mock-directory claims", async () => {
  const source = await sources();
  assert.doesNotMatch(
    source,
    /4,200\+|every listing verified|#1 rated|182 reviews|response time: under/i,
  );
  assert.match(source, /No placeholder businesses are shown/);
});

test("commercial placement is disclosed and external paid links are sponsored", async () => {
  const source = await sources();
  assert.match(source, />\s*Sponsored\s*</);
  assert.match(source, /sponsored noopener noreferrer/);
  assert.doesNotMatch(source, />\s*Featured\s*</);
});

test("Lead pipeline stays unavailable while Claim submission is truthfully review-gated", async () => {
  const listing = await readFile(
    new URL("../src/components/directory/listing-page.tsx", import.meta.url),
    "utf8",
  );
  const claim = await readFile(new URL("../src/routes/claim.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(listing, /Request a quote|submitLead|QuoteForm/);
  assert.match(claim, /Claim remains read-only/);
  assert.match(claim, /payment and authentication never grant authority/);
  assert.doesNotMatch(claim, /Leads now come to you|take it over/);
});

test("official design-system assets are used for the brand shell", async () => {
  const logo = await readFile(new URL("../src/components/brand/logo.tsx", import.meta.url), "utf8");
  assert.match(logo, /775directory-lockup-horizontal\.svg/);
  assert.match(logo, /brand\/mark\.svg/);
});

test("SEO allows public crawling while the runtime sitemap excludes private routes", async () => {
  const robots = await readFile(new URL("../public/robots.txt", import.meta.url), "utf8");
  const { renderSitemap } = await import("../src/lib/directory/sitemap.mjs");
  assert.doesNotMatch(robots, /Disallow: \/(?:claim|list-your-business|login|pricing|search|spec)/);
  assert.match(robots, /Disallow: \/studio\//);
  assert.doesNotMatch(renderSitemap([]), /pricing|claim|search|studio/);
});

test("listing JSON-LD cannot break out of its script element", () => {
  const serialized = serializeStructuredData({
    url: 'https://example.com/</script><script>alert("stored-xss")</script>',
    name: "A&B > C",
    separator: "\u2028\u2029",
  });
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/u);
  assert.match(serialized, /\\u003c\/script\\u003e/);
  assert.match(serialized, /\\u0026/);
  assert.match(serialized, /\\u2028\\u2029/);
  assert.throws(() => serializeStructuredData(undefined), /must be JSON serializable/);
});
