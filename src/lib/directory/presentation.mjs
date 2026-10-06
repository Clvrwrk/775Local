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

/** Hide obvious extraction/navigation fragments without manufacturing new services.
 * @param {string[]} values
 */
export function visibleServices(values) {
  const seen = new Set();
  return values.flatMap((raw) => {
    const value = typeof raw === "string" ? raw.replace(/\s+/gu, " ").trim() : "";
    if (
      value.length < 2 ||
      value.length > 100 ||
      /ready to help|all rights reserved|powered by|copyright\s*\d{4}|©|multi[- ]window discount|\bdiscount\b|\bcoupon\b|\bsave\s+\d+%/i.test(
        value,
      ) ||
      /^(?:everything we offer|our mission|why choose us|about(?: us)?|contact us|home|gallery|services?|service areas?|read more|learn more|call to|menu|schedule|book(?: now)?|request|faqs?|blog|our team|reviews?|testimonials?|careers|employment opportunities|financing available|specials|promotions)[.!?:]?$/i.test(
        value,
      ) ||
      /^(?:before|after|before\s*\/\s*after|hours(?: of operation)?|business hours|office hours|privacy(?: policy)?|terms(?: of service)?|contact|address|toggle|scroll to top|languages? spoken|cookie(?: policy)?|ktpstudio|terms and conditions|terms of use)[.!?:]?$/i.test(
        value,
      ) ||
      /^(?:page not found|404(?:\s+error)?|the page you|typed the web address|refresh button|go back to homepage|call (?:us|now|to (?:schedule|book|request))|get (?:a |your )?(?:free )?quote|request (?:a |your )?quote|join our team|careers|employment opportunities|view our gallery)\b/i.test(
        value,
      ) ||
      /https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)
    )
      return [];
    const key = value.normalize("NFKC").toLocaleLowerCase("en-US");
    if (seen.has(key)) return [];
    seen.add(key);
    return [value];
  });
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
