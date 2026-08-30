import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const SEED_FILTER_VERSION = "business-controlled-domain-v10";

function clean(value) {
  return String(value ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`>#|\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function paragraphs(markdown) {
  return String(markdown ?? "")
    .split(/\n\s*\n/)
    .map(clean)
    .filter(Boolean);
}

function about(pages, fallback) {
  const values = [];
  for (const [pageIndex, page] of pages.entries()) {
    for (const value of paragraphs(page.markdown)) {
      if (value.length < 120 || value.length > 900) continue;
      if (
        /privacy|terms|cookie|testimonial|all rights reserved|accessing our website|information about you|submit email address/i.test(
          value,
        )
      )
        continue;
      if ((value.match(/\s-\s/g) ?? []).length >= 5) continue;
      let score = Math.min(40, Math.floor(value.length / 25));
      if (pageIndex === 0) score += 15;
      if (/about|who we are|family|locally|since \d{4}|provide|serve/i.test(value)) score += 20;
      values.push({ value, score });
    }
  }
  return values.sort((a, b) => b.score - a.score)[0]?.value ?? clean(fallback).slice(0, 900);
}

function services(pages) {
  const values = new Map();
  const reject =
    /^(home|about|contact|menu|services?|learn more|read more|schedule|book|request|faq|blog|privacy|terms|our team|reviews?)$/i;
  for (const page of pages) {
    for (const line of String(page.markdown ?? "").split("\n")) {
      if (!/^#{2,4}\s+/.test(line) && !/^[-*]\s+/.test(line)) continue;
      const value = clean(line.replace(/^#{2,4}\s+|^[-*]\s+/, ""));
      if (value.length < 4 || value.length > 80 || reject.test(value)) continue;
      if (
        /privacy|cookie|financing|coupon|career|employment|testimonial|toggle|scroll to top|business hours|language spoken|insurance|^address$/i.test(
          value,
        )
      )
        continue;
      values.set(value.toLowerCase(), value);
    }
  }
  return [...values.values()].slice(0, 12);
}

function hours(value) {
  const normalized = clean(value).slice(0, 300);
  if (!normalized) return null;
  const hasDay =
    /\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i.test(
      normalized,
    );
  const hasTime =
    /\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(normalized) ||
    /\b24\s*(?:hours?|\/\s*7)\b/i.test(normalized);
  return hasDay && hasTime ? normalized : null;
}

function faqs(pages) {
  const values = [];
  for (const page of pages.filter((item) => /faq|frequent/i.test(`${item.url} ${item.title}`))) {
    const blocks = paragraphs(page.markdown);
    for (let index = 0; index < blocks.length - 1; index += 1) {
      const question = blocks[index].replace(/^Q[:.]?\s*/i, "");
      const answer = blocks[index + 1].replace(/^A[:.]?\s*/i, "");
      if (!question.endsWith("?") || question.length < 12 || question.length > 180) continue;
      if (answer.length < 30 || answer.length > 800) continue;
      values.push({ question, answer });
      if (values.length === 8) return values;
    }
  }
  return values;
}

function projects(pages) {
  return pages
    .filter((page) => /\/(?:projects?|portfolio|gallery|our-work)(?:\/|$)/i.test(page.url ?? ""))
    .map((page) => ({
      title: clean(page.title).slice(0, 160),
      description: paragraphs(page.markdown)
        .find((value) => value.length >= 80)
        ?.slice(0, 500),
    }))
    .filter((project) => project.title.length >= 4)
    .filter(
      (project, index, all) => all.findIndex((item) => item.title === project.title) === index,
    )
    .slice(0, 6);
}

function address(pages) {
  const text = pages.map((page) => page.markdown ?? "").join("\n");
  const match = text.match(
    /\b(\d{1,6}[ \t]+[A-Za-z0-9][A-Za-z0-9 .#'’-]{2,70}?),?[ \t]+(Reno|Sparks),?[ \t]+NV[ \t]+(89\d{3})\b/i,
  );
  return match
    ? { street: clean(match[1]), city: match[2].toLowerCase(), postalCode: match[3] }
    : null;
}

function phone(values) {
  for (const value of values ?? []) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length === 10 && digits.startsWith("775")) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1775")) return `+${digits}`;
  }
  return null;
}

function displayName(title, domain) {
  const first = clean(title)
    .split(/\s+[|–—]\s+|\s+-\s+(?=[A-Z0-9])/)[0]
    .trim();
  if (first.length >= 2 && first.length <= 120) return first;
  return domain
    .split(".")[0]
    .split(/[-_]/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
    .slice(0, 120);
}

function slug(domain) {
  return domain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function quality(row) {
  const modules = {
    description: row.description.length >= 120,
    services: row.services.length >= 3,
    hours: Boolean(row.hours),
    faqs: row.faqs.length >= 3,
    projects: row.projects.length >= 2,
  };
  const moduleCount = Object.values(modules).filter(Boolean).length;
  const score =
    (modules.description ? 20 : 0) +
    (modules.services ? 20 : 0) +
    (modules.hours ? 15 : 0) +
    (modules.faqs ? 25 : 0) +
    (modules.projects ? 20 : 0);
  return { modules, moduleCount, score };
}

export function assignMaterializedTiers(rows) {
  const ranked = rows
    .map((row) => ({ ...row, tierEvidence: quality(row) }))
    .sort((a, b) => b.tierEvidence.score - a.tierEvidence.score || a.slug.localeCompare(b.slug));
  const premium = ranked.filter(
    (row) =>
      row.tierEvidence.moduleCount >= 3 &&
      (row.tierEvidence.modules.faqs || row.tierEvidence.modules.projects),
  );
  if (premium.length < 10)
    throw new Error(`Only ${premium.length} candidates meet Premium quality.`);
  const premiumSlugs = new Set(premium.slice(0, 10).map((row) => row.slug));
  const standard = ranked.filter(
    (row) => !premiumSlugs.has(row.slug) && row.tierEvidence.moduleCount >= 2,
  );
  if (standard.length < 30)
    throw new Error(`Only ${standard.length} candidates meet Standard quality.`);
  const standardSlugs = new Set(standard.slice(0, 30).map((row) => row.slug));
  return rows.map((row) => ({
    ...row,
    contentTier: premiumSlugs.has(row.slug)
      ? "premium"
      : standardSlugs.has(row.slug)
        ? "standard"
        : "basic",
    tierEvidence: quality(row),
  }));
}

export async function buildSerpSeed(root) {
  const batch = join(root, "batch-01");
  const queue = JSON.parse(await readFile(join(root, "category-queue.json"), "utf8")).queue.slice(
    0,
    10,
  );
  const used = new Set();
  const rows = [];
  for (const category of queue) {
    const search = JSON.parse(await readFile(join(batch, `${category.slug}-search.json`), "utf8"));
    if (search.filterVersion !== SEED_FILTER_VERSION)
      throw new Error(`${category.slug} uses a stale filter.`);
    let selected = 0;
    for (const result of search.results) {
      if (used.has(result.domain)) continue;
      let receipt = null;
      try {
        receipt = JSON.parse(
          await readFile(
            join(batch, "listings", `${category.slug}--${result.domain}.json`),
            "utf8",
          ),
        );
      } catch {
        receipt = null;
      }
      const pages =
        receipt?.reviewStatus === "private_candidate" ? (receipt.sourcePages ?? []) : [];
      const location = address(pages);
      const row = {
        domain: result.domain,
        slug: slug(result.domain),
        displayName: displayName(result.title, result.domain),
        categorySlug: category.slug,
        serpRank: result.serpRank,
        websiteUrl: result.url,
        phoneE164: phone(receipt?.evidence?.phones),
        description: about(pages, result.description),
        services: services(pages),
        faqs: faqs(pages),
        projects: projects(pages),
        hours: hours(receipt?.evidence?.hoursEvidence),
        citySlug:
          location?.city ?? (result.serpCity?.toLowerCase() === "sparks" ? "sparks" : "reno"),
        postalCode: location?.postalCode ?? null,
        streetAddress: location?.street ?? null,
        isServiceArea: !location,
        evidenceStatus: receipt?.reviewStatus === "private_candidate" ? "complete" : "partial",
        filterVersion: search.filterVersion,
        sourceCheckedAt: search.revalidatedAt ?? search.researchedAt,
        sourceUrls: (receipt?.evidence?.sourceUrls ?? [result.url]).slice(0, 10),
      };
      used.add(result.domain);
      rows.push(row);
      selected += 1;
      if (selected === 10) break;
    }
    if (selected !== 10)
      throw new Error(`${category.slug} produced ${selected} unique candidates.`);
  }
  const listings = assignMaterializedTiers(rows);
  const receiptSha256 = createHash("sha256").update(JSON.stringify(listings)).digest("hex");
  return { schemaVersion: 1, filterVersion: SEED_FILTER_VERSION, receiptSha256, listings };
}
