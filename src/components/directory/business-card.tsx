import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
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
  const tierLabel = `${biz.contentTier[0].toUpperCase()}${biz.contentTier.slice(1)}`;
  return (
    <Link
      to="/biz/$slug"
      params={{ slug: biz.slug }}
      className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-line bg-card shadow-[0_8px_24px_rgba(28,26,22,0.04)] hover:border-gold"
    >
      {biz.coverUrl ? (
        <div
          className={
            variant === "photo" ? "aspect-[4/3] overflow-hidden" : "aspect-[16/7] overflow-hidden"
          }
        >
          <img src={biz.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            {biz.primaryCategory || "Local"} · {biz.cityName}
          </p>
          <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold">
            {tierLabel}
          </span>
        </div>
        {biz.featured ? (
          <span className="mt-3 self-start rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold">
            Sponsored
          </span>
        ) : null}
        <h3 className="mt-3 font-display text-2xl font-semibold leading-tight">{biz.name}</h3>
        {biz.tagline ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{biz.tagline}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-soft">
          {biz.rating != null ? <Stars rating={biz.rating} /> : null}
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" strokeWidth={1.75} />
            {biz.street || biz.cityName}
          </span>
          {biz.phone ? <span className="tabular-nums">{formatPhone(biz.phone)}</span> : null}
        </div>
        <p className="mt-4 text-xs text-muted">
          {biz.ownerVerified ? "Owner verified" : "Unclaimed"} ·{" "}
          {biz.verified ? "Information checked" : "Unverified"}
        </p>
        <p className="mt-auto pt-5 text-sm font-semibold text-teal">
          View business details <span aria-hidden="true">→</span>
        </p>
      </div>
    </Link>
  );
}
