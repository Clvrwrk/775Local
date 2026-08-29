import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  INDEXING_THRESHOLDS,
  robotsForListingCount,
} from "../src/lib/directory/indexability.mjs";

test("thin discovery pages remain noindex until reviewed listing thresholds are met", () => {
  assert.equal(INDEXING_THRESHOLDS.city, 3);
  assert.equal(INDEXING_THRESHOLDS.category, 3);
  assert.equal(INDEXING_THRESHOLDS.cityCategory, 5);
  assert.deepEqual(robotsForListingCount("city", 2), { name: "robots", content: "noindex, follow" });
  assert.equal(robotsForListingCount("city", 3), null);
  assert.deepEqual(robotsForListingCount("cityCategory", 4), { name: "robots", content: "noindex, follow" });
  assert.equal(robotsForListingCount("cityCategory", 5), null);
});

test("discovery routes apply the reviewed-listing indexability gate", async () => {
  const routes = await Promise.all([
    "nv.$city.tsx",
    "nv.$city.$category.tsx",
    "categories.$slug.tsx",
  ].map((name) => readFile(new URL(`../src/routes/${name}`, import.meta.url), "utf8")));

  assert.match(routes[0], /robotsForListingCount\("city", loaderData\.results\.length\)/);
  assert.match(routes[1], /robotsForListingCount\("cityCategory", loaderData\.results\.length\)/);
  assert.match(routes[2], /robotsForListingCount\("category", loaderData\.results\.length\)/);
});
