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
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(
          (value) =>
            value.length > 1 &&
            value.length <= 100 &&
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
