import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";

type Search = { q: string; city: string };

export const Route = createFileRoute("/claim")({
  validateSearch: (search: Record<string, unknown>): Search => ({ q: typeof search.q === "string" ? search.q : "", city: typeof search.city === "string" ? search.city : "" }),
  head: () => ({ meta: [{ title: "Claim a listing | 775Directory" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ClaimPage,
});

function ClaimPage() {
  return (
    <SiteShell wash>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-sage/20 text-teal"><BadgeCheck className="size-7" strokeWidth={1.75} /></span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-teal">For owners</p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-7xl">Claim review is coming soon.</h1>
          <p className="mt-5 text-base leading-7 text-ink-soft">The Claim workflow is not accepting submissions yet. We are completing identity, evidence, authorization, and change-review checks before opening it.</p>
        </div>
        <div className="mx-auto mt-9 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-line bg-card p-6"><Clock3 className="size-5 text-gold-2" /><h2 className="mt-3 font-display text-2xl font-semibold">What to do now</h2><p className="mt-2 text-sm leading-6 text-ink-soft">Search the public directory for your business and check its published facts. No action is required if the page is not public yet.</p></div>
          <div className="rounded-[24px] border border-line bg-card p-6"><ShieldCheck className="size-5 text-gold-2" /><h2 className="mt-3 font-display text-2xl font-semibold">What Claim will mean</h2><p className="mt-2 text-sm leading-6 text-ink-soft">An approved Claim will establish account authority after evidence review. It will not certify business quality or buy ranking.</p></div>
        </div>
        <div className="mt-8 flex justify-center"><Link to="/search" search={{ q: "", city: "", category: "" }} className="inline-flex min-h-12 items-center rounded-full bg-pine px-6 text-sm font-semibold text-paper hover:bg-teal">Search the directory</Link></div>
      </section>
    </SiteShell>
  );
}
