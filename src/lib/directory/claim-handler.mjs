import { getAuthKitContextOrNull } from "@workos/authkit-tanstack-react-start";
import {
  decideListingClaim,
  getMyListingClaim,
  submitListingClaim,
} from "../supabase/claim-commands.mjs";

/**
 * @typedef {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} HandlerOptions
 * @typedef {(input: unknown, options: HandlerOptions & {accessToken: string}) => Promise<unknown>} ClaimOperation
 */

function currentAccessToken() {
  const auth = getAuthKitContextOrNull()?.auth();
  return auth?.user && "accessToken" in auth ? auth.accessToken : "";
}

/** @param {unknown} input @param {ClaimOperation} operation @param {HandlerOptions} [options] */
export async function runAuthenticated(input, operation, options = {}) {
  const accessToken = currentAccessToken();
  if (!accessToken) return { ok: false, code: "authentication_required" };
  return operation(input, { ...options, accessToken });
}

/** @param {unknown} input @param {HandlerOptions} [options] */
export function handleSubmitListingClaim(input, options) {
  return runAuthenticated(input, submitListingClaim, options);
}

/** @param {unknown} input @param {HandlerOptions} [options] */
export function handleGetMyListingClaim(input, options) {
  return runAuthenticated(input, getMyListingClaim, options);
}

/** @param {unknown} input @param {HandlerOptions} [options] */
export function handleDecideListingClaim(input, options) {
  return runAuthenticated(input, decideListingClaim, options);
}
