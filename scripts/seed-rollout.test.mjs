import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRolloutPlan, forecastEnrichmentDeadline } from "./seed-rollout-lib.mjs";

test("cumulative rollout matches the approved category and listing targets", () => {
  assert.deepEqual(buildRolloutPlan({ categoryCount: 1790, companyCount: 20219 }), [
    { round: 1, name: "Seed", categoryCount: 10, resultPolicy: "top_10_serp", listingTarget: 100 },
    {
      round: 2,
      name: "Top 50",
      categoryCount: 50,
      resultPolicy: "top_10_serp",
      listingTarget: 500,
    },
    {
      round: 3,
      name: "Top 100",
      categoryCount: 100,
      resultPolicy: "top_10_serp",
      listingTarget: 1000,
    },
    {
      round: 4,
      name: "Top 500",
      categoryCount: 500,
      resultPolicy: "top_10_serp",
      listingTarget: 5000,
    },
    {
      round: 5,
      name: "Complete directory",
      categoryCount: 1790,
      resultPolicy: "all_found_companies",
      listingTarget: 20219,
    },
  ]);
});

test("the current 232-category queue fits before September 15 with nightly batches", () => {
  const forecast = forecastEnrichmentDeadline({
    categoryCount: 232,
    completedCategoryCount: 16,
    batchSize: 20,
    runsPerDay: 1,
    from: "2026-08-30T08:00:00-07:00",
    deadline: "2026-09-15T00:00:00-07:00",
  });
  assert.equal(forecast.runsRequired, 11);
  assert.equal(forecast.onTrack, true);
  assert.ok(forecast.slackRuns >= 4);
});

test("deadline forecasts reject impossible execution capacity", () => {
  const base = {
    categoryCount: 232,
    completedCategoryCount: 16,
    from: "2026-08-30T08:00:00-07:00",
    deadline: "2026-09-15T00:00:00-07:00",
  };
  assert.throws(() => forecastEnrichmentDeadline({ ...base, batchSize: 0 }), /batchSize/);
  assert.throws(() => forecastEnrichmentDeadline({ ...base, runsPerDay: 0 }), /runsPerDay/);
  assert.throws(
    () => forecastEnrichmentDeadline({ ...base, completedCategoryCount: 233 }),
    /completedCategoryCount/,
  );
});
