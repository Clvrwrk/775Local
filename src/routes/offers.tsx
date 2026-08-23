import { createFileRoute } from "@tanstack/react-router";
import { OfferTile } from "@/components/directory/offer-card";
import { SiteShell } from "@/components/layout/site-shell";
import { listActiveOffers } from "@/lib/directory/package";

export const Route = createFileRoute("/offers")({
  loader: async () => ({ offers: await listActiveOffers() }),
  component: OffersPage,
});

function OffersPage() {
  const { offers } = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-phone px-4 py-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-2">Coupons</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Offers in the 775</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          One live coupon per shop. Featured listings also ride these into neighborhood mail.
        </p>
        <div className="mt-6 grid gap-2.5">
          {offers.length === 0 ? (
            <p className="text-sm text-muted">No active offers right now.</p>
          ) : (
            offers.map((o) => <OfferTile key={o.businessId} {...o} />)
          )}
        </div>
      </section>
    </SiteShell>
  );
}
