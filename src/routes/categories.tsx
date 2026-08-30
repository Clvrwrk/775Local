import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";
import { categoryIcon } from "@/lib/directory/icons";
import { listPublishedCategories } from "@/lib/directory/queries";

export const Route = createFileRoute("/categories")({
  loader: () => listPublishedCategories({ data: {} }),
  head: () => ({
    meta: [
      { title: "Local business categories | 775Directory" },
      {
        name: "description",
        content: "Browse local business categories across Reno, Sparks, and Northern Nevada.",
      },
    ],
    links: [{ rel: "canonical", href: "https://775directory.com/categories" }],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const categories = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-page px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Browse by job</p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
          Services
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
          Start with what needs doing. Category pages show only listings that have cleared
          publication review.
        </p>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = categoryIcon(cat.icon);
            return (
              <Link
                key={cat.slug}
                to="/categories/$slug"
                params={{ slug: cat.slug }}
                className="rounded-[24px] border border-line bg-card p-6 shadow-[0_8px_24px_rgba(28,26,22,0.04)] hover:border-sage/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-paper-2 text-teal">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <h2 className="mt-3 font-display text-2xl font-semibold">{cat.name}</h2>
                <p className="mt-2 text-sm text-ink-soft">{cat.description}</p>
                <p className="mt-3 text-xs font-semibold text-teal">
                  {cat.listingCount} {cat.listingCount === 1 ? "listing" : "listings"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </SiteShell>
  );
}
