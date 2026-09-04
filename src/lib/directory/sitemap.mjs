import { robotsForListingCount } from "./indexability.mjs";

const ORIGIN = "https://775directory.com";
/** @param {string} value */
const escapeXml = (value) =>
  String(value).replace(
    /[<>&"']/g,
    (character) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] ??
      character,
  );

/** Input must come from the reviewed public projection, never private candidates.
 * @param {Array<{slug: string, citySlug: string, categorySlugs: string[]}>} listings
 */
export function renderSitemap(listings) {
  const reno = listings.filter((listing) => listing.citySlug === "reno");
  const paths = new Set(["/", "/about", "/categories", "/privacy", "/terms"]);
  if (!robotsForListingCount("city", reno.length)) paths.add("/nv/reno");
  const counts = new Map();
  for (const listing of reno) {
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(listing.slug)) paths.add(`/biz/${listing.slug}`);
    for (const category of new Set(listing.categorySlugs)) {
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category))
        counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  for (const [category, count] of counts) {
    if (!robotsForListingCount("category", count)) paths.add(`/categories/${category}`);
    if (!robotsForListingCount("cityCategory", count)) paths.add(`/nv/reno/${category}`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...paths,
  ]
    .sort()
    .map((path) => `  <url><loc>${escapeXml(ORIGIN + path)}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
}
