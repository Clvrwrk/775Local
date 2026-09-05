import { Link } from "@tanstack/react-router";
import type { Offer } from "@/lib/directory/types";

export function OfferBanner({ offer, featured }: { offer: Offer; featured?: boolean }) {
  return (
    <aside className="rounded-[16px] bg-gold/20 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal">
        {featured ? "Featured offer" : "Listing offer"}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold leading-tight">{offer.title}</p>
      {offer.details ? <p className="mt-1 text-sm text-ink-soft">{offer.details}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {offer.code ? (
          <span className="rounded-full bg-gold px-3 py-1 font-medium tabular-nums text-ink">
            {offer.code}
          </span>
        ) : null}
        {offer.expiresOn ? (
          <span className="text-xs text-muted">Through {offer.expiresOn.slice(0, 10)}</span>
        ) : null}
      </div>
    </aside>
  );
}

export function OfferTile({
  slug,
  businessName,
  cityName,
  featured,
  title,
  details,
  code,
}: {
  slug: string;
  businessName: string;
  cityName: string;
  featured: boolean;
  title: string;
  details: string;
  code: string;
}) {
  return (
    <Link
      to="/biz/$slug"
      params={{ slug }}
      className="block rounded-[20px] border border-line bg-card p-4 hover:border-gold/50"
    >
      {featured ? (
        <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-ink">
          Featured
        </span>
      ) : (
        <span className="text-[11px] uppercase tracking-wide text-muted">{cityName}</span>
      )}
      <p className="mt-2 font-display text-xl font-semibold leading-tight">{title}</p>
      <p className="mt-1 text-sm text-muted">{businessName}</p>
      {details ? <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{details}</p> : null}
      {code ? <p className="mt-2 text-sm font-medium text-teal">Code {code}</p> : null}
    </Link>
  );
}
