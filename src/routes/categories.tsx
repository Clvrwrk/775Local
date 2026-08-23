import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";
import { categoryIcon } from "@/lib/directory/icons";
import { listCategories } from "@/lib/directory/queries";

export const Route = createFileRoute("/categories")({
  loader: () => listCategories(),
  component: CategoriesPage,
});

function CategoriesPage() {
  const categories = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="app-sheet px-4 py-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Services</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Built for “near me” searches — screen doors, swamp coolers, and the shops that still
          answer the phone.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {categories.map((cat) => {
            const Icon = categoryIcon(cat.icon);
            return (
              <Link
                key={cat.slug}
                to="/categories/$slug"
                params={{ slug: cat.slug }}
                className="rounded-[24px] border border-line bg-card p-6 hover:border-sage/35"
              >
                <Icon className="size-6 text-sage" strokeWidth={1.75} />
                <h2 className="mt-3 font-display text-2xl font-semibold">{cat.name}</h2>
                <p className="mt-2 text-sm text-ink-soft">{cat.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </SiteShell>
  );
}
