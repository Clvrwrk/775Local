import { Link, useRouter } from "@tanstack/react-router";
import { Camera, CreditCard, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { domainMatchesListing, hostFromWebsite, isGenericEmail } from "@/lib/directory/domains";
import { claimListing } from "@/lib/directory/queries";

type ProofKind = "card" | "storefront" | "vehicle";

export function ClaimListingPanel({
  businessId,
  businessName,
  slug,
  claimedBy,
  website,
  listingEmail,
}: {
  businessId: number;
  businessName: string;
  slug: string;
  claimedBy: string | null;
  website: string;
  listingEmail: string;
}) {
  const { user } = useCurrentUserState();
  const router = useRouter();
  const [kind, setKind] = useState<ProofKind>("card");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [error, setError] = useState("");

  const email = user?.primaryEmail ?? "";
  const canSkip = useMemo(
    () => Boolean(email && domainMatchesListing(email, website, listingEmail)),
    [email, website, listingEmail],
  );
  const generic = email ? isGenericEmail(email) : true;
  const host = hostFromWebsite(website);

  if (claimedBy) {
    if (user && claimedBy === user.id) {
      return (
        <div className="mt-4 rounded-[24px] border border-line bg-card p-5">
          <p className="font-medium">You own this listing</p>
          <p className="mt-1 text-sm text-muted">
            Name, street, and phone are public NAP. Email stays private unless you publish it.
          </p>
          <Link to="/account" className="mt-3 inline-block text-sm font-medium text-sage hover:underline">
            Open account
          </Link>
        </div>
      );
    }
    return <p className="mt-4 text-xs text-muted">This listing is claimed by its owner.</p>;
  }

  const next = `/biz/${slug}`;

  function onFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError("");
    try {
      await claimListing({
        data: {
          businessId,
          method: canSkip ? "domain" : kind,
          filename: file?.name ?? "",
        },
      });
      setStatus("done");
      await router.invalidate();
    } catch (err) {
      setStatus("err");
      setError(err instanceof Error ? err.message : "Could not claim.");
    }
  }

  return (
    <div className="mt-4 rounded-[24px] border border-line bg-paper p-5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-sage">Unclaimed</p>
      <h3 className="mt-1 font-display text-xl font-semibold">Own {businessName}?</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Prefer Google or X. A work email that matches {host || "the shop website"} skips the photo.
        Gmail and other generic inboxes need a card or a quick pic in front of the store or rig.
      </p>
      {!user ? (
        <Link
          to="/login"
          search={{ next }}
          className="mt-4 inline-flex h-11 items-center rounded-[12px] bg-sage px-4 text-sm font-medium text-paper hover:bg-sage-2"
        >
          Sign in to claim
        </Link>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          {canSkip ? (
            <p className="rounded-[16px] border border-line bg-card px-3 py-2 text-sm text-ink-soft">
              {email} matches this listing’s domain. No card or storefront photo needed.
            </p>
          ) : (
            <>
              {generic ? (
                <p className="text-xs text-muted">
                  {email || "This inbox"} is generic — add proof so we know you’re the shop.
                </p>
              ) : (
                <p className="text-xs text-muted">
                  That domain doesn’t match {host || "the listed website"}. Add proof instead.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["card", "Business card", CreditCard],
                    ["storefront", "Storefront", Camera],
                    ["vehicle", "Service vehicle", Truck],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setKind(id)}
                    className={
                      kind === id
                        ? "flex min-h-16 flex-col items-center justify-center gap-1 rounded-[16px] bg-ink px-2 py-2 text-center text-xs font-medium text-paper"
                        : "flex min-h-16 flex-col items-center justify-center gap-1 rounded-[16px] border border-line bg-card px-2 py-2 text-center text-xs font-medium"
                    }
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`proof-${businessId}`}>Photo</Label>
                <input
                  id={`proof-${businessId}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="block w-full text-sm file:mr-3 file:h-11 file:rounded-[12px] file:border-0 file:bg-sage file:px-4 file:text-sm file:font-medium file:text-paper"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  required
                />
              </div>
              {preview ? (
                <img
                  src={preview}
                  alt="Proof preview"
                  className="h-32 w-full rounded-[16px] object-cover"
                />
              ) : null}
            </>
          )}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {status === "done" ? (
            <p className="text-sm text-sage">Claimed. Leads now come to you.</p>
          ) : (
            <Button type="submit" disabled={status === "saving" || (!canSkip && !file)}>
              {status === "saving" ? "Claiming…" : canSkip ? "Claim with work email" : "Submit proof & claim"}
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
