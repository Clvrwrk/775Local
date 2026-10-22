import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

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
  variant = "standard",
}: {
  slots: GallerySlot[];
  more?: GallerySlot[];
  name: string;
  variant?: "standard" | "premium";
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const galleryRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const premium = variant === "premium";
  const viewer = premium
    ? [...slots, ...more].filter((slot) => !slot.template && !failedUrls.has(slot.url))
    : [...slots, ...more];
  const visible = premium ? viewer.slice(0, 4) : slots;
  const additional = premium ? viewer.length - visible.length : more.length;
  const active = viewer.findIndex((slot) => slot.id === activeId);
  const current = viewer[active];

  useEffect(() => {
    if (activeId !== null) viewerRef.current?.focus();
  }, [activeId]);

  function close() {
    setActiveId(null);
    restoreGalleryFocus();
  }

  function restoreGalleryFocus() {
    if (openerRef.current?.isConnected) {
      openerRef.current.focus();
      return;
    }
    const next = galleryRef.current?.querySelector("button");
    if (next) next.focus();
    else galleryRef.current?.focus();
  }

  function photoFailed(url: string) {
    setFailedUrls((previous) => new Set([...previous, url]));
    if (current?.url === url) {
      setActiveId(null);
      requestAnimationFrame(restoreGalleryFocus);
    }
  }

  return (
    <>
      {premium && visible.length === 0 ? (
        <div
          className="listing-gallery-empty listing-premium-no-photos"
          ref={galleryRef}
          tabIndex={-1}
        >
          <ImageOff size={34} strokeWidth={1.2} aria-hidden="true" />
          <h2>Business photos</h2>
          <p>No business photos are available for {name}.</p>
        </div>
      ) : (
        <div
          ref={galleryRef}
          className={`listing-gallery listing-gallery-${variant}`}
          data-photo-count={visible.length}
          tabIndex={-1}
        >
          {visible.map((slot, i) => (
            <button
              type="button"
              key={slot.id}
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setActiveId(slot.id);
              }}
              aria-label={`Open photo ${i + 1} of ${viewer.length} for ${name}`}
            >
              <img
                className="listing-media-img"
                src={slot.url}
                alt={slot.alt}
                loading={premium && i === 0 ? "eager" : "lazy"}
                decoding="async"
                onError={premium ? () => photoFailed(slot.url) : undefined}
              />
              {slot.template ? <TemplatePill /> : null}
              {i === visible.length - 1 && additional > 0 ? (
                <span className="listing-gallery-more">+ {additional} more photos</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
      {current ? (
        <div
          ref={viewerRef}
          className="listing-photo-viewer"
          role="region"
          aria-label="Selected business photo"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "ArrowLeft" && active > 0) {
              event.preventDefault();
              setActiveId(viewer[active - 1].id);
            } else if (event.key === "ArrowRight" && active < viewer.length - 1) {
              event.preventDefault();
              setActiveId(viewer[active + 1].id);
            }
          }}
        >
          <button
            type="button"
            onClick={close}
            className="listing-photo-close"
            aria-label="Close selected photo"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
          <div className="listing-photo-frame">
            <img
              className="listing-media-img"
              src={current.url}
              alt={current.alt}
              onError={premium ? () => photoFailed(current.url) : undefined}
            />
            {current.template ? <TemplatePill /> : null}
          </div>
          <div className="listing-photo-controls">
            <button
              type="button"
              disabled={active === 0}
              onClick={() => setActiveId(viewer[active - 1].id)}
              aria-label="Previous photo"
            >
              <ChevronLeft strokeWidth={1.75} />
            </button>
            <p aria-live="polite">
              {active + 1} of {viewer.length}
            </p>
            <button
              type="button"
              disabled={active === viewer.length - 1}
              onClick={() => setActiveId(viewer[active + 1].id)}
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
