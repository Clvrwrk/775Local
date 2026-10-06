export function useCurrentUserState() {
  return {
    user: window.__fixture.user
      ? {
          id: "fixture-actor",
          primaryEmail: "manager@fixture.example",
          displayName: "Fixture Manager",
        }
      : null,
    isPending: false,
  };
}
export function useCurrentUser() {
  return useCurrentUserState().user;
}
export function useAuth() {
  const { user } = useCurrentUserState();
  return { user, loading: false, signOut: async () => {} };
}
