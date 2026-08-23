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
  component: CityPage,
});

function CityPage() {
  const { city, categories, results } = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-sheet px-4 py-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage">
          {city.region} · {city.county} County
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
          Local businesses in {city.name}, NV
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">{city.blurb}</p>
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
        <div className="mt-8 grid gap-3">
          {results.length === 0 ? (
            <p className="text-sm text-muted">No listings in this town yet.</p>
          ) : (
            results.map((biz) => <BusinessCardView key={biz.id} biz={biz} />)
          )}
        </div>
      </section>
    </SiteShell>
  );
}
