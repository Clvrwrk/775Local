import { useState } from "react";
import type { ListingPhoto } from "@/lib/directory/types";

export function PhotoGallery({ photos, name }: { photos: ListingPhoto[]; name: string }) {
  const [active, setActive] = useState(0);
  if (!photos.length) return null;
  const current = photos[active] ?? photos[0]!;

  return (
    <div className="overflow-hidden rounded-[20px] bg-card">
      <img
        src={current.url}
        alt={current.caption || name}
        className="aspect-[16/10] w-full object-cover"
      />
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto p-3">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(i)}
              className={
                i === active
                  ? "h-16 w-20 shrink-0 overflow-hidden rounded-[10px] ring-2 ring-gold"
                  : "h-16 w-20 shrink-0 overflow-hidden rounded-[10px] opacity-70"
              }
            >
              <img src={p.url} alt={p.caption || ""} className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
