import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { BusinessCardView } from "@/components/directory/business-card";
import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCities, searchBusinesses } from "@/lib/directory/queries";

type Search = { q: string; city: string };

export const Route = createFileRoute("/claim")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search.q === "string" ? search.q : "",
    city: "reno",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [cities, results] = await Promise.all([
      listCities(),
      searchBusinesses({ data: { q: deps.q, city: deps.city, unclaimed: true } }),
    ]);
    return { cities, results };
  },
  head: () => ({
    meta: [
      { title: "Claim a listing | 775Directory" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ClaimPage,
});

function ClaimPage() {
  const { q, city } = Route.useSearch();
  const { cities, results } = Route.useLoaderData();
  const navigate = useNavigate();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void navigate({
      to: "/claim",
      search: {
        q: String(form.get("q") ?? "").trim(),
        city: String(form.get("city") ?? ""),
      },
    });
  }

  return (
    <SiteShell wash>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-sage/20 text-teal">
            <BadgeCheck className="size-7" strokeWidth={1.75} />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-teal">
            For Business Owners
          </p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-7xl">
            Claim your Reno business.
          </h1>
          <p className="mt-5 text-base leading-7 text-ink-soft">
            Find the existing Listing, sign in, and submit evidence. A Claim remains read-only until
            a Local775 Operator approves it; payment and authentication never grant authority.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mx-auto mt-9 grid max-w-3xl gap-2 rounded-[24px] border border-line bg-card p-4 sm:grid-cols-[1fr_11rem_auto]"
        >
          <Input
            aria-label="Business name or service"
            name="q"
            defaultValue={q}
            placeholder="Business name or service"
          />
          <select
            name="city"
            defaultValue={city}
            aria-label="City"
            className="h-11 rounded-[12px] border border-line bg-paper px-3 text-sm"
          >
            {cities.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.name}
              </option>
            ))}
          </select>
          <Button type="submit">Find listing</Button>
        </form>

        <div className="mx-auto mt-4 flex max-w-3xl items-start gap-2 text-xs leading-5 text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />
          Claim Proof stays private and follows a separate retention-controlled review path.
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-6">
          {results.length === 0 ? (
            <div className="rounded-[24px] border border-line bg-card p-6 text-sm text-ink-soft">
              <p>No unclaimed Business Listings matched this search.</p>
              <Link
                to="/list-your-business"
                className="mt-3 inline-block font-semibold text-teal hover:underline"
              >
                Request a new Listing
              </Link>
            </div>
          ) : (
            results.map((business) => (
              <div key={business.sourceId} className="grid gap-2">
                <BusinessCardView biz={business} />
                <Link
                  to="/biz/$slug"
                  params={{ slug: business.slug }}
                  className="action-secondary justify-self-start"
                >
                  View listing and start claim
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </SiteShell>
  );
}
