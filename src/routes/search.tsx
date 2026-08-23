import { createFileRoute } from "@tanstack/react-router";
import { BusinessCardView } from "@/components/directory/business-card";
import { SearchBox } from "@/components/directory/search-box";
import { SiteShell } from "@/components/layout/site-shell";
import { listCities, searchBusinesses } from "@/lib/directory/queries";

type Search = { q: string; city: string; category: string };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : "",
    city: typeof s.city === "string" ? s.city : "",
    category: typeof s.category === "string" ? s.category : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [cities, results] = await Promise.all([
      listCities(),
      searchBusinesses({ data: deps }),
    ]);
    return { cities, results };
  },
  component: SearchPage,
});

function SearchPage() {
  const { q, city, category } = Route.useSearch();
  const { cities, results } = Route.useLoaderData();
  const cityName = cities.find((c) => c.slug === city)?.name;
  const title = [q || category || "Local businesses", cityName ? `in ${cityName}` : "in the 775"]
    .filter(Boolean)
    .join(" ");

  return (
    <SiteShell>
      <section className="app-sheet px-4 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {results.length} listing{results.length === 1 ? "" : "s"} · Northern Nevada
        </p>
        <div className="mt-6 max-w-3xl">
          <SearchBox cities={cities} defaultQ={q} defaultCity={city} />
        </div>
        <div className="mt-8 grid gap-3">
          {results.length === 0 ? (
            <p className="rounded-[24px] border border-line bg-card p-8 text-sm text-muted">
              No shops matched that yet. Try a nearby town or a broader service — screen repair,
              HVAC, plumber, or auto.
            </p>
          ) : (
            results.map((biz) => <BusinessCardView key={biz.id} biz={biz} />)
          )}
        </div>
      </section>
    </SiteShell>
  );
}
