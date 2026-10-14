import { Link } from "@tanstack/react-router";
import { Stars } from "@/components/directory/stars";
import type { MemberExperience, MemberProfile } from "@/lib/directory/members";

export function formatMemberDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function MemberProfileView({
  profile,
  experiences,
}: {
  profile: MemberProfile;
  experiences: MemberExperience[];
}) {
  return (
    <section className="app-page px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Local Member</p>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="flex size-20 items-center justify-center rounded-full bg-pine font-display text-2xl text-paper"
          aria-hidden="true"
        >
          {initials(profile.displayName) || "775"}
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold">{profile.displayName}</h1>
          <p className="mt-1 text-muted">
            {profile.town} · Member since {formatMemberDay(profile.memberSince) || "today"}
          </p>
        </div>
      </div>
      {profile.bio ? <p className="mt-6 max-w-2xl leading-7">{profile.bio}</p> : null}
      <h2 className="mt-10 font-display text-2xl font-semibold">
        {experiences.length} {experiences.length === 1 ? "experience" : "experiences"}
      </h2>
      <div className="mt-4 grid gap-4">
        {experiences.length ? (
          experiences.map((experience) => (
            <article key={experience.reviewId} className="rounded-[24px] border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to="/biz/$slug"
                  params={{ slug: experience.listingSlug }}
                  className="font-semibold text-teal"
                >
                  {experience.listingName}
                </Link>
                <Stars rating={experience.rating} />
              </div>
              <p className="mt-1 text-sm text-muted">{formatMemberDay(experience.createdAt)}</p>
              <p className="mt-3 leading-7">{experience.body}</p>
              {experience.photos.length ? (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {experience.photos.map((photo) => (
                    <img
                      key={photo}
                      src={photo}
                      alt={`${profile.displayName} at ${experience.listingName}`}
                      className="aspect-square w-full rounded-2xl object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-[24px] border border-line bg-card p-5 text-muted">
            No public experiences yet.
          </p>
        )}
      </div>
    </section>
  );
}
