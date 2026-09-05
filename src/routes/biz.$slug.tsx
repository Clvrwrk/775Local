import { createFileRoute, notFound } from "@tanstack/react-router";
import { ListingPage } from "@/components/directory/listing-page";
import { getBusiness } from "@/lib/directory/queries";

export const Route = createFileRoute("/biz/$slug")({
  loader: async ({ params }) => {
    const biz = await getBusiness({ data: params.slug });
    if (!biz) throw notFound();
    return { biz };
  },
  head: ({ loaderData, params }) => ({
    meta: loaderData?.biz
      ? [
          { title: `${loaderData.biz.name} | 775Directory` },
          ...(loaderData.biz.citySlug !== "reno"
            ? [{ name: "robots", content: "noindex, follow" }]
            : []),
          {
            name: "description",
            content:
              loaderData.biz.description ||
              `${loaderData.biz.primaryCategory} in ${loaderData.biz.cityName}, Nevada.`,
          },
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
