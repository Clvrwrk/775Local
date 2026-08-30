import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { serializeStructuredData } from "../src/lib/directory/structured-data.mjs";

const files = [
  "src/routes/index.tsx",
  "src/routes/biz.$slug.tsx",
  "src/routes/search.tsx",
  "src/routes/about.tsx",
  "src/routes/pricing.tsx",
  "src/components/directory/business-card.tsx",
];

async function sources() {
  return (await Promise.all(files.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")))).join("\n");
}

test("public design surfaces reject unsupported mock-directory claims", async () => {
  const source = await sources();
  assert.doesNotMatch(source, /4,200\+|every listing verified|#1 rated|182 reviews|response time: under/i);
  assert.match(source, /No placeholder businesses are shown/);
});

test("commercial placement is disclosed and external paid links are sponsored", async () => {
  const source = await sources();
  assert.match(source, />\s*Sponsored\s*</);
  assert.match(source, /sponsored noopener noreferrer/);
  assert.doesNotMatch(source, />Featured</);
});

test("unavailable lead and claim pipelines are not presented as working forms", async () => {
  const listing = await readFile(new URL("../src/routes/biz.$slug.tsx", import.meta.url), "utf8");
  const claim = await readFile(new URL("../src/routes/claim.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(listing, /Request a quote|submitLead|QuoteForm/);
  assert.match(claim, /not accepting submissions yet/i);
});

test("official design-system assets are used for the brand shell", async () => {
  const logo = await readFile(new URL("../src/components/brand/logo.tsx", import.meta.url), "utf8");
  assert.match(logo, /775directory-lockup-horizontal\.svg/);
  assert.match(logo, /brand\/mark\.svg/);
});

test("SEO launch files expose noindex pages to crawlers and exclude empty discovery leaves", async () => {
  const [robots, sitemap] = await Promise.all([
    readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(robots, /Disallow: \/(?:claim|list-your-business|login|pricing|search|spec)/);
  assert.match(robots, /Disallow: \/studio\//);
  assert.match(sitemap, /https:\/\/775directory\.com\/about/);
  assert.match(sitemap, /https:\/\/775directory\.com\/privacy/);
  assert.doesNotMatch(sitemap, /\/nv\/|\/business\/|\/biz\/|pricing|claim|search|studio/);
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
