/** Only explicitly reviewed public business contacts may reach this formatter. @param {unknown} value */
export function publicEmailHref(value) {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}$/.test(value)
    ? `mailto:${encodeURIComponent(value)}`
    : null;
}
/** @param {unknown} value */
function publicUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash
      ? url.href
      : null;
  } catch {
    return null;
  }
}
/** No private-contact fallback, generated logo, or unreviewed media inference. @param {any} row */
export function mapPublicPresentation(row) {
  const email =
    publicEmailHref(row?.public_email) &&
    publicUrl(row?.email_source_url) &&
    typeof row?.email_checked_at === "string" &&
    Number.isFinite(Date.parse(row.email_checked_at))
      ? row.public_email
      : "";
  const source = email ? publicUrl(row.email_source_url) : null;
  /** @type {any[]} */
  const input = Array.isArray(row?.media) ? row.media : [];
  const photos = input.flatMap((item, index) => {
    const url = publicUrl(item?.url),
      sourceUrl = publicUrl(item?.sourceUrl);
    if (
      !url ||
      !sourceUrl ||
      typeof item?.id !== "string" ||
      typeof item?.sourceCredit !== "string" ||
      !item.sourceCredit.trim() ||
      item.sourceCredit.length > 200 ||
      (index === 0 && item.kind !== "logo") ||
      (index > 0 && item.kind === "logo")
    )
      return [];
    return [
      {
        id: item.id,
        url,
        caption: typeof item.caption === "string" ? item.caption : "",
        kind: item.kind,
        sourceUrl,
        sourceCredit: item.sourceCredit,
        sortOrder: index,
      },
    ];
  });
  const approvedPhotos = photos[0]?.kind === "logo" ? photos : [];
  return {
    publicEmail: Boolean(email),
    publicEmailAddress: email,
    publicEmailSourceUrl: source,
    logoUrl: approvedPhotos[0]?.url ?? null,
    coverUrl: approvedPhotos[0]?.url ?? null,
    photos: approvedPhotos,
  };
}
/** @param {any[]} listings @param {any[]} presentations */
export function attachPublicPresentation(listings, presentations) {
  const byId = new Map();
  for (const row of presentations) {
    if (typeof row?.listing_id !== "string" || byId.has(row.listing_id))
      throw Error("ambiguous_public_presentation");
    byId.set(row.listing_id, row);
  }
  return listings.map((listing) => {
    const presentation = mapPublicPresentation(byId.get(listing.sourceId));
    return { ...listing, ...presentation, email: presentation.publicEmailAddress };
  });
}

/** Additional image placements must reuse the exact current reviewed gallery.
 * @param {any[]} photos @param {unknown} url @param {unknown} logoUrl
 */
export function reviewedMediaForUrl(photos, url, logoUrl) {
  const logo = photos?.[0];
  if (
    !logo ||
    logo.kind !== "logo" ||
    logo.url !== logoUrl ||
    !publicUrl(logo.url) ||
    !publicUrl(logo.sourceUrl) ||
    !logo.sourceCredit
  )
    return null;
  const destination = publicUrl(url);
  return destination
    ? (photos.find(
        (photo) => photo.url === destination && publicUrl(photo.sourceUrl) && photo.sourceCredit,
      ) ?? null)
    : null;
}
