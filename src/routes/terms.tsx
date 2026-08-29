import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms | 775Directory" }, { name: "description", content: "Terms for using the 775Directory local business discovery service." }],
    links: [{ rel: "canonical", href: "https://775directory.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Terms</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          775Directory is a local business discovery service, not a guarantor of a business,
          professional license, insurance policy, price, availability, or completed work. Confirm
          those details directly before hiring or purchasing. Listings and material owner changes
          appear only after review; payment never establishes ownership or purchases a favorable
          review or undisclosed organic placement.
        </p>
      </article>
    </SiteShell>
  );
}
