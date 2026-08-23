import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { CircleMark } from "@/components/brand/mark";
import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";

function safeNext(raw: unknown) {
  if (typeof raw !== "string") return "/account";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/account";
  return raw;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s.next) }),
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  return (
    <SiteShell wash>
      <section className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="mx-auto flex size-56 items-center justify-center rounded-full border border-gold/70">
          <div>
            <CircleMark className="mx-auto size-10 text-gold" />
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">
              Join the 775
            </h1>
          </div>
        </div>
        <p className="mt-6 text-sm text-ink-soft">
          Claim a shop, register for neighborhood mail, or keep a punch card in your pocket.
        </p>
        <div className="mt-8 space-y-3">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant={p.providerId === "google" ? "default" : "outline"}
                className="w-full rounded-full"
                onClick={() => signIn(p.providerId, { callbackURL: next })}
              >
                Continue with {p.label}
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
        </div>
        <p className="mt-8 text-sm text-muted">
          Prefer Google or X. Email codes ship on the production auth layer.
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
