import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Map, ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About 775Directory" }, { name: "description", content: "Why 775Directory is building a practical, review-gated Northern Nevada business directory." }], links: [{ rel: "canonical", href: "https://775directory.com/about" }] }),
  component: AboutPage,
});

const principles = [
  { Icon: Map, title: "Built around the 775", body: "Northern Nevada is its own market. The directory starts with Reno and Sparks, then expands as town and business records clear review." },
  { Icon: BadgeCheck, title: "Review before publication", body: "A business appearing in source data is not enough. Core facts need review before an entry reaches the public directory." },
  { Icon: ShieldCheck, title: "Clear commercial labels", body: "Paid placement is labeled Sponsored and kept distinct from ordinary directory results. Payment never proves ownership or quality." },
];

function AboutPage() {
  return (
    <SiteShell wash>
      <article className="app-page px-4 py-10 sm:px-6 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">About the directory</p>
            <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-7xl">Northern Nevada is not an appendix of Las Vegas.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-soft">775Directory is a practical business finder for the geography locals call the 775: the Sierra edge, Reno and Sparks, the high desert, and the communities along I-80.</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">The public site is deliberately narrow at launch. It publishes reviewed business details and straightforward ways to contact a shop. Claim, lead, review, and paid-plan capabilities open only after their own acceptance checks pass.</p>
          </div>
          <div className="relative min-h-[25rem] overflow-hidden rounded-[28px]">
            <img src="/brand/imagery/shopkeeper.jpg" alt="A Northern Nevada shopkeeper at work" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/65 via-transparent to-transparent" />
            <p className="absolute inset-x-0 bottom-0 p-6 font-display text-3xl font-semibold text-paper">A directory for the better half of Nevada.</p>
          </div>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {principles.map(({ Icon, title, body }) => (
            <section key={title} className="rounded-[24px] border border-line bg-card p-6">
              <span className="inline-flex size-11 items-center justify-center rounded-full bg-paper-2 text-teal"><Icon className="size-5" strokeWidth={1.75} /></span>
              <h2 className="mt-4 font-display text-2xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </SiteShell>
  );
}
