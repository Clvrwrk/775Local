import { useRef, useState } from "react";
import { claimWorkflow, type ReviewEvidence } from "@/lib/directory/claims";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export function ClaimAuthorityReview({
  claimId,
  onSaved,
}: {
  claimId: string;
  onSaved: () => void;
}) {
  const [data, setData] = useState<ReviewEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function load() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await claimWorkflow({ data: { action: "reviewEvidence", claimId } });
      if (result.ok) setData(result.receipt);
      else
        setError(
          "Private evidence requires a recent operator sign-in and claim-review permission.",
        );
    } catch {
      setError("Evidence could not be loaded. Retry.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function assess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !data) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await claimWorkflow({
        data: {
          action: "assess",
          claimId,
          evidenceId: String(form.get("evidenceId")),
          identityBasis: String(form.get("identityBasis")),
          authorityBasis: String(form.get("authorityBasis")),
          conflictResolution: String(form.get("conflictResolution")),
          validUntil: new Date(`${String(form.get("validUntil"))}T23:59:59.000Z`).toISOString(),
          scope: data.scope,
        },
      });
      if (result.ok) onSaved();
      else {
        setData(null);
        setError(
          "Assessment was not accepted. Reload current evidence and conflicts, then review again.",
        );
      }
    } catch {
      setError("Connection interrupted. Reload evidence to confirm review status.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        className="action-secondary"
        disabled={busy}
        onClick={() => void load()}
      >
        {busy ? "Loading…" : "Review private evidence"}
      </button>
      {data ? (
        <>
          <p className="mt-3 text-xs text-muted">
            Evidence access is audited. These are claimant statements, requiring independent
            verification. Do not follow untrusted references with privileged credentials.
          </p>
          {data.evidence.map((item) => (
            <article key={item.id} className="mt-3 rounded-xl bg-paper p-4 text-sm">
              <p className="break-words font-semibold">{item.reference}</p>
              <p className="mt-2 whitespace-pre-wrap break-words">{item.explanation}</p>
              <p className="mt-2 text-xs">
                {item.revoked
                  ? "Revoked"
                  : `Expires ${new Date(item.expires_at).toLocaleDateString()}`}
              </p>
            </article>
          ))}
          <details className="mt-3 text-sm">
            <summary>Current listing, role and conflicts</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(data.scope, null, 2)}
            </pre>
          </details>
          {data.evidence.some((x) => !x.revoked && Date.parse(x.expires_at) > Date.now()) ? (
            <form onSubmit={assess} className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-medium">
                Evidence assessed
                <select
                  name="evidenceId"
                  required
                  className="h-11 rounded-xl border border-line bg-paper px-3"
                >
                  {data.evidence
                    .filter((x) => !x.revoked && Date.parse(x.expires_at) > Date.now())
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.reference.slice(0, 70)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Independent identity verification
                <Textarea
                  name="identityBasis"
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="How you independently confirmed the claimant’s identity"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Exact location and role authorization
                <Textarea
                  name="authorityBasis"
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="How this person’s owner or manager authority was verified for this listing"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Conflict resolution
                <Textarea
                  name="conflictResolution"
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="Identify and resolve all current competing claims and participants, or confirm none"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Authority expires (UTC)
                <Input
                  name="validUntil"
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  max={new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" required className="mt-1" />I independently verified
                identity, this exact listing and role authority, and resolved the displayed
                conflicts. Domain match, payment and model scores do not establish authority.
              </label>
              <button className="action-primary justify-self-start" disabled={busy}>
                Record human assessment
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm">No current evidence. Request evidence before approving.</p>
          )}
        </>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
