import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { DIRECTORY_PLANS } from "@/lib/directory/pricing.mjs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Directory pricing preview | 775 Directory" },
      {
        name: "description",
        content: "A private preview of future Local775 directory listing plans.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PricingPage,
});

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function PlanPrice({
  monthlyPriceCents,
  annualPriceCents,
  annualFreeMonths,
}: {
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  annualFreeMonths: number;
}) {
  if (monthlyPriceCents === null) {
    return (
      <div className="min-h-28">
        <p className="font-display text-3xl font-semibold tracking-tight">Rate coming soon</p>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Pay monthly, or pay for 10 months in advance and keep the plan for all 12.
        </p>
      </div>
    );
  }

  if (monthlyPriceCents === 0) {
    return (
      <div className="min-h-28">
        <p className="font-display text-5xl font-semibold tracking-tight">$0</p>
        <p className="mt-2 text-sm text-ink-soft">No annual fee</p>
      </div>
    );
  }

  return (
    <div className="min-h-28">
      <div className="flex items-end gap-1.5">
        <p className="font-display text-5xl font-semibold tracking-tight">
          {dollars(monthlyPriceCents)}
        </p>
        <p className="pb-1.5 text-sm text-muted">/ month</p>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        {annualPriceCents === null ? "Annual rate coming soon" : `${dollars(annualPriceCents)} billed yearly`}
      </p>
      {annualFreeMonths ? (
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-2">
          {annualFreeMonths} months free annually
        </p>
      ) : null}
    </div>
  );
}

function PricingPage() {
  return (
    <SiteShell wash>
      <section className="app-page px-4 pb-10 pt-10 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-card px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold-2 shadow-sm">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Future pricing preview
          </div>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
            Put your best local work on the map.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-soft sm:text-lg">
            Start with a useful free listing. Add more story, proof, and response tools when they
            earn their keep for your business.
          </p>
        </div>

        <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-[20px] border border-line bg-card/90 p-4 shadow-[0_10px_30px_rgba(28,26,22,0.05)]">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Nothing is for sale on this preview.</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">
              These future plans do not change today’s listings, Claims, publication review,
              organic rank, or Featured access. Payment will never prove ownership or verification.
            </p>
          </div>
        </div>

        <div className="relative mt-12">
          <div className="absolute left-[12.5%] right-[12.5%] top-4 hidden border-t border-dashed border-sage/60 lg:block" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DIRECTORY_PLANS.map((plan, index) => {
              const premium = plan.id === "premium";
              return (
                <article
                  key={plan.id}
                  className={cn(
                    "relative flex min-h-full flex-col rounded-[26px] border bg-card p-5 shadow-[0_14px_38px_rgba(28,26,22,0.07)]",
                    premium ? "border-gold/70" : "border-line",
                  )}
                >
                  <div className="absolute -top-2 left-1/2 z-10 hidden size-5 -translate-x-1/2 rounded-full border-4 border-paper bg-sage lg:block" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-2">
                      {plan.eyebrow}
                    </p>
                    <span className="font-display text-lg font-semibold text-muted" aria-label={`Plan ${index + 1} of 4`}>
                      {index + 1}/4
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">{plan.name}</h2>
                  <p className="mt-2 min-h-20 text-sm leading-6 text-ink-soft">{plan.summary}</p>
                  <div className="my-5 border-t border-line pt-5">
                    <PlanPrice
                      monthlyPriceCents={plan.monthlyPriceCents}
                      annualPriceCents={plan.annualPriceCents}
                      annualFreeMonths={plan.annualFreeMonths}
                    />
                  </div>
                  <ul className="flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm leading-5 text-ink-soft">
                        <Check className="mt-0.5 size-4 shrink-0 text-sage-2" aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.id === "free" ? (
                    <Link
                      to="/claim"
                      search={{ q: "", city: "" }}
                      className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-pine px-4 text-sm font-semibold text-paper hover:bg-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
                    >
                      Claim a free listing
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-line bg-paper-2 px-4 text-sm font-semibold text-muted"
                    >
                      Not available yet
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          <section className="rounded-[24px] border border-line bg-card p-6">
            <div className="flex items-center gap-2 text-teal">
              <MapPin className="size-5" aria-hidden="true" />
              <h2 className="font-display text-2xl font-semibold text-ink">What paying does</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              A paid plan can add richer presentation, response tools, and clearly disclosed
              sponsored opportunities. Any Sponsored placement remains separate from organic results.
            </p>
          </section>
          <section className="rounded-[24px] border border-line bg-card p-6">
            <div className="flex items-center gap-2 text-teal">
              <ShieldCheck className="size-5" aria-hidden="true" />
              <h2 className="font-display text-2xl font-semibold text-ink">What paying never does</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Payment never grants control of a listing, proves a business claim, purchases a
              positive review, or improves undisclosed organic rank.
            </p>
          </section>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-muted">
          Draft plan names and features are prepared for future review and may change before paid
          plans launch. Premium’s monthly rate is intentionally unset; its annual price will equal
          ten monthly payments.
        </p>
      </section>
    </SiteShell>
  );
}
