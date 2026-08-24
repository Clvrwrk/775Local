import { createServerFn } from "@tanstack/react-start";
import { fetchDirectoryListings } from "@/lib/supabase/public-directory.mjs";
import type { ListingPhoto, Offer } from "./types";

const PHOTO_CAP = { claimed: 6, featured: 12 } as const;

function ownerAccessUnavailable<T>(): T {
  throw new Error("Owner access is unavailable until the WorkOS connection is configured.");
}

export function photoCap(featured: boolean) {
  return featured ? PHOTO_CAP.featured : PHOTO_CAP.claimed;
}

export const listOwnerPhotos = createServerFn({ method: "GET" })
  .validator((businessId: number) => businessId)
  .handler(async () =>
    ownerAccessUnavailable<{
      photos: ListingPhoto[];
      cap: (typeof PHOTO_CAP)[keyof typeof PHOTO_CAP];
      featured: boolean;
      slug: string;
    }>(),
  );

export const addListingPhoto = createServerFn({ method: "POST" })
  .validator((input: { businessId: number; dataUrl: string; caption: string }) => input)
  .handler(async () => ownerAccessUnavailable<ListingPhoto>());

export const deleteListingPhoto = createServerFn({ method: "POST" })
  .validator((input: { businessId: number; photoId: number }) => input)
  .handler(async () => ownerAccessUnavailable<{ ok: true }>());

export const saveOffer = createServerFn({ method: "POST" })
  .validator((input: {
    businessId: number;
    title: string;
    details: string;
    code: string;
    expiresOn: string;
    active: boolean;
  }) => input)
  .handler(async () => ownerAccessUnavailable<{ ok: true }>());

export const getOwnerOffer = createServerFn({ method: "GET" })
  .validator((businessId: number) => businessId)
  .handler(async () =>
    ownerAccessUnavailable<{ offer: Offer | null; featured: boolean; slug: string }>(),
  );

export const setFeaturedPackage = createServerFn({ method: "POST" })
  .validator((input: { businessId: number; featured: boolean }) => input)
  .handler(async () => ownerAccessUnavailable<{ featured: boolean }>());

export const listActiveOffers = createServerFn({ method: "GET" }).handler(async () => {
  const listings = await fetchDirectoryListings({ filters: { limit: 24 } });
  return listings.flatMap((listing) => {
    const offer = listing.offer as Offer | null;
    if (!offer) return [];
    return [{
      businessId: listing.id as number,
      slug: listing.slug as string,
      businessName: listing.name as string,
      cityName: listing.cityName as string,
      featured: listing.featured as boolean,
      title: offer.title,
      details: offer.details,
      code: offer.code,
      expiresOn: offer.expiresOn,
    }];
  });
});

export type OwnerPhotoResult = { photos: ListingPhoto[]; cap: number; featured: boolean; slug: string };
