import { createServerFn } from "@tanstack/react-start";
import { runAuthenticated } from "./claim-handler.mjs";
import { runProfileCommand } from "../supabase/profile-commands.mjs";

export type PersonProfile = {
  displayName: string;
  city: string;
  bio: string;
  version: number;
};
type Result = { ok: true; receipt: PersonProfile | null } | { ok: false; code: string };
export const personProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(({ data }) => runAuthenticated(data, runProfileCommand) as Promise<Result>);
