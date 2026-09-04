import { createFileRoute } from "@tanstack/react-router";
import { fetchDirectoryListings } from "@/lib/supabase/public-directory.mjs";
import { renderSitemap } from "@/lib/directory/sitemap.mjs";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const listings = [];
          for (let page = 0; page < 100; page++) {
            const batch = await fetchDirectoryListings({
              filters: { city: "reno", limit: 100, offset: page * 100 },
            });
            listings.push(...batch);
            if (batch.length < 100)
              return new Response(renderSitemap(listings), {
                headers: {
                  "Content-Type": "application/xml; charset=utf-8",
                  "Cache-Control": "public, max-age=300, s-maxage=300",
                },
              });
          }
          throw new Error("sitemap_capacity_exceeded");
        } catch {
          return new Response("Sitemap temporarily unavailable", {
            status: 503,
            headers: { "Retry-After": "300", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
