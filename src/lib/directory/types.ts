export type City = {
  id: number;
  slug: string;
  name: string;
  county: string;
  region: string;
  zip: string;
  lat: number;
  lng: number;
  blurb: string;
};

export type Category = {
  id: number;
  slug: string;
  name: string;
  description: string;
  synonyms: string;
  icon: string;
  listingCount?: number;
};

export type BusinessCard = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  phone: string;
  street: string;
  zip: string;
  rating: number | null;
  reviewCount: number | null;
  hours: string;
  featured: boolean;
  contentTier: "basic" | "standard" | "premium";
  verified: boolean;
  ownerVerified: boolean;
  citySlug: string;
  cityName: string;
  primaryCategory: string;
  primaryCategorySlug: string;
  categorySlugs: string[];
  claimedBy: string | null;
  website: string;
  publicEmail: boolean;
  hideStreet: boolean;
  coverUrl: string | null;
  informationCheckedAt: string | null;
  publishedAt: string | null;
  googlePlaceId: string | null;
};

export type ListingPhoto = {
  id: number;
  url: string;
  caption: string;
  sortOrder: number;
};

export type Offer = {
  id: number;
  businessId: number;
  title: string;
  details: string;
  code: string;
  expiresOn: string | null;
  active: boolean;
};
export type BusinessDetail = BusinessCard & {
  email: string;
  website: string;
  lat: number | null;
  lng: number | null;
  categories: { slug: string; name: string }[];
  reviews: { id: number; author: string; rating: number; body: string }[];
  photos: ListingPhoto[];
  services: string[];
  faqs: { question: string; answer: string }[];
  projects: { title: string; description?: string; imageUrl?: string }[];
  offer: Offer | null;
};

export type LeadRow = {
  id: number;
  businessId: number;
  businessName: string;
  name: string;
  phone: string;
  email: string;
  zip: string;
  message: string;
  createdAt: string;
};

export type CampaignRow = {
  id: number;
  name: string;
  channel: string;
  citySlug: string;
  categorySlug: string;
  message: string;
  status: string;
  reach: number;
  createdAt: string;
  businessName: string;
  includedOffer: string;
};

export type ResidentRow = {
  displayName: string;
  zip: string;
  citySlug: string;
  interests: string;
};
