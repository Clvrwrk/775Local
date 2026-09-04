import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";
import { listCities } from "@/lib/directory/queries";

export const Route = createFileRoute("/cities")({
  loader: () => listCities(),
  head: () => ({
    meta: [
      { title: "Explore Reno | 775Directory" },
      { name: "description", content: "Explore the Reno pilot directory." },
    ],
    links: [{ rel: "canonical", href: "https://775directory.com/cities" }],
  }),
  component: CitiesPage,
});

function CitiesPage() {
  const cities = Route.useLoaderData();
  const regions = [...new Set(cities.map((c) => c.region))];
  return (
    <SiteShell>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Browse by place
        </p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
          Explore Reno
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
          The pilot is focused on Reno. Find a local business by service, or browse all published
          Reno listings.
        </p>
        {regions.map((region) => (
          <div key={region} className="mt-10">
            <h2 className="font-display text-2xl font-semibold">{region}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cities
                .filter((c) => c.region === region)
                .map((c) => (
                  <Link
                    key={c.slug}
                    to="/nv/$city"
                    params={{ city: c.slug }}
                    className="rounded-[24px] border border-line bg-card p-6 shadow-[0_8px_24px_rgba(28,26,22,0.04)] hover:border-sage/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
                  >
                    <p className="font-display text-xl font-semibold">{c.name}</p>
                    <p className="text-xs text-muted">
                      {c.county} County · {c.zip}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{c.blurb}</p>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </section>
    </SiteShell>
  );
}
