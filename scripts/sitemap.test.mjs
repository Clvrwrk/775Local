import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSitemap } from "../src/lib/directory/sitemap.mjs";

test("sitemap includes eligible Reno pages and excludes thin, non-pilot, and malformed paths", () => {
  const listings = Array.from({ length: 5 }, (_, index) => ({
    slug: `business-${index}`,
    citySlug: "reno",
    categorySlugs: ["plumbing"],
  }));
  listings.push({ slug: "sparks-business", citySlug: "sparks", categorySlugs: ["plumbing"] });
  listings.push({ slug: "bad<slug", citySlug: "reno", categorySlugs: ["thin"] });
  const xml = renderSitemap(listings);
  assert.match(xml, /\/biz\/business-0/);
  assert.match(xml, /\/nv\/reno\/plumbing/);
  assert.match(xml, /\/categories\/plumbing/);
  assert.doesNotMatch(xml, /sparks|bad|\/thin|claim|studio|search/);
});
