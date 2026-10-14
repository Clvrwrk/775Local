import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pilotCommand, type ListingRequestReviewData } from "@/lib/directory/studio";
import { retryIdentity } from "@/lib/directory/retry-key.mjs";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
const checks = [
  ["nap", "I verified the public business name, service area and phone."],
  ["activeBusiness", "I verified this is an active, legitimate business."],
  ["category", "I verified the selected category matches its services."],
  ["reno", "I verified this location serves the Reno pilot."],
  ["rights", "I verified the sources and publication rights."],
  ["privacy", "I removed residential addresses and private contact details."],
  ["duplicates", "I investigated existing locations and confirmed no duplicate."],
] as const;
export function ListingRequestReview({ id, onSaved }: { id: string; onSaved: () => void }) {
  const { user } = useCurrentUserState();
  const identity = useRef(user?.id);
  identity.current = user?.id;
  const [data, setData] = useState<ListingRequestReviewData | null>(null);
  const [decision, setDecision] = useState("rejected");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const lock = useRef(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    setData(null);
    setError("");
    setSaved("");
    pending.current = null;
  }, [user?.id, id]);
  async function load() {
    if (lock.current) return;
    const actor = identity.current;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await pilotCommand({ data: { action: "requestReview", id } });
      if (identity.current !== actor) return;
      if (result.ok) {
        setData(result.receipt);
        setDecision("rejected");
      } else
        setError(
          "Review unavailable. Sign in recently as an Operator with listing-review permission, then retry.",
        );
    } catch {
      if (identity.current === actor) setError("Review could not be loaded. Retry.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !data) return;
    const actor = identity.current;
    const form = new FormData(event.currentTarget);
    const approved = decision === "approved";
    if (approved && (!data.canPublish || data.duplicates.length)) return;
    const checkedAt = approved ? Date.parse(`${String(form.get("checkedAt"))}:00.000Z`) : 0;
    if (approved && !Number.isFinite(checkedAt)) {
      setError("Enter when the sources were checked in UTC.");
      return;
    }
    const command = {
      action: "decideRequest",
      id,
      scope: data.scope,
      decision: {
        outcome: decision,
        reason: String(form.get("reason")).trim(),
        ...(approved
          ? {
              sourceUrls: String(form.get("sources"))
                .split(/\r?\n/)
                .map((x) => x.trim())
                .filter(Boolean),
              sourceCheckedAt: new Date(checkedAt).toISOString(),
              duplicateDecision: "no_duplicate",
              checks: Object.fromEntries(checks.map(([name]) => [name, form.get(name) === "on"])),
              canonical: {
                name: String(form.get("name")),
                citySlug: "reno",
                categorySlug: String(form.get("categorySlug")),
                zip: String(form.get("zip")),
                phone: String(form.get("phone")),
                website: String(form.get("website")),
                description: String(form.get("description")),
              },
            }
          : {}),
      },
    };
    pending.current = retryIdentity(
      pending.current,
      { ...command, actor },
      () => `request-review-${crypto.randomUUID()}`,
    );
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await pilotCommand({ data: { ...command, key: pending.current.key } });
      if (identity.current !== actor) return;
      if (result.ok) {
        setSaved(
          approved
            ? "Listing published. No business authority or lead access was granted."
            : "Request rejected. No listing or authority was created.",
        );
        setData(null);
      } else if (
        ["listing_review_changed", "duplicate_review_required", "request_already_decided"].includes(
          result.code,
        )
      ) {
        setData(null);
        setError(
          "The listing or duplicate investigation changed. Reload current review before deciding.",
        );
      } else
        setError(
          "Decision not accepted. Check the verified details and sources; sign in again if your session is no longer recent.",
        );
    } catch {
      if (identity.current === actor)
        setError("Connection interrupted. Retry the same decision to confirm the receipt.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mt-4 border-t border-line pt-4">
      {saved ? (
        <>
          <p role="status" className="text-sm">
            {saved}
          </p>
          <button type="button" className="action-secondary mt-3" onClick={onSaved}>
            Refresh review queue
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="action-secondary"
            disabled={busy}
            onClick={() => void load()}
          >
            {busy ? "Loading…" : "Review listing request"}
          </button>
          {data ? (
            <form onSubmit={submit} className="mt-4 grid gap-4">
              <p className="text-sm text-muted">
                Verify these details independently. A request is a private candidate; publication
                never establishes ownership.
              </p>
              {!data.canPublish ? (
                <p className="text-sm">
                  Your grant permits review only. Publishing requires separate listing-publication
                  permission.
                </p>
              ) : null}
              {data.duplicates.length ? (
                <div className="rounded-xl border border-line p-4">
                  <p className="font-semibold">Possible existing locations</p>
                  <ul className="mt-2 space-y-2">
                    {data.duplicates.map((x) => (
                      <li key={x.id}>
                        <Link
                          to="/biz/$slug"
                          params={{ slug: x.slug }}
                          className="break-words text-teal underline"
                        >
                          {x.name}
                        </Link>{" "}
                        · {x.zip} · {x.status}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm">
                    Publishing is blocked. Reject a confirmed duplicate with a reason, or leave this
                    request for a human exception investigation.
                  </p>
                </div>
              ) : null}
              <label className="grid gap-2 text-sm">
                Request decision
                <select
                  name="decision"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="h-11 rounded-xl border border-line bg-paper px-3"
                >
                  <option value="rejected">Reject request</option>
                  <option
                    value="approved"
                    disabled={!data.canPublish || data.duplicates.length > 0}
                  >
                    Publish reviewed listing
                  </option>
                </select>
              </label>
              {decision === "approved" ? (
                <>
                  <label className="grid gap-2 text-sm">
                    Reviewed business name
                    <Input
                      name="name"
                      required
                      minLength={2}
                      maxLength={200}
                      defaultValue={data.payload.name}
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Reviewed category
                    <select
                      name="categorySlug"
                      required
                      defaultValue={data.payload.categorySlug}
                      className="h-11 rounded-xl border border-line bg-paper px-3"
                    >
                      {data.categories.map((x) => (
                        <option key={x.slug} value={x.slug}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    Reviewed Reno ZIP
                    <Input
                      name="zip"
                      required
                      pattern="895[0-9]{2}"
                      maxLength={5}
                      inputMode="numeric"
                      defaultValue={data.payload.zip}
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Reviewed public phone
                    <Input name="phone" type="tel" required defaultValue={data.payload.phone} />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Reviewed website (HTTPS)
                    <Input name="website" type="url" defaultValue={data.payload.website} />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Reviewed description
                    <Textarea
                      name="description"
                      required
                      minLength={10}
                      maxLength={5000}
                      defaultValue={data.payload.description}
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Verified source URLs (one per line, up to five)
                    <Textarea
                      name="sources"
                      required
                      maxLength={10000}
                      placeholder="https://business.example"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Sources checked (UTC)
                    <Input
                      name="checkedAt"
                      type="datetime-local"
                      required
                      max={new Date().toISOString().slice(0, 16)}
                      min={new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 16)}
                    />
                  </label>
                  <fieldset className="grid gap-3">
                    <legend className="mb-3 font-semibold">Independent publication checks</legend>
                    {checks.map(([name, label]) => (
                      <label key={name} className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          name={name}
                          required
                          className="mt-1 h-5 w-5 shrink-0"
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                </>
              ) : null}
              <label className="grid gap-2 text-sm">
                Decision reason (shared with requester)
                <Textarea name="reason" required minLength={10} maxLength={500} />
              </label>
              <button className="action-primary justify-self-start" disabled={busy}>
                {busy ? "Saving…" : "Save request decision"}
              </button>
            </form>
          ) : null}
        </>
      )}
      {error ? (
        <div role="alert" className="mt-3 text-sm">
          <p>{error}</p>
          <Link
            to="/login"
            search={{ next: "/review", error: undefined }}
            className="mt-2 inline-flex min-h-11 items-center text-teal underline"
          >
            Sign in again for review
          </Link>
        </div>
      ) : null}
    </section>
  );
}
