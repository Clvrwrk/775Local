import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { normalizeDomain, normalizeResultUrl } from "./serp-enrichment-lib.mjs";

export const ACCEPTED_ENRICHMENT_FILTER_VERSION = "business-controlled-domain-v10";
export const PROFILE_PROPOSAL_VERSION = "seed-profile-v1";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function listArtifactFiles(root, directory = root) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await listArtifactFiles(root, path)));
    if (entry.isFile() && [".json", ".jsonl"].includes(extname(entry.name))) paths.push(path);
  }
  return paths.sort((left, right) => left.localeCompare(right));
}

function classifyArtifact(relativePath) {
  if (relativePath === "category-queue.json") return "category_queue";
  if (relativePath === "progress.json") return "progress";
  if (relativePath === "provider-ledger.jsonl") return "provider_ledger";
  if (/^batch-[^/]+\/run-summary\.json$/.test(relativePath)) return "batch_summary";
  if (/^batch-[^/]+\/[^/]+-search\.json$/.test(relativePath)) return "search_receipt";
  if (/^batch-[^/]+\/(?:superseded-listings\/)?listings\/.+\.json$/.test(relativePath)) {
    return "listing_receipt";
  }
  if (/^batch-[^/]+\/(?:listings|superseded-listings)\/.+\.json$/.test(relativePath)) {
    return "listing_receipt";
  }
  return "other";
}

