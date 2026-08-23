import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";
import { listCities } from "@/lib/directory/queries";

export const Route = createFileRoute("/cities")({
  loader: () => listCities(),
  component: CitiesPage,
});

function CitiesPage() {
  const cities = Route.useLoaderData();
  const regions = [...new Set(cities.map((c) => c.region))];
  return (
    <SiteShell>
      <section className="app-sheet px-4 py-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Towns in the 775</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Every municipality from the Sierra to the Utah border. Pick a town to see local shops.
        </p>
        {regions.map((region) => (
          <div key={region} className="mt-10">
            <h2 className="font-display text-2xl font-semibold">{region}</h2>
            <div className="mt-4 grid gap-3">
              {cities
                .filter((c) => c.region === region)
                .map((c) => (
                  <Link
                    key={c.slug}
                    to="/nv/$city"
                    params={{ city: c.slug }}
                    className="rounded-[24px] border border-line bg-card p-5 hover:border-sage/35"
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
