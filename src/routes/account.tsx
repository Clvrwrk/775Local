import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pilotCommand, type PilotAccount } from "@/lib/directory/studio";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your Reno listings | 775Directory" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountPage,
});
function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const [account, setAccount] = useState<PilotAccount | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) {
      setAccount(null);
      return;
    }
    setAccount(null);
    let active = true;
    setError("");
    void pilotCommand({ data: { action: "account" } })
      .then((result) => {
        if (active) {
          if (result.ok) setAccount(result.receipt);
          else setError("Your account could not be loaded. Please retry or sign in again.");
        }
      })
      .catch(() => {
        if (active) setError("Connection interrupted. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);
  if (!isPending && !user) return <RedirectToSignIn />;
  return (
    <SiteShell wash>
      <section className="app-page px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Your account</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Your place in Reno.</h1>
        <p className="mt-3 text-muted">
          Manage approved listing access and follow your claim reviews.
        </p>
        {error ? (
          <div role="alert" className="mt-6 rounded-2xl border border-line bg-card p-5">
            <p>{error}</p>
            <button className="action-secondary mt-3" onClick={() => setAttempt((x) => x + 1)}>
              Retry account
            </button>
          </div>
        ) : !account ? (
          <p role="status" className="mt-6">
            Loading your account…
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="action-primary" to="/claim" search={{ q: "", city: "reno" }}>
                Find your business
              </Link>
              {account.canReview ? (
                <Link className="action-secondary" to="/review">
                  Open review queue
                </Link>
              ) : null}
            </div>
            <h2 className="mt-10 font-display text-2xl font-semibold">Your listings</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {account.listings.length ? (
                account.listings.map((listing) => (
                  <Link
                    key={listing.id}
                    to="/studio/$slug"
                    params={{ slug: listing.slug }}
                    className="rounded-2xl border border-line bg-card p-5 hover:border-gold"
                  >
                    <h3 className="font-semibold">{listing.name}</h3>
                    <p className="mt-1 text-sm capitalize text-muted">
                      {listing.role.replaceAll("_", " ")}
                    </p>
                    <p className="mt-4 text-sm font-semibold text-teal">Open listing studio →</p>
                  </Link>
                ))
              ) : (
                <p className="rounded-2xl border border-line bg-card p-5 text-muted">
                  No active listing access yet. An approved claim establishes owner access.
                </p>
              )}
            </div>
            <h2 className="mt-10 font-display text-2xl font-semibold">Claim reviews</h2>
            <div className="mt-4 grid gap-3">
              {account.claims.length ? (
                account.claims.map((claim) => (
                  <article key={claim.id} className="rounded-2xl border border-line bg-card p-5">
                    <Link
                      to="/biz/$slug"
                      params={{ slug: claim.slug }}
                      className="font-semibold text-teal"
                    >
                      {claim.name}
                    </Link>
                    <p className="mt-2 text-sm capitalize">{claim.status.replaceAll("_", " ")}</p>
                    {claim.reason ? (
                      <p className="mt-2 text-sm text-muted">{claim.reason}</p>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-muted">You have no claim reviews.</p>
              )}
            </div>
          </>
        )}
      </section>
    </SiteShell>
  );
}
