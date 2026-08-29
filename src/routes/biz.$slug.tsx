import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, CalendarCheck, Clock, Globe2, MapPin, Phone } from "lucide-react";
import { PhotoGallery } from "@/components/directory/gallery";
import { OfferBanner } from "@/components/directory/offer-card";
import { Stars } from "@/components/directory/stars";
import { SiteShell } from "@/components/layout/site-shell";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { listingCover } from "@/lib/directory/covers";
import { getBusiness } from "@/lib/directory/queries";
import { serializeStructuredData } from "@/lib/directory/structured-data.mjs";
import { formatPhone } from "@/lib/utils";

export const Route = createFileRoute("/biz/$slug")({
  loader: async ({ params }) => {
    const biz = await getBusiness({ data: params.slug });
    if (!biz) throw notFound();
    return { biz };
  },
  head: ({ loaderData, params }) => ({
    meta: loaderData?.biz
      ? [
          { title: `${loaderData.biz.name} | 775Directory` },
          { name: "description", content: loaderData.biz.description || `${loaderData.biz.primaryCategory} in ${loaderData.biz.cityName}, Nevada.` },
        ]
      : [],
    links: [{ rel: "canonical", href: `https://775directory.com/biz/${params.slug}` }],
  }),
  component: BusinessPage,
});

function safeHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function checkedLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function BusinessPage() {
  const { biz } = Route.useLoaderData();
  const user = useCurrentUser();
  const isOwner = Boolean(user && biz.claimedBy === user.id);
  const showStreet = !biz.hideStreet && biz.street && biz.street !== "Service area";
  const checked = checkedLabel(biz.informationCheckedAt);
  const hero = biz.coverUrl || listingCover(biz.citySlug, biz.id);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: biz.name,
    ...(biz.description ? { description: biz.description } : {}),
    ...(biz.phone ? { telephone: biz.phone } : {}),
    ...(biz.website ? { url: biz.website } : {}),
    address: {
      "@type": "PostalAddress",
      ...(showStreet ? { streetAddress: biz.street } : {}),
      addressLocality: biz.cityName,
      addressRegion: "NV",
      ...(biz.zip ? { postalCode: biz.zip } : {}),
    },
    ...(!showStreet ? { areaServed: `${biz.cityName}, Nevada` } : {}),
  };

  return (
    <SiteShell wash>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }} />
      <article className="app-page px-4 pb-14 pt-5 sm:px-6 sm:pt-8">
        <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted" aria-label="Breadcrumb">
          <Link to="/">Directory</Link><span aria-hidden="true">/</span>
          <Link to="/nv/$city" params={{ city: biz.citySlug }}>{biz.cityName}</Link><span aria-hidden="true">/</span>
          <Link to="/categories/$slug" params={{ slug: biz.primaryCategorySlug }}>{biz.primaryCategory}</Link>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.65fr)] lg:items-start">
          <div className="min-w-0">
            {biz.photos.length ? (
              <PhotoGallery photos={biz.photos} name={biz.name} />
            ) : (
              <div className="relative aspect-[16/9] overflow-hidden rounded-[28px] bg-paper-2 sm:aspect-[2/1]">
                <img src={hero} alt="" className="size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-ink/65 px-3 py-1.5 text-xs font-medium text-paper backdrop-blur-sm">Regional image · {biz.cityName}</span>
              </div>
            )}

            <div className="mt-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">{biz.primaryCategory} · {biz.cityName}</p>
              <h1 className="mt-2 font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-6xl">{biz.name}</h1>
              {biz.tagline ? <p className="mt-3 text-lg leading-7 text-ink-soft">{biz.tagline}</p> : null}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {biz.rating != null && biz.reviewCount != null ? (
                  <><Stars rating={biz.rating} /><span className="tabular-nums text-muted">{biz.rating.toFixed(1)} ({biz.reviewCount})</span></>
                ) : null}
                {biz.featured ? (
                  <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">Sponsored</span>
                ) : biz.ownerVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/20 px-3 py-1 text-xs font-semibold text-teal"><BadgeCheck className="size-3.5" /> Owner verified</span>
                ) : (
                  <span className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">Unclaimed</span>
                )}
                {isOwner ? <Link to="/studio/$slug" params={{ slug: biz.slug }} className="text-xs font-semibold text-teal">Open listing studio</Link> : null}
              </div>
            </div>

            {biz.offer ? <div className="mt-6"><OfferBanner offer={biz.offer} featured={biz.featured} /></div> : null}

            <section className="mt-8 border-t border-line pt-8" aria-labelledby="about-business">
              <h2 id="about-business" className="font-display text-3xl font-semibold">About this business</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-ink-soft">{biz.description || `${biz.name} is listed for ${biz.primaryCategory.toLowerCase()} in ${biz.cityName}. Contact the business directly for current service details.`}</p>
              {checked ? <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted"><CalendarCheck className="size-4 text-teal" /> Information checked {checked}</p> : null}
            </section>

            {!biz.ownerVerified ? (
              <section className="mt-8 rounded-[24px] border border-line bg-card p-6" aria-labelledby="claim-heading">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Unclaimed listing</p>
                <h2 id="claim-heading" className="mt-2 font-display text-2xl font-semibold">Own {biz.name}?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Claim submissions are not open yet. The future workflow will require evidence connecting the requester to the business before account control is granted.</p>
                <Link to="/claim" search={{ q: biz.name, city: biz.citySlug }} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-ink hover:bg-paper-2">See Claim status</Link>
              </section>
            ) : null}

            {biz.reviews.length ? (
              <section className="mt-8 border-t border-line pt-8" aria-labelledby="reviews-heading">
                <h2 id="reviews-heading" className="font-display text-3xl font-semibold">Reviews</h2>
                <div className="mt-4 grid gap-3">
                  {biz.reviews.map((review) => (
                    <blockquote key={review.id} className="rounded-[20px] border border-line bg-card p-5">
                      <Stars rating={review.rating} />
                      <p className="mt-3 text-sm leading-6 text-ink-soft">{review.body}</p>
                      <footer className="mt-2 text-xs text-muted">— {review.author}</footer>
                    </blockquote>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="rounded-[26px] border border-line bg-card p-5 shadow-[0_14px_40px_rgba(28,26,22,0.07)] lg:sticky lg:top-24 sm:p-6" aria-label="Business contact details">
            <h2 className="font-display text-2xl font-semibold">Contact {biz.name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Confirm availability, pricing, and current hours directly with the business.</p>
            <dl className="mt-5 grid gap-4 text-sm">
              {biz.phone ? <div className="flex items-start gap-3"><Phone className="mt-0.5 size-5 shrink-0 text-gold-2" /><div><dt className="text-xs text-muted">Phone</dt><dd className="mt-0.5 font-medium"><a href={`tel:+1${biz.phone.replace(/\D/g, "")}`}>{formatPhone(biz.phone)}</a></dd></div></div> : null}
              <div className="flex items-start gap-3"><MapPin className="mt-0.5 size-5 shrink-0 text-gold-2" /><div><dt className="text-xs text-muted">{showStreet ? "Address" : "Service area"}</dt><dd className="mt-0.5 text-ink-soft">{showStreet ? `${biz.street}, ` : ""}{biz.cityName}, NV {biz.zip}</dd></div></div>
              <div className="flex items-start gap-3"><Clock className="mt-0.5 size-5 shrink-0 text-gold-2" /><div><dt className="text-xs text-muted">Hours</dt><dd className="mt-0.5 text-ink-soft">{biz.hours}</dd></div></div>
              {biz.website ? <div className="flex items-start gap-3"><Globe2 className="mt-0.5 size-5 shrink-0 text-gold-2" /><div className="min-w-0"><dt className="text-xs text-muted">Website</dt><dd className="mt-0.5 truncate font-medium">{safeHost(biz.website)}</dd></div></div> : null}
            </dl>
            <div className="mt-6 grid gap-2">
              {biz.phone ? <a href={`tel:+1${biz.phone.replace(/\D/g, "")}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-4 text-sm font-semibold text-ink hover:bg-gold-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine">Call {formatPhone(biz.phone)}</a> : null}
              {biz.website ? <a href={biz.website} target="_blank" rel={biz.featured ? "sponsored noopener noreferrer" : "noopener noreferrer"} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-ink hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine">Visit website <ArrowUpRight className="size-4" /></a> : null}
            </div>
            <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">775Directory publishes reviewed business information. It does not guarantee pricing, availability, or service outcomes.</p>
          </aside>
        </div>
      </article>
    </SiteShell>
  );
}
