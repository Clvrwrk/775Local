import { createServerFn } from "@tanstack/react-start";
import {
  handleListingPublicationTransition,
  handlePublishLaunchSelection,
  handleReviewListingCandidate,
} from "@/lib/directory/operator-publication-handler.mjs";

const preserveUntrustedInput = (input: unknown) => input;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type OperatorCommandResult = { ok: boolean; code?: string; receipt?: JsonValue };

function createOperatorCommand(handler: (input: unknown) => Promise<OperatorCommandResult>) {
  return createServerFn({ method: "POST" })
    .validator(preserveUntrustedInput)
    .handler(({ data }) => handler(data));
}

export const reviewListingCandidate = createOperatorCommand(handleReviewListingCandidate);
export const publishLaunchSelection = createOperatorCommand(handlePublishLaunchSelection);
export const transitionListingPublicationState = createOperatorCommand(
  handleListingPublicationTransition,
);
