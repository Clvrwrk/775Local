import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { listingCover } from "@/lib/directory/covers";
import type { BusinessCard } from "@/lib/directory/types";
import { formatPhone } from "@/lib/utils";
import { Stars } from "./stars";

export function BusinessCardView({
  biz,
  variant = "sheet",
}: {
  biz: BusinessCard;
  variant?: "sheet" | "photo";
}) {
  const cover = biz.coverUrl || listingCover(biz.citySlug, biz.id);

  if (variant === "photo") {
    return (
      <Link
        to="/biz/$slug"
        params={{ slug: biz.slug }}
        className="group overflow-hidden rounded-[20px] bg-card shadow-[0_8px_24px_rgba(28,26,22,0.06)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={cover}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {biz.featured ? (
            <span className="absolute right-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[11px] font-medium text-ink">
              Featured
            </span>
          ) : null}
        </div>
        <div className="p-3.5">
          <h3 className="font-medium leading-snug text-ink">{biz.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted">
            {biz.tagline || `${biz.primaryCategory} in ${biz.cityName}`}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/biz/$slug"
      params={{ slug: biz.slug }}
      className="group relative block overflow-hidden rounded-[20px]"
    >
      <img src={cover} alt="" className="h-40 w-full object-cover sm:h-44" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
      {biz.featured ? (
        <span className="absolute right-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[11px] font-medium text-ink">
          Featured
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 p-4 text-paper">
        <p className="text-xs font-medium uppercase tracking-wide text-paper/80">
          {biz.primaryCategory || "Local"} · {biz.cityName}
        </p>
        <h3 className="mt-0.5 font-display text-2xl font-semibold leading-tight">{biz.name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-paper/85">
          {biz.rating != null ? <Stars rating={biz.rating} /> : null}
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {biz.street}
          </span>
          <span className="tabular-nums">{formatPhone(biz.phone)}</span>
        </div>
      </div>
    </Link>
  );
}
