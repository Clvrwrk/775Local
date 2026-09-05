export const PILOT_CITY = "reno";

/** Discovery is Reno-only. Direct links retain their original public identity.
 * @template {{city?: string, slug?: string}} T
 * @param {T} filters
 */
export function pilotFilters(filters) {
  return filters.slug ? filters : { ...filters, city: PILOT_CITY };
}

const aliases = {
  hvac: ["hvac", "ac repair", "air conditioning", "heating", "furnace repair"],
  plumbing: ["plumbing", "plumber", "plumbers", "drain cleaning"],
  electrical: ["electrical", "electrician", "electricians"],
  "auto-repair": ["auto repair", "mechanic", "mechanics", "car repair"],
  "screen-repair": ["screen repair", "window screens", "screen door repair"],
  dentists: ["dentist", "dentists", "dental"],
  veterinarians: ["vet", "vets", "veterinarian", "veterinarians"],
  roofing: ["roofing", "roofer", "roofers", "roof repair"],
  handyman: ["handyman", "handyperson", "home repair"],
  restaurants: ["restaurant", "restaurants", "places to eat"],
};

/** @param {string} query */
export function categoryForQuery(query) {
  const term = query
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, " ");
  return Object.entries(aliases).find(([, terms]) => terms.includes(term))?.[0] ?? null;
}
