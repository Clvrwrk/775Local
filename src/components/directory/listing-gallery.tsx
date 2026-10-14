import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export type GallerySlot = {
  id: string;
  url: string;
  alt: string;
  template: boolean;
};

function TemplatePill() {
  return <span className="listing-template-pill">Template</span>;
}

export function ListingGallery({
  slots,
  more = [],
  name,
}: {
  slots: GallerySlot[];
  more?: GallerySlot[];
  name: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const viewer = [...slots, ...more];
  const current = active === null ? undefined : viewer[active];
  return (
    <>
      <div
        className="listing-gallery listing-gallery-standard"
        data-photo-count={slots.length}
      >
        {slots.map((slot, i) => (
          <button
            type="button"
            key={slot.id}
            onClick={() => setActive(i)}
            aria-label={`Open photo ${i + 1} of ${viewer.length} for ${name}`}
          >
            <img src={slot.url} alt={slot.alt} loading="lazy" />
            {slot.template ? <TemplatePill /> : null}
            {i === slots.length - 1 && more.length > 0 ? (
              <span className="listing-gallery-more">+ {more.length} more photos</span>
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
          <div className="listing-photo-frame">
            <img src={current.url} alt={current.alt} />
            {current.template ? <TemplatePill /> : null}
          </div>
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
              {active + 1} of {viewer.length}
            </p>
            <button
              type="button"
              disabled={active === viewer.length - 1}
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
