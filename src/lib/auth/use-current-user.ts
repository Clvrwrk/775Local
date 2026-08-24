/** The identity shape the WorkOS adapter will expose to UI code. */
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

/**
 * Authentication fails closed until the approved WorkOS AuthKit environment is
 * connected. There is deliberately no local or preview identity fallback.
 */
export function useCurrentUserState(): CurrentUserState {
  return { user: null, isPending: false };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
