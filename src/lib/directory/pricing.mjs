export const DIRECTORY_PRICING_STATUS = "future-preview";

// Set this only after the owner approves the Premium monthly rate.
// The annual price is always derived as 10 monthly payments for 12 months of service.
export const PREMIUM_MONTHLY_PRICE_CENTS = null;

/**
 * @param {number} monthlyPriceCents
 * @param {number} freeMonths
 * @returns {number}
 */
export function annualPriceWithFreeMonths(monthlyPriceCents, freeMonths) {
  if (!Number.isInteger(monthlyPriceCents) || monthlyPriceCents < 0) {
    throw new TypeError("monthlyPriceCents must be a non-negative integer");
  }
  if (!Number.isInteger(freeMonths) || freeMonths < 0 || freeMonths > 11) {
    throw new TypeError("freeMonths must be an integer from 0 through 11");
  }
  return monthlyPriceCents * (12 - freeMonths);
}

export const DIRECTORY_PLANS = Object.freeze([
  ...["Basic", "Standard", "Premium"].map((name) => ({
    id: name.toLowerCase(),
    name: `${name} listing`,
    eyebrow: "Always free",
    summary: "Content completeness reflects approved information, not payment or ownership.",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    annualFreeMonths: 0,
    features: [
      "Reviewed business information",
      "Contact and discovery",
      "Claim access is independent of content tier",
    ],
  })),
  {
    id: "featured",
    name: "Featured founder package",
    eyebrow: "Sponsored reach",
    summary: "The separately approved concierge package with disclosed Sponsored placement.",
    onboardingPriceCents: 49_700,
    monthlyPriceCents: 29_700,
    annualPriceCents: null,
    annualFreeMonths: 0,
    features: [
      "Clearly labeled Sponsored placement, subject to inventory",
      "Dedicated 775 tracking number",
      "Concierge onboarding and fuller reporting",
      "Payment never grants Claim or Listing authority",
    ],
  },
]);
