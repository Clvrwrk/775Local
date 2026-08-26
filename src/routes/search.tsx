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
  head: () => ({ meta: [{ title: "Search local businesses | 775Directory" }, { name: "robots", content: "noindex, follow" }], links: [{ rel: "canonical", href: "https://775directory.com/search" }] }),
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
      <section className="app-page px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Directory search</p>
        <h1 className="mt-2 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.03em] sm:text-6xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {results.length} reviewed listing{results.length === 1 ? "" : "s"} in current launch coverage
        </p>
        <div className="mt-7 max-w-2xl rounded-[22px] border border-line bg-card p-3 shadow-[0_10px_30px_rgba(28,26,22,0.05)]">
          <SearchBox cities={cities} defaultQ={q} defaultCity={city} />
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.length === 0 ? (
            <p className="rounded-[24px] border border-line bg-card p-8 text-sm leading-6 text-muted sm:col-span-2 lg:col-span-3">
              No reviewed listings matched this search. Try a nearby town or a broader service, or check back as more entries clear publication review.
            </p>
          ) : (
            results.map((biz) => <BusinessCardView key={biz.id} biz={biz} />)
          )}
        </div>
      </section>
    </SiteShell>
  );
}
