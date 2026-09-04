import { createServerFn } from "@tanstack/react-start";
import { runAuthenticated } from "./claim-handler.mjs";
import { runStudioCommand } from "../supabase/studio-commands.mjs";

export type Proposal = {
  id: string;
  status: string;
  reason?: string;
  createdAt?: string;
  name?: string;
  payload: { name: string; description: string; phone: string; website: string };
};
export type PilotAccount = {
  listings: { id: string; slug: string; name: string; role: string }[];
  claims: { id: string; slug: string; name: string; status: string; reason?: string }[];
  canReview: boolean;
};
export type PilotWorkspace = { role: string; canEdit: boolean; proposals: Proposal[] };
export type PilotReview = {
  claims: { id: string; name: string; slug: string; method: string; status: string }[];
  proposals: Proposal[];
};
type Result =
  { ok: true; receipt: PilotAccount & PilotWorkspace & PilotReview } | { ok: false; code: string };
export const pilotCommand = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(({ data }) => runAuthenticated(data, runStudioCommand) as Promise<Result>);
