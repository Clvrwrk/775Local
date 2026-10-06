import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { sendFeedback } from "@/lib/directory/feedback";
import { retryIdentity } from "@/lib/directory/retry-key.mjs";
import { publicRoadmap } from "@/lib/directory/roadmap.mjs";

export function FeedbackActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <a href="/roadmap?kind=feature#feedback" className="action-primary">
        Request a feature
      </a>
      <a href="/roadmap?kind=bug#feedback" className="action-secondary">
        Report a bug
      </a>
      <a href="/roadmap" className="inline-flex min-h-11 items-center text-teal underline">
        View roadmap
      </a>
    </div>
  );
}

export function RoadmapContent({ kind }: { kind: "feature" | "bug" }) {
  return (
    <>
      <h1 className="font-display text-5xl font-semibold">Help shape 775Directory.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-ink-soft">
        Here is the work we are considering and working on. These are directions, not promised
        release dates. Your request goes to private triage before any public roadmap change.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {publicRoadmap().map((item) => (
          <article key={item.slug} className="rounded-[24px] border border-line bg-card p-6">
            <p className="text-sm font-semibold text-teal">
              {item.status === "in_progress"
                ? "In progress"
                : item.status === "released"
                  ? "Released"
                  : "Planned"}
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold">{item.title}</h2>
            <p className="mt-3 leading-6 text-ink-soft">{item.summary}</p>
          </article>
        ))}
      </div>
      <FeedbackForm initialKind={kind} />
    </>
  );
}

export function FeedbackForm({ initialKind }: { initialKind: "feature" | "bug" }) {
  const { user, isPending } = useCurrentUserState();
  const [kind, setKind] = useState(initialKind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [consent, setConsent] = useState(false);
  const lock = useRef(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const identity = useRef(user?.id);
  identity.current = user?.id;
  const generation = useRef(0);
  const resultFocus = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);
  useEffect(() => {
    generation.current++;
    pending.current = null;
    setTitle("");
    setDetails("");
    setConsent(false);
    setError("");
    setReceipt("");
  }, [user?.id]);
  useEffect(() => {
    if (error || receipt) resultFocus.current?.focus();
  }, [error, receipt]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const actor = identity.current;
    const version = generation.current;
    const company = String(new FormData(event.currentTarget).get("company") ?? "");
    const data = { kind, title: title.trim(), details: details.trim(), consent, company };
    pending.current = retryIdentity(
      pending.current,
      { actor, ...data },
      () => `feedback-${crypto.randomUUID()}`,
    );
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await sendFeedback({ data: { ...data, key: pending.current.key } });
      if (identity.current !== actor || generation.current !== version) return;
      if (result.ok) setReceipt(result.receipt.id);
      else
        setError(
          result.code === "feedback_rate_limited"
            ? "You have reached the submission limit. Wait an hour before trying again; your text is still here."
            : result.code === "verified_identity_required" ||
                result.code === "authentication_required"
              ? "Sign in with a verified account to submit. A full sign-in may clear this draft."
              : "We could not confirm your submission. Check the fields and retry the same request.",
        );
    } catch {
      if (identity.current === actor && generation.current === version)
        setError(
          "Connection interrupted. Retry the same request to confirm it was saved; your text is still here.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      id="feedback"
      className="mt-10 max-w-2xl scroll-mt-6 rounded-[24px] border border-line bg-card p-6"
    >
      <h2 className="font-display text-3xl font-semibold">Send an idea or report a bug</h2>
      <p id="feedback-disclosure" className="mt-3 text-sm leading-6 text-ink-soft">
        We save your text with your account identity for private review. Moderators may prepare a
        sanitized issue for our 775Local team. A submission is not public and does not promise a
        change or reply. Do not include personal contact details, passwords, private files or
        security exploit details.
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        Sign-in helps limit spam. Drafts stay in this page while you retry; leaving or signing in
        may clear them.{" "}
        <Link to="/privacy" className="underline">
          Privacy
        </Link>
      </p>
      {isPending ? (
        <p role="status" className="mt-5">
          Checking sign-in…
        </p>
      ) : !user ? (
        <Link
          to="/login"
          search={{ next: `/roadmap?kind=${kind}#feedback`, error: undefined }}
          className="action-primary mt-5"
        >
          Sign in to send feedback
        </Link>
      ) : receipt ? (
        <>
          <p ref={resultFocus} tabIndex={-1} role="status" className="mt-5">
            Saved for private triage. Reference {receipt}. No public roadmap item or live Linear
            delivery has been created.
          </p>
          <button
            type="button"
            className="action-secondary mt-4"
            onClick={() => {
              setReceipt("");
              setTitle("");
              setDetails("");
              setConsent(false);
              pending.current = null;
            }}
          >
            Send another request
          </button>
        </>
      ) : (
        <form
          className="mt-5 space-y-5"
          onSubmit={submit}
          aria-describedby="feedback-disclosure"
          aria-busy={busy}
        >
          <fieldset disabled={busy} className="space-y-5">
            <legend className="font-semibold">What would you like to send?</legend>
            <div className="flex flex-wrap gap-4">
              {(["feature", "bug"] as const).map((value) => (
                <label key={value} className="inline-flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                  />
                  {value === "feature" ? "Feature request" : "Bug report"}
                </label>
              ))}
            </div>
            <label className="block">
              Short title
              <Input
                className="mt-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={5}
                maxLength={120}
                autoComplete="off"
              />
            </label>
            <label className="block">
              {kind === "bug"
                ? "What happened, and what did you expect?"
                : "What would help, and why?"}
              <Textarea
                className="mt-2"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required
                minLength={20}
                maxLength={3000}
                rows={6}
                autoComplete="off"
              />
            </label>
            <div className="hidden" aria-hidden="true">
              <label>
                Company
                <input name="company" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
              <input
                className="mt-1"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
              />
              I agree to private review of this text and account identity, with sanitized triage for
              the directory team.
            </label>
            <button className="action-primary" type="submit">
              {busy ? "Saving…" : "Submit for private review"}
            </button>
          </fieldset>
          {error ? (
            <p ref={resultFocus} tabIndex={-1} role="alert">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
