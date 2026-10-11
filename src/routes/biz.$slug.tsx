import { createFileRoute, notFound } from "@tanstack/react-router";
import { ListingPage } from "@/components/directory/listing-page";
import { getBusiness } from "@/lib/directory/queries";
import { getPublishedImages } from "@/lib/directory/business-images";
import { isManagedBusinessImageUrl } from "@/lib/directory/business-image-urls.mjs";

export const Route = createFileRoute("/biz/$slug")({
  loader: async ({ params }) => {
    const biz = await getBusiness({ data: params.slug });
    if (!biz) throw notFound();
    const businessImages = await getPublishedImages({ data: biz.sourceId });
    // The new workflow has its own reviewed projection and alt text. Avoid duplicate
    // legacy gallery entries and never treat its logo as a photograph.
    const photos = biz.photos.filter((p) => !isManagedBusinessImageUrl(p.url));
    return { biz: { ...biz, photos, businessImages } };
  },
  head: ({ loaderData, params }) => ({
    meta: loaderData?.biz
      ? [
          {
            title: `${loaderData.biz.name} — ${loaderData.biz.primaryCategory} in ${loaderData.biz.cityName}, NV | 775Directory`,
          },
          ...(loaderData.biz.citySlug !== "reno"
            ? [{ name: "robots", content: "noindex, follow" }]
            : []),
          {
            name: "description",
            content:
              loaderData.biz.description.slice(0, 160) ||
              `${loaderData.biz.primaryCategory} in ${loaderData.biz.cityName}, Nevada.`,
          },
          ...(loaderData.biz.businessImages[0]
            ? [
                { property: "og:image", content: loaderData.biz.businessImages[0].url },
                { property: "og:image:alt", content: loaderData.biz.businessImages[0].alt },
              ]
            : []),
        ]
      : [],
    links: [{ rel: "canonical", href: `https://775directory.com/biz/${params.slug}` }],
  }),
  component: BusinessPage,
});

function BusinessPage() {
  const { biz } = Route.useLoaderData();
  return <ListingPage biz={biz} />;
}
