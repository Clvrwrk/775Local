import { createFileRoute } from "@tanstack/react-router";
import { RoadmapContent } from "@/components/directory/roadmap";
import { SiteShell } from "@/components/layout/site-shell";
export const Route = createFileRoute("/roadmap")({
  validateSearch: (search: Record<string, unknown>): { kind: "feature" | "bug" } => ({
    kind: search.kind === "bug" ? "bug" : "feature",
  }),
  head: () => ({
    meta: [
      { title: "Roadmap and feedback | 775Directory" },
      {
        name: "description",
        content:
          "See the directory’s curated roadmap and send a feature request or bug report for private review.",
      },
    ],
    links: [{ rel: "canonical", href: "https://775directory.com/roadmap" }],
  }),
  component: RoadmapPage,
});
function RoadmapPage() {
  const { kind } = Route.useSearch();
  return (
    <SiteShell wash>
      <main className="app-page px-4 py-10 sm:px-6 sm:py-16">
        <RoadmapContent kind={kind} />
      </main>
    </SiteShell>
  );
}
