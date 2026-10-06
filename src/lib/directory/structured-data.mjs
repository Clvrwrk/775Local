/** @param {unknown} value @returns {string} */
export function serializeStructuredData(value) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError("Structured data must be JSON serializable.");
  return json
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

/**
 * A discovery/service-area city is not evidence of a physical address locality.
 * Public street and postal fields must already have passed publication review.
 * @param {{ street?: string, hideStreet?: boolean, cityName?: string, zip?: string, verifiedAddressLocality?: string | null, serviceAreas?: string[] }} location
 */
export function listingLocationStructuredData(location) {
  const street = location.street?.trim();
  const city = location.cityName?.trim();
  const areas = location.serviceAreas?.filter((v) => typeof v === "string" && v.trim());
  if (location.hideStreet || !street || /^service area$/i.test(street)) {
    if (areas?.length) return { areaServed: areas.map((v) => `${v}, Nevada`) };
    return city ? { areaServed: `${city}, Nevada` } : {};
  }
  const locality = location.verifiedAddressLocality?.trim();
  const postalCode = location.zip?.trim();
  return {
    address: {
      "@type": "PostalAddress",
      streetAddress: street,
      addressRegion: "NV",
      addressCountry: "US",
      ...(locality ? { addressLocality: locality } : {}),
      ...(postalCode && /^\d{5}(?:-\d{4})?$/.test(postalCode) ? { postalCode } : {}),
    },
    ...(areas?.length ? { areaServed: areas.map((v) => `${v}, Nevada`) } : {}),
  };
}

/** @param {{ street?: string, hideStreet?: boolean, cityName?: string, zip?: string, verifiedAddressLocality?: string | null, serviceAreas?: string[] }} location */
export function listingPublicLocationLabel(location) {
  const street = location.street?.trim();
  if (location.hideStreet || !street || /^service area$/i.test(street))
    return `Serving ${location.serviceAreas?.length ? location.serviceAreas.join(", ") : location.cityName || "the local area"}, Nevada`;
  return [
    street,
    location.verifiedAddressLocality?.trim(),
    `NV${location.zip && /^\d{5}(?:-\d{4})?$/.test(location.zip) ? ` ${location.zip}` : ""}`,
  ]
    .filter(Boolean)
    .join(", ");
}
