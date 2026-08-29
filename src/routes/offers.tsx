import { createFileRoute } from "@tanstack/react-router";
import { OfferTile } from "@/components/directory/offer-card";
import { SiteShell } from "@/components/layout/site-shell";
import { listActiveOffers } from "@/lib/directory/package";

export const Route = createFileRoute("/offers")({
  loader: async () => ({ offers: await listActiveOffers() }),
  head: () => ({ meta: [{ title: "Current local offers | 775Directory" }], links: [{ rel: "canonical", href: "https://775directory.com/offers" }] }),
  component: OffersPage,
});

function OffersPage() {
  const { offers } = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Published offers</p>
        <h1 className="mt-2 font-display text-5xl font-semibold sm:text-6xl">Offers in the 775</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-ink-soft">
          Offers shown here come from reviewed published listing data. Confirm details with the business before purchase.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {offers.length === 0 ? (
            <p className="rounded-[24px] border border-line bg-card p-8 text-sm text-muted md:col-span-3">No reviewed active offers are published right now.</p>
          ) : (
            offers.map((o) => <OfferTile key={o.businessId} {...o} />)
          )}
        </div>
      </section>
    </SiteShell>
  );
}
