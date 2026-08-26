import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

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
  assert.match(source, />Sponsored</);
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

test("SEO launch files index public discovery and exclude private or incomplete tools", async () => {
  const [robots, sitemap] = await Promise.all([
    readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8"),
  ]);
  assert.match(robots, /Disallow: \/pricing/);
  assert.match(robots, /Disallow: \/search/);
  assert.match(robots, /Disallow: \/studio\//);
  assert.match(sitemap, /https:\/\/775directory\.com\/nv\/reno\/screen-repair/);
  assert.doesNotMatch(sitemap, /pricing|claim|search|studio/);
});
