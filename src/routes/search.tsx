import { createFileRoute, Link } from "@tanstack/react-router";
import { BusinessCardView } from "@/components/directory/business-card";
import { SearchBox } from "@/components/directory/search-box";
import { SiteShell } from "@/components/layout/site-shell";
import { listCities, searchBusinesses } from "@/lib/directory/queries";

type Search = { q: string; city: string; category: string; page?: number };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : "",
    city: "reno",
    page: Math.max(1, Math.min(1000, Math.trunc(Number(s.page)) || 1)),
    category: typeof s.category === "string" ? s.category : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [cities, results] = await Promise.all([listCities(), searchBusinesses({ data: deps })]);
    return { cities, results };
  },
  head: () => ({
    meta: [
      { title: "Search local businesses | 775Directory" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://775directory.com/search" }],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, city, category, page = 1 } = Route.useSearch();
  const { cities, results } = Route.useLoaderData();
  const visible = results.slice(0, 24);
  const hasNext = results.length > 24;
  const cityName = cities.find((c) => c.slug === city)?.name;
  const title = [q || category || "Local businesses", cityName ? `in ${cityName}` : "in Reno"]
    .filter(Boolean)
    .join(" ");

  return (
    <SiteShell>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Directory search
        </p>
        <h1 className="mt-2 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.03em] sm:text-6xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {visible.length} listing{visible.length === 1 ? "" : "s"} on page {page} · Reno pilot
        </p>
        <div className="mt-7 max-w-2xl rounded-[22px] border border-line bg-card p-3 shadow-[0_10px_30px_rgba(28,26,22,0.05)]">
          <SearchBox key={`${q}:${city}`} defaultQ={q} />
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.length === 0 ? (
            <p className="rounded-[24px] border border-line bg-card p-8 text-sm leading-6 text-muted sm:col-span-2 lg:col-span-3">
              No published listings matched this search. Try a broader service or browse Reno
              categories. More listings will appear as their details clear review.
            </p>
          ) : (
            visible.map((biz) => <BusinessCardView key={biz.id} biz={biz} />)
          )}
        </div>
        <nav
          aria-label="Search results pages"
          className="mt-8 flex items-center justify-between gap-3"
        >
          {page > 1 ? (
            <Link
              to="/search"
              search={{ q, city: "reno", category, page: page - 1 }}
              className="action-secondary"
            >
              Previous page
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link
              to="/search"
              search={{ q, city: "reno", category, page: page + 1 }}
              className="action-primary"
            >
              Next page
            </Link>
          ) : null}
        </nav>
      </section>
    </SiteShell>
  );
}
