import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { useCurrentUserState } from "./use-current-user";

export const SIGN_IN_PATH = "/login";

export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

export function UserButton() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <button
      type="button"
      className="text-sm font-medium text-teal hover:underline"
      onClick={() => void signOut({ returnTo: "/" })}
    >
      Sign out
    </button>
  );
}
