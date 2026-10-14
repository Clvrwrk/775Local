/** Preserve verified E.164; accept common US display formats without inventing digits.
 * @param {unknown} value
 */
export function telephoneHref(value) {
  if (typeof value !== "string" || !/^[+\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  if (/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return `tel:+1${digits}`;
  if (/^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return `tel:+${digits}`;
  if (value.trim().startsWith("+") && /^[2-9]\d{7,14}$/.test(digits)) return `tel:+${digits}`;
  return null;
}

/** @param {unknown} value */
export function safeWebsite(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const STREET_ADDRESS =
  /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?[\p{L}\d.'#-]+(?:\s+[\p{L}\d.'#-]+){0,5}\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|cir|circle|hwy|highway|pkwy|parkway|șt)\b/iu;

/** @param {string} value */
function hasPhoneNumber(value) {
  if (/(?:\+?1[\s.-]*)?\(?[2-9]\d{2}\)?[\s.()-]*[2-9]\d{2}[\s.-]*\d{4}/.test(value)) return true;
  return /(?:\+?1)?[2-9]\d{2}[2-9]\d{6}/.test(value.replace(/\D/g, ""));
}

/** @param {string} value */
function isHoursOfOperation(value) {
  const line = value.trim();
  if (/^(hours?|hours of operation|office hours|business hours|hours of ops|after hours)$/i.test(line))
    return true;
  if (
    /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b[:\s-].*(?:\d|closed|open)/i.test(
      line,
    )
  )
    return true;
  if (/^\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(line)) return true;
  if (
    line.length <= 80 &&
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(line) &&
    /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(line)
  )
    return true;
  return /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+[A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?$/i.test(
    line,
  );
}

/** Phone numbers, hours of operation, and street addresses are contact facts, not services.
 * @param {string} value
 */
export function isContactFragment(value) {
  const line = value.trim();
  if (hasPhoneNumber(line) || isHoursOfOperation(line) || STREET_ADDRESS.test(line)) return true;
  return /^(?:\d{1,2}\s*[.)]\s*)?(?:reno|sparks)(?:\s*,\s*nv(?:\s+area)?)?$/i.test(line);
}

/** @param {unknown} value */
export function isPlaceholderCopy(value) {
  return (
    typeof value === "string" &&
    /lorem|ipsum|loreum|consectetur|adipisicing|eiusmod|incididunt|dolor sit amet/i.test(value)
  );
}

/** Keep a real description. Replace empty or dummy latin with a sentence from the listing itself.
 * @param {{ name?: unknown, primaryCategory?: unknown, cityName?: unknown, description?: unknown }} biz
 */
export function listingDescription(biz) {
  const name = typeof biz.name === "string" && biz.name.trim() ? biz.name.trim() : "This business";
  const category =
    typeof biz.primaryCategory === "string" && biz.primaryCategory.trim()
      ? biz.primaryCategory.trim()
      : "local services";
  const city = typeof biz.cityName === "string" && biz.cityName.trim() ? biz.cityName.trim() : "Reno";
  const stored = typeof biz.description === "string" ? biz.description.trim() : "";
  if (stored && !isPlaceholderCopy(stored)) return stored;
  return `${name} is listed for ${category.toLowerCase()} in ${city}. Contact the business for current service details.`;
}

/** Hide obvious extraction/navigation fragments without manufacturing new services.
 * @param {string[]} values
 */
export function visibleServices(values) {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(
          (value) =>
            value.length > 1 &&
            value.length <= 100 &&
            !isContactFragment(value) &&
            !/ready to help/i.test(value) &&
            !/^(everything we offer|our mission|why choose us|about us|contact us|home|gallery|services|read more|learn more|call to|at .+we are guided)\b/i.test(
              value,
            ),
        ),
    ),
  ];
}

/** @template {{title: string, description?: string, imageUrl?: string}} T
 * @param {T[]} values
 */
export function visibleProjects(values) {
  return values.filter(
    (value) => value.title?.trim() && (value.description?.trim() || safeWebsite(value.imageUrl)),
  );
}

/** Preserve the original wording but split scraped bullet paragraphs for reading.
 * @param {string} value
 */
export function descriptionBlocks(value) {
  return value.trim().startsWith("- ")
    ? value
        .trim()
        .slice(2)
        .split(/\s+-\s+(?=[A-Z])/u)
    : value.split(/\n\s*\n/);
}
