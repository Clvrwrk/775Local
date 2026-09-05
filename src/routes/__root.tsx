import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";
import { Link } from "@tanstack/react-router";
import { AuthKitProvider, getAuthAction } from "@workos/authkit-tanstack-react-start/client";
import { serializeStructuredData } from "@/lib/directory/structured-data.mjs";
import appCss from "../styles.css?url";

const APP_NAME = "775 Directory";
const SITE_URL = "https://775directory.com";
const SITE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: APP_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/brand/mark.svg`,
      areaServed: ["Reno, Nevada"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: APP_NAME,
      url: `${SITE_URL}/`,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
  ],
};

export const Route = createRootRoute({
  loader: async () => {
    try {
      return { auth: await getAuthAction() };
    } catch {
      return { auth: { user: null } as const };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Find reviewed local business listings in Reno, Nevada.",
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
  component: RootDocument,
});

function RootDocument() {
  const { auth } = Route.useLoaderData();
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(SITE_STRUCTURED_DATA) }}
        />
      </head>
      <body className="min-h-dvh bg-paper font-sans text-ink">
        <AuthKitProvider initialAuth={auth}>
          <Outlet />
        </AuthKitProvider>
        <Scripts />
      </body>
    </html>
  );
}
