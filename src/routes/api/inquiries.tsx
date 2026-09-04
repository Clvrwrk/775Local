import { createFileRoute } from "@tanstack/react-router";
import { handleInquiry } from "@/lib/directory/inquiry-handler.mjs";
export const Route = createFileRoute("/api/inquiries")({
  server: { handlers: { POST: ({ request }) => handleInquiry(request) } },
});
