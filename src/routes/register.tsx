import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getResident, listCategories, listCities, saveResident } from "@/lib/directory/queries";

export const Route = createFileRoute("/register")({
  loader: async () => {
    const [cities, categories] = await Promise.all([listCities(), listCategories()]);
    return { cities, categories };
  },
  component: RegisterPage,
});

function RegisterPage() {
  const { cities, categories } = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [pref, setPref] = useState({ displayName: "", zip: "", citySlug: "reno" });

  useEffect(() => {
    if (!user) return;
    void getResident().then((r) => {
      if (!r) return;
      setPref({
        displayName: r.displayName,
        zip: r.zip,
        citySlug: r.citySlug,
      });
      setInterests(r.interests ? r.interests.split(",").filter(Boolean) : []);
    });
  }, [user]);

  if (isPending) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-lg px-4 py-16">
          <div className="h-10 w-56 animate-pulse rounded bg-paper-2" />
        </div>
      </SiteShell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      await saveResident({
        data: {
          ...pref,
          interests: interests.join(","),
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-lg px-4 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Local mail</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Register your household. Name, ZIP, and town stay private — used only to target mail you
          opted into. We never publish a resident’s phone or email on a listing.
        </p>
        <form onSubmit={onSubmit} className="mt-8 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              value={pref.displayName}
              onChange={(e) => setPref((p) => ({ ...p, displayName: e.target.value }))}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="zip">ZIP</Label>
            <Input
              id="zip"
              value={pref.zip}
              onChange={(e) => setPref((p) => ({ ...p, zip: e.target.value }))}
              required
              inputMode="numeric"
              placeholder="89502"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="city">Town</Label>
            <select
              id="city"
              value={pref.citySlug}
              onChange={(e) => setPref((p) => ({ ...p, citySlug: e.target.value }))}
              className="h-11 rounded-[12px] border border-line bg-card px-3 text-sm"
            >
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-ink-soft">Interests</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = interests.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() =>
                      setInterests((cur) =>
                        on ? cur.filter((x) => x !== c.slug) : [...cur, c.slug],
                      )
                    }
                    className={
                      on
                        ? "rounded-full bg-sage px-3 py-1.5 text-xs font-medium text-paper"
                        : "rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium"
                    }
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {saved ? <p className="text-sm text-sage">You’re on the list for the 775.</p> : null}
          <Button type="submit">Save registration</Button>
        </form>
      </section>
    </SiteShell>
  );
}
