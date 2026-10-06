import { createServerFn } from "@tanstack/react-start";
import { runAuthenticated } from "./claim-handler.mjs";
import { runStudioCommand } from "../supabase/studio-commands.mjs";

export type Proposal = {
  id: string;
  status: string;
  reason?: string;
  createdAt?: string;
  name?: string;
  payload: {
    services?: string[];
    name: string;
    description: string;
    phone: string;
    website: string;
  };
};
export type PilotAccount = {
  listings: { id: string; slug: string; name: string; role: string }[];
  claims: { id: string; slug: string; name: string; status: string; reason?: string }[];
  canReview: boolean;
};
export type PilotWorkspace = {
  editable: {
    name: string;
    description: string;
    phone: string;
    website: string;
    baseVersion: string;
    services: string[];
  };
  role: string;
  canEdit: boolean;
  proposals: Proposal[];
};
export type PilotReview = {
  requests: {
    id: string;
    createdAt: string;
    payload: {
      name: string;
      description: string;
      categorySlug: string;
      phone: string;
      zip: string;
      website: string;
    };
  }[];
  claims: {
    id: string;
    name: string;
    slug: string;
    method: string;
    claimantEmail: string;
    domainMatches: boolean;
    requestedRole: "business_owner" | "listing_manager";
    hasEvidence: boolean;
    readyForApproval: boolean;
    status: string;
  }[];
  proposals: Proposal[];
};
export type ListingRequestReviewData = {
  id: string;
  canPublish: boolean;
  payload: PilotReview["requests"][number]["payload"];
  scope: { requestHash: string; duplicates: { id: string; version: string }[] };
  duplicates: { id: string; name: string; slug: string; zip: string; status: string }[];
  categories: { slug: string; name: string }[];
};
export type MyListingRequest = {
  id: string;
  name: string;
  status: string;
  reason?: string;
  slug?: string;
};
type Result =
  | {
      ok: true;
      receipt: PilotAccount &
        PilotWorkspace &
        PilotReview &
        ListingRequestReviewData &
        MyListingRequest[];
    }
  | { ok: false; code: string };
export const pilotCommand = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(({ data }) => runAuthenticated(data, runStudioCommand) as Promise<Result>);
