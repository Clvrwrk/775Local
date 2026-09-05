import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Image } from "lucide-react";
import type { ListingPhoto } from "@/lib/directory/types";
import { safeWebsite } from "@/lib/directory/presentation.mjs";

export function ListingGallery({
  photos,
  name,
  variant,
}: {
  photos: ListingPhoto[];
  name: string;
  variant: "standard" | "premium";
}) {
  const [active, setActive] = useState<number | null>(null);
  const usable = photos.filter((photo) => safeWebsite(photo.url));
  if (!usable.length)
    return (
      <div className={`listing-gallery-empty listing-gallery-${variant}`}>
        <Image size={28} strokeWidth={1.75} />
        <p>Business photos have not been added yet.</p>
      </div>
    );
  const current = active === null ? undefined : usable[active];
  const count = variant === "standard" ? 5 : 3;
  return (
    <>
      <div
        className={`listing-gallery listing-gallery-${variant}`}
        data-photo-count={Math.min(usable.length, count)}
      >
        {usable.slice(0, count).map((photo, i) => (
          <button
            type="button"
            key={photo.id}
            onClick={() => setActive(i)}
            aria-label={`Open photo ${i + 1} of ${usable.length} for ${name}`}
          >
            <img src={photo.url} alt={photo.caption || `${name}, photo ${i + 1}`} loading="lazy" />
            {i === count - 1 && usable.length > count ? (
              <span>+ {usable.length - count} more photos</span>
            ) : null}
          </button>
        ))}
      </div>
      {active !== null && current ? (
        <div className="listing-photo-viewer" role="region" aria-label="Selected business photo">
          <button
            type="button"
            onClick={() => setActive(null)}
            className="listing-photo-close"
            aria-label="Close selected photo"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
          <img src={current.url} alt={current.caption || `${name}, photo ${active + 1}`} />
          <div>
            <button
              type="button"
              disabled={active === 0}
              onClick={() => setActive(active - 1)}
              aria-label="Previous photo"
            >
              <ChevronLeft strokeWidth={1.75} />
            </button>
            <p>
              {active + 1} of {usable.length}
            </p>
            <button
              type="button"
              disabled={active === usable.length - 1}
              onClick={() => setActive(active + 1)}
              aria-label="Next photo"
            >
              <ChevronRight strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
