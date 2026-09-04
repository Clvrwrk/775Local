import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleMark } from "@/components/brand/mark";
import { SiteShell } from "@/components/layout/site-shell";
import { safeReturnPath } from "@/lib/auth/policy.mjs";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: safeReturnPath(s.next),
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  head: () => ({
    meta: [{ title: "Sign in | 775Directory" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Login,
});

function Login() {
  const { next, error } = Route.useSearch();
  return (
    <SiteShell wash>
      <section className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="mx-auto flex size-56 items-center justify-center rounded-full border border-gold/70">
          <div>
            <CircleMark className="mx-auto size-10 text-gold" />
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">Join the 775</h1>
          </div>
        </div>
        <p className="mt-6 text-sm text-ink-soft">
          Claim or manage your Reno business listing. Your account access is separate from approval
          to manage a business.
        </p>
        {error ? (
          <p role="alert" className="mt-6 rounded-[16px] border border-line bg-card p-4 text-sm">
            {error === "not_configured"
              ? "Sign-in is not configured in this environment yet."
              : "Sign-in could not be completed. Please try again."}
          </p>
        ) : null}
        <a
          href={`/api/auth/sign-in?returnPathname=${encodeURIComponent(next)}`}
          className="action-primary mt-8 w-full"
        >
          Continue with email or Google
        </a>
        <p className="mt-8 text-sm text-muted">
          Residents do not need an account. Owner and operator access is individually authorized.
        </p>
        <p className="mt-4 text-sm">
          <Link to="/" className="text-teal underline-offset-4 hover:underline">
            Back to Explore
          </Link>
        </p>
      </section>
    </SiteShell>
  );
}
