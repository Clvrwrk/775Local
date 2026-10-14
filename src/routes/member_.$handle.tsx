import { createFileRoute, notFound } from "@tanstack/react-router";
import { MemberProfileView } from "@/components/directory/member-profile";
import { SiteShell } from "@/components/layout/site-shell";
import { getPublicMember } from "@/lib/directory/members";

export const Route = createFileRoute("/member_/$handle")({
  loader: async ({ params }) => {
    const member = await getPublicMember({ data: params.handle });
    if (!member) throw notFound();
    return { member };
  },
  head: ({ loaderData, params }) => ({
    meta: loaderData?.member
      ? [
          { title: `${loaderData.member.displayName} | 775Directory` },
          {
            name: "description",
            content: `${loaderData.member.displayName} is a Local Member in ${loaderData.member.town}.`,
          },
          ...(loaderData.member.experiences.length
            ? []
            : [{ name: "robots", content: "noindex, nofollow" }]),
        ]
      : [{ name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "canonical", href: `https://775directory.com/member/${params.handle}` }],
  }),
  component: PublicMemberPage,
});

function PublicMemberPage() {
  const { member } = Route.useLoaderData();
  return (
    <SiteShell wash>
      <MemberProfileView profile={member} experiences={member.experiences} />
    </SiteShell>
  );
}
