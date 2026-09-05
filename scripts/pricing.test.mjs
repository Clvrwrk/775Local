import assert from "node:assert/strict";
import test from "node:test";
import {
  DIRECTORY_PLANS,
  DIRECTORY_PRICING_STATUS,
  PREMIUM_MONTHLY_PRICE_CENTS,
  annualPriceWithFreeMonths,
} from "../src/lib/directory/pricing.mjs";

test("directory pricing remains a future preview", () => {
  assert.equal(DIRECTORY_PRICING_STATUS, "future-preview");
});

test("all content tiers are free and only Featured carries a paid rate", () => {
  for (const id of ["basic", "standard", "premium"]) {
    const plan = DIRECTORY_PLANS.find((plan) => plan.id === id);
    assert.equal(plan.monthlyPriceCents, 0);
    assert.equal(plan.annualPriceCents, 0);
  }
  assert.equal(PREMIUM_MONTHLY_PRICE_CENTS, null);
  assert.equal(DIRECTORY_PLANS.filter((plan) => plan.monthlyPriceCents > 0).length, 1);
});

test("Featured founder pricing is separate and exact", () => {
  const featured = DIRECTORY_PLANS.find((plan) => plan.id === "featured");
  assert.equal(featured.onboardingPriceCents, 49_700);
  assert.equal(featured.monthlyPriceCents, 29_700);
});

test("annual discount arithmetic rejects ambiguous currency values", () => {
  assert.throws(() => annualPriceWithFreeMonths(14.9, 2), TypeError);
  assert.throws(() => annualPriceWithFreeMonths(1_490, 12), TypeError);
});
