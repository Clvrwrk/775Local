import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, CalendarCheck, Clock, Globe2, MapPin, Phone } from "lucide-react";
import { PhotoGallery } from "@/components/directory/gallery";
import { OfferBanner } from "@/components/directory/offer-card";
import { Stars } from "@/components/directory/stars";
import { SiteShell } from "@/components/layout/site-shell";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { listingCover } from "@/lib/directory/covers";
import { photoCapForPlan } from "@/lib/directory/package";
import { getBusiness } from "@/lib/directory/queries";
import { serializeStructuredData } from "@/lib/directory/structured-data.mjs";
import type { BusinessDetail, CaseStudy, Offer } from "@/lib/directory/types";
import { cn, formatPhone, mapsHref, telHref } from "@/lib/utils";

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

/**
 * Page layout by plan (chosen directions): Basic = photo lead, Standard = offer-led
 * hero, Premium = long scroll with a sticky call bar on phones. Free reads as Basic.
 */
type PageLayout = "basic" | "standard" | "premium";

function pageLayout(biz: BusinessDetail): PageLayout {
  if (biz.plan === "premium") return "premium";
  if (biz.plan === "standard") return "standard";
  return "basic";
}

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

const pillButton =
  "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine";
const goldButton = cn(pillButton, "bg-gold text-ink hover:bg-gold-2");
const outlineButton = cn(pillButton, "border border-line bg-card text-ink hover:bg-paper-2");

function websiteRel(featured: boolean) {
  return featured ? "sponsored noopener noreferrer" : "noopener noreferrer";
}

