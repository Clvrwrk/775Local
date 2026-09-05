import { Link } from "@tanstack/react-router";
import { BadgeCheck, Clock, MapPin } from "lucide-react";
import { listingCover } from "@/lib/directory/covers";
import type { BusinessCard, ListingPlan } from "@/lib/directory/types";
import { cn, formatPhone, mapsHref, telHref } from "@/lib/utils";
import { Stars } from "./stars";

/**
 * Card layout by plan: compact row for Free/Basic, photo left for Standard,
 * photo above for Premium. Pass `layout` to override (the homepage grid uses stack).
 */
export type CardLayout = "row" | "side" | "stack";

const LAYOUT_BY_PLAN: Record<ListingPlan, CardLayout> = {
  free: "row",
  basic: "row",
  standard: "side",
  premium: "stack",
};

function cardLayout(plan: ListingPlan | undefined): CardLayout {
  return LAYOUT_BY_PLAN[plan ?? "basic"];
}

const linkHit = "relative z-10 -my-1.5 inline-flex min-h-8 items-center gap-1 py-1.5 hover:text-teal hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine";

/** Tappable street (maps) and phone (tel) — sits above the card's stretched link. */
function ContactLinks({ biz, className }: { biz: BusinessCard; className?: string }) {
  const showStreet = !biz.hideStreet && biz.street && biz.street !== "Service area";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted", className)}>
      {showStreet ? (
        <a
          href={mapsHref({ street: biz.street, city: biz.cityName, zip: biz.zip })}
          target="_blank"
          rel="noopener noreferrer"
          className={linkHit}
        >
          <MapPin className="size-3.5" />
          {biz.street}
        </a>
      ) : (
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" />
          Serves {biz.cityName}
        </span>
      )}
      {biz.phone ? (
        <a href={telHref(biz.phone)} className={cn(linkHit, "tabular-nums")}>
          {formatPhone(biz.phone)}
        </a>
      ) : null}
    </div>
  );
}

function Eyebrow({ biz }: { biz: BusinessCard }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">
        {biz.primaryCategory || "Local"} · {biz.cityName}
      </p>
      {biz.ownerVerified ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
          <BadgeCheck className="size-3 text-teal" />
          Verified
        </span>
      ) : null}
    </div>
  );
}

function Rating({ biz }: { biz: BusinessCard }) {
  if (biz.rating == null) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-ink-soft">
      <Stars rating={biz.rating} />
      <span className="font-medium text-ink">{biz.rating.toFixed(1)}</span>
      {biz.reviewCount != null ? <span className="text-muted">({biz.reviewCount})</span> : null}
    </div>
  );
}

/** The whole card is the link, via a stretched pseudo-element on the title. */
function Title({ biz, className }: { biz: BusinessCard; className?: string }) {
  return (
    <h3 className={cn("font-display font-semibold leading-tight text-ink", className)}>
      <Link
        to="/biz/$slug"
        params={{ slug: biz.slug }}
        className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:[&]:text-teal"
      >
        {biz.name}
      </Link>
    </h3>
  );
}

function Sponsored() {
  return (
    <span className="absolute right-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[11px] font-semibold text-ink">
      Sponsored
    </span>
  );
}

const cardBase =
  "group relative overflow-hidden bg-card focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pine";

export function BusinessCardView({
  biz,
  layout,
}: {
  biz: BusinessCard;
  layout?: CardLayout;
}) {
  const cover = biz.coverUrl || listingCover(biz.citySlug, biz.id);
  const kind = layout ?? cardLayout(biz.plan);

  if (kind === "row") {
    return (
      <article className={cn(cardBase, "flex items-center gap-3.5 rounded-[16px] border border-line p-3")}>
        <div className="relative size-20 shrink-0 overflow-hidden rounded-[12px]">
          <img src={cover} alt="" className="size-full object-cover" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">
              {biz.primaryCategory || "Local"} · {biz.cityName}
            </p>
            {biz.featured ? (
              <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-ink">Sponsored</span>
            ) : null}
          </div>
          <Title biz={biz} className="text-xl" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <Rating biz={biz} />
            <ContactLinks biz={biz} />
          </div>
        </div>
      </article>
    );
  }

  if (kind === "side") {
    return (
      <article className={cn(cardBase, "flex min-h-52 rounded-[20px] shadow-[0_8px_24px_rgba(28,26,22,0.06)]")}>
        <div className="relative w-[38%] min-w-32 max-w-56 shrink-0 overflow-hidden">
          <img
            src={cover}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {biz.featured ? <Sponsored /> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-4">
          <Eyebrow biz={biz} />
          <Title biz={biz} className="text-2xl" />
          <p className="line-clamp-1 text-sm text-muted">
            {biz.tagline || `${biz.primaryCategory} in ${biz.cityName}`}
          </p>
          <Rating biz={biz} />
          <ContactLinks biz={biz} className="mt-1" />
        </div>
      </article>
    );
  }

  return (
    <article className={cn(cardBase, "flex flex-col rounded-[20px] shadow-[0_8px_24px_rgba(28,26,22,0.06)]")}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={cover}
          alt=""
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {biz.featured ? <Sponsored /> : null}
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <Eyebrow biz={biz} />
        <Title biz={biz} className="text-2xl" />
        <p className="line-clamp-2 text-sm text-muted">
          {biz.tagline || `${biz.primaryCategory} in ${biz.cityName}`}
        </p>
        <Rating biz={biz} />
        <ContactLinks biz={biz} className="mt-1" />
        {biz.hours ? (
          <p className="inline-flex items-center gap-1 text-xs text-muted">
            <Clock className="size-3.5" />
            {biz.hours}
          </p>
        ) : null}
      </div>
    </article>
  );
}
