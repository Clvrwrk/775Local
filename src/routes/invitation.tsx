import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimWorkflow } from "@/lib/directory/claims";
export const Route = createFileRoute("/invitation")({
  validateSearch: (search: Record<string, unknown>) => ({
    token:
      typeof search.token === "string" && /^[a-f0-9]{64}$/.test(search.token) ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Listing invitation | 775Directory" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: InvitationPage,
});
function InvitationPage() {
  const { token } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const [scope, setScope] = useState<{
    name?: string;
    role?: string;
    city?: string;
    slug?: string;
    expires_at?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setScope(null);
    if (!userId || !token) return;
    void claimWorkflow({ data: { action: "invitation", token } })
      .then((result) => {
        if (!active) return;
        if (result.ok && result.receipt) setScope(result.receipt);
        else
          setMessage(
            "Sign in with the named verified email, or ask the owner to check this invitation.",
          );
      })
      .catch(() => {
        if (active) setMessage("Invitation details unavailable. Reload this link to retry.");
      });
    return () => {
      active = false;
    };
  }, [token, userId]);
  async function accept() {
    if (lock.current || !scope) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await claimWorkflow({ data: { action: "acceptInvitation", token } });
      if (result.ok) {
        setAccepted(true);
        setMessage("Invitation accepted. Your access is scoped to the invited listing and role.");
        window.history.replaceState(null, "", "/invitation");
      } else
        setMessage(
          result.code === "invitation_identity_mismatch"
            ? "Sign in with the invitation’s named email and verify that email before accepting."
            : result.code === "reauth_required"
              ? "Sign in again to accept this invitation."
              : "This invitation is unavailable or requires review. Ask the owner to check its expiry, role limits and any conflicting claims.",
        );
    } catch {
      setMessage("Connection interrupted. Retry the same link to confirm acceptance.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <SiteShell wash>
      <section className="mx-auto max-w-lg px-4 py-12">
        <h1 className="font-display text-4xl font-semibold">Listing invitation</h1>
        <p className="mt-4 text-muted">
          Accept only if you are authorized to act for this business. The invitation is bound to
          your verified email, one listing and one role.
        </p>
        {accepted ? (
          <Link to="/account" className="action-primary mt-6">
            Open your account
          </Link>
        ) : !token ? (
          <p role="alert" className="mt-6">
            This invitation link is incomplete.
          </p>
        ) : isPending ? (
          <p role="status" className="mt-6">
            Checking sign-in…
          </p>
        ) : !user ? (
          <Link
            to="/login"
            search={{ next: `/invitation?token=${token}`, error: undefined }}
            className="action-primary mt-6"
          >
            Sign in to accept
          </Link>
        ) : (
          <>
            {scope ? (
              <div className="mt-5 rounded-2xl border border-line bg-card p-5">
                <p className="font-semibold">{scope.name}</p>
                <p className="mt-2 text-sm capitalize">
                  {scope.city} · {scope.role?.replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-xs">
                  Expires {scope.expires_at ? new Date(scope.expires_at).toLocaleString() : ""}
                </p>
              </div>
            ) : (
              <p role="status" className="mt-4">
                Verifying invitation scope…
              </p>
            )}
            <button
              type="button"
              className="action-primary mt-6"
              disabled={busy || !scope}
              onClick={() => void accept()}
            >
              {busy ? "Accepting…" : "Accept scoped invitation"}
            </button>
            <Link
              to="/login"
              search={{ next: `/invitation?token=${token}`, error: undefined }}
              className="mt-4 block min-h-11 font-semibold text-teal"
            >
              Sign in again or use another email
            </Link>
          </>
        )}
        {message ? (
          <p role="status" className="mt-4 text-sm">
            {message}
          </p>
        ) : null}
      </section>
    </SiteShell>
  );
}
