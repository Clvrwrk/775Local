import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { safeReturnPath } from "./policy.mjs";
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
  const location = useLocation();
  const navigate = useNavigate();
  const [next] = useState(() => safeReturnPath(location.href));
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    redirected.current = true;
    void navigate({ to, search: { next, error: undefined }, replace: true });
  }, [navigate, to, next]);
  return <p role="status">Opening sign-in…</p>;
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
