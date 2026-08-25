import { createServerFn } from "@tanstack/react-start";
import { getAuthKitContextOrNull } from "@workos/authkit-tanstack-react-start";
import {
  publishLaunchSelection as publishLaunchSelectionRpc,
  reviewListingCandidate as reviewListingCandidateRpc,
  validateCandidateReviewInput,
  validateLaunchPublicationInput,
} from "@/lib/supabase/operator-publication.mjs";

function currentAccessToken() {
  const auth = getAuthKitContextOrNull()?.auth();
  return auth?.user && "accessToken" in auth ? auth.accessToken : "";
}

export const reviewListingCandidate = createServerFn({ method: "POST" })
  .validator(validateCandidateReviewInput)
  .handler(async ({ data }) => {
    const accessToken = currentAccessToken();
    if (!accessToken) return { ok: false as const, code: "authentication_required" };
    return reviewListingCandidateRpc(data, { accessToken });
  });

export const publishLaunchSelection = createServerFn({ method: "POST" })
  .validator(validateLaunchPublicationInput)
  .handler(async ({ data }) => {
    const accessToken = currentAccessToken();
    if (!accessToken) return { ok: false as const, code: "authentication_required" };
    return publishLaunchSelectionRpc(data, { accessToken });
  });
