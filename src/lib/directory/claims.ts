import { createServerFn } from "@tanstack/react-start";
import {
  handleDecideListingClaim,
  handleGetMyListingClaim,
  handleSubmitListingClaim,
} from "@/lib/directory/claim-handler.mjs";

export type ClaimStatus =
  "draft" | "submitted" | "needs_evidence" | "approved" | "rejected" | "withdrawn";

export type ClaimReceipt = {
  claim_id?: string;
  status: ClaimStatus;
  method?: "business_domain" | "document" | "storefront" | "vehicle";
  role?:
    "operator" | "business_owner" | "listing_manager" | "agency_representative" | "lead_recipient";
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
