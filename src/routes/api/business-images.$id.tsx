import { createFileRoute } from "@tanstack/react-router";
import { serveBusinessImage } from "@/lib/supabase/business-image-commands.mjs";
export const Route = createFileRoute("/api/business-images/$id")({
  server: { handlers: { GET: ({ params }) => serveBusinessImage(params.id) } },
});
