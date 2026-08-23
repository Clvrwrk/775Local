import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { createListing, listCategories, listCities } from "@/lib/directory/queries";

export const Route = createFileRoute("/list-your-business")({
  loader: async () => {
    const [cities, categories] = await Promise.all([listCities(), listCategories()]);
    return { cities, categories };
  },
  component: ListPage,
});

function ListPage() {
  const { cities, categories } = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError("");
    try {
      const res = await createListing({
        data: {
          name: String(fd.get("name") ?? ""),
          citySlug: String(fd.get("city") ?? ""),
          categorySlug: String(fd.get("category") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          street: String(fd.get("street") ?? ""),
          zip: String(fd.get("zip") ?? ""),
          description: String(fd.get("description") ?? ""),
        },
      });
      await navigate({ to: "/biz/$slug", params: { slug: res.slug } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not list.");
      setSaving(false);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-lg px-4 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">List your business</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Get found for the searches neighbors actually type. No newspaper. A listing.
        </p>
        <div className="mt-6 rounded-[24px] border border-line bg-card p-5">
          <p className="font-medium">Already in the seed?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Most 775 shops will be pre-listed. Claim yours with the last four of the phone on the
            page — don’t create a duplicate.
          </p>
          <Link to="/claim" search={{ q: "", city: "" }} className="mt-3 inline-block text-sm font-medium text-sage hover:underline">
            Claim an existing listing
          </Link>
        </div>
        {isPending ? (
          <div className="mt-8 h-40 animate-pulse rounded-[24px] bg-paper-2" />
        ) : !user ? (
          <p className="mt-8 text-sm text-ink-soft">
            Need a brand-new page?{" "}
            <Link to="/login" search={{ next: "/list-your-business" }} className="text-sage hover:underline">
              Sign in to publish
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Business name</Label>
              <Input id="name" name="name" required placeholder="High Sierra Screens" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="city">Town</Label>
              <select
                id="city"
                name="city"
                required
                className="h-11 rounded-[12px] border border-line bg-card px-3 text-sm"
              >
                {cities.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category">Primary service</Label>
              <select
                id="category"
                name="category"
                required
                className="h-11 rounded-[12px] border border-line bg-card px-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="775-555-0100" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="street">Street</Label>
              <Input id="street" name="street" placeholder="1845 S Virginia St" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" name="zip" placeholder="89502" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">What you do</Label>
              <Textarea id="description" name="description" placeholder="Window and patio screens across the Meadows." />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? "Publishing…" : "Publish listing"}
            </Button>
          </form>
        )}
      </section>
    </SiteShell>
  );
}
