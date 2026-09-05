import { Link } from "@tanstack/react-router";
import { Check, MapPin } from "lucide-react";
import type { BusinessDetail } from "@/lib/directory/types";
import {
  telephoneHref,
  safeWebsite,
  visibleServices,
  visibleProjects,
  descriptionBlocks,
} from "@/lib/directory/presentation.mjs";
import { serializeStructuredData } from "@/lib/directory/structured-data.mjs";
import { formatPhone } from "@/lib/utils";
import { BrandMark } from "@/components/brand/logo";
import { SiteShell } from "@/components/layout/site-shell";
import { ContactActions } from "./contact-actions";
import { ClaimListingPanel } from "./claim-listing";
import { InquiryForm } from "./inquiry-form";
import { ListingGallery } from "./listing-gallery";
import { Stars } from "./stars";
import { CaseStudies } from "./case-studies";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="listing-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function TrustLine({ biz }: { biz: BusinessDetail }) {
  return (
    <p className="listing-trust">
      {biz.rating != null && biz.reviewCount != null ? (
        <>
          <Stars rating={biz.rating} /> <strong>{biz.rating.toFixed(1)}</strong> · {biz.reviewCount}{" "}
          reviews ·{" "}
        </>
      ) : null}
      {biz.ownerVerified ? "Owner verified" : "Unclaimed"} ·{" "}
      {biz.verified ? "Information checked" : "Unverified"} · Serving {biz.cityName}
    </p>
  );
}

function Details({ biz, basic = false }: { biz: BusinessDetail; basic?: boolean }) {
  const phone = telephoneHref(biz.phone);
  const website = safeWebsite(biz.website);
  const showStreet = !biz.hideStreet && biz.street && biz.street !== "Service area";
  return (
    <Panel
      title={
        basic
          ? "Contact & location"
          : biz.contentTier === "premium"
            ? "Business details"
            : "Details"
      }
    >
      <dl className="listing-details">
        <dt>{showStreet ? "Address" : "Service area"}</dt>
        <dd>
          {showStreet ? `${biz.street}, ` : ""}
          {biz.cityName}, NV {biz.zip}
        </dd>
        {phone ? (
          <>
            <dt>Phone</dt>
            <dd>
              <a href={phone}>{formatPhone(biz.phone)}</a>
            </dd>
          </>
        ) : null}
        {website ? (
          <>
            <dt>Website</dt>
            <dd>
              <a
                href={website}
                target="_blank"
                rel={biz.featured ? "sponsored noopener noreferrer" : "noopener noreferrer"}
              >
                {new URL(website).hostname.replace(/^www\./, "")}
              </a>
            </dd>
          </>
        ) : null}
        <dt>Category</dt>
        <dd>{biz.primaryCategory}</dd>
        <dt>Serving</dt>
        <dd>{biz.cityName}</dd>
      </dl>
    </Panel>
  );
}

function Location({ biz }: { biz: BusinessDetail }) {
  const showStreet = !biz.hideStreet && biz.street && biz.street !== "Service area";
  const address = `${showStreet ? `${biz.street}, ` : ""}${biz.cityName}, NV`;
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <div className="listing-location">
      <BrandMark className="size-9 opacity-60" />
      <p>{showStreet ? address : `Serving ${biz.cityName}, Nevada`}</p>
      <a href={map} target="_blank" rel="noopener noreferrer">
        <MapPin size={15} strokeWidth={1.75} />
        {showStreet ? "View location on map" : "Explore the service area"}
      </a>
    </div>
  );
}

function Hours({ biz }: { biz: BusinessDetail }) {
  return (
    <Panel title="Hours">
      <p>{biz.hours}</p>
    </Panel>
  );
}

function Claim({ biz }: { biz: BusinessDetail }) {
  return biz.citySlug === "reno" ? (
    <div id="claim-listing" className="listing-claim">
      <ClaimListingPanel
        listingId={biz.sourceId}
        businessName={biz.name}
        slug={biz.slug}
        ownerVerified={biz.ownerVerified}
        website={biz.website}
        listingEmail=""
      />
    </div>
  ) : (
    <p className="listing-panel">
      This listing is retained for reference. Owner onboarding is currently available in Reno.
    </p>
  );
}

