import { useSyncExternalStore } from "react";
function subscribe(callback) {
  window.addEventListener("fixture-identity", callback);
  return () => window.removeEventListener("fixture-identity", callback);
}
export function useCurrentUserState() {
  const id = useSyncExternalStore(subscribe, () =>
    window.__fixture.user ? (window.__fixture.actorId ?? "fixture-actor") : null,
  );
  return {
    user: id
      ? {
          id,
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
  return {
    user,
    loading: false,
    signOut: async () => {
      // AuthKit signOut navigates away; this fixture mirrors that navigation only.
      localStorage.setItem("fixture-signed-out", "true");
      window.location.assign("/login");
    },
  };
}
