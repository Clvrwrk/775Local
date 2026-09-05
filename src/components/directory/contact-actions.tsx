import { ArrowUpRight, Phone } from "lucide-react";
import { telephoneHref, safeWebsite } from "@/lib/directory/presentation.mjs";
import { formatPhone } from "@/lib/utils";

export function ContactActions({
  phone,
  website,
  sponsored = false,
}: {
  phone: string;
  website: string;
  sponsored?: boolean;
}) {
  const telephone = telephoneHref(phone);
  const destination = safeWebsite(website);
  return (
    <div className="flex flex-wrap gap-3" aria-label="Contact this business">
      {telephone ? (
        <a href={telephone} className="action-primary">
          <Phone className="size-4" strokeWidth={1.75} />
          Call {formatPhone(phone)}
        </a>
      ) : null}
      {destination ? (
        <a
          href={destination}
          target="_blank"
          rel={sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer"}
          className={telephone ? "action-secondary" : "action-primary"}
        >
          Visit website
          <ArrowUpRight className="size-4" strokeWidth={1.75} />
        </a>
      ) : null}
      {!telephone && !destination ? (
        <p className="text-sm text-muted">Contact details are being checked. Please check back.</p>
      ) : null}
    </div>
  );
}
