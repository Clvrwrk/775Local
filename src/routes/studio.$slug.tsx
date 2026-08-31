import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, Building2, Megaphone, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyListingClaim } from "@/lib/directory/claims";
import type { ClaimReceipt } from "@/lib/directory/claims";
import { getBusiness } from "@/lib/directory/queries";

export const Route = createFileRoute("/studio/$slug")({
  head: () => ({
    meta: [
      { title: "Listing Studio | 775Directory" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async ({ params }) => {
    const business = await getBusiness({ data: params.slug });
    if (!business) throw notFound();
    return { business };
  },
  component: StudioPage,
});

type StudioRole = NonNullable<ClaimReceipt["role"]>;

const roleLabels: Record<StudioRole, string> = {
  operator: "Listing Admin",
  business_owner: "Business Owner",
  listing_manager: "Listing Manager",
  agency_representative: "Agency Representative",
  lead_recipient: "Lead Recipient",
};

const capabilities: Record<StudioRole, string[]> = {
  operator: [
    "Review Claims and protected identity changes",
    "Manage all Listing Participants and Lead Recipients",
    "Publish, suspend, restore, and reconcile integrations",
    "View delivery failures and audited operational evidence",
  ],
  business_owner: [
    "Propose protected identity changes and manage approved content",
    "Invite up to the remaining participant limits",
    "Manage Leads and designate verified Lead Recipients",
    "Request Featured activation and manage Offers",
  ],
  listing_manager: [
    "Manage approved Listing content, hours, media, and Offers",
    "Work assigned Leads and Lead Recipient settings",
    "Invite no Owners, Managers, Agencies, or Operators",
    "Propose—but never approve—protected identity changes",
  ],
  agency_representative: [
    "Propose approved marketing content and Offers",
    "Request Featured work without gaining ownership",
    "No participant administration or Lead PII by default",
    "Access can expire or be revoked independently",
  ],
  lead_recipient: [
    "Receive explicitly assigned Leads at verified destinations",
    "Update assigned Lead outcomes",
    "No Listing content, participant, payment, or Claim authority",
  ],
};

function StudioPage() {
  const { business } = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const [access, setAccess] = useState<ClaimReceipt | null | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setAccess(undefined);
      return;
    }
    let active = true;
    void getMyListingClaim({ data: { listingId: business.sourceId } }).then((result) => {
      if (active) setAccess(result.ok ? result.receipt : null);
    });
    return () => {
      active = false;
    };
  }, [business.sourceId, user]);

  if (isPending || (user && access === undefined)) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="h-10 w-48 animate-pulse rounded bg-paper-2" />
        </div>
      </SiteShell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const role = access?.role;
  if (!role) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="font-display text-3xl font-semibold">No active Listing access</h1>
          <p className="mt-2 text-sm text-muted">
            A pending Claim is read-only. Studio opens only after approved Listing Participation.
          </p>
          <Link
            to="/biz/$slug"
            params={{ slug: business.slug }}
            className="mt-4 inline-block font-semibold text-teal"
          >
            View Listing and Claim status
          </Link>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell wash>
      <section className="app-page px-4 pb-16 pt-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-2">
              Listing Studio · {roleLabels[role]}
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
              {business.name}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {business.cityName} · {business.primaryCategory}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-sage/20 px-4 py-2 text-sm font-semibold text-teal">
            <BadgeCheck className="size-4" /> {roleLabels[role]}
          </span>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <section
            className="rounded-[26px] border border-line bg-card p-6"
            aria-labelledby="access-heading"
          >
            <ShieldCheck className="size-5 text-teal" />
            <h2 id="access-heading" className="mt-3 font-display text-2xl font-semibold">
              Your scoped capabilities
            </h2>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-ink-soft">
              {capabilities[role].map((capability) => (
                <li key={capability} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-2"
                  />
                  {capability}
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded-[26px] border border-line bg-card p-6"
            aria-labelledby="team-heading"
          >
            <Users className="size-5 text-gold-2" />
            <h2 id="team-heading" className="mt-3 font-display text-2xl font-semibold">
              Participant limits
            </h2>
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt>Business Owners</dt>
                <dd className="font-semibold">up to 2</dd>
              </div>
              <div className="flex justify-between">
                <dt>Listing Managers</dt>
                <dd className="font-semibold">up to 3</dd>
              </div>
              <div className="flex justify-between">
                <dt>Agency Representatives</dt>
                <dd className="font-semibold">up to 3</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-muted">
              Limits are enforced by Supabase commands, not by this interface. Payment never adds a
              participant.
            </p>
          </section>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section className="rounded-[24px] border border-line bg-paper-2 p-5">
            <Building2 className="size-5 text-teal" />
            <h2 className="mt-3 font-display text-xl font-semibold">Listing management</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The role-filtered interface is active. Content, participant, and Lead command modules
              are the next implementation slices.
            </p>
          </section>
          <section className="rounded-[24px] border border-line bg-paper-2 p-5">
            <Megaphone className="size-5 text-gold-2" />
            <h2 className="mt-3 font-display text-xl font-semibold">GHL operations</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Supabase outbox events will project Contacts, Directory Listings, Listing
              Participations, and Lead Opportunities into the dedicated Local775 location.
            </p>
          </section>
        </div>

        <Link
          to="/biz/$slug"
          params={{ slug: business.slug }}
          className="mt-8 inline-block text-sm font-semibold text-teal hover:underline"
        >
          View public Listing
        </Link>
      </section>
    </SiteShell>
  );
}
