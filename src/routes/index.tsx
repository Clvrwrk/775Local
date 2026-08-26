import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, MapPin } from "lucide-react";
import { BusinessCardView } from "@/components/directory/business-card";
import { OfferTile } from "@/components/directory/offer-card";
import { SearchBox } from "@/components/directory/search-box";
import { SiteShell } from "@/components/layout/site-shell";
import { categoryIcon } from "@/lib/directory/icons";
import { listActiveOffers } from "@/lib/directory/package";
import { featuredBusinesses, listCategories, listCities } from "@/lib/directory/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "775Directory | Find local businesses in Northern Nevada" },
      {
        name: "description",
        content: "Find reviewed local business listings across Reno, Sparks, and Northern Nevada's 775 area code.",
      },
    ],
    links: [{ rel: "canonical", href: "https://775directory.com/" }],
  }),
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

function Home() {
  const { cities, categories, featured, offers } = Route.useLoaderData();

  return (
    <SiteShell wash>
      <section className="app-page px-4 pb-8 pt-5 sm:px-6 sm:pt-8">
        <div className="overflow-hidden rounded-[30px] bg-pine text-paper shadow-[0_24px_70px_rgba(28,26,22,0.16)] md:grid md:min-h-[34rem] md:grid-cols-[1.08fr_0.92fr]">
          <div className="relative z-10 flex flex-col justify-center px-6 py-10 sm:px-10 md:px-12 md:py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Northern Nevada, by locals</p>
            <h1 className="mt-4 max-w-xl font-display text-5xl font-semibold leading-[0.92] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
              Find the local shop worth calling.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-paper/76 sm:text-lg">
              Search practical business details across Reno, Sparks, and the 775. Listings appear only after publication review.
            </p>
            <div className="mt-7 max-w-xl rounded-[22px] bg-paper p-3 text-ink sm:p-4">
              <SearchBox cities={cities} />
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-paper/70">
              <Link to="/categories" className="inline-flex items-center gap-1.5 hover:text-paper">Browse services <ArrowRight className="size-4" /></Link>
              <Link to="/cities" className="inline-flex items-center gap-1.5 hover:text-paper">Choose a town <ArrowRight className="size-4" /></Link>
            </div>
          </div>
          <div className="relative min-h-72 overflow-hidden md:min-h-full">
            <img src="/brand/imagery/mainstreet.jpg" alt="A small Northern Nevada main street beneath the mountains" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-pine/75 via-transparent to-pine/10 md:bg-gradient-to-r md:from-pine/45 md:via-transparent md:to-transparent" />
            <div className="absolute bottom-5 left-5 rounded-full border border-white/25 bg-pine/80 px-3 py-1.5 text-xs font-medium text-paper backdrop-blur-sm md:left-auto md:right-5">
              From the Sierra to the high desert
            </div>
          </div>
        </div>
      </section>

      <section className="app-page px-4 py-10 sm:px-6 sm:py-14" aria-labelledby="services-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Start with the job</p>
            <h2 id="services-heading" className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">What do you need today?</h2>
          </div>
          <Link to="/categories" className="hidden items-center gap-1 text-sm font-semibold text-teal sm:inline-flex">All services <ArrowRight className="size-4" /></Link>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <Link key={category.slug} to="/categories/$slug" params={{ slug: category.slug }} className="group rounded-[22px] border border-line bg-card p-4 shadow-[0_8px_24px_rgba(28,26,22,0.04)] hover:border-sage/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine sm:p-5">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-paper-2 text-teal transition-colors group-hover:bg-sage/25"><Icon className="size-5" strokeWidth={1.75} /></span>
                <h3 className="mt-4 text-base font-semibold leading-tight">{category.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{category.description}</p>
              </Link>
            );
          })}
        </div>
        <Link to="/categories" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal sm:hidden">All services <ArrowRight className="size-4" /></Link>
      </section>

      <section className="bg-paper-2/65 py-12 sm:py-16" aria-labelledby="towns-heading">
        <div className="app-page px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Close to home</p>
              <h2 id="towns-heading" className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Pick your part of the 775.</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-ink-soft">Launch coverage begins with reviewed listings in Reno and Sparks. More Northern Nevada towns will open as their records clear review.</p>
              <Link to="/cities" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal">See town pages <ArrowRight className="size-4" /></Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {cities.slice(0, 2).map((city, index) => (
                <Link key={city.slug} to="/nv/$city" params={{ city: city.slug }} className="group relative min-h-72 overflow-hidden rounded-[26px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine">
                  <img src={index === 0 ? "/brand/imagery/sierra-vista.jpg" : "/brand/imagery/workvan.jpg"} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-paper">
                    <p className="inline-flex items-center gap-1 text-xs text-paper/75"><MapPin className="size-3.5" /> {city.county} County</p>
                    <h3 className="mt-1 font-display text-3xl font-semibold">{city.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-paper/80">{city.blurb}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="app-page px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="listings-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Published directory</p>
            <h2 id="listings-heading" className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Local listings</h2>
          </div>
          <Link to="/search" search={{ q: "", city: "", category: "" }} className="inline-flex items-center gap-1 text-sm font-semibold text-teal">Search all <ArrowRight className="size-4" /></Link>
        </div>
        {featured.length ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.slice(0, 6).map((biz) => <BusinessCardView key={biz.id} biz={biz} variant="photo" />)}
          </div>
        ) : (
          <div className="mt-7 grid gap-5 rounded-[26px] border border-line bg-card p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-sage/20 text-teal"><BadgeCheck className="size-6" strokeWidth={1.75} /></span>
            <div>
              <h3 className="font-display text-2xl font-semibold">Publication review is in progress.</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">We will show directory entries here when their core business details and source evidence pass review. No placeholder businesses are shown.</p>
            </div>
          </div>
        )}
      </section>

      {offers.length ? (
        <section className="app-page px-4 pb-14 sm:px-6" aria-labelledby="offers-heading">
          <div className="flex items-end justify-between gap-3">
            <h2 id="offers-heading" className="font-display text-4xl font-semibold">Current offers</h2>
            <Link to="/offers" className="text-sm font-semibold text-teal">See all</Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">{offers.slice(0, 3).map((offer) => <OfferTile key={offer.businessId} {...offer} />)}</div>
        </section>
      ) : null}
    </SiteShell>
  );
}
