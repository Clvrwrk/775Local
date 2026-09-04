import { InquiryForm } from "@/components/directory/inquiry-form";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, CalendarCheck, Clock, Globe2, MapPin, Phone } from "lucide-react";
import { ContactActions } from "@/components/directory/contact-actions";
import {
  telephoneHref,
  visibleServices,
  visibleProjects,
  descriptionBlocks,
} from "@/lib/directory/presentation.mjs";
import { PhotoGallery } from "@/components/directory/gallery";
import { OfferBanner } from "@/components/directory/offer-card";
import { Stars } from "@/components/directory/stars";
import { ClaimListingPanel } from "@/components/directory/claim-listing";
import { SiteShell } from "@/components/layout/site-shell";
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
          ...(loaderData.biz.citySlug !== "reno"
            ? [{ name: "robots", content: "noindex, follow" }]
            : []),
          {
            name: "description",
            content:
              loaderData.biz.description ||
              `${loaderData.biz.primaryCategory} in ${loaderData.biz.cityName}, Nevada.`,
          },
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function BusinessPage() {
  const { biz } = Route.useLoaderData();
  const showStreet = !biz.hideStreet && biz.street && biz.street !== "Service area";
  const checked = checkedLabel(biz.informationCheckedAt);
  const phoneHref = telephoneHref(biz.phone);
  const services = visibleServices(biz.services);
  const projects = visibleProjects(biz.projects);
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }}
      />
      <article className="app-page px-4 pb-14 pt-5 sm:px-6 sm:pt-8">
        <nav
          className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted"
          aria-label="Breadcrumb"
        >
          <Link to="/">Directory</Link>
          <span aria-hidden="true">/</span>
          <Link to="/nv/$city" params={{ city: biz.citySlug }}>
            {biz.cityName}
          </Link>
          <span aria-hidden="true">/</span>
          <Link to="/categories/$slug" params={{ slug: biz.primaryCategorySlug }}>
            {biz.primaryCategory}
          </Link>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.65fr)] lg:items-start">
          <div className="min-w-0">
            <div className="mt-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
                {biz.primaryCategory} · {biz.cityName}
              </p>
              <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
                {biz.name}
              </h1>
              {biz.tagline ? (
                <p className="mt-3 text-lg leading-7 text-ink-soft">{biz.tagline}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {biz.rating != null && biz.reviewCount != null ? (
                  <>
                    <Stars rating={biz.rating} />
                    <span className="tabular-nums text-muted">
                      {biz.rating.toFixed(1)} ({biz.reviewCount})
                    </span>
                  </>
                ) : null}
                <span className="rounded-full bg-pine px-3 py-1 text-xs font-semibold text-paper">
                  {biz.contentTier[0].toUpperCase()}
                  {biz.contentTier.slice(1)} listing
                </span>
                {biz.featured ? (
                  <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">
                    Sponsored
                  </span>
                ) : null}
                {biz.ownerVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/20 px-3 py-1 text-xs font-semibold text-teal">
                    <BadgeCheck className="size-3.5" /> Owner verified
                  </span>
                ) : (
                  <span className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">
                    Unclaimed
                  </span>
                )}
                <span className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">
                  {biz.verified ? "Information checked" : "Unverified"}
                </span>
              </div>
            </div>

            <div className="my-6">
              <ContactActions phone={biz.phone} website={biz.website} sponsored={biz.featured} />
            </div>
            {biz.photos.length ? (
              <PhotoGallery photos={biz.photos} name={biz.name} />
            ) : (
              <div className="relative aspect-[16/9] overflow-hidden rounded-[28px] bg-paper-2 sm:aspect-[2/1]">
                <img src={hero} alt="" className="size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-ink/65 px-3 py-1.5 text-xs font-medium text-paper backdrop-blur-sm">
                  Regional image · {biz.cityName}
                </span>
              </div>
            )}

            {biz.offer ? (
              <div className="mt-6">
                <OfferBanner offer={biz.offer} featured={biz.featured} />
              </div>
            ) : null}

            <section className="mt-8 border-t border-line pt-8" aria-labelledby="about-business">
              <h2 id="about-business" className="font-display text-3xl font-semibold">
                About this business
              </h2>
              <div className="mt-3 max-w-prose space-y-4 text-base leading-7 text-ink-soft">
                {descriptionBlocks(
                  biz.description ||
                    `${biz.name} is listed for ${biz.primaryCategory.toLowerCase()} in ${biz.cityName}. Contact the business directly for current service details.`,
                ).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              {checked ? (
                <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted">
                  <CalendarCheck className="size-4 text-teal" /> Information checked {checked}
                </p>
              ) : (
                <p className="mt-4 text-xs text-muted">
                  Unverified information — confirm details directly with the business.
                </p>
              )}
            </section>

            {biz.contentTier !== "basic" && services.length ? (
              <section
                className="mt-8 border-t border-line pt-8"
                aria-labelledby="services-offered"
              >
                <h2 id="services-offered" className="font-display text-3xl font-semibold">
                  Services
                </h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {services.map((service) => (
                    <li
                      key={service}
                      className="rounded-[18px] border border-line bg-card px-4 py-3 text-sm text-ink-soft"
                    >
                      {service}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {biz.contentTier === "premium" && projects.length ? (
              <section
                className="mt-8 border-t border-line pt-8"
                aria-labelledby="projects-heading"
              >
                <h2 id="projects-heading" className="font-display text-3xl font-semibold">
                  Projects
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {projects.map((project, index) => (
                    <article
                      key={`${project.title}-${index}`}
                      className="overflow-hidden rounded-[22px] border border-line bg-card"
                    >
                      {project.imageUrl ? (
                        <img
                          src={project.imageUrl}
                          alt=""
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : null}
                      <div className="p-5">
                        <h3 className="font-display text-xl font-semibold">{project.title}</h3>
                        {project.description ? (
                          <p className="mt-2 text-sm leading-6 text-ink-soft">
                            {project.description}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {biz.contentTier === "premium" && biz.faqs.length ? (
              <section className="mt-8 border-t border-line pt-8" aria-labelledby="faq-heading">
                <h2 id="faq-heading" className="font-display text-3xl font-semibold">
                  Frequently asked questions
                </h2>
                <div className="mt-4 grid gap-3">
                  {biz.faqs.map((faq, index) => (
                    <details
                      key={`${faq.question}-${index}`}
                      className="rounded-[20px] border border-line bg-card p-5"
                    >
                      <summary className="cursor-pointer font-semibold text-ink">
                        {faq.question}
                      </summary>
                      <p className="mt-3 text-sm leading-6 text-ink-soft">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            {biz.citySlug === "reno" ? (
              <ClaimListingPanel
                listingId={biz.sourceId}
                businessName={biz.name}
                slug={biz.slug}
                ownerVerified={biz.ownerVerified}
                website={biz.website}
                listingEmail=""
              />
            ) : (
              <p className="mt-8 rounded-2xl border border-line bg-card p-5 text-sm text-muted">
                This listing is retained for reference. The current owner-onboarding pilot is in
                Reno.
              </p>
            )}

            {biz.reviews.length ? (
              <section className="mt-8 border-t border-line pt-8" aria-labelledby="reviews-heading">
                <h2 id="reviews-heading" className="font-display text-3xl font-semibold">
                  Reviews
                </h2>
                <div className="mt-4 grid gap-3">
                  {biz.reviews.map((review) => (
                    <blockquote
                      key={review.id}
                      className="rounded-[20px] border border-line bg-card p-5"
                    >
                      <Stars rating={review.rating} />
                      <p className="mt-3 text-sm leading-6 text-ink-soft">{review.body}</p>
                      <footer className="mt-2 text-xs text-muted">— {review.author}</footer>
                    </blockquote>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside
            className="rounded-[26px] border border-line bg-card p-5 shadow-[0_14px_40px_rgba(28,26,22,0.07)] lg:sticky lg:top-24 sm:p-6"
            aria-label="Business contact details"
          >
            <h2 className="font-display text-2xl font-semibold">Contact {biz.name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Confirm availability, pricing, and current hours directly with the business.
            </p>
            <dl className="mt-5 grid gap-4 text-sm">
              {phoneHref ? (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-5 shrink-0 text-teal" />
                  <div>
                    <dt className="text-xs text-muted">Phone</dt>
                    <dd className="mt-0.5 font-medium">
                      <a href={phoneHref ?? undefined}>{formatPhone(biz.phone)}</a>
                    </dd>
                  </div>
                </div>
              ) : null}
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-teal" />
                <div>
                  <dt className="text-xs text-muted">{showStreet ? "Address" : "Service area"}</dt>
                  <dd className="mt-0.5 text-ink-soft">
                    {showStreet ? `${biz.street}, ` : ""}
                    {biz.cityName}, NV {biz.zip}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-teal" />
                <div>
                  <dt className="text-xs text-muted">Hours</dt>
                  <dd className="mt-0.5 text-ink-soft">{biz.hours}</dd>
                </div>
              </div>
              {biz.website ? (
                <div className="flex items-start gap-3">
                  <Globe2 className="mt-0.5 size-5 shrink-0 text-teal" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">Website</dt>
                    <dd className="mt-0.5 truncate font-medium">{safeHost(biz.website)}</dd>
                  </div>
                </div>
              ) : null}
            </dl>
            <div className="mt-6">
              <ContactActions phone={biz.phone} website={biz.website} sponsored={biz.featured} />
            </div>
            <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">
              Listing tier reflects available content, not ownership or endorsement. Confirm
              pricing, availability, licensing, and service details directly with the business.
            </p>
            {biz.citySlug === "reno" ? (
              <InquiryForm listingId={biz.sourceId} name={biz.name} />
            ) : null}
          </aside>
        </div>
      </article>
    </SiteShell>
  );
}
