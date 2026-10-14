import { createServerFn } from "@tanstack/react-start";
import {
  handleDecideListingClaim,
  handleGetMyListingClaim,
  handleSubmitListingClaim,
} from "@/lib/directory/claim-handler.mjs";
import { runAuthenticated } from "./claim-handler.mjs";
import { runClaimWorkflow } from "../supabase/claim-commands.mjs";

export type ClaimStatus =
  "draft" | "submitted" | "needs_evidence" | "approved" | "rejected" | "withdrawn";

export type ClaimReceipt = {
  claim_id?: string;
  status: ClaimStatus;
  method?: "business_domain" | "document" | "storefront" | "vehicle";
  role?:
    "operator" | "business_owner" | "listing_manager" | "agency_representative" | "lead_recipient";
  requested_role?: "business_owner" | "listing_manager";
  authority_active?: boolean;
  challenge?: string;
  challenge_expires_at?: string;
  evidence?: { id: string; submitted_at: string; expires_at: string; reviewed: boolean }[];
  owner_authority: boolean;
  requires_evidence: boolean;
};

export type ClaimResult = { ok: true; receipt: ClaimReceipt | null } | { ok: false; code: string };
export type ClaimDecisionResult =
  | {
      ok: true;
      receipt: {
        claim_id: string;
        listing_id: string;
        status: "approved" | "rejected";
        participation_id?: string | null;
        idempotent: boolean;
      };
    }
  | { ok: false; code: string };

const preserveUntrustedInput = (input: unknown) => input;

export const submitListingClaim = createServerFn({ method: "POST" })
  .validator(preserveUntrustedInput)
  .handler(({ data }) => handleSubmitListingClaim(data) as Promise<ClaimResult>);

export const getMyListingClaim = createServerFn({ method: "POST" })
  .validator(preserveUntrustedInput)
  .handler(({ data }) => handleGetMyListingClaim(data) as Promise<ClaimResult>);

export const decideListingClaim = createServerFn({ method: "POST" })
  .validator(preserveUntrustedInput)
  .handler(({ data }) => handleDecideListingClaim(data) as Promise<ClaimDecisionResult>);

export type ReviewEvidence = {
  evidence: {
    id: string;
    reference: string;
    explanation: string;
    expires_at: string;
    revoked: boolean;
  }[];
  scope: {
    listingVersion: string;
    role: string;
    conflicts: { id: string; status: string }[];
    participants: { id: string; status: string; expiresAt: string | null }[];
  };
};
export type ListingPeople = {
  participants: {
    id: string;
    name: string | null;
    role: string;
    status: string;
    expires_at: string | null;
  }[];
  invitations: {
    id: string;
    email: string;
    role: string;
    expires_at: string;
    accepted: boolean;
    revoked: boolean;
  }[];
};
export const claimWorkflow = createServerFn({ method: "POST" })
  .validator(preserveUntrustedInput)
  .handler(
    ({ data }) =>
      runAuthenticated(data, runClaimWorkflow) as Promise<
        | {
            ok: true;
            receipt: ClaimReceipt &
              ReviewEvidence &
              ListingPeople & {
                listing_id?: string;
                participation_id?: string;
                expires_at?: string;
                name?: string;
                slug?: string;
                city?: string;
              };
          }
        | { ok: false; code: string }
      >,
  );
