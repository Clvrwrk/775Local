import { createFileRoute } from "@tanstack/react-router";
import { getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { isWorkosServerConfigured, safeReturnPath } from "@/lib/auth/policy.mjs";

export const Route = createFileRoute("/api/auth/sign-in")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isWorkosServerConfigured(process.env)) {
          const failed = new URL("/login", request.url);
          failed.searchParams.set("error", "not_configured");
          failed.searchParams.set(
            "next",
            safeReturnPath(new URL(request.url).searchParams.get("returnPathname")),
          );
          return Response.redirect(failed, 307);
        }
        const requested = new URL(request.url).searchParams.get("returnPathname");
        const returnPathname = safeReturnPath(requested);
        const url = await getSignInUrl({ data: { returnPathname, prompt: "login", maxAge: 0 } });
        return new Response(null, { status: 307, headers: { Location: url } });
      },
    },
  },
});