function batchSlug(relativePath) {
  return relativePath.match(/^(batch-[^/]+)\//)?.[1] ?? null;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`>#|\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBoilerplate(text) {
  return /^(skip to|close|search|menu|home|contact|learn more|read more|copyright|privacy|terms|cookie|schedule|book now|call now|get a quote)/i.test(
    text,
  );
}

export function extractAboutSourceExcerpt(sourcePages) {
  const candidates = [];
  for (const [pageIndex, page] of (sourcePages ?? []).entries()) {
    const paragraphs = String(page?.markdown ?? "").split(/\n\s*\n/);
    for (const raw of paragraphs) {
      const text = cleanText(raw);
      if (text.length < 120 || text.length > 1200 || isBoilerplate(text)) continue;
      if (
        /testimonial|what our customers|privacy policy|terms of service|all rights reserved/i.test(
          text,
        )
      ) {
        continue;
      }
      let score = Math.min(40, Math.floor(text.length / 25));
      if (pageIndex === 0) score += 20;
      if (/about|who we are|since \d{4}|family|locally|serve|provid/i.test(text)) score += 15;
      candidates.push({ text, score });
    }
  }
  return candidates.sort((left, right) => right.score - left.score)[0]?.text ?? null;
}

export function extractServiceCandidates(sourcePages) {
  const candidates = new Map();
  const reject =
    /^(home|about|contact|menu|services?|service areas?|learn more|read more|schedule|book|request|faq|blog|privacy|terms|our team|testimonials?|reviews?)$/i;
  for (const page of sourcePages ?? []) {
    const pageUrl = String(page?.url ?? "");
    for (const rawLine of String(page?.markdown ?? "").split("\n")) {
      if (!/^#{2,4}\s+/.test(rawLine) && !/^[-*]\s+/.test(rawLine)) continue;
      const text = cleanText(rawLine.replace(/^#{2,4}\s+|^[-*]\s+/, ""));
      if (text.length < 4 || text.length > 90 || reject.test(text) || isBoilerplate(text)) continue;
      if (
        /copyright|privacy|cookie|financing|special|promotion|coupon|career|employment/i.test(text)
      ) {
        continue;
      }
      const key = text.toLowerCase();
      const score = (pageUrl.includes("/service") ? 20 : 0) + (rawLine.startsWith("#") ? 10 : 0);
      if (!candidates.has(key) || candidates.get(key).score < score)
        candidates.set(key, { text, score });
    }
  }
  return [...candidates.values()]
    .sort((left, right) => right.score - left.score || left.text.localeCompare(right.text))
    .slice(0, 20)
    .map(({ text }) => text);
}

export function extractServiceAreaCandidates(sourcePages) {
  const values = new Set();
  for (const page of sourcePages ?? []) {
    let url;
    try {
      url = new URL(page?.url ?? "");
    } catch {
      continue;
    }
    const match = url.pathname.match(/\/service-areas?\/([^/]+)/i);
    if (match) {
      const area = match[1]
        .replace(/-nv$/i, "")
        .split("-")
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join(" ");
      if (area.length >= 3) values.add(area);
    }
  }
  const combined = (sourcePages ?? []).map((page) => page?.markdown ?? "").join("\n");
  for (const city of ["Reno", "Sparks", "Carson City", "Sun Valley", "Spanish Springs"]) {
    if (new RegExp(`\\b${city.replace(" ", "\\s+")}\\b`, "i").test(combined)) values.add(city);
  }
  return [...values].sort().slice(0, 20);
}

const BAD_IMAGE_HOSTS = [
  "cdn.userway.org",
  "events.jotform.com",
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "facebook.com",
  "gravatar.com",
];
const BAD_IMAGE_TEXT =
  /spinner|loader|loading|tracking|pixel|captcha|userway|jotform|favicon|placeholder|blank|spacer|arrow|chevron|close[-_ ]?icon/i;

function imageRole(altText, imageUrl) {
  return /\b(logo|brand mark)\b/i.test(`${altText} ${imageUrl}`) ? "logo" : "gallery";
}

export function extractPhotoCandidates(sourcePages, businessDomain) {
  const candidates = new Map();
  for (const page of sourcePages ?? []) {
    const sourcePageUrl = normalizeResultUrl(page?.url);
    if (!sourcePageUrl) continue;
    const markdown = String(page?.markdown ?? "");
    const matches = [
      ...markdown.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/gi),
      ...markdown.matchAll(/<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi),
    ];
    for (const match of matches) {
      const altText = cleanText(match.length >= 3 ? match[1] : "").slice(0, 500);
      const imageUrl = String(match.length >= 3 ? match[2] : match[1]).replaceAll("&amp;", "&");
      let image;
      try {
        image = new URL(imageUrl);
      } catch {
        continue;
      }
      const host = image.hostname.toLowerCase();
      if (BAD_IMAGE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
        continue;
      }
      if (BAD_IMAGE_TEXT.test(`${altText} ${image.pathname}`) || /\.svg(?:$|\?)/i.test(imageUrl)) {
        continue;
      }
      const imageDomain = normalizeDomain(imageUrl);
      const sameSite = Boolean(
        imageDomain &&
        businessDomain &&
        (imageDomain === businessDomain || imageDomain.endsWith(`.${businessDomain}`)),
      );
      const roleCandidate = imageRole(altText, imageUrl);
      let evidenceScore = sameSite ? 50 : 10;
      if (/\.(?:jpe?g|png|webp|avif)(?:$|\?)/i.test(imageUrl)) evidenceScore += 20;
      if (/\/uploads?\/|\/gallery\/|\/portfolio\/|\/projects?\/|\/team\//i.test(image.pathname)) {
        evidenceScore += 20;
      }
      if (/\/(?:about|gallery|portfolio|projects?|team)(?:\/|$)/i.test(sourcePageUrl))
        evidenceScore += 10;
      if (altText.length >= 5 && !/^(image|photo|img|untitled)$/i.test(altText))
        evidenceScore += 10;
      if (roleCandidate === "logo") evidenceScore += 15;
      if (evidenceScore < 20) continue;
      const candidate = {
        image_url: image.href,
        source_page_url: sourcePageUrl,
        alt_text: altText || null,
        role_candidate: roleCandidate,
        same_site: sameSite,
        evidence_score: Math.min(200, evidenceScore),
      };
      const prior = candidates.get(candidate.image_url);
      if (!prior || prior.evidence_score < candidate.evidence_score) {
        candidates.set(candidate.image_url, candidate);
      }
    }
  }
  return [...candidates.values()]
    .sort(
      (left, right) =>
        right.evidence_score - left.evidence_score || left.image_url.localeCompare(right.image_url),
    )
    .slice(0, 30);
}

function descriptionCandidate(title, services, serviceAreas) {
  if (!title || services.length === 0) return null;
  const serviceText = services.slice(0, 4).join(", ");
  const areaText = serviceAreas.length ? ` in ${serviceAreas.slice(0, 3).join(", ")}` : "";
  return `${title} provides ${serviceText}${areaText}.`;
}

function completeness(profile) {
  let score = 0;
  if (profile.normalized_title) score += 20;
  if (profile.phone_candidates.length) score += 20;
  if (profile.email_candidates.length) score += 10;
  if (profile.hours_evidence) score += 10;
  if (profile.description_candidate) score += 15;
  if (profile.service_candidates.length) score += 10;
  if (profile.photo_candidates.length) score += 15;
  return score;
}

function profileEvidenceStatus(receipt, currentResult) {
  if (
    !currentResult ||
    normalizeResultUrl(receipt?.serp?.url) !== normalizeResultUrl(currentResult.url)
  ) {
    return "stale";
  }
  if (receipt?.reviewStatus === "crawl_failed") return "crawl_failed";
  if (
    receipt?.reviewStatus === "private_candidate" &&
    Number.isInteger(receipt?.crawl?.pageCount) &&
    receipt.crawl.pageCount > 0 &&
    Array.isArray(receipt.sourcePages) &&
    receipt.sourcePages.length > 0
  ) {
    return "complete";
  }
  return "invalid";
}

function artifactMetadata(relativePath, payload) {
  const artifactKind = classifyArtifact(relativePath);
  const searchCategory = payload?.category ?? null;
  const domain = payload?.serp?.domain ?? null;
  return {
    artifact_kind: artifactKind,
    batch_slug: batchSlug(relativePath),
    category_priority: searchCategory?.priority ?? null,
    category_slug: searchCategory?.slug ?? null,
    domain: domain ? String(domain).toLowerCase() : null,
    source_url: payload?.serp?.url ?? null,
    provider: payload?.crawl?.provider ?? payload?.provider ?? null,
    is_superseded: relativePath.includes("superseded"),
  };
}

function buildProfiles(artifacts) {
  const searches = artifacts.filter(
    (artifact) =>
      artifact.artifact_kind === "search_receipt" && artifact.parsed_payload?.category?.slug,
  );
  const receiptsByDomain = new Map();
  for (const artifact of artifacts) {
    if (
      artifact.artifact_kind !== "listing_receipt" ||
      artifact.is_superseded ||
      !/\/listings\/[^/]+\.json$/.test(`/${artifact.relative_path}`)
    ) {
      continue;
    }
    const receipt = artifact.parsed_payload;
    const categorySlug = receipt?.category?.slug;
    const domain = String(receipt?.serp?.domain ?? artifact.domain ?? "").toLowerCase();
    if (categorySlug && domain) {
      receiptsByDomain.set(`${artifact.batch_slug}\u0000${categorySlug}\u0000${domain}`, artifact);
    }
  }
  const profiles = [];
  for (const searchArtifact of searches) {
    const search = searchArtifact.parsed_payload;
    const category = search.category;
    const categoryName = category?.name ?? category?.category;
    for (const currentResult of search.results ?? []) {
      const domain = String(currentResult?.domain ?? "").toLowerCase();
      const websiteUrl = normalizeResultUrl(currentResult?.url);
      const artifact = receiptsByDomain.get(
        `${searchArtifact.batch_slug}\u0000${category.slug}\u0000${domain}`,
      );
      if (
        !artifact ||
        !category?.priority ||
        !category?.slug ||
        !categoryName ||
        !domain ||
        !websiteUrl
      ) {
        continue;
      }
      const receipt = artifact.parsed_payload;
      const sourcePages = Array.isArray(receipt.sourcePages) ? receipt.sourcePages : [];
      const services = extractServiceCandidates(sourcePages);
      const serviceAreas = extractServiceAreaCandidates(sourcePages);
      const photos = extractPhotoCandidates(sourcePages, domain);
      const normalizedTitle =
        String(receipt?.evidence?.title ?? receipt?.serp?.title ?? "").trim() || null;
      const profile = {
        content_sha256: artifact.content_sha256,
        proposal_version: PROFILE_PROPOSAL_VERSION,
        category_priority: category.priority,
        category_slug: category.slug,
        category_name: categoryName,
        domain,
        website_url: websiteUrl,
        serp_rank: Number.isInteger(currentResult?.serpRank) ? currentResult.serpRank : null,
        filter_version: search?.filterVersion ?? null,
        filter_version_accepted: search?.filterVersion === ACCEPTED_ENRICHMENT_FILTER_VERSION,
        evidence_status: profileEvidenceStatus(receipt, currentResult),
        normalized_title: normalizedTitle,
        description_candidate: descriptionCandidate(normalizedTitle, services, serviceAreas),
        about_source_excerpt: extractAboutSourceExcerpt(sourcePages),
        phone_candidates: Array.isArray(receipt?.evidence?.phones) ? receipt.evidence.phones : [],
        email_candidates: Array.isArray(receipt?.evidence?.emails) ? receipt.evidence.emails : [],
        hours_evidence: receipt?.evidence?.hoursEvidence ?? null,
        service_candidates: services,
        service_area_candidates: serviceAreas,
        photo_candidates: photos,
        source_urls: Array.isArray(receipt?.evidence?.sourceUrls)
          ? [...new Set(receipt.evidence.sourceUrls)]
          : [],
        page_count: Number.isInteger(receipt?.crawl?.pageCount) ? receipt.crawl.pageCount : 0,
        completeness_score: 0,
      };
      profile.completeness_score = completeness(profile);
      profiles.push(profile);
    }
  }
  return profiles.sort(
    (left, right) =>
      left.category_priority - right.category_priority || left.domain.localeCompare(right.domain),
  );
}

export async function buildEnrichmentSnapshot(root) {
  const paths = await listArtifactFiles(root);
  const artifacts = [];
  let capturedAt = 0;
  for (const path of paths) {
    const [bytes, details] = await Promise.all([readFile(path), stat(path)]);
    const relativePath = relative(root, path).split(sep).join("/");
    let rawText;
    try {
      rawText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      throw new Error(`Artifact is not valid UTF-8: ${relativePath}`);
    }
    if (rawText.includes("\u0000"))
      throw new Error(`Artifact contains a NUL byte: ${relativePath}`);
    let parsedPayload = null;
    if (extname(path) === ".json") {
      try {
        parsedPayload = JSON.parse(rawText);
      } catch {
        throw new Error(`Artifact is not valid JSON: ${relativePath}`);
      }
    }
    capturedAt = Math.max(capturedAt, details.mtimeMs);
    artifacts.push({
      relative_path: relativePath,
      content_sha256: sha256(bytes),
      byte_count: bytes.length,
      content_type: extname(path) === ".jsonl" ? "application/x-ndjson" : "application/json",
      raw_text: rawText,
      parsed_payload: parsedPayload,
      ...artifactMetadata(relativePath, parsedPayload),
    });
  }
  const profiles = buildProfiles(artifacts);
  const manifestSha256 = sha256(
    stableJson({
      proposalVersion: PROFILE_PROPOSAL_VERSION,
      artifacts: artifacts.map((artifact) => ({
        path: artifact.relative_path,
        sha256: artifact.content_sha256,
        bytes: artifact.byte_count,
      })),
    }),
  );
  return {
    manifestSha256,
    proposalVersion: PROFILE_PROPOSAL_VERSION,
    sourceRoot: root,
    artifactCount: artifacts.length,
    profileCount: profiles.length,
    totalBytes: artifacts.reduce((sum, artifact) => sum + artifact.byte_count, 0),
    capturedAt: new Date(capturedAt || Date.now()).toISOString(),
    filterVersions: [
      ...new Set(profiles.map((profile) => profile.filter_version).filter(Boolean)),
    ].sort(),
    artifacts,
    profiles,
  };
}

export function summarizeEnrichmentSnapshot(snapshot) {
  const byStatus = Object.fromEntries(
    ["complete", "crawl_failed", "invalid", "missing", "stale"].map((status) => [
      status,
      snapshot.profiles.filter((profile) => profile.evidence_status === status).length,
    ]),
  );
  return {
    manifestSha256: snapshot.manifestSha256,
    proposalVersion: snapshot.proposalVersion,
    artifactCount: snapshot.artifactCount,
    profileCount: snapshot.profileCount,
    totalBytes: snapshot.totalBytes,
    filterVersions: snapshot.filterVersions,
    profilesByEvidenceStatus: byStatus,
    acceptedFilterProfileCount: snapshot.profiles.filter(
      (profile) => profile.filter_version_accepted,
    ).length,
    photoCandidateCount: snapshot.profiles.reduce(
      (sum, profile) => sum + profile.photo_candidates.length,
      0,
    ),
    canonicalListingWrites: false,
    publicationWrites: false,
  };
}
