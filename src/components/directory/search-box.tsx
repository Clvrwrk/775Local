import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { CircleMark } from "@/components/brand/mark";
import type { City } from "@/lib/directory/types";

export function SearchBox({
  cities,
  defaultQ = "",
  defaultCity = "",
}: {
  cities: City[];
  defaultQ?: string;
  defaultCity?: string;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState(defaultQ);
  const [city, setCity] = useState(defaultCity);

  function go(e: React.FormEvent) {
    e.preventDefault();
    void navigate({
      to: "/search",
      search: { q: q.trim(), city, category: "" },
    });
  }

  return (
    <form onSubmit={go} className="w-full">
      <div className="flex items-center gap-2 rounded-full border border-line bg-card px-3 shadow-[0_8px_30px_rgba(28,26,22,0.06)]">
        <CircleMark className="size-6 shrink-0 text-gold" />
        <label className="sr-only" htmlFor="need">
          What do you need?
        </label>
        <input
          id="need"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Discover your 775"
          className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus-visible:outline-none"
        />
        <button
          type="submit"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gold text-ink"
          aria-label="Search"
        >
          <Search className="size-4" />
        </button>
      </div>
      <select
        value={city}
        onChange={(e) => setCity(e.target.value)}
        aria-label="Town"
        className="mt-2 w-full bg-transparent text-center text-xs text-ink-soft focus-visible:outline-none"
      >
        <option value="">All towns in the 775</option>
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}
