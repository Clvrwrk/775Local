import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";
import { Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";

const APP_NAME = "775 Directory";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Find trusted local businesses across the 775, from the California border to West Wendover.",
      },
      { name: "theme-color", content: "#1C3B34" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold">Not in the 775 — yet</h1>
        <p className="mt-3 text-sm text-muted">That page doesn’t exist. Try a town or a service.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-sage hover:underline">
          Back to the directory
        </Link>
      </div>
    </SiteShell>
  ),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-paper font-sans text-ink">
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
});
