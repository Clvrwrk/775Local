import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { ClaimListingPanel } from "@/components/directory/claim-listing";
import { PhotoGallery } from "@/components/directory/gallery";
import { OfferBanner } from "@/components/directory/offer-card";
import { SiteShell } from "@/components/layout/site-shell";
import { Stars } from "@/components/directory/stars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { listingCover } from "@/lib/directory/covers";
import { getBusiness, submitLead } from "@/lib/directory/queries";
import { formatPhone } from "@/lib/utils";

export const Route = createFileRoute("/biz/$slug")({
  loader: async ({ params }) => {
    const biz = await getBusiness({ data: params.slug });
    if (!biz) throw notFound();
    return { biz };
  },
  component: BusinessPage,
});

function BusinessPage() {
  const { biz } = Route.useLoaderData();
  const user = useCurrentUser();
  const isOwner = Boolean(user && biz.claimedBy === user.id);
  const showStreet = !biz.hideStreet;
  const showEmail = Boolean(biz.publicEmail) || isOwner;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: biz.name,
    description: biz.description,
    telephone: biz.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: biz.street,
      addressLocality: biz.cityName,
      addressRegion: "NV",
      postalCode: biz.zip,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: biz.rating,
      reviewCount: biz.reviewCount,
    },
  };

  return (
    <SiteShell wash>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="app-sheet px-4 pb-12 pt-4">
        <PhotoGallery
          photos={
            biz.photos.length
              ? biz.photos
              : [{ id: 0, url: biz.coverUrl || listingCover(biz.citySlug, biz.id), caption: "", sortOrder: 0 }]
          }
          name={biz.name}
        />
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-teal">
          {biz.primaryCategory} · {biz.cityName}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">{biz.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">{biz.tagline}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Stars rating={biz.rating} />
          <span className="tabular-nums text-muted">
            {Number(biz.rating).toFixed(1)} ({biz.reviewCount})
          </span>
          {biz.featured ? (
            <span className="rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-medium text-ink">Featured</span>
          ) : biz.claimedBy ? (
            <span className="rounded-full bg-sage/20 px-2.5 py-0.5 text-[11px] font-medium text-teal">Claimed</span>
          ) : (
            <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted">Unclaimed</span>
          )}
          {isOwner ? (
            <Link to="/studio/$slug" params={{ slug: biz.slug }} className="text-xs font-medium text-teal">
              Studio
            </Link>
          ) : null}
        </div>
        {biz.offer ? (
          <div className="mt-4">
            <OfferBanner offer={biz.offer} featured={biz.featured} />
          </div>
        ) : null}
        <p className="mt-5 text-sm leading-relaxed text-ink-soft">{biz.description}</p>
        <dl className="mt-6 grid gap-2 text-sm">
          <div className="flex items-start gap-3 rounded-[16px] bg-card px-3 py-3">
            <Phone className="mt-0.5 size-4 text-gold" />
            <div>
              <dt className="text-xs text-muted">Phone</dt>
              <dd>
                <a href={`tel:+1${biz.phone.replace(/\D/g, "")}`}>{formatPhone(biz.phone)}</a>
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-[16px] bg-card px-3 py-3">
            <MapPin className="mt-0.5 size-4 text-gold" />
            <div>
              <dt className="text-xs text-muted">Address</dt>
              <dd className="text-ink-soft">
                {showStreet ? `${biz.street}, ` : "Service area · "}
                {biz.cityName}, NV {biz.zip}
              </dd>
            </div>
          </div>
          {showEmail && biz.email ? (
            <div className="flex items-start gap-3 rounded-[16px] bg-card px-3 py-3">
              <Mail className="mt-0.5 size-4 text-gold" />
              <div>
                <dt className="text-xs text-muted">Email</dt>
                <dd>
                  {Boolean(biz.publicEmail) ? (
                    <a href={`mailto:${biz.email}`}>{biz.email}</a>
                  ) : (
                    <span className="text-ink-soft">{biz.email} <span className="text-xs text-muted">(private)</span></span>
                  )}
                </dd>
              </div>
            </div>
          ) : null}
          <div className="flex items-start gap-3 rounded-[16px] bg-card px-3 py-3">
            <Clock className="mt-0.5 size-4 text-gold" />
            <div>
              <dt className="text-xs text-muted">Hours</dt>
              <dd className="text-ink-soft">{biz.hours}</dd>
            </div>
          </div>
        </dl>
        <div className="mt-6">
          <QuoteForm businessId={biz.id} businessName={biz.name} />
        </div>
        <ClaimListingPanel
          businessId={biz.id}
          businessName={biz.name}
          slug={biz.slug}
          claimedBy={biz.claimedBy}
          website={biz.website}
          listingEmail={biz.email}
        />
        {biz.reviews.length ? (
          <div className="mt-8">
            <h2 className="font-display text-2xl font-semibold">Reviews</h2>
            <div className="mt-3 grid gap-2">
              {biz.reviews.map((r) => (
                <blockquote key={r.id} className="rounded-[16px] bg-card p-4">
                  <Stars rating={r.rating} />
                  <p className="mt-2 text-sm text-ink-soft">{r.body}</p>
                  <footer className="mt-2 text-xs text-muted">— {r.author}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    </SiteShell>
  );
}

function QuoteForm({
  businessId,
  businessName,
}: {
  businessId: number;
  businessName: string;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus("saving");
    setError("");
    try {
      await submitLead({
        data: {
          businessId,
          name: String(fd.get("name") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          email: String(fd.get("email") ?? ""),
          zip: String(fd.get("zip") ?? ""),
          message: String(fd.get("message") ?? ""),
        },
      });
      setStatus("done");
      e.currentTarget.reset();
    } catch (err) {
      setStatus("err");
      setError(err instanceof Error ? err.message : "Could not send.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[28px] border border-line bg-card p-5 lg:sticky lg:top-24"
    >
      <h2 className="font-display text-2xl font-semibold">Request a quote</h2>
      <p className="mt-1 text-sm text-muted">
        Tell {businessName} what you need. Your name, phone, and email go only to this shop — they
        are not published on the listing.
      </p>
      <div className="mt-4 grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="Your name" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" placeholder="775…" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@email.com" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="zip">ZIP</Label>
          <Input id="zip" name="zip" inputMode="numeric" placeholder="89502" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="message">What happened?</Label>
          <Textarea
            id="message"
            name="message"
            required
            placeholder="Cat tore through the patio screen this morning…"
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {status === "done" ? (
          <p className="text-sm text-sage">Sent. They’ll follow up from the 775.</p>
        ) : (
          <Button type="submit" disabled={status === "saving"} className="w-full">
            {status === "saving" ? "Sending…" : "Send request"}
          </Button>
        )}
      </div>
    </form>
  );
}
