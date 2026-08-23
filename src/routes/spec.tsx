import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";

export const Route = createFileRoute("/spec")({ component: SpecPage });

function SpecPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage">Internal</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
          PRD, sitemap & schema
        </h1>
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">Product</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Hyper-local directory for Northern Nevada (775). Competes with 775buzz as a pure
            finder — not a newspaper — plus registration-based virtual and direct mail.
          </p>
        </section>
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">Sitemap</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>/ — home search</li>
            <li>/search — intent results</li>
            <li>/cities, /nv/:city, /nv/:city/:category — geo × service</li>
            <li>/categories, /categories/:slug</li>
            <li>/biz/:slug — profile + claim + LocalBusiness schema</li>
            <li>/claim — unclaimed listings; domain-match skip or card / storefront / rig photo</li>
            <li>/list-your-business, /register, /account, /login</li>
          </ul>
        </section>
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">Data</h2>
          <p className="mt-2 text-sm text-ink-soft">
            cities, categories, businesses, business_categories, reviews, leads (public quote
            insert), residents (auth), campaigns (auth). Seed covers Reno through West Wendover
            including screen-repair shops for the “cat through the door” query.
          </p>
        </section>
      </article>
    </SiteShell>
  );
}
