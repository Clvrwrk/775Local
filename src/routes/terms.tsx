import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Terms</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Listings should be accurate. Owners are responsible for the work they advertise. 775
          Directory is a discovery layer, not a guarantor of trades. Campaign reach figures on
          this demo include modeled neighborhood estimates when few residents have registered.
        </p>
      </article>
    </SiteShell>
  );
}
