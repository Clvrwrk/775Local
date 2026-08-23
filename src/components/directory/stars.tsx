import { Star } from "lucide-react";

export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5 text-gold" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="size-3.5"
          fill={i < full ? "currentColor" : "none"}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}
