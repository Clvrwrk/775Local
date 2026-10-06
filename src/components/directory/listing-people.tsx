import { useEffect, useRef, useState } from "react";
import { claimWorkflow, type ListingPeople } from "@/lib/directory/claims";
import { Input } from "@/components/ui/input";

export function ListingPeoplePanel({ listingId }: { listingId: string }) {
  const [people, setPeople] = useState<ListingPeople | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const pending = useRef<{ fingerprint: string; token: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    setPeople(null);
    setError("");
    void claimWorkflow({ data: { action: "people", listingId } })
      .then((result) => {
        if (active) {
          if (result.ok) setPeople(result.receipt);
          else
            setError(
              "Participant management requires a recent owner or authorized operator sign-in.",
            );
        }
      })
      .catch(() => {
        if (active) setError("Participant details unavailable. Retry.");
      });
    return () => {
      active = false;
    };
  }, [listingId, attempt]);
  async function command(input: Record<string, unknown>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await claimWorkflow({ data: input });
      if (result.ok) {
        setAttempt((x) => x + 1);
        return true;
      }
      setError(
        result.code === "last_owner_protected"
          ? "The last active owner cannot revoke themselves. Ask an operator to review the change."
          : "Change not accepted. Recheck your sign-in, authority, role limits and current conflicts.",
      );
    } catch {
      setError("Connection interrupted. Retry to confirm the same change.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
    return false;
  }
  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const role = String(form.get("role"));
    const fingerprint = JSON.stringify({ listingId, email, role });
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = {
        fingerprint,
        token: `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", ""),
        key: `invite-${crypto.randomUUID()}`,
      };
    const saved = await command({
      action: "invite",
      listingId,
      email,
      role,
      token: pending.current.token,
      key: pending.current.key,
    });
    if (saved) setLink(`${window.location.origin}/invitation?token=${pending.current.token}`);
  }
  return (
    <section className="mt-8 rounded-[24px] border border-line bg-card p-6">
      <h2 className="font-display text-2xl font-semibold">Listing participants</h2>
      <p className="mt-2 text-sm text-muted">
        Owners can delegate listing access. Managers cannot invite or revoke participants. Lead
        delivery requires a separate verified recipient.
      </p>
      {error ? (
        <div role="alert" className="mt-3 text-sm">
          <p>{error}</p>
          <button
            type="button"
            className="action-secondary mt-3"
            onClick={() => setAttempt((x) => x + 1)}
          >
            Reload participants
          </button>
        </div>
      ) : null}
      {people ? (
        <>
          <div className="mt-4 grid gap-3">
            {people.participants.map((person) => (
              <article key={person.id} className="rounded-xl border border-line p-4">
                <p className="font-semibold">{person.name || "Listing participant"}</p>
                <p className="mt-1 text-sm capitalize">
                  {person.role.replaceAll("_", " ")} · {person.status}
                </p>
                {person.status === "active" ? (
                  <form
                    className="mt-3 grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void command({
                        action: "revokeParticipation",
                        participationId: person.id,
                        reason: String(form.get("reason")),
                      });
                    }}
                  >
                    <label className="grid gap-2 text-sm">
                      Reason for revocation
                      <Input name="reason" required minLength={10} maxLength={500} />
                    </label>
                    <button className="action-secondary justify-self-start" disabled={busy}>
                      Revoke access
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
          <form onSubmit={invite} className="mt-6 grid gap-3">
            <h3 className="font-semibold">Create a scoped invitation</h3>
            <label className="grid gap-2 text-sm">
              Recipient email
              <Input name="email" type="email" required maxLength={254} />
            </label>
            <label className="grid gap-2 text-sm">
              Role
              <select name="role" className="h-11 rounded-xl border border-line bg-paper px-3">
                <option value="listing_manager">Listing manager</option>
                <option value="business_owner">Business owner</option>
                <option value="agency_representative">Agency representative</option>
              </select>
            </label>
            <button disabled={busy} className="action-primary justify-self-start">
              Create invitation link
            </button>
          </form>
          {link ? (
            <div role="status" className="mt-4 text-sm">
              <p>
                No email was sent. Share this single-use link only with the named recipient; it
                expires in 48 hours.
              </p>
              <Input
                className="mt-2"
                readOnly
                value={link}
                aria-label="Invitation link"
                onFocus={(event) => event.target.select()}
              />
            </div>
          ) : null}
          <div className="mt-5 grid gap-2">
            {people.invitations
              .filter((x) => !x.accepted && !x.revoked)
              .map((invite) => (
                <article key={invite.id} className="rounded-xl bg-paper p-3 text-sm">
                  <p className="break-all">
                    {invite.email} · {invite.role.replaceAll("_", " ")}
                  </p>
                  <p>Expires {new Date(invite.expires_at).toLocaleString()}</p>
                  <button
                    type="button"
                    className="min-h-11 font-semibold text-teal"
                    disabled={busy}
                    onClick={() =>
                      void command({ action: "revokeInvitation", invitationId: invite.id })
                    }
                  >
                    Revoke invitation
                  </button>
                </article>
              ))}
          </div>
        </>
      ) : !error ? (
        <p role="status" className="mt-4">
          Checking participant permissions…
        </p>
      ) : null}
    </section>
  );
}
