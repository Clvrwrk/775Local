import { Images } from "lucide-react";
import { useState } from "react";
import type { ListingPhoto } from "@/lib/directory/types";

export function PhotoGallery({
  photos,
  name,
  showCount = false,
}: {
  photos: ListingPhoto[];
  name: string;
  showCount?: boolean;
}) {
  const [active, setActive] = useState(0);
  if (!photos.length) return null;
  const current = photos[active] ?? photos[0]!;

  return (
    <div className="overflow-hidden rounded-[20px] bg-card">
      <div className="relative">
        <img
          src={current.url}
          alt={current.caption || name}
          className="aspect-[16/10] w-full object-cover"
        />
        {showCount && photos.length > 1 ? (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-ink/65 px-3 py-1.5 text-xs font-medium text-paper backdrop-blur-sm">
            <Images className="size-3.5" />
            {photos.length} photos
          </span>
        ) : null}
      </div>
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
