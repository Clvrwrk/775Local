import type { BusinessDetail, CaseStudy } from "@/lib/directory/types";
import { cn } from "@/lib/utils";
import { safeWebsite } from "@/lib/directory/presentation.mjs";
import { Stars } from "./stars";

function BeforeAfter({ study, compact = false }: { study: CaseStudy; compact?: boolean }) {
  const pairs = (
    [
      ["Before", study.beforeUrl],
      ["After", study.afterUrl],
    ] as const
  ).filter(([, url]) => Boolean(safeWebsite(url)));
  if (!pairs.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {pairs.map(([label, url]) => (
        <figure
          key={label}
          className={cn(
            "relative overflow-hidden rounded-[14px] bg-paper-2",
            compact ? "aspect-square" : "aspect-[4/3]",
          )}
        >
          <img src={url} alt={`${label}: ${study.title}`} className="size-full object-cover" />
          <figcaption className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-paper">
            {label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Standard and Premium: the featured case study in full, the rest as cards. */
export function CaseStudies({ biz }: { biz: BusinessDetail }) {
  const [lead, ...rest] = biz.caseStudies;
  if (!lead) return null;
  const facts = [
    lead.projectType,
    lead.clientLocation,
    lead.completedOn ? `Completed ${lead.completedOn.slice(0, 7)}` : "",
    lead.investmentRange,
  ].filter(Boolean);
  return (
    <section className="mt-8 border-t border-line pt-8" aria-labelledby="projects-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="projects-heading" className="font-display text-3xl font-semibold">
          Projects
        </h2>
        {lead.featured ? (
          <span className="rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-semibold text-ink">
            Spotlight
          </span>
        ) : null}
      </div>
      <article className="mt-4 rounded-[20px] border border-line bg-card p-4 sm:p-5">
        <BeforeAfter study={lead} />
        <h3 className="mt-4 font-display text-2xl font-semibold leading-tight">{lead.title}</h3>
        {facts.length ? <p className="mt-1 text-xs text-muted">{facts.join(" · ")}</p> : null}
        {lead.summary ? (
          <p className="mt-2 text-sm leading-6 text-ink-soft">{lead.summary}</p>
        ) : null}
        <dl className="mt-4 grid gap-3 text-sm leading-6 text-ink-soft">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
              What they needed
            </dt>
            <dd className="mt-1">{lead.clientNeed}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
              What we did
            </dt>
            <dd className="mt-1">{lead.approach}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Results</dt>
            <dd className="mt-1">{lead.results}</dd>
          </div>
        </dl>
        {lead.metrics.length ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {lead.metrics.map((m) => (
              <div key={m.label} className="rounded-[14px] border border-line p-3">
                <p className="text-xs text-muted">{m.label}</p>
                <p className="mt-0.5 font-display text-xl font-semibold text-pine tabular-nums">
                  {m.before ? `${m.before} → ` : ""}
                  {m.after}
                  {m.unit ? ` ${m.unit}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {lead.testimonial ? (
          <blockquote className="mt-4 rounded-[16px] bg-gold/10 p-4">
            {lead.testimonial.rating != null ? <Stars rating={lead.testimonial.rating} /> : null}
            <p className="mt-2 text-sm leading-6 text-ink-soft">{lead.testimonial.quote}</p>
            <footer className="mt-2 text-xs text-muted">
              — {lead.testimonial.author}
              {lead.testimonial.role ? `, ${lead.testimonial.role}` : ""}
            </footer>
          </blockquote>
        ) : null}
      </article>
      {rest.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {rest.map((study) => (
            <article key={study.id} className="rounded-[20px] border border-line bg-card p-3">
              <BeforeAfter study={study} compact />
              <h3 className="mt-3 font-display text-xl font-semibold leading-tight">
                {study.title}
              </h3>
              {study.summary ? (
                <p className="mt-1 line-clamp-3 text-sm leading-5 text-muted">{study.summary}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
