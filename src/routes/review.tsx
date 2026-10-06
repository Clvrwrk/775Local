import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pilotCommand, type PilotReview } from "@/lib/directory/studio";
import { retryIdentity } from "@/lib/directory/retry-key.mjs";
import { ListingRequestReview } from "@/components/directory/listing-request-review";
import { ClaimAuthorityReview } from "@/components/directory/claim-authority-review";
import { decideListingClaim } from "@/lib/directory/claims";
export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review queue | 775Directory" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewPage,
});
function ReviewPage() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const [queue, setQueue] = useState<PilotReview | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) {
      setQueue(null);
      return;
    }
    setQueue(null);
    let active = true;
    setError("");
    void pilotCommand({ data: { action: "review" } })
      .then((result) => {
        if (active) {
          if (result.ok) setQueue(result.receipt);
          else
            setError(
              "Review access requires a recent operator sign-in and the relevant review permission.",
            );
        }
      })
      .catch(() => {
        if (active) setError("Review queue unavailable. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);
  if (!isPending && !user) return <RedirectToSignIn />;
  return (
    <SiteShell wash>
      <section className="app-page px-4 py-10 sm:px-6">
        <Link to="/account" className="text-sm font-semibold text-teal">
          ← Your account
        </Link>
        <h1 className="mt-6 font-display text-4xl font-semibold">Reno review queue</h1>
        <p className="mt-3 text-muted">
          Review the evidence and record a reason for every decision.
        </p>
        {error ? (
          <div role="alert" className="mt-6">
            <p>{error}</p>
            <button className="action-secondary mt-3" onClick={() => setAttempt((x) => x + 1)}>
              Retry queue
            </button>
          </div>
        ) : !queue ? (
          <p role="status" className="mt-6">
            Loading reviews…
          </p>
        ) : (
          <>
            <h2 className="mt-8 font-display text-2xl font-semibold">Ownership claims</h2>
            <div className="mt-4 grid gap-4">
              {queue.claims.length ? (
                queue.claims.map((claim) => (
                  <article key={claim.id} className="rounded-2xl border border-line bg-card p-6">
                    <Link
                      className="font-semibold text-teal"
                      to="/biz/$slug"
                      params={{ slug: claim.slug }}
                    >
                      {claim.name}
                    </Link>
                    <p className="mt-2 text-sm capitalize">
                      {claim.method.replaceAll("_", " ")} · {claim.status.replaceAll("_", " ")}
                    </p>
                    <p className="mt-3 text-sm text-muted">
                      Approval requires independently verified identity, this exact listing and the
                      requested role. Submission alone grants no ownership.
                    </p>
                    <p className="mt-3 break-all text-sm">Requester: {claim.claimantEmail}</p>
                    <p className="mt-2 text-sm text-muted">
                      {claim.domainMatches
                        ? "A matching domain is a contact hint only; it grants no authority."
                        : "Independent authority evidence must be reviewed before approval."}
                    </p>
                    <p className="mt-2 text-sm">
                      Requested role: {claim.requestedRole.replaceAll("_", " ")}
                    </p>
                    <ClaimAuthorityReview
                      claimId={claim.id}
                      onSaved={() => setAttempt((x) => x + 1)}
                    />
                    <DecisionForm
                      allowApprove={claim.readyForApproval}
                      kind="claim"
                      id={claim.id}
                      onSaved={() => setAttempt((x) => x + 1)}
                    />
                  </article>
                ))
              ) : (
                <p className="text-muted">No pending ownership claims.</p>
              )}
            </div>
            <h2 className="mt-8 font-display text-2xl font-semibold">New listing requests</h2>
            <p className="mt-3 text-sm text-muted">
              Check for duplicate locations and verify public business details before publication.
              Publication and business authority remain separate.
            </p>
            <div className="mt-4 grid gap-4">
              {queue.requests?.length ? (
                queue.requests.map((request) => (
                  <article key={request.id} className="rounded-2xl border border-line bg-card p-6">
                    <h3 className="font-semibold">{request.payload.name}</h3>
                    <p className="mt-2 text-sm">{request.payload.description}</p>
                    <p className="mt-2 text-sm">
                      Reno {request.payload.zip} · {request.payload.categorySlug} ·{" "}
                      {request.payload.phone}
                    </p>
                    <p className="mt-2 break-all text-sm">{request.payload.website}</p>
                    <p className="mt-3 text-xs text-muted">
                      Request {request.id} · Publication review pending
                    </p>
                    <ListingRequestReview
                      id={request.id}
                      onSaved={() => setAttempt((x) => x + 1)}
                    />
                  </article>
                ))
              ) : (
                <p className="text-muted">No new listing requests.</p>
              )}
            </div>
            <h2 className="mt-8 font-display text-2xl font-semibold">Business details</h2>
            <div className="mt-4 grid gap-4">
              {queue.proposals.length ? (
                queue.proposals.map((proposal) => (
                  <article key={proposal.id} className="rounded-2xl border border-line bg-card p-6">
                    <h3 className="font-semibold">{proposal.name}</h3>
                    <dl className="mt-4 grid gap-3 text-sm">
                      <div>
                        <dt className="text-muted">Proposed name</dt>
                        <dd>{proposal.payload.name}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Description</dt>
                        <dd className="whitespace-pre-wrap">{proposal.payload.description}</dd>
                      </div>
                      {proposal.payload.services ? (
                        <div>
                          <dt className="text-muted">Services</dt>
                          <dd>{proposal.payload.services.join(", ") || "None"}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-muted">Phone</dt>
                        <dd>{proposal.payload.phone}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Website</dt>
                        <dd className="break-all">{proposal.payload.website || "None"}</dd>
                      </div>
                    </dl>
                    <DecisionForm
                      kind="proposal"
                      id={proposal.id}
                      onSaved={() => setAttempt((x) => x + 1)}
                    />
                  </article>
                ))
              ) : (
                <p className="text-muted">No pending listing edits.</p>
              )}
            </div>
          </>
        )}
      </section>
    </SiteShell>
  );
}
function DecisionForm({
  allowApprove = true,
  kind,
  id,
  onSaved,
}: {
  allowApprove?: boolean;
  kind: "claim" | "proposal";
  id: string;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  async function decide(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    const form = new FormData(event.currentTarget);
    const decision = String(form.get("decision"));
    const reason = String(form.get("reason")).trim();
    setBusy(true);
    setError("");
    pending.current = retryIdentity(
      pending.current,
      { kind, id, decision, reason },
      () => `review-${crypto.randomUUID()}`,
    );
    try {
      const result =
        kind === "claim"
          ? await decideListingClaim({
              data: { claimId: id, decision, reason, idempotencyKey: pending.current.key },
            })
          : await pilotCommand({ data: { action: "decide", id, decision, reason } });
      if (result.ok) onSaved();
      else
        setError(
          "Decision was not accepted. Check current evidence, review permission and listing changes before retrying.",
        );
    } catch {
      setError("Connection interrupted. Retry to confirm this decision.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={decide} className="mt-5 grid gap-3">
      <label className="grid gap-2 text-sm font-medium">
        Decision
        <select name="decision" className="h-11 rounded-xl border border-line bg-paper px-3">
          <option value="rejected">Reject</option>
          <option value="approved" disabled={!allowApprove}>
            Approve
          </option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Evidence and decision reason
        <Textarea name="reason" required minLength={3} maxLength={500} />
      </label>
      <button disabled={busy} className="action-primary justify-self-start">
        {busy ? "Recording…" : "Record decision"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
