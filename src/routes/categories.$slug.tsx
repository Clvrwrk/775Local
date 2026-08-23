import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BusinessCardView } from "@/components/directory/business-card";
import { SiteShell } from "@/components/layout/site-shell";
import { getCategory, listCities, searchBusinesses } from "@/lib/directory/queries";

export const Route = createFileRoute("/categories/$slug")({
  loader: async ({ params }) => {
    const [category, cities, results] = await Promise.all([
      getCategory({ data: params.slug }),
      listCities(),
      searchBusinesses({ data: { category: params.slug } }),
    ]);
    if (!category) throw notFound();
    return { category, cities, results };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category, cities, results } = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-sheet px-4 py-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage">Across the 775</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
          {category.name} in Northern Nevada
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">{category.description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {cities.slice(0, 8).map((c) => (
            <Link
              key={c.slug}
              to="/nv/$city/$category"
              params={{ city: c.slug, category: category.slug }}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium hover:border-sage/40"
            >
              {c.name}
            </Link>
          ))}
        </div>
        <div className="mt-8 grid gap-3">
          {results.map((biz) => (
            <BusinessCardView key={biz.id} biz={biz} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
