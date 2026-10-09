import { createServerFn } from "@tanstack/react-start";
import { runAuthenticated } from "./claim-handler.mjs";
import { submitFeedback } from "../supabase/feedback-commands.mjs";

export type FeedbackResult =
  | { ok: true; receipt: { id: string; status: "pending_review"; duplicate: boolean } }
  | { ok: false; code: string };
export const sendFeedback = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(({ data }) => runAuthenticated(data, submitFeedback) as Promise<FeedbackResult>);
