const GENERIC = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "pm.me",
]);

export function emailDomain(email: string) {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return "";
  return email
    .trim()
    .toLowerCase()
    .slice(at + 1)
    .replace(/^www\./, "");
}

export function hostFromWebsite(website: string) {
  const raw = website.trim().toLowerCase();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  }
}

export function isGenericEmail(email: string) {
  const d = emailDomain(email);
  return !d || GENERIC.has(d);
}

export function domainMatchesListing(email: string, website: string, listingEmail: string) {
  const d = emailDomain(email);
  if (!d || GENERIC.has(d)) return false;
  const site = hostFromWebsite(website);
  const listed = emailDomain(listingEmail);
  if (site && (d === site || site.endsWith(`.${d}`) || d.endsWith(`.${site}`))) return true;
  if (listed && d === listed) return true;
  return false;
}
