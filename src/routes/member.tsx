import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/directory/stars";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { safeReturnPath } from "@/lib/auth/policy.mjs";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { memberHandle } from "@/lib/directory/member-validate.mjs";
import {
  getMyLocalMember,
  saveLocalMember,
  withdrawExperience,
  type MyMember,
} from "@/lib/directory/members";

export const Route = createFileRoute("/member")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: safeReturnPath(search.next, ""),
  }),
  head: () => ({
    meta: [
      { title: "Your Local Member profile | 775Directory" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MemberEditorPage,
});

const errors: Record<string, string> = {
  authentication_required: "Your session expired. Sign in again.",
  handle_taken: "That profile address is already used. Choose another.",
  invalid_member_profile: "Use your name, a town in the 775, and a short public address.",
  connection_interrupted: "Connection interrupted. Retry to confirm your profile.",
  member_command_failed: "Your profile could not be saved.",
  member_command_unavailable: "Local Member profiles are not available yet.",
};

function MemberEditorPage() {
  const { next } = Route.useSearch();
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();
  const [member, setMember] = useState<MyMember | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [town, setTown] = useState("Reno");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (!user) return;
    let active = true;
    void getMyLocalMember()
      .then((result) => {
        if (!active || !result.ok) return;
        setMember(result.member);
        if (result.member.profile) {
          setDisplayName(result.member.profile.displayName);
          setHandle(result.member.profile.handle);
          setTown(result.member.profile.town);
          setBio(result.member.profile.bio);
        }
      })
      .catch(() => {
        if (active) setError(errors.connection_interrupted);
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    try {
      const result = await saveLocalMember({ data: { displayName, handle, town, bio } });
      if (!result.ok) {
        setStatus("idle");
        setError(errors[result.code] ?? errors.member_command_failed);
        return;
      }
      setHandle(result.profile.handle);
      setStatus("saved");
      const refreshed = await getMyLocalMember();
      if (refreshed.ok) setMember(refreshed.member);
      await router.invalidate();
    } catch {
      setStatus("idle");
      setError(errors.connection_interrupted);
    }
  }

  async function removeExperience(listingId: string) {
    setError("");
    const result = await withdrawExperience({ data: { listingId } });
    if (!result.ok) {
      setError("That experience could not be removed from the public page.");
      return;
    }
    const refreshed = await getMyLocalMember();
    if (refreshed.ok) setMember(refreshed.member);
  }

  if (!isPending && !user) return <RedirectToSignIn />;

  return (
    <SiteShell wash>
      <section className="app-page px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Local Member</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Your profile in the 775.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          This is the public page neighbors see when you review a business. It is separate from
          claiming a listing. Your email is never shown.
        </p>
        <form onSubmit={onSubmit} className="mt-8 grid max-w-xl gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Name neighbors will see
            <input
              className="h-11 rounded-xl border border-line bg-paper px-3"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (!member?.profile) setHandle(memberHandle(event.target.value));
              }}
              required
              minLength={2}
              maxLength={40}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Profile address
            <input
              className="h-11 rounded-xl border border-line bg-paper px-3"
              value={handle}
              onChange={(event) => setHandle(memberHandle(event.target.value))}
              required
              minLength={3}
              maxLength={24}
            />
            <span className="font-normal text-muted">775directory.com/member/{handle || "your-name"}</span>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Town in the 775
            <input
              className="h-11 rounded-xl border border-line bg-paper px-3"
              value={town}
              onChange={(event) => setTown(event.target.value)}
              required
              minLength={2}
              maxLength={40}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Short bio
            <textarea
              className="min-h-28 rounded-xl border border-line bg-paper px-3 py-2"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={280}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {status === "saved" ? <p role="status">Your Local Member profile is public.</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Save profile"}
            </Button>
            {member?.profile ? (
              <Link className="action-secondary" to="/member/$handle" params={{ handle: member.profile.handle }}>
                View public page
              </Link>
            ) : null}
            {next ? (
              <a className="action-secondary" href={next}>
                Back to the business
              </a>
            ) : (
              <Link className="action-secondary" to="/account">
                Your account
              </Link>
            )}
          </div>
        </form>
        {member?.experiences.length ? (
          <div className="mt-10 grid max-w-xl gap-3">
            <h2 className="font-display text-2xl font-semibold">Your experiences</h2>
            {member.experiences.map((experience) => (
              <article key={experience.reviewId} className="rounded-2xl border border-line bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <Link to="/biz/$slug" params={{ slug: experience.listingSlug }} className="font-semibold">
                    {experience.listingName}
                  </Link>
                  <Stars rating={experience.rating} />
                </div>
                <p className="mt-2 text-sm leading-6">{experience.body}</p>
                {experience.listingId ? (
                  <button
                    type="button"
                    className="mt-3 text-sm font-semibold text-teal"
                    onClick={() => removeExperience(experience.listingId!)}
                  >
                    Remove from the public page
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}
