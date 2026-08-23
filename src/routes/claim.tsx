import { createFileRoute, Link } from "@tanstack/react-router";
import { BusinessCardView } from "@/components/directory/business-card";
import { ClaimListingPanel } from "@/components/directory/claim-listing";
import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCities, searchBusinesses } from "@/lib/directory/queries";
import { useNavigate } from "@tanstack/react-router";

type Search = { q: string; city: string };

export const Route = createFileRoute("/claim")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : "",
    city: typeof s.city === "string" ? s.city : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [cities, results] = await Promise.all([
      listCities(),
      searchBusinesses({
        data: { q: deps.q, city: deps.city, unclaimed: true },
      }),
    ]);
    return { cities, results };
  },
  component: ClaimPage,
});

function ClaimPage() {
  const { q, city } = Route.useSearch();
  const { cities, results } = Route.useLoaderData();
  const navigate = useNavigate();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    void navigate({
      to: "/claim",
      search: {
        q: String(fd.get("q") ?? "").trim(),
        city: String(fd.get("city") ?? ""),
      },
    });
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage">For owners</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
          Claim your listing
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ink-soft">
          We’re seeding the 775 with public shop pages. If that’s you, find the listing, confirm
          the last four of the listed phone, and take it over — leads and campaigns then belong to
          you.
        </p>
        <form onSubmit={onSubmit} className="mt-8 grid gap-2 sm:grid-cols-[1fr_11rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Shop name or service" />
          <select
            name="city"
            defaultValue={city}
            aria-label="Town"
            className="h-11 rounded-[12px] border border-line bg-card px-3 text-sm"
          >
            <option value="">All of the 775</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <Button type="submit">Find listings</Button>
        </form>
        <p className="mt-3 text-sm text-muted">
          Not in the directory yet?{" "}
          <Link to="/list-your-business" className="text-sage hover:underline">
            Create a new listing
          </Link>
          .
        </p>
        <div className="mt-8 grid gap-6">
          {results.length === 0 ? (
            <p className="rounded-[24px] border border-line bg-card p-6 text-sm text-ink-soft">
              No unclaimed shops matched. Try another town, or publish a new listing.
            </p>
          ) : (
            results.map((biz) => (
              <div key={biz.id} className="grid gap-2">
                <BusinessCardView biz={biz} />
                <ClaimListingPanel
                  businessId={biz.id}
                  businessName={biz.name}
                  slug={biz.slug}
                  claimedBy={biz.claimedBy}
                  website={biz.website}
                  listingEmail=""
                />
              </div>
            ))
          )}
        </div>
      </section>
    </SiteShell>
  );
}
