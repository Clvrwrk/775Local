import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BusinessCardView } from "@/components/directory/business-card";
import { SiteShell } from "@/components/layout/site-shell";
import { categoryIcon } from "@/lib/directory/icons";
import { getCity, listCategories, searchBusinesses } from "@/lib/directory/queries";

export const Route = createFileRoute("/nv/$city")({
  loader: async ({ params }) => {
    const [city, categories, results] = await Promise.all([
      getCity({ data: params.city }),
      listCategories(),
      searchBusinesses({ data: { city: params.city } }),
    ]);
    if (!city) throw notFound();
    return { city, categories, results };
  },
  head: ({ loaderData, params }) => ({ meta: loaderData ? [{ title: `Local businesses in ${loaderData.city.name}, NV | 775Directory` }, { name: "description", content: `Browse reviewed local business listings in ${loaderData.city.name}, Nevada.` }] : [], links: [{ rel: "canonical", href: `https://775directory.com/nv/${params.city}` }] }),
  component: CityPage,
});

function CityPage() {
  const { city, categories, results } = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          {city.region} · {city.county} County
        </p>
        <h1 className="mt-2 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.03em] sm:text-6xl">
          Local businesses in {city.name}, NV
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">{city.blurb}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const Icon = categoryIcon(cat.icon);
            return (
              <Link
                key={cat.slug}
                to="/nv/$city/$category"
                params={{ city: city.slug, category: cat.slug }}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium hover:border-sage/40"
              >
                <Icon className="size-3.5" />
                {cat.name}
              </Link>
            );
          })}
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.length === 0 ? (
            <p className="rounded-[24px] border border-line bg-card p-8 text-sm leading-6 text-muted sm:col-span-2 lg:col-span-3">No reviewed listings are published in {city.name} yet.</p>
          ) : (
            results.map((biz) => <BusinessCardView key={biz.id} biz={biz} />)
          )}
        </div>
      </section>
    </SiteShell>
  );
}