function About({ biz }: { biz: BusinessDetail }) {
  return (
    <Panel title="About">
      <div className="listing-prose">
        {descriptionBlocks(
          biz.description ||
            `${biz.name} is listed for ${biz.primaryCategory.toLowerCase()} in ${biz.cityName}. Contact the business for current service details.`,
        ).map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </Panel>
  );
}

function Reviews({ biz }: { biz: BusinessDetail }) {
  return (
    <Panel title={biz.contentTier === "premium" ? `What ${biz.cityName} neighbors say` : "Reviews"}>
      {biz.reviews.length ? (
        <div className="listing-reviews">
          {biz.reviews.map((review) => (
            <blockquote key={review.id}>
              <strong>{review.author}</strong>
              <Stars rating={review.rating} />
              <p>{review.body}</p>
            </blockquote>
          ))}
        </div>
      ) : (
        <p className="listing-note">No reviews are published on this listing yet.</p>
      )}
    </Panel>
  );
}

function Services({ biz }: { biz: BusinessDetail }) {
  const services = visibleServices(biz.services);
  return services.length ? (
    <Panel title={`Services in ${biz.cityName}`}>
      <ul className="listing-services">
        {services.map((service) => (
          <li key={service}>
            <Check size={16} strokeWidth={1.75} />
            <span>{service}</span>
          </li>
        ))}
      </ul>
    </Panel>
  ) : null;
}

function PremiumContent({ biz }: { biz: BusinessDetail }) {
  const projects = visibleProjects(biz.projects);
  return (
    <>
      <ListingGallery photos={biz.photos} name={biz.name} variant="premium" />
      <Services biz={biz} />
      {biz.faqs.length ? (
        <Panel title="Frequently asked questions">
          <div className="listing-faqs">
            {biz.faqs.map((faq, i) => (
              <details key={i}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </Panel>
      ) : null}
      <About biz={biz} />
      {projects.length ? (
        <Panel title="Projects">
          <div className="listing-projects">
            {projects.map((project, i) => (
              <article key={i}>
                {safeWebsite(project.imageUrl) ? (
                  <img src={project.imageUrl} alt="" loading="lazy" />
                ) : null}
                <h3>{project.title}</h3>
                {project.description ? <p>{project.description}</p> : null}
              </article>
            ))}
          </div>
        </Panel>
      ) : null}
      <Reviews biz={biz} />
    </>
  );
}

export function ListingPage({ biz }: { biz: BusinessDetail }) {
  const basic = biz.contentTier === "basic";
  const premium = biz.contentTier === "premium";
  const showStreet = !biz.hideStreet && biz.street && biz.street !== "Service area";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: biz.name,
    ...(biz.description ? { description: biz.description } : {}),
    ...(biz.phone ? { telephone: biz.phone } : {}),
    ...(safeWebsite(biz.website) ? { url: biz.website } : {}),
    address: {
      "@type": "PostalAddress",
      ...(showStreet ? { streetAddress: biz.street } : {}),
      addressLocality: biz.cityName,
      addressRegion: "NV",
      ...(biz.zip ? { postalCode: biz.zip } : {}),
    },
    ...(!showStreet ? { areaServed: `${biz.cityName}, Nevada` } : {}),
  };
  const heading = (
    <div className="listing-heading-copy">
      <p className="listing-eyebrow">
        {biz.primaryCategory} · {biz.cityName}, NV
      </p>
      {premium ? (
        <div className="listing-badges">
          <span>Premium listing</span>
          {biz.featured ? <span>Sponsored</span> : null}
        </div>
      ) : null}
      <h1>{premium ? `${biz.primaryCategory} in ${biz.cityName}, NV — ${biz.name}` : biz.name}</h1>
      {premium && biz.tagline ? <p className="listing-intro">{biz.tagline}</p> : null}
      <TrustLine biz={biz} />
      {!premium && biz.featured ? <span className="listing-sponsored">Sponsored</span> : null}
      {basic && biz.citySlug === "reno" && !biz.ownerVerified ? (
        <p className="listing-note">
          <a href="#claim-listing">Is this your business? Claim it free</a>
        </p>
      ) : null}
    </div>
  );

  return (
    <SiteShell listing>
      <article
        className={`listing-page listing-${biz.contentTier}`}
        data-listing-tier={biz.contentTier}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }}
        />
        <div className="listing-breadcrumb-band">
          <nav className="listing-container listing-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">775Directory</Link>
            <span aria-hidden="true">›</span>
            <Link to="/categories/$slug" params={{ slug: biz.primaryCategorySlug }}>
              {biz.primaryCategory}
            </Link>
            <span aria-hidden="true">›</span>
            <Link to="/nv/$city" params={{ city: biz.citySlug }}>
              {biz.cityName}
            </Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{biz.name}</span>
          </nav>
        </div>
        {premium ? (
          <header className="listing-premium-hero">
            {biz.coverUrl && safeWebsite(biz.coverUrl) ? (
              <img className="listing-hero-photo" src={biz.coverUrl} alt="" />
            ) : null}
            <div className="listing-container listing-hero-inner">
              {heading}
              <ContactActions phone={biz.phone} website={biz.website} sponsored={biz.featured} />
            </div>
          </header>
        ) : null}
        <div className="listing-container listing-body">
          {!premium ? (
            <header className="listing-heading">
              {heading}
              <div className="listing-heading-actions">
                <span className="listing-tier-label">
                  {basic ? "Basic listing" : "Standard listing"}
                </span>
                <ContactActions phone={biz.phone} website={biz.website} sponsored={biz.featured} />
              </div>
            </header>
          ) : null}
          {biz.contentTier === "standard" ? (
            <ListingGallery photos={biz.photos} name={biz.name} variant="standard" />
          ) : null}
          <div className="listing-columns">
            <div className="listing-stack">
              {basic ? (
                <>
                  <Details biz={biz} basic />
                  <Hours biz={biz} />
                  <Claim biz={biz} />
                </>
              ) : premium ? (
                <PremiumContent biz={biz} />
              ) : (
                <>
                  <About biz={biz} />
                  <Services biz={biz} />
                  <Reviews biz={biz} />
                </>
              )}
              {!basic ? <CaseStudies biz={biz} /> : null}
              {!basic && biz.caseStudiesStatus === "unavailable" ? (
                <p className="listing-note">Project stories are temporarily unavailable.</p>
              ) : null}
            </div>
            <aside className="listing-stack" aria-label="Business information">
              {premium && biz.offer ? (
                <section className="listing-deal">
                  <p className="listing-eyebrow">Current offer</p>
                  <h2>{biz.offer.title}</h2>
                  <p>{biz.offer.details}</p>
                  {biz.offer.code ? <p>Mention {biz.offer.code} when booking.</p> : null}
                </section>
              ) : null}
              {basic ? (
                <>
                  <Location biz={biz} />
                  <Panel title="On this listing">
                    <ul className="listing-included">
                      <li>
                        <Check size={16} />
                        Contact & location
                      </li>
                      <li>
                        <Check size={16} />
                        Category & town search
                      </li>
                      <li>
                        <Check size={16} />
                        Always free to claim
                      </li>
                    </ul>
                    <p className="listing-note">
                      Listing content and owner verification are separate.
                    </p>
                  </Panel>
                  {biz.description ? <About biz={biz} /> : null}
                </>
              ) : (
                <>
                  <Details biz={biz} />
                  <Hours biz={biz} />
                  {premium ? (
                    <Panel title="Service area">
                      <p>{biz.cityName}, Nevada</p>
                      <Location biz={biz} />
                    </Panel>
                  ) : (
                    <Location biz={biz} />
                  )}
                  <Claim biz={biz} />
                </>
              )}
              {biz.citySlug === "reno" ? (
                <InquiryForm listingId={biz.sourceId} name={biz.name} />
              ) : null}
            </aside>
          </div>
          <p className="listing-verification-note">
            {biz.verified ? "Information checked. " : "Unverified information. "}Confirm current
            hours, availability and service details directly with the business.
          </p>
        </div>
      </article>
    </SiteShell>
  );
}
