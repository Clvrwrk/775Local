import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BusinessCardView } from "@/components/directory/business-card";
import { SiteShell } from "@/components/layout/site-shell";
import { getCategory, listCities, searchBusinesses } from "@/lib/directory/queries";
import { robotsForListingCount } from "@/lib/directory/indexability.mjs";

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
  head: ({ loaderData, params }) => {
    const robots = loaderData
      ? robotsForListingCount("category", loaderData.results.length)
      : null;
    return {
      meta: loaderData
        ? [
            { title: `${loaderData.category.name} in Northern Nevada | 775Directory` },
            { name: "description", content: `Browse reviewed ${loaderData.category.name.toLowerCase()} listings in Reno and Sparks.` },
            ...(robots ? [robots] : []),
          ]
        : [],
      links: [{ rel: "canonical", href: `https://775directory.com/categories/${params.slug}` }],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category, cities, results } = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Across current launch coverage</p>
        <h1 className="mt-2 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.03em] sm:text-6xl">
          {category.name} in Reno and Sparks
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">{category.description}</p>
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
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.length ? results.map((biz) => <BusinessCardView key={biz.id} biz={biz} />) : <p className="rounded-[24px] border border-line bg-card p-8 text-sm leading-6 text-muted sm:col-span-2 lg:col-span-3">No reviewed {category.name.toLowerCase()} listings are published yet. Try a town page or check back as more entries clear review.</p>}
        </div>
      </section>
    </SiteShell>
  );
}
