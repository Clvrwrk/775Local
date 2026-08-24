import { createFileRoute } from "@tanstack/react-router";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";
import { syncWorkosActor } from "@/lib/supabase/identity.server";

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: handleCallbackRoute({
        errorRedirectUrl: "/login?error=auth_failed",
        onSuccess: async ({ user }) => {
          await syncWorkosActor(user);
        },
      }),
    },
  },
});
