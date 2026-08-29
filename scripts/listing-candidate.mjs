import { createHash } from "node:crypto";

const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
]);

function cellValue(value) {
  if (value && typeof value === "object" && "result" in value && value.result != null) {
    return value.result;
  }
  return value;
}

function text(value) {
  return String(cellValue(value) ?? "")
    .normalize("NFKC")
    .trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function categoryMatches(value, { allowScreenRepair = true, allowRestaurant = false } = {}) {
  const matches = [];

  if (
    allowScreenRepair &&
    (value.includes("screen repair") ||
      value.includes("window screen") ||
      value === "window installation service")
  )
    matches.push("screen-repair");
  if (/(hvac|air conditioning contractor|heating contractor|air duct cleaning)/.test(value)) {
    matches.push("hvac");
  }
  if (/(^|\b)(plumber|plumbing service|plumbing contractor)(\b|$)/.test(value)) {
    matches.push("plumbing");
  }
  if (/(electrician|electrical contractor|electrical installation service)/.test(value)) {
    matches.push("electrical");
  }
  if (
    /(auto repair shop|car repair and maintenance service|mechanic|transmission shop|brake shop|diesel engine repair service)/.test(
      value,
    )
  ) {
    matches.push("auto-repair");
  }
  if (
    allowRestaurant &&
    /(restaurant|cafe|coffee shop|diner|food court|bakery|bar & grill)/.test(value)
  )
    matches.push("restaurants");
  if (/(dentist|dental clinic|orthodontist|endodontist|prosthodontist)/.test(value)) {
    matches.push("dentists");
  }
  if (/(handyman|handywoman|handyperson|handy person)/.test(value)) matches.push("handyman");
  if (/(roofing contractor|roofer|roof repair)/.test(value)) matches.push("roofing");
  if (/(veterinarian|veterinary|animal hospital)/.test(value)) matches.push("veterinarians");
  return matches;
}

/** @param {Record<string, unknown>} row */
function classifyLaunchCategories(row) {
  const primary = lower(row.category);
  const group = lower(row.group);
  const additional = lower(row.additional_categories);
  const allowScreenRepair = !/(mobile|phone|computer|electronics)/.test(primary);
  const primaryMatches = categoryMatches(primary, {
    allowScreenRepair,
    allowRestaurant: group === "restaurants & food",
  });
  const additionalMatches = categoryMatches(additional, {
    allowScreenRepair,
    allowRestaurant: true,
  });
  const matches = [...new Set([...primaryMatches, ...additionalMatches])];
  const selectedCategory =
    primaryMatches[0] === "screen-repair"
      ? "screen-repair"
      : /(hvac|air conditioning contractor|heating contractor|air duct cleaning)/.test(
            `${primary} | ${additional}`,
          )
        ? "hvac"
        : (primaryMatches.find((match) => match !== "hvac") ?? null);
  return { matches, selectedCategory };
}

/** @param {Record<string, unknown>} row */
export function launchCategoriesFor(row) {
  return classifyLaunchCategories(row).matches;
}

/** @param {Record<string, unknown>} row */
export function launchCategoryFor(row) {
  return classifyLaunchCategories(row).selectedCategory;
}

function e164(value) {
  let digits = text(value).replace(/\D/g, "");
  if (digits.length === 10) digits = `1${digits}`;
  return /^1[2-9][0-9]{9}$/.test(digits) ? `+${digits}` : null;
}

function websiteFor(row) {
  const raw = text(row.url || row.domain).toLowerCase();
  if (!raw) return { url: null, host: "" };
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = parsed.hostname.replace(/^www\./, "");
    if (!host.includes(".") || FREE_MAIL.has(host)) return { url: null, host: "" };
    parsed.protocol = "https:";
    return { url: parsed.toString(), host };
  } catch {
    return { url: null, host: "" };
  }
}

function rootDomain(host) {
  const parts = host.split(".").filter(Boolean);
  return parts.length > 1 ? parts.slice(-2).join(".") : host;
}

function businessEmailFor(row, websiteHost) {
  if (!websiteHost) return null;
  const websiteRoot = rootDomain(websiteHost);
  const contacts = parseJson(row.contact_info, []);
  if (!Array.isArray(contacts)) return null;
  const emails = contacts
    .filter((contact) => contact && contact.type === "mail")
    .map((contact) => lower(contact.value))
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .filter((email) => {
      const domain = email.split("@")[1].replace(/^www\./, "");
      return !FREE_MAIL.has(domain) && rootDomain(domain) === websiteRoot;
    })
    .sort();
  return emails[0] ?? null;
}

