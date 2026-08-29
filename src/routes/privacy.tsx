import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "Privacy | 775Directory" }, { name: "description", content: "How 775Directory handles directory, Claim, Lead, and account information." }],
    links: [{ rel: "canonical", href: "https://775directory.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Public directory pages contain only reviewed publication fields. Claim evidence, account
          details, business email addresses, and future Lead information are kept outside the public
          directory. Claim and Lead submissions remain closed until their protected workflows are
          accepted for production. Owner and operator sign-in is handled through WorkOS using email
          or Google when production access is enabled.
        </p>
      </article>
    </SiteShell>
  );
}
