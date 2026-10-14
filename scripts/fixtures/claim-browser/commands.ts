const claimId = "b2000000-0000-4000-8000-000000000001";
const challenge = "b3000000-0000-4000-8000-000000000001";
export async function getMyListingClaim() {
  return { ok: true, receipt: window.__fixture.claim ?? null };
}
export async function submitListingClaim({ data }) {
  window.__calls.push(data);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const receipt = {
    claim_id: claimId,
    status: "needs_evidence",
    method: data.method,
    requested_role: data.role,
    owner_authority: false,
    requires_evidence: true,
    challenge,
    challenge_expires_at: "2099-01-01T00:00:00.000Z",
  };
  window.__fixture.claim = receipt;
  return { ok: true, receipt };
}
export async function claimWorkflow({ data }) {
  if (data.action === "people") return { ok: true, receipt: { participants: [], invitations: [] } };
  window.__calls.push(data);
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (data.action === "evidence" && window.__fixture.interruptEvidence) {
    window.__fixture.interruptEvidence = false;
    throw Error("Synthetic interruption");
  }
  if (data.action === "evidence")
    window.__fixture.claim = {
      ...window.__fixture.claim,
      status: "submitted",
      evidence: [
        {
          id: "fixture-evidence",
          submitted_at: "2026-09-30",
          expires_at: "2099-01-01",
          reviewed: false,
        },
      ],
    };
  if (data.action === "withdraw")
    window.__fixture.claim = { ...window.__fixture.claim, status: "withdrawn" };
  if (data.action === "invitation")
    return {
      ok: true,
      receipt: {
        name: "Synthetic Reno Shop",
        city: "reno",
        role: "listing_manager",
        expires_at: "2099-01-01T00:00:00.000Z",
      },
    };
  return { ok: true, receipt: {} };
}
export async function decideListingClaim({ data }) {
  window.__calls.push(data);
  return { ok: false, code: "independent_authority_review_required" };
}
export async function pilotCommand({ data }) {
  if (data.action === "account")
    return {
      ok: true,
      receipt: {
        listings: window.__fixture.owner
          ? [
              {
                id: "b1000000-0000-4000-8000-000000000001",
                slug: "fixture-shop",
                name: "Synthetic Reno Shop",
                role: window.__fixture.role ?? "business_owner",
              },
            ]
          : [],
        claims: [],
        canReview: false,
      },
    };
  if (data.action === "workspace") {
    if (!window.__fixture.owner || data.id !== "b1000000-0000-4000-8000-000000000001")
      return { ok: false, code: "listing_access_forbidden" };
    return {
      ok: true,
      receipt: {
        role: window.__fixture.role ?? "business_owner",
        canEdit: window.__fixture.role !== "lead_recipient",
        editable: {
          name: "Synthetic Reno Shop",
          description: "Synthetic reviewed business description.",
          phone: "+17755550100",
          website: "https://fixture.example",
          baseVersion: "2026-09-30T00:00:00Z",
          services: ["Synthetic repair"],
        },
        proposals: JSON.parse(localStorage.getItem("fixture-proposals") ?? "[]"),
      },
    };
  }
  if (data.action === "propose") {
    window.__calls.push(data);
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (!window.__fixture.owner) return { ok: false, code: "listing_access_forbidden" };
    if (window.__fixture.interruptProposal) {
      window.__fixture.interruptProposal = false;
      throw Error("Synthetic interruption");
    }
    if (window.__fixture.staleProposal)
      return { ok: false, code: "listing_changed_since_proposal" };
    if (!data.phone.match(/^(\+1)?7755550100$/) || !data.website.startsWith("https://"))
      return { ok: false, code: "invalid_studio_command" };
    const proposals = JSON.parse(localStorage.getItem("fixture-proposals") ?? "[]");
    if (!proposals.some((p) => p.id === data.key))
      proposals.push({ id: data.key, status: "pending_review", payload: data });
    localStorage.setItem("fixture-proposals", JSON.stringify(proposals));
    return { ok: true, receipt: {} };
  }
  if (data.action === "requests")
    return { ok: true, receipt: window.__fixture.requestStatuses ?? [] };
  if (data.action === "requestReview")
    return {
      ok: true,
      receipt: {
        id: data.id,
        canPublish: !window.__fixture.reviewOnly,
        payload: {
          name: "Synthetic New Shop",
          description: "Synthetic home repair service.",
          categorySlug: "handyman",
          phone: "+17755550100",
          zip: "89502",
          website: "https://fixture.example",
        },
        categories: [{ slug: "handyman", name: "Handyman" }],
        scope: { requestHash: "a".repeat(64), duplicates: [] },
        duplicates: window.__fixture.duplicateRequest
          ? [
              {
                id: "duplicate",
                name: "Existing Synthetic Shop",
                slug: "fixture-shop",
                zip: "89502",
                status: "published",
              },
            ]
          : [],
      },
    };
  if (data.action === "decideRequest") {
    window.__calls.push(data);
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (window.__fixture.interruptRequestReview) {
      window.__fixture.interruptRequestReview = false;
      throw Error("Synthetic interruption");
    }
    return { ok: true, receipt: { status: data.decision.outcome } };
  }
  return {
    ok: true,
    receipt: {
      claims: [
        {
          id: claimId,
          name: "Synthetic Reno Shop",
          slug: "fixture-shop",
          method: "business_domain",
          claimantEmail: "manager@fixture.example",
          domainMatches: true,
          requestedRole: "listing_manager",
          status: "needs_evidence",
          readyForApproval: false,
        },
      ],
      proposals: [],
      requests: window.__fixture.reviewRequests
        ? [
            {
              id: "b4000000-0000-4000-8000-000000000001",
              createdAt: "2026-09-30",
              payload: {
                name: "Synthetic New Shop",
                description: "Synthetic home repair service.",
                categorySlug: "handyman",
                phone: "+17755550100",
                zip: "89502",
                website: "https://fixture.example",
              },
            },
          ]
        : [],
    },
  };
}
export async function createListing({ data }) {
  window.__calls.push(data);
  await new Promise((resolve) => setTimeout(resolve, 150));
  return {
    ok: true,
    receipt: { id: "synthetic-request", status: "pending_review", idempotent: false },
  };
}
export async function listCategories() {
  return [{ id: 1, slug: "handyman", name: "Handyman" }];
}
export async function getBusiness({ data }) {
  return {
    sourceId:
      data === "fixture-shop"
        ? "b1000000-0000-4000-8000-000000000001"
        : "b1000000-0000-4000-8000-000000000002",
    name: "Synthetic Reno Shop",
    slug: data,
  };
}
export async function personProfile({ data }) {
  const storage = `fixture-profile-${window.__fixture.actorId ?? "fixture-actor"}`;
  if (data.action === "get")
    return { ok: true, receipt: JSON.parse(localStorage.getItem(storage) ?? "null") };
  window.__calls.push(data);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const current = JSON.parse(localStorage.getItem(storage) ?? "null");
  if (current?.key !== data.key && (current?.version ?? 0) !== data.version)
    return { ok: false, code: "profile_changed" };
  if (current?.key !== data.key)
    localStorage.setItem(
      storage,
      JSON.stringify({
        displayName: data.displayName,
        city: data.city,
        bio: data.bio,
        version: data.version + 1,
        key: data.key,
      }),
    );
  if (window.__fixture.interruptProfile) {
    window.__fixture.interruptProfile = false;
    throw Error("Synthetic response lost after save");
  }
  return { ok: true, receipt: JSON.parse(localStorage.getItem(storage)) };
}