function activeProfileStatus(row) {
  const work = parseJson(row.work_time, {});
  const current = lower(work?.work_hours?.current_status);
  if (current === "closed_forever") return "closed_forever";
  if (current === "temporarily_closed") return "temporarily_closed";
  const claimed = row.is_claimed === true || lower(row.is_claimed) === "true";
  return claimed && text(row.place_id) ? "active" : "unverified";
}

function slugPart(value) {
  return (
    lower(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "listing"
  );
}

function normalizedName(value) {
  return text(value)
    .replaceAll("‚Äì", "–")
    .replaceAll("‚Äî", "—")
    .replaceAll("‚Äô", "’")
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

/**
 * @param {string} worksheet
 * @param {number} sourceRow
 * @param {Record<string, any>} row
 */
export function classifyListingRow(worksheet, sourceRow, row) {
  const { matches: launchCategoryMatches, selectedCategory: launchCategory } =
    classifyLaunchCategories(row);
  const city = lower(row.city);
  if (!launchCategory || (city !== "reno" && city !== "sparks")) return null;

  const name = normalizedName(row.title || row.original_title);
  const phone = e164(row.phone);
  const website = websiteFor(row);
  const businessEmail = businessEmailFor(row, website.host);
  const profileStatus = activeProfileStatus(row);
  const claimed = row.is_claimed === true || lower(row.is_claimed) === "true";
  const placeId = text(row.place_id);
  const statusReasons = [];
  if (profileStatus === "closed_forever") statusReasons.push("closed_forever");
  if (profileStatus === "temporarily_closed") statusReasons.push("temporarily_closed");
  if (!claimed || !placeId) statusReasons.push("active_claimed_gbp_unverified");
  if (!phone?.startsWith("+1775")) statusReasons.push("non_775_phone");
  if (!website.url) statusReasons.push("website_missing");
  if (!businessEmail) statusReasons.push("business_domain_email_missing");
  if (launchCategoryMatches.length > 1) statusReasons.push("launch_category_ambiguity");
  if (/(dentist|orthodontist|endodontist|prosthodontist|veterinarian)/.test(lower(row.category))) {
    statusReasons.push("practitioner_entity_review");
  }
  if (!text(row.street_address)) statusReasons.push("service_area_address_review");

  const screeningStatus =
    profileStatus === "closed_forever"
      ? "ineligible"
      : statusReasons.length === 0
        ? "eligible"
        : "needs_review";
  const suffix = createHash("sha256")
    .update(`${worksheet}:${sourceRow}:${text(row.cid || row.place_id || row.feature_id)}`)
    .digest("hex")
    .slice(0, 8);
  const hasHours = Boolean(parseJson(row.work_time, {})?.work_hours?.timetable);
  const qualityScore =
    (profileStatus === "active" ? 30 : 0) +
    (businessEmail ? 20 : 0) +
    (phone?.startsWith("+1775") ? 15 : 0) +
    (website.url ? 15 : 0) +
    10 +
    (text(row.street_address) ? 5 : 0) +
    (hasHours ? 5 : 0);

  return {
    worksheet,
    source_row: sourceRow,
    normalized_name: name,
    proposed_slug: `${slugPart(name)}-${suffix}`,
    phone_e164: phone,
    business_email: businessEmail,
    website_url: website.url,
    street_address: text(row.street_address) || null,
    city_slug: city,
    postal_code: text(row.zip),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    google_place_id: placeId || null,
    source_category: text(row.category) || null,
    launch_category_slug: launchCategory,
    active_profile_status: profileStatus,
    screening_status: screeningStatus,
    screening_reasons: statusReasons,
    quality_score: qualityScore,
    diversity_key: website.host || slugPart(name),
    evidence: {
      transform_version: "launch-candidate-v2",
      source_check_url: text(row.check_url) || null,
      place_id_present: Boolean(placeId),
      profile_claimed: claimed,
      source_status: lower(parseJson(row.work_time, {})?.work_hours?.current_status) || "unknown",
      website_host: website.host || null,
      matching_business_domain_email: Boolean(businessEmail),
      launch_category_matches: launchCategoryMatches,
      rating_present: Number.isFinite(Number(row.rating_value)),
      rating_count_present: Number.isFinite(Number(row.rating_votes_count)),
    },
  };
}
