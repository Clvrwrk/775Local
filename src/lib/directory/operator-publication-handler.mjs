import { getAuthKitContextOrNull } from "@workos/authkit-tanstack-react-start";
import {
  publishLaunchSelection,
  reviewListingCandidate,
  transitionListingPublicationState,
} from "../supabase/operator-publication.mjs";

/**
 * @typedef {{ok: boolean, code?: string, receipt?: any}} OperatorCommandResult
 * @typedef {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} HandlerOptions
 * @typedef {(input: unknown, options: HandlerOptions & {accessToken: string}) => Promise<OperatorCommandResult>} OperatorCommand
 */

function currentAccessToken() {
  const auth = getAuthKitContextOrNull()?.auth();
  return auth?.user && "accessToken" in auth ? auth.accessToken : "";
}

/**
 * @param {unknown} input
 * @param {OperatorCommand} command
 * @param {HandlerOptions} [options]
 * @returns {Promise<OperatorCommandResult>}
 */
async function runAuthenticatedCommand(input, command, options = {}) {
  const accessToken = currentAccessToken();
  if (!accessToken) return { ok: false, code: "authentication_required" };
  return command(input, { ...options, accessToken });
}

/**
 * @param {unknown} input
 * @param {HandlerOptions} [options]
 */
export function handleReviewListingCandidate(input, options) {
  return runAuthenticatedCommand(input, reviewListingCandidate, options);
}

/**
 * @param {unknown} input
 * @param {HandlerOptions} [options]
 */
export function handlePublishLaunchSelection(input, options) {
  return runAuthenticatedCommand(input, publishLaunchSelection, options);
}

/**
 * @param {unknown} input
 * @param {HandlerOptions} [options]
 */
export function handleListingPublicationTransition(input, options) {
  return runAuthenticatedCommand(input, transitionListingPublicationState, options);
}
