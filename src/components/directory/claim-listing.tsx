import { Link } from "@tanstack/react-router";
import { Building2, CreditCard, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyListingClaim, submitListingClaim } from "@/lib/directory/claims";
import type { ClaimReceipt } from "@/lib/directory/claims";
import { domainMatchesListing, hostFromWebsite, isGenericEmail } from "@/lib/directory/domains";

type ProofKind = "document" | "storefront" | "vehicle";

const proofOptions = [
  ["document", "Business document", CreditCard],
  ["storefront", "Storefront", Building2],
  ["vehicle", "Service vehicle", Truck],
] as const;

function claimMessage(claim: ClaimReceipt) {
  if (claim.role) {
    const label = claim.role.replaceAll("_", " ");
    return {
      title: `Active ${label}`,
      body: "Your access is active. Listing authority and Lead Recipient status remain separately scoped.",
    };
  }
  switch (claim.status) {
    case "submitted":
      return {
        title: "Claim submitted",
        body: "Local775 will review the evidence. The Listing remains read-only and Leads are not routed to you yet.",
      };
    case "needs_evidence":
      return {
        title: "Evidence needed",
        body: "Your Claim is saved. Proof must be provided through the private review workflow before an Operator can approve it.",
      };
    case "approved":
      return {
        title: "Claim approved",
        body: "Your Business Owner participation is active. Lead delivery still requires a verified Lead Recipient.",
      };
    case "rejected":
      return {
        title: "Claim not approved",
        body: "The decision is retained for audit. Contact Local775 if you have different evidence.",
      };
    case "withdrawn":
      return { title: "Claim withdrawn", body: "This Claim no longer requests Listing authority." };
    default:
      return {
        title: "Claim started",
        body: "Complete the requested evidence to submit it for review.",
      };
  }
}

export function ClaimListingPanel({
  listingId,
  businessName,
  slug,
  ownerVerified,
  website,
  listingEmail,
}: {
  listingId: string;
  businessName: string;
  slug: string;
  ownerVerified: boolean;
  website: string;
  listingEmail: string;
}) {
  const { user } = useCurrentUserState();
  const [kind, setKind] = useState<ProofKind>("document");
  const [claim, setClaim] = useState<ClaimReceipt | null>(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "err">("idle");
  const [error, setError] = useState("");
  const [useProof, setUseProof] = useState(false);
  const pending = useRef<{ method: string; key: string } | null>(null);

  const email = user?.primaryEmail ?? "";
  const domainHint = useMemo(
    () => Boolean(email && domainMatchesListing(email, website, listingEmail)),
    [email, website, listingEmail],
  );
  const generic = email ? isGenericEmail(email) : true;
  const host = hostFromWebsite(website);

  useEffect(() => {
    if (!user) {
      setClaim(null);
      return;
    }
    let active = true;
    setChecking(true);
    void getMyListingClaim({ data: { listingId } })
      .then((result) => {
        if (!active) return;
        setChecking(false);
        if (result.ok) setClaim(result.receipt);
        else setError("Claim status could not be loaded. Retry before starting another claim.");
      })
      .catch(() => {
        if (active) {
          setChecking(false);
          setError("Connection interrupted while checking your claim.");
        }
      });
    return () => {
      active = false;
    };
  }, [listingId, user]);

  if (claim) {
    const message = claimMessage(claim);
    return (
      <div className="mt-4 rounded-[24px] border border-line bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-teal">Claim status</p>
        <p className="mt-1 font-medium">{message.title}</p>
        <p className="mt-1 text-sm text-muted">{message.body}</p>
        {claim.role && claim.role !== "lead_recipient" ? (
          <Link
            to="/studio/$slug"
            params={{ slug }}
            className="mt-3 inline-block text-sm font-medium text-teal hover:underline"
          >
            Open Studio
          </Link>
        ) : null}
      </div>
    );
  }

  if (ownerVerified && !checking) {
    return (
      <div className="mt-4 rounded-[24px] border border-line bg-card p-5">
        <p className="font-medium">Owner verified</p>
        <p className="mt-1 text-sm text-muted">
          Additional Business Owners, Listing Managers, and Agency Representatives join by a scoped
          invitation from an authorized participant or Local775 Operator.
        </p>
      </div>
    );
  }

  const next = `/biz/${slug}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError("");
    const method = domainHint && !useProof ? "business_domain" : kind;
    if (pending.current?.method !== method)
      pending.current = { method, key: `claim-${crypto.randomUUID()}` };
    let result;
    try {
      result = await submitListingClaim({
        data: {
          listingId,
          method,
          idempotencyKey: pending.current.key,
        },
      });
    } catch {
      setStatus("err");
      setError("Connection interrupted. Retry to confirm your claim without duplicating it.");
      return;
    }
    if (result.ok && result.receipt) {
      setClaim(result.receipt);
      pending.current = null;
      setStatus("idle");
      return;
    }
    setStatus("err");
    const code = result.ok ? "claim_command_failed" : result.code;
    setError(
      code === "domain_evidence_not_established"
        ? "That email domain could not establish authority. Choose another evidence path."
        : code === "invitation_required"
          ? "This Listing already has a verified owner. Ask an owner or Local775 Operator for an invitation."
          : code === "authentication_required"
            ? "Your session expired. Sign in again before submitting the Claim."
            : "The Claim could not be submitted. No Listing authority was changed.",
    );
  }

  return (
    <div className="mt-4 rounded-[24px] border border-line bg-paper p-5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-teal">Unclaimed</p>
      <h3 className="mt-1 font-display text-xl font-semibold">Own {businessName}?</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Sign in with Google or email. A work email matching {host || "the Business website"} is
        strong evidence, but an Operator still approves the Claim before any Listing authority is
        granted.
      </p>
      {!user ? (
        <Link to="/login" search={{ next, error: undefined }} className="action-primary mt-4">
          Sign in to claim
        </Link>
      ) : checking ? (
        <p className="mt-4 text-sm text-muted">Checking Claim status…</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          {domainHint && !useProof ? (
            <div>
              <p className="rounded-[16px] border border-line bg-card px-3 py-2 text-sm text-ink-soft">
                {email} appears to match this Listing’s domain. The server verifies that match again
                when you submit.
              </p>
              <button
                type="button"
                className="mt-2 min-h-11 text-sm font-semibold text-teal"
                onClick={() => setUseProof(true)}
              >
                Use other evidence instead
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted">
                {generic
                  ? `${email || "This inbox"} is a personal or generic inbox.`
                  : `That email domain does not match ${host || "the listed website"}.`}{" "}
                Choose the private evidence you can provide during review.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {proofOptions.map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setKind(id)}
                    aria-pressed={kind === id}
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
              <p className="text-xs text-muted">
                This step records the Claim and evidence type only. Sensitive files are accepted
                only through the private, retention-controlled proof workflow.
              </p>
            </>
          )}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving"
              ? "Submitting…"
              : domainHint && !useProof
                ? "Submit work-email Claim"
                : "Start Claim review"}
          </Button>
        </form>
      )}
    </div>
  );
}
