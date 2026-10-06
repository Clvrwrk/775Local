import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createListing } from "@/lib/directory/queries";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pilotCommand, type MyListingRequest } from "@/lib/directory/studio";
import type { Category } from "@/lib/directory/types";
import { retryIdentity } from "@/lib/directory/retry-key.mjs";
export function ListingRequestForm({ categories }: { categories: Category[] }) {
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [requests, setRequests] = useState<MyListingRequest[]>([]);
  const [statusError, setStatusError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const actor = useRef(user?.id);
  actor.current = user?.id;
  useEffect(() => {
    setRequests([]);
    if (!user?.id) return;
    let active = true;
    void pilotCommand({ data: { action: "requests" } })
      .then((result) => {
        if (active) {
          if (result.ok) {
            setRequests(result.receipt);
            setStatusError("");
          } else setStatusError("Request status unavailable. Sign in again or retry.");
        }
      })
      .catch(() => {
        if (active) setStatusError("Request status unavailable. Retry.");
      });
    return () => {
      active = false;
    };
  }, [user?.id, attempt]);
  useEffect(() => {
    setSaved(false);
    setMessage("");
    pending.current = null;
  }, [user?.id]);
  const lock = useRef(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const identity = actor.current;
    const form = new FormData(event.currentTarget);
    const data = {
      action: "request",
      name: String(form.get("name")),
      citySlug: "reno",
      categorySlug: String(form.get("categorySlug")),
      phone: String(form.get("phone")),
      zip: String(form.get("zip")),
      description: String(form.get("description")),
      website: String(form.get("website")),
    };
    pending.current = retryIdentity(
      pending.current,
      { ...data, actor: user?.id },
      () => `request-${crypto.randomUUID()}`,
    );
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await createListing({ data: { ...data, key: pending.current.key } });
      if (actor.current !== identity) return;
      if (result.ok) {
        setSaved(true);
        setMessage(
          `Request ${result.receipt.id} saved for review. It has not been published and creates no listing authority.`,
        );
      } else
        setMessage(
          "Request not accepted. Check your sign-in and Reno business details, then retry.",
        );
    } catch {
      if (actor.current !== identity) return;
      setMessage("Connection interrupted. Retry the same request to confirm it was saved.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto mt-10 max-w-2xl rounded-[24px] border border-line bg-card p-6">
      <h2 className="font-display text-2xl font-semibold">Request a new Reno listing</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Search first to avoid duplicates. Submit business details for review; publication and
        authority remain separate. Do not enter a residential street address.
      </p>
      {requests.length ? (
        <section className="mt-5 border-t border-line pt-4">
          <h3 className="font-semibold">Your listing requests</h3>
          <ul className="mt-3 space-y-3">
            {requests.map((request) => (
              <li key={request.id} className="text-sm">
                <p>
                  {request.name} · {request.status.replaceAll("_", " ")}
                </p>
                {request.reason ? <p className="mt-1 text-muted">{request.reason}</p> : null}
                {request.slug ? (
                  <Link
                    to="/biz/$slug"
                    params={{ slug: request.slug }}
                    className="mt-2 inline-flex min-h-11 items-center text-teal underline"
                  >
                    View published listing
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Publication grants no business authority. Claim the published listing separately.
          </p>
        </section>
      ) : null}
      {statusError ? (
        <div role="alert" className="mt-3 text-sm">
          <p>{statusError}</p>
          <button
            type="button"
            className="action-secondary mt-2"
            onClick={() => setAttempt((x) => x + 1)}
          >
            Retry request status
          </button>
        </div>
      ) : null}
      {saved ? (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      ) : isPending ? (
        <p role="status" className="mt-4">
          Checking sign-in…
        </p>
      ) : !user ? (
        <Link
          to="/login"
          search={{ next: "/list-your-business", error: undefined }}
          className="action-primary mt-4"
        >
          Sign in to request a listing
        </Link>
      ) : (
        <form onSubmit={submit} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm">
            Business name
            <Input name="name" required minLength={2} maxLength={200} />
          </label>
          <label className="grid gap-2 text-sm">
            Category
            <select
              name="categorySlug"
              className="h-11 rounded-xl border border-line bg-paper px-3"
              required
            >
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Reno ZIP
            <Input name="zip" required pattern="895[0-9]{2}" maxLength={5} inputMode="numeric" />
          </label>
          <label className="grid gap-2 text-sm">
            Public business phone
            <Input name="phone" type="tel" required />
          </label>
          <label className="grid gap-2 text-sm">
            Website (HTTPS)
            <Input name="website" type="url" />
          </label>
          <label className="grid gap-2 text-sm">
            What your business does
            <Textarea name="description" required minLength={10} maxLength={5000} />
          </label>
          <button className="action-primary justify-self-start" disabled={busy}>
            {busy ? "Saving…" : "Submit listing request"}
          </button>
          {message ? (
            <p role="alert" className="text-sm">
              {message}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
