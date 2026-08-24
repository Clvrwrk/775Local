import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { toAppUser } from "./policy.mjs";

/** The sanitized identity shape exposed to Local775 UI code. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
};

export type CurrentUserState = {
  user: AppUser | null;
  isPending: boolean;
};

export function useCurrentUserState(): CurrentUserState {
  const { user, loading } = useAuth();
  return { user: user ? toAppUser(user) : null, isPending: loading };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
