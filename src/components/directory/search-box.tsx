import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/brand/logo";
import type { City } from "@/lib/directory/types";

export function SearchBox({
  cities,
  defaultQ = "",
  defaultCity = "reno",
}: {
  cities: City[];
  defaultQ?: string;
  defaultCity?: string;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState(defaultQ);
  const [city, setCity] = useState(defaultCity === "reno" ? defaultCity : "reno");

  function go(e: React.FormEvent) {
    e.preventDefault();
    void navigate({
      to: "/search",
      search: { q: q.trim(), city: "reno", category: "" },
    });
  }

  return (
    <form onSubmit={go} className="w-full" role="search">
      <div className="flex items-center gap-2 rounded-full border border-line bg-card px-3 shadow-[0_8px_30px_rgba(28,26,22,0.08)] focus-within:border-teal focus-within:ring-2 focus-within:ring-teal">
        <BrandMark className="size-7" />
        <label className="sr-only" htmlFor="need">
          What do you need?
        </label>
        <input
          id="need"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What do you need?"
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus-visible:outline-none"
        />
        <button
          type="submit"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink hover:bg-gold-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
          aria-label="Search"
        >
          <Search className="size-4" />
        </button>
      </div>
      <select
        value={city}
        onChange={(e) => setCity(e.target.value)}
        aria-label="Town"
        className="mt-2 w-full bg-transparent text-center text-sm text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
      >
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}
