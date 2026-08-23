import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BusinessCardView } from "@/components/directory/business-card";
import { SiteShell } from "@/components/layout/site-shell";
import { getCategory, getCity, searchBusinesses } from "@/lib/directory/queries";

export const Route = createFileRoute("/nv/$city/$category")({
  loader: async ({ params }) => {
    const [city, category, results] = await Promise.all([
      getCity({ data: params.city }),
      getCategory({ data: params.category }),
      searchBusinesses({ data: { city: params.city, category: params.category } }),
    ]);
    if (!city || !category) throw notFound();
    return { city, category, results };
  },
  component: CityCategoryPage,
});

function CityCategoryPage() {
  const { city, category, results } = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-sheet px-4 py-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage">
          {city.name}, Nevada · 775
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {category.name} in {city.name}, NV
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {category.description} Looking in {city.name} ({city.region})? These are the local shops
          on 775 Directory.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/nv/$city" params={{ city: city.slug }} className="text-sage hover:underline">
            All of {city.name}
          </Link>
          <Link
            to="/categories/$slug"
            params={{ slug: category.slug }}
            className="text-sage hover:underline"
          >
            {category.name} statewide
          </Link>
        </div>
        <div className="mt-8 grid gap-3">
          {results.length === 0 ? (
            <div className="rounded-[24px] border border-line bg-card p-8">
              <p className="text-sm text-ink-soft">
                No {category.name.toLowerCase()} listings in {city.name} yet. Try a neighboring
                town or{" "}
                <Link to="/list-your-business" className="text-sage underline">
                  list your shop
                </Link>
                .
              </p>
            </div>
          ) : (
            results.map((biz) => <BusinessCardView key={biz.id} biz={biz} />)
          )}
        </div>
        <div className="mt-10 rounded-[24px] border border-line bg-card p-6">
          <h2 className="font-display text-xl font-semibold">People also ask</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium">Who does {category.name.toLowerCase()} near {city.name}?</dt>
              <dd className="mt-1 text-ink-soft">
                775 Directory lists local {category.name.toLowerCase()} shops in {city.name} and
                nearby 775 towns. Call the listing or send a quote request.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Is this only Reno?</dt>
              <dd className="mt-1 text-ink-soft">
                No. The 775 covers Northern Nevada from the California border to West Wendover on
                the Utah line — including {city.name}.
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </SiteShell>
  );
}
