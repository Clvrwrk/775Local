import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";
export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Neighborhood mail | 775Directory" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: () => (
    <SiteShell>
      <section className="app-sheet px-4 py-16">
        <h1 className="font-display text-4xl font-semibold">Start with a local business.</h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Neighborhood mail is outside the Reno pilot. You can browse businesses and contact them
          without an account.
        </p>
        <Link to="/categories" className="action-primary mt-6">
          Browse Reno services
        </Link>
      </section>
    </SiteShell>
  ),
});
