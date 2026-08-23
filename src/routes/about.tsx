import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">About 775 Directory</h1>
        <p className="mt-4 text-ink-soft">
          Northern Nevada is not an appendix of Las Vegas. Locals call this stretch the 775 — Reno
          and Tahoe on the California line, Elko and West Wendover on the Utah line, and every
          ranch town, basin, and I-80 exit in between.
        </p>
        <p className="mt-4 text-ink-soft">
          775 Directory is a business finder for that geography. We are not a newspaper. We list
          shops, capture quote requests, and let registered neighbors receive virtual or printed
          mail from businesses they actually might use.
        </p>
        <p className="mt-4 text-ink-soft">
          Search the way you’d tell a neighbor: “screen repair in Reno,” “HVAC in Carson,” “Basque
          dinner in Elko.” That’s the product.
        </p>
      </article>
    </SiteShell>
  );
}
