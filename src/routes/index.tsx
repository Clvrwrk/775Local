import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Car,
  DoorOpen,
  Mail,
  Search,
  Utensils,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BusinessCardView } from "@/components/directory/business-card";
import { OfferTile } from "@/components/directory/offer-card";
import { SearchBox } from "@/components/directory/search-box";
import { SiteShell } from "@/components/layout/site-shell";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { listingCover } from "@/lib/directory/covers";
import { listActiveOffers } from "@/lib/directory/package";
import {
  featuredBusinesses,
  listCategories,
  listCities,
} from "@/lib/directory/queries";
import type { BusinessCard, City } from "@/lib/directory/types";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [cities, categories, featured, offers] = await Promise.all([
      listCities(),
      listCategories(),
      featuredBusinesses(),
      listActiveOffers(),
    ]);
    return { cities, categories, featured, offers };
  },
  component: Home,
});

const SHORTCUTS = [
  { to: "/search", search: { q: "", city: "", category: "" }, label: "Find", Icon: Search },
  { to: "/categories/$slug", params: { slug: "screen-repair" }, label: "Home", Icon: DoorOpen },
  { to: "/categories/$slug", params: { slug: "restaurants" }, label: "Dine", Icon: Utensils },
  { to: "/categories/$slug", params: { slug: "auto-repair" }, label: "Auto", Icon: Car },
  { to: "/claim", search: { q: "", city: "" }, label: "Claim", Icon: BadgeCheck },
  { to: "/register", label: "Mail", Icon: Mail },
] as const;

function MemberStrip() {
  const user = useCurrentUser();
  return (
    <Link
      to={user ? "/account" : "/register"}
      className="flex items-center justify-between rounded-t-[22px] bg-sage/40 px-5 py-3 text-sm text-ink"
    >
      <span className="font-medium">{user?.displayName || user?.primaryEmail || "Join the 775"}</span>
      <span className="text-ink-soft">{user ? "Your card" : "Local mail"}</span>
    </Link>
  );
}

function Discover({
  cities,
  featured,
}: {
  cities: City[];
  featured: BusinessCard[];
}) {
  const tabs = useMemo(() => [{ slug: "", name: "Discover" }, ...cities.slice(0, 5)], [cities]);
  const [tab, setTab] = useState("");
  const list = tab ? featured.filter((b) => b.citySlug === tab) : featured;
  const city = cities.find((c) => c.slug === tab);

  return (
    <section className="px-4 pb-10 pt-2">
      <div className="flex gap-4 overflow-x-auto pb-3 text-sm">
        {tabs.map((t) => (
          <button
            key={t.slug || "all"}
            type="button"
            onClick={() => setTab(t.slug)}
            className={
              tab === t.slug
                ? "shrink-0 border-b-2 border-gold pb-2 font-medium text-ink"
                : "shrink-0 border-b-2 border-transparent pb-2 text-muted"
            }
          >
            {t.name}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {list.slice(0, 6).map((biz) => (
            <BusinessCardView key={biz.id} biz={biz} variant="photo" />
          ))}
        </div>
      ) : city ? (
        <Link to="/nv/$city" params={{ city: city.slug }} className="mt-3 block overflow-hidden rounded-[20px]">
          <img src={listingCover(city.slug, city.id)} alt="" className="h-40 w-full object-cover" />
          <div className="p-3">
            <p className="font-display text-xl font-semibold">{city.name}</p>
            <p className="mt-1 text-sm text-muted">{city.blurb}</p>
          </div>
        </Link>
      ) : null}
      <Link to="/cities" className="mt-5 inline-block text-sm font-medium text-teal">
        All towns in the 775
      </Link>
    </section>
  );
}

function Home() {
  const { cities, featured, offers } = Route.useLoaderData();
  return (
    <SiteShell wash>
      <div className="app-phone px-4 pt-3">
        <SearchBox cities={cities} />
        <div className="mt-5 grid grid-cols-6 gap-1">
          {SHORTCUTS.map((s) => {
            const Icon = s.Icon;
            return (
              <Link
                key={s.label}
                to={s.to}
                params={"params" in s ? s.params : undefined}
                search={"search" in s ? s.search : undefined}
                className="flex flex-col items-center gap-1.5"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-card text-teal shadow-[0_6px_18px_rgba(28,26,22,0.06)]">
                  <Icon className="size-4" strokeWidth={1.7} />
                </span>
                <span className="text-[11px] text-ink-soft">{s.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-5">
          <MemberStrip />
        </div>
      </div>

      <div className="app-phone overflow-hidden rounded-t-[28px] bg-card shadow-[0_-10px_32px_rgba(28,26,22,0.05)]">
        <div className="px-4 pt-4">
          <Link
            to="/nv/$city/$category"
            params={{ city: "reno", category: "screen-repair" }}
            className="relative block overflow-hidden rounded-[20px]"
          >
            <img src="/media/washoe.jpg" alt="" className="h-48 w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-paper">
              <p className="font-display text-2xl font-semibold leading-tight">
                When the cat goes through the screen
              </p>
              <p className="mt-1 text-xs text-paper/85">Who actually shows up — Reno to Wendover.</p>
            </div>
          </Link>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Link to="/categories/$slug" params={{ slug: "restaurants" }} className="relative overflow-hidden rounded-[20px]">
              <img src="/media/shop.jpg" alt="" className="h-36 w-full object-cover" />
              <span className="absolute left-2.5 top-2.5 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-medium">
                Local tables
              </span>
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 p-2.5 text-xs font-medium text-paper">
                Basque, diners, Tuesday specials
              </p>
            </Link>
            <Link to="/register" className="relative overflow-hidden rounded-[20px]">
              <img src="/media/tahoe.jpg" alt="" className="h-36 w-full object-cover" />
              <span className="absolute left-2.5 top-2.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-medium text-ink">
                Member
              </span>
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 p-2.5 text-xs font-medium text-paper">
                Neighborhood mail
              </p>
            </Link>
          </div>
        </div>
        <Discover cities={cities} featured={featured} />
        {offers.length ? (
          <section className="px-4 pb-10">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Offers this month</h2>
              <Link to="/offers" className="text-xs font-medium text-teal">
                All
              </Link>
            </div>
            <div className="mt-3 grid gap-2.5">
              {offers.slice(0, 3).map((o) => (
                <OfferTile key={o.businessId} {...o} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </SiteShell>
  );
}
