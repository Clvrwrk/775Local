import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy | 775Directory" },
      {
        name: "description",
        content: "How 775Directory handles directory, claim, inquiry and account information.",
      },
    ],
    links: [{ rel: "canonical", href: "https://775directory.com/privacy" }],
  }),
  component: PrivacyPage,
});
function PrivacyPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-semibold">Privacy</h1>
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">Public business details</h2>
          <p className="mt-3 leading-7 text-ink-soft">
            Directory pages contain reviewed publication fields. Account details, private ownership
            evidence and resident inquiries are not published in the directory.
          </p>
        </section>
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">Accounts and ownership claims</h2>
          <p className="mt-3 leading-7 text-ink-soft">
            WorkOS handles sign-in using email or Google. We use account information to identify the
            requester, review ownership claims and enforce listing access. Signing in does not
            establish business ownership. Claim decisions and authorized listing changes have
            private audit records.
          </p>
        </section>
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">Requests to businesses</h2>
          <p className="mt-3 leading-7 text-ink-soft">
            Where an inquiry form is available, we collect your name, email, optional phone, Reno
            ZIP code, request and permission to share them with the named business and its
            authorized recipient. We retain a request reference and processing history. Request
            consent does not include marketing consent.
          </p>
          <p className="mt-3 leading-7 text-ink-soft">
            Inquiry forms use Cloudflare Turnstile to check for automated abuse. We also use a keyed
            email digest to limit repeated submissions and detect duplicate requests. A received
            request is saved; it does not by itself confirm delivery or a business response.
          </p>
        </section>
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">Your choices</h2>
          <p className="mt-3 leading-7 text-ink-soft">
            You can browse without creating an account and contact businesses directly using their
            published phone or website. Those businesses handle information you provide through
            their own services.
          </p>
        </section>
      </article>
    </SiteShell>
  );
}
