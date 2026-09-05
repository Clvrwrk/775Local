import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BusinessCardView } from "@/components/directory/business-card";
import { SiteShell } from "@/components/layout/site-shell";
import { getCategory, getCity, searchBusinesses } from "@/lib/directory/queries";
import { robotsForListingCount } from "@/lib/directory/indexability.mjs";

export const Route = createFileRoute("/nv_/$city/$category")({
  loader: async ({ params }) => {
    const [city, category, results] = await Promise.all([
      getCity({ data: params.city }),
      getCategory({ data: params.category }),
      searchBusinesses({ data: { city: params.city, category: params.category } }),
    ]);
    if (!city || !category || results.length === 0) throw notFound();
    return { city, category, results };
  },
  head: ({ loaderData, params }) => {
    const robots = loaderData
      ? robotsForListingCount("cityCategory", loaderData.results.length)
      : null;
    return {
      meta: loaderData
        ? [
            { title: `${loaderData.category.name} in ${loaderData.city.name}, NV | 775Directory` },
            {
              name: "description",
              content: `Browse reviewed ${loaderData.category.name.toLowerCase()} listings in ${loaderData.city.name}, Nevada.`,
            },
            ...(robots ? [robots] : []),
          ]
        : [],
      links: [
        { rel: "canonical", href: `https://775directory.com/nv/${params.city}/${params.category}` },
      ],
    };
  },
  component: CityCategoryPage,
});

function CityCategoryPage() {
  const { city, category, results } = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          {city.name}, Nevada · 775
        </p>
        <h1 className="mt-2 max-w-4xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.03em] sm:text-6xl">
          {category.name} in {city.name}, NV
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
          {category.description} These entries appear after their core business information passes
          publication review.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            to="/nv/$city"
            params={{ city: city.slug }}
            className="font-medium text-teal hover:underline"
          >
            All of {city.name}
          </Link>
          <Link
            to="/categories/$slug"
            params={{ slug: category.slug }}
            className="font-medium text-teal hover:underline"
          >
            {category.name} statewide
          </Link>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.length === 0 ? (
            <div className="rounded-[24px] border border-line bg-card p-8 sm:col-span-2 lg:col-span-3">
              <p className="text-sm text-ink-soft">
                No {category.name.toLowerCase()} listings in {city.name} yet. Try a neighboring town
                or{" "}
                <Link to="/list-your-business" className="text-sage underline">
                  add your business
                </Link>
                .
              </p>
            </div>
          ) : (
            results.map((biz) => <BusinessCardView key={biz.id} biz={biz} />)
          )}
        </div>
        <p className="mt-10 border-t border-line pt-5 text-xs leading-5 text-muted">
          Listings are informational. Confirm service area, availability, pricing, licensing, and
          insurance directly with the business before spending money.
        </p>
      </section>
    </SiteShell>
  );
}
