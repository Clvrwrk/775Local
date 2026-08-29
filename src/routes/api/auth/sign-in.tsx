import { createFileRoute } from "@tanstack/react-router";
import { getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { isWorkosServerConfigured, safeReturnPath } from "@/lib/auth/policy.mjs";

export const Route = createFileRoute("/api/auth/sign-in")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isWorkosServerConfigured(process.env)) {
          return Response.redirect(new URL("/login?error=not_configured", request.url), 307);
        }
        const requested = new URL(request.url).searchParams.get("returnPathname");
        const returnPathname = safeReturnPath(requested);
        const url = await getSignInUrl({ data: { returnPathname } });
        return new Response(null, { status: 307, headers: { Location: url } });
      },
    },
  },
});
