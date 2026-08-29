import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, FileCheck2, Search, ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";

export const Route = createFileRoute("/list-your-business")({
  head: () => ({ meta: [{ title: "List your business | 775Directory" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ListPage,
});

const steps = [
  { Icon: Search, title: "Search first", body: "Many local businesses will already have a directory record. Checking first prevents duplicates." },
  { Icon: BadgeCheck, title: "Prove the connection", body: "A future Claim request will require evidence tying the requester to the business. Payment will not count as proof." },
  { Icon: FileCheck2, title: "Review the facts", body: "Core contact and service details will be reviewed before publication or a material listing change." },
];

function ListPage() {
  return (
    <SiteShell wash>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">For business owners</p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-7xl">Put your local business on the map.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-soft">The listing and Claim workflow is being prepared for a reviewed launch. Submissions are not open yet, so this page will not accept information it cannot safely process.</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
          {steps.map(({ Icon, title, body }, index) => (
            <section key={title} className="rounded-[24px] border border-line bg-card p-6">
              <div className="flex items-center justify-between"><span className="inline-flex size-11 items-center justify-center rounded-full bg-paper-2 text-teal"><Icon className="size-5" strokeWidth={1.75} /></span><span className="font-display text-xl text-muted">0{index + 1}</span></div>
              <h2 className="mt-5 font-display text-2xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
            </section>
          ))}
        </div>
        <div className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-[22px] border border-gold/40 bg-card p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal" />
          <div><p className="font-semibold">Ownership and paid plans stay separate.</p><p className="mt-1 text-sm leading-6 text-ink-soft">Claim approval will be evidence-based. A free or paid plan will never establish business ownership, purchase a positive review, or change undisclosed organic rank.</p></div>
        </div>
        <div className="mt-8 flex justify-center"><Link to="/search" search={{ q: "", city: "", category: "" }} className="inline-flex min-h-12 items-center rounded-full bg-pine px-6 text-sm font-semibold text-paper hover:bg-teal">Search the current directory</Link></div>
      </section>
    </SiteShell>
  );
}
