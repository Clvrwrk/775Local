export const INDEXING_THRESHOLDS = Object.freeze({
  city: 3,
  category: 3,
  cityCategory: 5,
});

/**
 * @param {keyof typeof INDEXING_THRESHOLDS} scope
 * @param {number} listingCount
 */
export function robotsForListingCount(scope, listingCount) {
  const threshold = INDEXING_THRESHOLDS[scope];
  if (!threshold) throw new Error(`Unknown indexability scope: ${scope}`);
  return Number.isInteger(listingCount) && listingCount >= threshold
    ? null
    : { name: "robots", content: "noindex, follow" };
}
