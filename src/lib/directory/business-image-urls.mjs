const managedPath =
  /^\/api\/business-images\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Recognize the reserved route in relative and earlier absolute gallery entries.
 * This never produces a host or changes where a new managed image is served.
 * @param {string} value
 */
export function isManagedBusinessImageUrl(value) {
  try {
    const url = new URL(value, "https://path-only.invalid");
    return ["http:", "https:"].includes(url.protocol) && managedPath.test(url.pathname);
  } catch {
    return false;
  }
}
