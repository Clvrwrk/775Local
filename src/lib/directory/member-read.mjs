import { callMemberRpc, photoUrls } from "../supabase/member-commands.mjs";

/** @param {string} slug @param {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} [options] */
export async function fetchListingExperiences(slug, options = {}) {
  const result = await callMemberRpc({
    rpc: "listing_experiences",
    body: { requested_slug: slug },
    env: options.env,
    fetchImpl: options.fetchImpl,
    failureCode: "experiences_unavailable",
  });
  if (!result.ok || !Array.isArray(result.receipt)) return [];
  const baseUrl = options.env?.SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  return result.receipt.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const review = /** @type {Record<string, unknown>} */ (row);
    const handle = typeof review.handle === "string" ? review.handle : "";
    const body = typeof review.body === "string" ? review.body : "";
    const rating = Number(review.rating);
    if (!handle || !body || !Number.isInteger(rating)) return [];
    return [
      {
        id: String(review.id ?? ""),
        author: String(review.author ?? "Local Member"),
        handle,
        town: String(review.town ?? ""),
        rating,
        body,
        createdAt: String(review.createdAt ?? ""),
        photos: photoUrls(review.photoPaths, baseUrl),
      },
    ];
  });
}

/** @param {string} handle @param {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} [options] */
export async function fetchPublicMember(handle, options = {}) {
  const result = await callMemberRpc({
    rpc: "local_member_page",
    body: { requested_handle: handle },
    env: options.env,
    fetchImpl: options.fetchImpl,
    failureCode: "member_unavailable",
  });
  if (!result.ok || !result.receipt || typeof result.receipt !== "object") return null;
  const page = /** @type {Record<string, unknown>} */ (result.receipt);
  if (typeof page.handle !== "string" || typeof page.displayName !== "string") return null;
  const baseUrl = options.env?.SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const experiences = Array.isArray(page.experiences) ? page.experiences : [];
  return {
    displayName: page.displayName,
    handle: page.handle,
    town: String(page.town ?? ""),
    bio: String(page.bio ?? ""),
    memberSince: String(page.memberSince ?? ""),
    experiences: experiences.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const experience = /** @type {Record<string, unknown>} */ (row);
      if (experience.status !== "published") return [];
      return [
        {
          reviewId: String(experience.reviewId ?? ""),
          listingSlug: String(experience.listingSlug ?? ""),
          listingName: String(experience.listingName ?? ""),
          rating: Number(experience.rating),
          body: String(experience.body ?? ""),
          createdAt: String(experience.createdAt ?? ""),
          photos: photoUrls(experience.photoPaths, baseUrl),
        },
      ];
    }),
  };
}
