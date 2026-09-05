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
  {
    id: "free",
    name: "Free Listing",
    eyebrow: "Be findable",
    summary: "A useful local listing with the essentials neighbors need to reach you.",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    annualFreeMonths: 0,
    features: [
      "Accurate business name, contact details, and service area",
      "Description, hours, logo, and up to 3 photos",
      "Claim access and owner-submitted corrections",
      "Email delivery of listing inquiries",
    ],
  },
  {
    id: "basic",
    name: "Owner tools — Basic",
    eyebrow: "Tell the full story",
    summary: "More room to explain what you do and show the work behind the name.",
    monthlyPriceCents: 1_000,
    annualPriceCents: 12_000,
    annualFreeMonths: 0,
    features: [
      "Everything in Free",
      "Expanded services and service-area highlights",
      "Up to 6 gallery photos",
      "Richer business highlights and calls to action",
    ],
  },
  {
    id: "standard",
    name: "Owner tools — Standard",
    eyebrow: "Turn visits into inquiries",
    summary: "A fuller storefront for businesses ready to generate and measure interest.",
    monthlyPriceCents: 1_500,
    annualPriceCents: 18_000,
    annualFreeMonths: 0,
    features: [
      "Everything in Owner tools — Basic",
      "Up to 12 gallery photos",
      "One active offer",
      "Enhanced inquiry and listing-performance reporting",
    ],
  },
  {
    id: "premium",
    name: "Owner tools — Premium",
    eyebrow: "Make the most of Local775",
    summary: "The complete future package, with the annual rate equal to ten monthly payments.",
    monthlyPriceCents: PREMIUM_MONTHLY_PRICE_CENTS,
    annualPriceCents:
      PREMIUM_MONTHLY_PRICE_CENTS === null
        ? null
        : annualPriceWithFreeMonths(PREMIUM_MONTHLY_PRICE_CENTS, 2),
    annualFreeMonths: 2,
    features: [
      "Everything in Owner tools — Standard",
      "Up to 20 gallery photos",
      "A dedicated 775 tracking number and fuller reporting",
      "Additional owner tools defined before this future plan opens",
    ],
  },
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