/** Call / Directions / Website in one row. Phone and street are the tap targets. */
function TapRow({ biz, showStreet }: { biz: BusinessDetail; showStreet: boolean }) {
  const cols = [biz.phone, showStreet, biz.website].filter(Boolean).length;
  if (!cols) return null;
  return (
    <div className={cn("mt-5 grid gap-2", cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {biz.phone ? <a href={telHref(biz.phone)} className={goldButton}><Phone className="size-4" /> Call</a> : null}
      {showStreet ? <a href={mapsHref({ street: biz.street, city: biz.cityName, zip: biz.zip })} target="_blank" rel="noopener noreferrer" className={outlineButton}><MapPin className="size-4" /> Directions</a> : null}
      {biz.website ? <a href={biz.website} target="_blank" rel={websiteRel(biz.featured)} className={outlineButton}><ArrowUpRight className="size-4" /> Website</a> : null}
    </div>
  );
}

function RegionalHero({ biz, className }: { biz: BusinessDetail; className?: string }) {
  const hero = biz.coverUrl || listingCover(biz.citySlug, biz.id);
  return (
    <div className={cn("relative aspect-[16/9] overflow-hidden bg-paper-2 sm:aspect-[2/1]", className)}>
      <img src={hero} alt="" className="size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
      <span className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-ink/65 px-3 py-1.5 text-xs font-medium text-paper backdrop-blur-sm">Regional image · {biz.cityName}</span>
    </div>
  );
}

/** Standard: the cover bleeds to the phone edges and the active offer card overlaps its bottom. */
function OfferLedHero({ biz, offer }: { biz: BusinessDetail; offer: Offer }) {
  const hero = biz.photos[0]?.url || biz.coverUrl || listingCover(biz.citySlug, biz.id);
  return (
    <div className="relative -mx-4 pb-24 sm:mx-0">
      <div className="overflow-hidden sm:rounded-[28px]">
        <img src={hero} alt={biz.photos[0]?.caption || ""} className="aspect-[4/3] w-full object-cover sm:aspect-[2/1]" />
      </div>
      {biz.ownerVerified ? (
        <span className="absolute right-8 top-4 inline-flex items-center gap-1 rounded-full bg-sage/20 px-3 py-1 text-xs font-semibold text-teal backdrop-blur-sm sm:right-4"><BadgeCheck className="size-3.5" /> Owner verified</span>
      ) : null}
      <aside className="absolute inset-x-4 bottom-0 rounded-[16px] bg-card p-3.5 shadow-[0_14px_40px_rgba(28,26,22,0.12)] sm:inset-x-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-gold-2">Listing offer</p>
        <p className="mt-1 font-display text-2xl font-semibold leading-tight">{offer.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {offer.code ? <span className="rounded-full bg-gold px-3 py-1 font-medium tabular-nums text-ink">{offer.code}</span> : null}
          {offer.expiresOn ? <span className="text-xs text-muted">Through {offer.expiresOn.slice(0, 10)}</span> : null}
        </div>
      </aside>
    </div>
  );
}

function PhotoGrid({ biz, cap, strip = false }: { biz: BusinessDetail; cap: number; strip?: boolean }) {
  const photos = biz.photos.slice(0, cap);
  if (photos.length < 2) return null;
  const shown = strip ? photos.slice(0, 4) : photos.slice(0, 6);
  const rest = photos.length - shown.length;
  return (
    <section className="mt-8" aria-labelledby="photos-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="photos-heading" className="font-display text-3xl font-semibold">Photos</h2>
        <span className="text-sm text-muted">{photos.length} photos</span>
      </div>
      <div className={cn("mt-4", strip ? "flex gap-2 overflow-x-auto" : "grid grid-cols-3 gap-2")}>
        {shown.map((p, i) => (
          <div key={p.id} className={cn("relative overflow-hidden rounded-[12px]", strip ? "h-[105px] w-[140px] shrink-0" : "aspect-square")}>
            <img src={p.url} alt={p.caption || ""} className="size-full object-cover" />
            {i === shown.length - 1 && rest > 0 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-sm font-semibold text-paper">+{rest}</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function Reviews({ biz, strip = false }: { biz: BusinessDetail; strip?: boolean }) {
  if (!biz.reviews.length) return null;
  return (
    <section className="mt-8 border-t border-line pt-8" aria-labelledby="reviews-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="reviews-heading" className="font-display text-3xl font-semibold">Reviews</h2>
        {strip && biz.reviewCount != null ? <span className="text-sm text-muted">{biz.reviewCount} reviews</span> : null}
      </div>
      <div className={cn("mt-4", strip ? "flex gap-3 overflow-x-auto" : "grid gap-3")}>
        {biz.reviews.map((review) => (
          <blockquote key={review.id} className={cn("rounded-[20px] border border-line bg-card p-5", strip ? "w-72 shrink-0" : "")}>
            <Stars rating={review.rating} />
            <p className="mt-3 text-sm leading-6 text-ink-soft">{review.body}</p>
            <footer className="mt-2 text-xs text-muted">— {review.author}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function BeforeAfter({ study, compact = false }: { study: CaseStudy; compact?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[["Before", study.beforeUrl], ["After", study.afterUrl]].map(([label, url]) => (
        <figure key={label} className={cn("relative overflow-hidden rounded-[14px] bg-paper-2", compact ? "aspect-square" : "aspect-[4/3]")}>
          <img src={url} alt={`${label}: ${study.title}`} className="size-full object-cover" />
          <figcaption className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-paper">{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Standard and Premium: the featured case study in full, the rest as cards. */
function Projects({ biz }: { biz: BusinessDetail }) {
  const [lead, ...rest] = biz.caseStudies;
  if (!lead) return null;
  const facts = [lead.projectType, lead.clientLocation, lead.completedOn ? `Completed ${lead.completedOn.slice(0, 7)}` : "", lead.investmentRange].filter(Boolean);
  return (
    <section className="mt-8 border-t border-line pt-8" aria-labelledby="projects-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="projects-heading" className="font-display text-3xl font-semibold">Projects</h2>
        {lead.featured ? <span className="rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-semibold text-ink">Spotlight</span> : null}
      </div>
      <article className="mt-4 rounded-[20px] border border-line bg-card p-4 sm:p-5">
        <BeforeAfter study={lead} />
        <h3 className="mt-4 font-display text-2xl font-semibold leading-tight">{lead.title}</h3>
        {facts.length ? <p className="mt-1 text-xs text-muted">{facts.join(" · ")}</p> : null}
        {lead.summary ? <p className="mt-2 text-sm leading-6 text-ink-soft">{lead.summary}</p> : null}
        <dl className="mt-4 grid gap-3 text-sm leading-6 text-ink-soft">
          <div><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">What they needed</dt><dd className="mt-1">{lead.clientNeed}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">What we did</dt><dd className="mt-1">{lead.approach}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Results</dt><dd className="mt-1">{lead.results}</dd></div>
        </dl>
        {lead.metrics.length ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {lead.metrics.map((m) => (
              <div key={m.label} className="rounded-[14px] border border-line p-3">
                <p className="text-xs text-muted">{m.label}</p>
                <p className="mt-0.5 font-display text-xl font-semibold text-pine tabular-nums">{m.before ? `${m.before} → ` : ""}{m.after}{m.unit ? ` ${m.unit}` : ""}</p>
              </div>
            ))}
          </div>
        ) : null}
        {lead.testimonial ? (
          <blockquote className="mt-4 rounded-[16px] bg-gold/10 p-4">
            {lead.testimonial.rating != null ? <Stars rating={lead.testimonial.rating} /> : null}
            <p className="mt-2 text-sm leading-6 text-ink-soft">{lead.testimonial.quote}</p>
            <footer className="mt-2 text-xs text-muted">— {lead.testimonial.author}{lead.testimonial.role ? `, ${lead.testimonial.role}` : ""}</footer>
          </blockquote>
        ) : null}
      </article>
      {rest.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {rest.map((study) => (
            <article key={study.id} className="rounded-[20px] border border-line bg-card p-3">
              <BeforeAfter study={study} compact />
              <h3 className="mt-3 font-display text-xl font-semibold leading-tight">{study.title}</h3>
              {study.summary ? <p className="mt-1 line-clamp-3 text-sm leading-5 text-muted">{study.summary}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Premium, phones only: the call button rides above the tab bar the whole way down. */
function StickyCallBar({ biz, showStreet }: { biz: BusinessDetail; showStreet: boolean }) {
  if (!biz.phone) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-[minmax(0,1fr)_3rem] gap-2 border-t border-line/70 bg-paper/90 px-4 py-2.5 backdrop-blur-xl md:hidden">
      <a href={telHref(biz.phone)} className={goldButton}><Phone className="size-4" /> Call {formatPhone(biz.phone)}</a>
      {showStreet ? (
        <a href={mapsHref({ street: biz.street, city: biz.cityName, zip: biz.zip })} target="_blank" rel="noopener noreferrer" className="inline-flex size-12 items-center justify-center rounded-full border border-line bg-card text-ink" aria-label="Get directions"><MapPin className="size-[18px]" /></a>
      ) : null}
    </div>
  );
}

function BusinessPage() {
  const { biz } = Route.useLoaderData();
  const user = useCurrentUser();
  const isOwner = Boolean(user && biz.claimedBy === user.id);
  const layout = pageLayout(biz);
  const cap = photoCapForPlan(biz.plan);
  const showStreet = Boolean(!biz.hideStreet && biz.street && biz.street !== "Service area");
  const checked = checkedLabel(biz.informationCheckedAt);
  const offerLed = layout === "standard" && biz.offer;
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
      <article className={cn("app-page px-4 pt-5 sm:px-6 sm:pt-8", layout === "premium" ? "pb-32 md:pb-14" : "pb-14")}>
        <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted" aria-label="Breadcrumb">
          <Link to="/">Directory</Link><span aria-hidden="true">/</span>
          <Link to="/nv/$city" params={{ city: biz.citySlug }}>{biz.cityName}</Link><span aria-hidden="true">/</span>
          <Link to="/categories/$slug" params={{ slug: biz.primaryCategorySlug }}>{biz.primaryCategory}</Link>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.65fr)] lg:items-start">
          <div className="min-w-0">
            {offerLed ? (
              <OfferLedHero biz={biz} offer={biz.offer!} />
            ) : biz.photos.length ? (
              <PhotoGallery photos={biz.photos.slice(0, cap)} name={biz.name} showCount={layout === "premium"} />
            ) : (
              <RegionalHero biz={biz} className="rounded-[28px]" />
            )}

            <div className={offerLed ? "mt-5" : "mt-7"}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">{biz.primaryCategory} · {biz.cityName}</p>
              <h1 className="mt-2 font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-6xl">{biz.name}</h1>
              {biz.tagline ? <p className="mt-3 text-lg leading-7 text-ink-soft">{biz.tagline}</p> : null}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {biz.rating != null && biz.reviewCount != null ? (
                  <><Stars rating={biz.rating} /><span className="tabular-nums text-muted">{biz.rating.toFixed(1)} ({biz.reviewCount})</span></>
                ) : null}
                {biz.featured ? (
                  <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">Sponsored</span>
                ) : biz.ownerVerified && !offerLed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/20 px-3 py-1 text-xs font-semibold text-teal"><BadgeCheck className="size-3.5" /> Owner verified</span>
                ) : !biz.ownerVerified ? (
                  <span className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">Unclaimed</span>
                ) : null}
                {isOwner ? <Link to="/studio/$slug" params={{ slug: biz.slug }} className="text-xs font-semibold text-teal">Open listing studio</Link> : null}
              </div>
            </div>

            {layout === "premium" ? <TapRow biz={biz} showStreet={showStreet} /> : null}
            {layout === "premium" && biz.offer ? <div className="mt-6"><OfferBanner offer={biz.offer} featured={biz.featured} /></div> : null}
            {layout !== "premium" ? <TapRow biz={biz} showStreet={showStreet} /> : null}

            <section className="mt-8 border-t border-line pt-8" aria-labelledby="about-business">
              <h2 id="about-business" className="font-display text-3xl font-semibold">About this business</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-ink-soft">{biz.description || `${biz.name} is listed for ${biz.primaryCategory.toLowerCase()} in ${biz.cityName}. Contact the business directly for current service details.`}</p>
              {checked ? <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted"><CalendarCheck className="size-4 text-teal" /> Information checked {checked}</p> : null}
            </section>

            {biz.categories.length ? (
              <section className="mt-8" aria-labelledby="services-heading">
                <h2 id="services-heading" className="font-display text-3xl font-semibold">Services</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {biz.categories.map((c) => (
                    <Link key={c.slug} to="/nv/$city/$category" params={{ city: biz.citySlug, category: c.slug }} className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-3 text-[13px] font-medium text-ink hover:border-sage/40">{c.name}</Link>
                  ))}
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted"><MapPin className="size-3.5" /> Serving {biz.cityName}</p>
              </section>
            ) : null}

            <PhotoGrid biz={biz} cap={cap} strip={layout === "basic"} />

            {layout !== "basic" ? <Projects biz={biz} /> : null}

            {layout === "basic" && biz.hours ? (
              <div className="mt-6 flex items-start gap-3 rounded-[16px] border border-line bg-card p-3.5">
                <Clock className="mt-0.5 size-5 shrink-0 text-gold-2" />
                <div><p className="text-xs text-muted">Hours</p><p className="mt-0.5 text-sm text-ink-soft">{biz.hours}</p></div>
              </div>
            ) : null}

            {!biz.ownerVerified ? (
              <section className="mt-8 rounded-[24px] border border-line bg-card p-6" aria-labelledby="claim-heading">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Unclaimed listing</p>
                <h2 id="claim-heading" className="mt-2 font-display text-2xl font-semibold">Own {biz.name}?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Claim submissions are not open yet. The future workflow will require evidence connecting the requester to the business before account control is granted.</p>
                <Link to="/claim" search={{ q: biz.name, city: biz.citySlug }} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-ink hover:bg-paper-2">See Claim status</Link>
              </section>
            ) : null}

            {layout !== "basic" ? <Reviews biz={biz} strip={layout === "premium"} /> : null}
          </div>

          <aside className="rounded-[26px] border border-line bg-card p-5 shadow-[0_14px_40px_rgba(28,26,22,0.07)] lg:sticky lg:top-24 sm:p-6" aria-label="Business contact details">
            <h2 className="font-display text-2xl font-semibold">Contact {biz.name}</h2>
            {layout !== "basic" ? <p className="mt-2 text-sm leading-6 text-muted">Confirm availability, pricing, and current hours directly with the business.</p> : null}
            <dl className="mt-5 grid gap-4 text-sm">
              {biz.phone ? <div className="flex items-start gap-3"><Phone className="mt-0.5 size-5 shrink-0 text-gold-2" /><div><dt className="text-xs text-muted">Phone</dt><dd className="mt-0.5 font-medium"><a href={telHref(biz.phone)}>{formatPhone(biz.phone)}</a></dd></div></div> : null}
              <div className="flex items-start gap-3"><MapPin className="mt-0.5 size-5 shrink-0 text-gold-2" /><div><dt className="text-xs text-muted">{showStreet ? "Address" : "Service area"}</dt><dd className="mt-0.5 text-ink-soft">{showStreet ? <a href={mapsHref({ street: biz.street, city: biz.cityName, zip: biz.zip })} target="_blank" rel="noopener noreferrer" className="font-medium text-ink hover:text-teal hover:underline">{biz.street}, {biz.cityName}, NV {biz.zip}</a> : <>{biz.cityName}, NV {biz.zip}</>}</dd></div></div>
              <div className="flex items-start gap-3"><Clock className="mt-0.5 size-5 shrink-0 text-gold-2" /><div><dt className="text-xs text-muted">Hours</dt><dd className="mt-0.5 text-ink-soft">{biz.hours}</dd></div></div>
              {biz.website ? <div className="flex items-start gap-3"><Globe2 className="mt-0.5 size-5 shrink-0 text-gold-2" /><div className="min-w-0"><dt className="text-xs text-muted">Website</dt><dd className="mt-0.5 truncate font-medium"><a href={biz.website} target="_blank" rel={websiteRel(biz.featured)}>{safeHost(biz.website)}</a></dd></div></div> : null}
            </dl>
            <div className="mt-6 grid gap-2">
              {biz.phone ? <a href={telHref(biz.phone)} className={goldButton}>Call {formatPhone(biz.phone)}</a> : null}
              {showStreet ? <a href={mapsHref({ street: biz.street, city: biz.cityName, zip: biz.zip })} target="_blank" rel="noopener noreferrer" className={outlineButton}><MapPin className="size-4" /> Get directions</a> : null}
              {biz.website ? <a href={biz.website} target="_blank" rel={websiteRel(biz.featured)} className={outlineButton}>Visit website <ArrowUpRight className="size-4" /></a> : null}
            </div>
            <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">775Directory publishes reviewed business information. It does not guarantee pricing, availability, or service outcomes.</p>
          </aside>
        </div>
      </article>
      {layout === "premium" ? <StickyCallBar biz={biz} showStreet={showStreet} /> : null}
    </SiteShell>
  );
}
