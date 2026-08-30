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

test("approved owner-tool prices remain exact after separating content tier names", () => {
  const basic = DIRECTORY_PLANS.find((plan) => plan.id === "basic");
  const standard = DIRECTORY_PLANS.find((plan) => plan.id === "standard");

  assert.deepEqual([basic.monthlyPriceCents, basic.annualPriceCents], [1_000, 12_000]);
  assert.deepEqual([standard.monthlyPriceCents, standard.annualPriceCents], [1_500, 18_000]);
  assert.equal(basic.name, "Owner tools — Basic");
  assert.equal(standard.name, "Owner tools — Standard");
});

test("owner-tools Premium stays unset until approved and annual billing gives two months free", () => {
  const premium = DIRECTORY_PLANS.find((plan) => plan.id === "premium");

  assert.equal(PREMIUM_MONTHLY_PRICE_CENTS, null);
  assert.equal(premium.monthlyPriceCents, null);
  assert.equal(premium.annualPriceCents, null);
  assert.equal(premium.annualFreeMonths, 2);
  assert.equal(premium.name, "Owner tools — Premium");
  assert.equal(annualPriceWithFreeMonths(2_000, 2), 20_000);
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
