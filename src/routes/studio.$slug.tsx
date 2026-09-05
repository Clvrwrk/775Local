import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { studioFeedback } from "@/lib/directory/studio-feedback.mjs";
import { getBusiness } from "@/lib/directory/queries";
import { pilotCommand, type PilotWorkspace } from "@/lib/directory/studio";

export const Route = createFileRoute("/studio/$slug")({
  head: () => ({
    meta: [
      { title: "Listing Studio | 775Directory" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async ({ params }) => {
    const business = await getBusiness({ data: params.slug });
    if (!business) throw notFound();
    return { business };
  },
  component: StudioPage,
});
function StudioPage() {
  const { business } = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const [workspace, setWorkspace] = useState<PilotWorkspace | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    if (!userId) {
      setWorkspace(null);
      return;
    }
    setWorkspace(null);
    let active = true;
    setError("");
    void pilotCommand({ data: { action: "workspace", id: business.sourceId } })
      .then((result) => {
        if (active) {
          if (result.ok) setWorkspace(result.receipt);
          else setError(studioFeedback(result.code));
        }
      })
      .catch(() => {
        if (active) setError("Connection interrupted. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [userId, business.sourceId, attempt]);
  async function propose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      action: "propose",
      baseVersion: workspace?.editable.baseVersion,
      id: business.sourceId,
      name: String(form.get("name")),
      description: String(form.get("description")),
      phone: String(form.get("phone")),
      website: String(form.get("website")),
    };
    const fingerprint = JSON.stringify(data);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, key: `listing-${crypto.randomUUID()}` };
    setSaving(true);
    setMessage("");
    setSaveError("");
    try {
      const result = await pilotCommand({ data: { ...data, key: pending.current.key } });
      if (result.ok) {
        setMessage(
          "Changes saved for review. Your public listing remains unchanged until approval.",
        );
        pending.current = null;
        setAttempt((x) => x + 1);
      } else setSaveError(studioFeedback(result.code));
    } catch {
      setSaveError("Connection interrupted. Retry to confirm your submission.");
    } finally {
      setSaving(false);
    }
  }
  if (!isPending && !user) return <RedirectToSignIn />;
  return (
    <SiteShell wash>
      <section className="app-page px-4 py-10 sm:px-6">
        <Link to="/account" className="text-sm font-semibold text-teal">
          ← Your account
        </Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-teal">
          Listing Studio{workspace ? ` · ${workspace.role.replaceAll("_", " ")}` : ""}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold">{business.name}</h1>
        <Link to="/biz/$slug" params={{ slug: business.slug }} className="action-secondary mt-4">
          View public listing
        </Link>
        {error ? (
          <div role="alert" className="mt-6 rounded-2xl border border-line bg-card p-5">
            <p>{error}</p>
            <button className="action-secondary mt-3" onClick={() => setAttempt((x) => x + 1)}>
              Retry studio
            </button>
          </div>
        ) : !workspace ? (
          <p role="status" className="mt-6">
            Checking listing access…
          </p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            {workspace.canEdit ? (
              <form
                key={workspace.editable.baseVersion}
                onSubmit={propose}
                className="grid gap-4 rounded-[24px] border border-line bg-card p-6"
              >
                <h2 className="font-display text-2xl font-semibold">Update business details</h2>
                <p className="text-sm leading-6 text-muted">
                  Submit accurate details for review. Ownership and contact verification remain
                  separate from this edit.
                </p>
                <label className="grid gap-2 text-sm font-medium">
                  Business name
                  <Input
                    name="name"
                    defaultValue={workspace.editable.name}
                    required
                    minLength={2}
                    maxLength={200}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  About your business
                  <Textarea
                    name="description"
                    defaultValue={workspace.editable.description}
                    required
                    minLength={10}
                    maxLength={5000}
                    className="min-h-48"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Business phone
                  <Input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    defaultValue={workspace.editable.phone}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Website (HTTPS)
                  <Input
                    name="website"
                    type="url"
                    defaultValue={workspace.editable.website}
                    placeholder="https://your-business.com"
                  />
                </label>
                <button className="action-primary justify-self-start" disabled={saving}>
                  {saving ? "Saving…" : "Submit changes for review"}
                </button>
                {saveError ? (
                  <div role="alert" className="text-sm leading-6 text-danger">
                    <p>{saveError}</p>
                    <button
                      type="button"
                      className="action-secondary mt-2"
                      onClick={() => setAttempt((x) => x + 1)}
                    >
                      Reload Studio
                    </button>
                  </div>
                ) : null}
                {message ? (
                  <p role="status" className="text-sm leading-6 text-teal">
                    {message}
                  </p>
                ) : null}
              </form>
            ) : (
              <section className="rounded-[24px] border border-line bg-card p-6">
                <h2 className="font-display text-2xl font-semibold">Recipient access</h2>
                <p className="mt-3 text-muted">
                  Your recipient role does not include editing this listing.
                </p>
              </section>
            )}
            <section>
              <h2 className="font-display text-2xl font-semibold">Recent submissions</h2>
              <div className="mt-4 grid gap-3">
                {workspace.proposals.length ? (
                  workspace.proposals.map((proposal) => (
                    <article
                      key={proposal.id}
                      className="rounded-2xl border border-line bg-card p-5"
                    >
                      <p className="font-semibold capitalize">
                        {proposal.status.replaceAll("_", " ")}
                      </p>
                      <p className="mt-2 text-sm">{proposal.payload.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {proposal.createdAt
                          ? new Date(proposal.createdAt).toLocaleDateString()
                          : ""}
                      </p>
                      {proposal.reason ? (
                        <p className="mt-3 text-sm text-muted">{proposal.reason}</p>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-muted">No listing changes submitted yet.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
