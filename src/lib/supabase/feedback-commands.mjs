import { feedbackPayload } from "../directory/roadmap.mjs";
import { callClaimRpc } from "./claim-commands.mjs";

/** @param {unknown} input @param {import('./claim-commands.mjs').ClaimOptions} options */
export async function submitFeedback(input, options) {
  let command;
  try {
    command = feedbackPayload(input);
  } catch {
    return { ok: false, code: "invalid_feedback" };
  }
  const result = await callClaimRpc({
    ...options,
    rpc: "submit_directory_feedback",
    body: { requested_payload: command.payload, requested_key: command.key },
    failureCode: "feedback_not_confirmed",
    errorCode: (message, fallback) =>
      ["feedback_rate_limited", "verified_identity_required", "idempotency_conflict"].includes(
        message,
      )
        ? message
        : fallback,
  });
  if (
    result.ok &&
    (!result.receipt ||
      typeof result.receipt.id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(result.receipt.id) ||
      result.receipt.status !== "pending_review")
  )
    return { ok: false, code: "feedback_not_confirmed" };
  return result;
}
