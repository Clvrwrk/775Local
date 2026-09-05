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

export type ListingPlan = "basic" | "standard" | "premium";

export type BusinessCard = {
  id: number;
  sourceId: string;
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
  contentTier: ListingPlan;
  verified: boolean;
  ownerVerified: boolean;
  citySlug: string;
  cityName: string;
  primaryCategory: string;
  primaryCategorySlug: string;
  categorySlugs: string[];
  /** Public projection never identifies an owner Actor. */
  claimedBy: null;
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
export type CaseStudyMetric = { label: string; before: string; after: string; unit: string };

export type CaseStudy = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  clientType: string;
  clientLocation: string;
  projectType: string;
  startedOn: string | null;
  completedOn: string | null;
  investmentRange: string;
  materials: string;
  crewSize: number | null;
  clientNeed: string;
  approach: string;
  results: string;
  challenges: string;
  timelineNote: string;
  lessons: string;
  futurePlans: string;
  metrics: CaseStudyMetric[];
  testimonial: { quote: string; author: string; role: string; rating: number | null } | null;
  beforeUrl: string;
  afterUrl: string;
  featured: boolean;
  publishedAt: string | null;
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
  caseStudies: CaseStudy[];
  caseStudiesStatus: "available" | "unavailable";
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
