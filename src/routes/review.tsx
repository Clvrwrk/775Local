import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pilotCommand, type PilotReview } from "@/lib/directory/studio";
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
  const [queue, setQueue] = useState<PilotReview | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user) return;
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
  }, [user, attempt]);
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
                      Approval requires current domain evidence or privately reviewed proof.
                      Submission alone grants no ownership.
                    </p>
                    <p className="mt-3 break-all text-sm">Requester: {claim.claimantEmail}</p>
                    <p className="mt-2 text-sm text-muted">
                      {claim.domainMatches
                        ? "Current business-domain match confirmed. Review the listing identity before deciding."
                        : "Domain evidence is not established. Private proof review must be completed before approval."}
                    </p>
                    <DecisionForm
                      allowApprove={claim.domainMatches}
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
  const key = useRef("");
  async function decide(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const decision = String(form.get("decision"));
    const reason = String(form.get("reason"));
    setBusy(true);
    setError("");
    key.current ||= `review-${crypto.randomUUID()}`;
    try {
      const result =
        kind === "claim"
          ? await decideListingClaim({
              data: { claimId: id, decision, reason, idempotencyKey: key.current },
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
