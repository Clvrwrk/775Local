import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  listCategories,
  listCities,
  myCampaigns,
  myLeads,
  myListings,
  sendCampaign,
} from "@/lib/directory/queries";
import type { BusinessCard, CampaignRow, Category, City, LeadRow } from "@/lib/directory/types";

export const Route = createFileRoute("/account")({
  loader: async () => {
    const [cities, categories] = await Promise.all([listCities(), listCategories()]);
    return { cities, categories };
  },
  component: AccountPage,
});

function AccountPage() {
  const { cities, categories } = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const [listings, setListings] = useState<BusinessCard[] | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [tab, setTab] = useState<"listings" | "leads" | "mail">("listings");

  useEffect(() => {
    if (!user) return;
    void Promise.all([myListings(), myLeads(), myCampaigns()]).then(([a, b, c]) => {
      setListings(a);
      setLeads(b);
      setCampaigns(c);
    });
  }, [user]);

  if (isPending) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="h-10 w-40 animate-pulse rounded bg-paper-2" />
        </div>
      </SiteShell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <SiteShell wash>
      <section className="mx-auto max-w-4xl px-4 pb-12">
        <div className="flex flex-col items-center pt-4 text-center">
          <p className="text-sm text-muted">{user.displayName ?? user.primaryEmail}</p>
          <div className="mt-4 flex size-48 items-center justify-center rounded-full border border-gold">
            <div>
              <p className="font-display text-4xl font-semibold">775</p>
              <p className="mt-1 text-xs text-muted">Local mail · claimed shops</p>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {(
            [
              ["listings", "Listings"],
              ["leads", "Leads"],
              ["mail", "Campaigns"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "h-10 rounded-full bg-gold px-4 text-sm font-medium text-ink"
                  : "h-10 rounded-full border border-line bg-card px-4 text-sm font-medium"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "listings" ? (
          <div className="mt-8 grid gap-3">
            <div className="flex flex-wrap gap-4 text-sm font-medium">
              <Link to="/claim" search={{ q: "", city: "" }} className="text-teal hover:underline">
                Claim a seeded listing
              </Link>
              <Link to="/list-your-business" className="text-teal hover:underline">
                + New listing
              </Link>
            </div>
            {listings === null ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : listings.length === 0 ? (
              <p className="rounded-[24px] border border-line bg-card p-6 text-sm text-ink-soft">
                You don’t own a listing yet. Claim a seeded shop or publish a new one to collect
                quote requests and send neighborhood mail.
              </p>
            ) : (
              listings.map((b) => (
                <Link
                  key={b.id}
                  to="/studio/$slug"
                  params={{ slug: b.slug }}
                  className="rounded-[20px] border border-line bg-card p-4 hover:border-gold/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-sm text-muted">
                        {b.cityName} · {b.primaryCategory}
                      </p>
                    </div>
                    {b.featured ? (
                      <span className="rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-medium text-ink">
                        Featured
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-teal">Photos, offer, Featured →</p>
                </Link>
              ))
            )}
          </div>
        ) : null}

        {tab === "leads" ? (
          <div className="mt-8 grid gap-3">
            {leads.length === 0 ? (
              <p className="text-sm text-muted">No quote requests on your listings yet.</p>
            ) : (
              leads.map((l) => (
                <article key={l.id} className="rounded-[20px] border border-line bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">{l.businessName}</p>
                  <p className="mt-1 font-medium">{l.name}</p>
                  <p className="text-sm text-ink-soft">{l.message}</p>
                  <p className="mt-2 text-xs text-muted">
                    {l.phone} · {l.email} · {l.zip}
                  </p>
                </article>
              ))
            )}
          </div>
        ) : null}

        {tab === "mail" ? (
          <MailTab
            listings={listings ?? []}
            cities={cities}
            categories={categories}
            campaigns={campaigns}
            onSent={(c) => setCampaigns((cur) => [c, ...cur])}
          />
        ) : null}
      </section>
    </SiteShell>
  );
}

function MailTab({
  listings,
  cities,
  categories,
  campaigns,
  onSent,
}: {
  listings: BusinessCard[];
  cities: City[];
  categories: Category[];
  campaigns: CampaignRow[];
  onSent: (c: CampaignRow) => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError("");
    try {
      const businessId = Number(fd.get("businessId"));
      const name = String(fd.get("name") ?? "");
      const channel = String(fd.get("channel") ?? "virtual") as "virtual" | "direct_mail";
      const citySlug = String(fd.get("citySlug") ?? "");
      const categorySlug = String(fd.get("categorySlug") ?? "");
      const message = String(fd.get("message") ?? "");
      const includeOffer = fd.get("includeOffer") === "on";
      const res = await sendCampaign({
        data: { businessId, name, channel, citySlug, categorySlug, message, includeOffer },
      });
      const biz = listings.find((x) => x.id === businessId);
      onSent({
        id: Date.now(),
        name: name || "Neighborhood drop",
        channel,
        citySlug,
        categorySlug,
        message,
        status: "sent",
        reach: res.reach,
        createdAt: new Date().toISOString(),
        businessName: biz?.name ?? "Listing",
        includedOffer: res.includedOffer,
      });
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8">
      <form onSubmit={onSubmit} className="grid gap-4 rounded-[24px] border border-line bg-card p-5">
        <h2 className="font-display text-2xl font-semibold">Send a drop</h2>
        <p className="text-sm text-muted">
          Virtual postcards hit registered neighbors instantly. Direct mail is queued as a
          neighborhood estimate for this demo.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {listings.length === 0 ? (
          <p className="text-sm">List a business first — campaigns send from a listing you own.</p>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="businessId">From listing</Label>
              <select
                id="businessId"
                name="businessId"
                className="h-11 rounded-[12px] border border-line bg-paper px-3 text-sm"
                required
              >
                {listings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Campaign name</Label>
              <Input id="name" name="name" placeholder="Spring screen special" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="channel">Channel</Label>
              <select
                id="channel"
                name="channel"
                className="h-11 rounded-[12px] border border-line bg-paper px-3 text-sm"
              >
                <option value="virtual">Virtual postcard</option>
                <option value="direct_mail">Direct mail (print estimate)</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="citySlug">Town</Label>
              <select
                id="citySlug"
                name="citySlug"
                className="h-11 rounded-[12px] border border-line bg-paper px-3 text-sm"
              >
                <option value="">All registered towns</option>
                {cities.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="categorySlug">Interest</Label>
              <select
                id="categorySlug"
                name="categorySlug"
                className="h-11 rounded-[12px] border border-line bg-paper px-3 text-sm"
              >
                <option value="">All interests</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="message">Card copy</Label>
              <Textarea
                id="message"
                name="message"
                required
                placeholder="Cat vs. patio screen? We’ll recut pet mesh this week. Mention 775 Directory."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="includeOffer" defaultChecked />
              Include Featured offer on the card (Featured listings only)
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? "Sending…" : "Send campaign"}
            </Button>
          </>
        )}
      </form>
      <div>
        <h3 className="font-display text-xl font-semibold">Recent drops</h3>
        <div className="mt-3 grid gap-3">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted">No campaigns yet.</p>
          ) : (
            campaigns.map((c) => (
              <article key={c.id} className="rounded-[20px] border border-line bg-card p-4">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs uppercase tracking-wide text-muted">
                  {c.channel === "direct_mail" ? "Direct mail" : "Virtual"} · reach {c.reach} ·{" "}
                  {c.businessName}
                </p>
                <p className="mt-2 text-sm text-ink-soft">{c.message}</p>
                {c.includedOffer ? (
                  <p className="mt-2 text-xs font-medium text-gold-2">Mail insert · {c.includedOffer}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
