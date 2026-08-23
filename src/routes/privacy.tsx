import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Quote requests are sent to the business you chose. Mail registrations are used only to
          target neighborhood campaigns you opted into. We do not sell 775 household lists to
          national brokers. Sign-in is handled by Google or X through this app’s account system.
        </p>
      </article>
    </SiteShell>
  );
}
