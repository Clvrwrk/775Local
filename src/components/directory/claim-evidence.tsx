import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { claimWorkflow, type ClaimReceipt } from "@/lib/directory/claims";
import { retryIdentity } from "@/lib/directory/retry-key.mjs";

export function ClaimEvidenceForm({
  claim,
  onUpdated,
}: {
  claim: ClaimReceipt;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  if (!claim.claim_id || !["submitted", "needs_evidence"].includes(claim.status)) return null;
  const expired =
    !claim.challenge_expires_at || Date.parse(claim.challenge_expires_at) <= Date.now();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const input = {
      action: "evidence",
      claimId: claim.claim_id,
      challenge: claim.challenge,
      reference: String(form.get("reference")),
      explanation: String(form.get("explanation")),
    };
    pending.current = retryIdentity(
      pending.current,
      input,
      () => `evidence-${crypto.randomUUID()}`,
    );
    await command({ ...input, key: pending.current.key });
  }
  async function command(input: Record<string, unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await claimWorkflow({ data: input });
      if (result.ok) {
        setMessage(
          input.action === "withdraw"
            ? "Claim withdrawn."
            : "Saved. Your listing remains read-only until independent review.",
        );
        onUpdated();
      } else
        setMessage(
          result.code === "challenge_expired_or_replayed"
            ? "This evidence step expired or was already used. Refresh your claim status before retrying."
            : result.code === "authentication_required"
              ? "Your session expired. Sign in again and return to this listing."
              : "This step was not accepted. Refresh the status and retry.",
        );
    } catch {
      setMessage("Connection interrupted. Retry the same evidence to confirm it was saved.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 border-t border-line pt-5">
      <h4 className="font-semibold">
        Evidence for your {claim.requested_role === "listing_manager" ? "manager" : "owner"} claim
      </h4>
      <p className="mt-2 text-sm leading-6 text-muted">
        Give the reviewer a business registry reference, license reference or an independently
        verifiable authorization contact. Explain your connection to this exact Reno location and
        the authority you request. An email-domain match or payment cannot establish ownership.
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">
        Keep residential addresses, account numbers, identity documents and passwords out of this
        form. File uploads await the private scanner and retention service.
      </p>
      {claim.evidence?.length ? (
        <p className="mt-3 text-sm">
          {claim.evidence.length} evidence reference(s) saved for private review.
        </p>
      ) : null}
      {expired ? (
        <button
          type="button"
          disabled={busy}
          className="action-secondary mt-4"
          onClick={() => void command({ action: "challenge", claimId: claim.claim_id })}
        >
          Renew evidence step
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <label className="grid gap-2 text-sm font-medium">
            Evidence reference
            <Input
              name="reference"
              required
              minLength={10}
              maxLength={2000}
              placeholder="Registry or license reference; authorization contact"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Your role and this location
            <Textarea name="explanation" required minLength={20} maxLength={4000} />
          </label>
          <button className="action-primary justify-self-start" disabled={busy}>
            {busy ? "Saving…" : "Send evidence for review"}
          </button>
        </form>
      )}
      <button
        type="button"
        className="mt-4 min-h-11 text-sm font-semibold text-teal"
        disabled={busy}
        onClick={() => void command({ action: "withdraw", claimId: claim.claim_id })}
      >
        Withdraw this claim
      </button>
      {message ? (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
