import { useEffect, useRef, useState } from "react";
import { imageCommand, uploadImage, type BusinessImage } from "@/lib/directory/business-images";

function feedback(code: string) {
  const messages: Record<string, string> = {
    media_not_configured: "Image uploads are not enabled yet.",
    media_writer_not_configured:
      "Image publication is not available yet. This submission remains private.",
    authentication_required: "Sign in again to continue.",
    listing_access_forbidden: "Your current listing role does not allow image submissions.",
    reauth_required: "Sign in again as an authorized Operator before reviewing images.",
    review_forbidden: "Image review requires listing-review permission.",
    invalid_image:
      "Choose a valid, still JPEG, PNG or WebP image, at most 2 MB. Images must be at least 16 pixels per side.",
    media_limit_reached:
      "This small release supports one logo and three gallery images per listing, including pending submissions.",
    idempotency_conflict:
      "This retry differs from the original submission. Choose the file again to start a new submission.",
    review_incomplete: "Confirm publication rights and complete the image preview before approval.",
  };
  return (
    messages[code] ?? "The image action could not be confirmed. Retry to check its saved status."
  );
}
export function BusinessImagePanel({
  listingId,
  review = false,
}: {
  listingId?: string;
  review?: boolean;
}) {
  const [items, setItems] = useState<BusinessImage[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [resume, setResume] = useState<BusinessImage | null>(null);
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const activeAction = useRef(false);
  useEffect(() => {
    let active = true;
    setItems(null);
    setError("");
    setPreviews({});
    void imageCommand({
      data: review ? { action: "review" } : { action: "workspace", id: listingId },
    })
      .then((r) => {
        if (!active) return;
        if (r.ok && Array.isArray(r.receipt)) setItems(r.receipt);
        else if (!r.ok) setError(feedback(r.code));
      })
      .catch(() => {
        if (active) setError("Image status unavailable. Retry to confirm saved submissions.");
      });
    return () => {
      active = false;
    };
  }, [listingId, review, attempt]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeAction.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError(feedback("invalid_image"));
      return;
    }
    const fingerprint = JSON.stringify([
      file.name,
      file.size,
      file.lastModified,
      ...[...data].filter(([k]) => k !== "file"),
    ]);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, id: resume?.id ?? crypto.randomUUID() };
    data.set("id", pending.current.id);
    data.set("listingId", listingId ?? "");
    activeAction.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await uploadImage({ data });
      if (r.ok) {
        pending.current = null;
        setResume(null);
        form.reset();
        setMessage("Saved privately for Operator review. Your public listing has not changed.");
        setAttempt((x) => x + 1);
      } else setError(feedback(r.code));
    } catch {
      setError("Connection interrupted. Retry the same file to confirm this submission.");
    } finally {
      activeAction.current = false;
      setBusy(false);
    }
  }
  async function preview(id: string) {
    if (activeAction.current) return;
    activeAction.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await imageCommand({ data: { action: "preview", id } });
      if (r.ok && !Array.isArray(r.receipt) && r.receipt.dataUrl) {
        const dataUrl = r.receipt.dataUrl;
        setPreviews((p) => ({ ...p, [id]: dataUrl }));
      } else if (!r.ok) setError(feedback(r.code));
    } catch {
      setError("Preview unavailable. Retry before deciding.");
    } finally {
      activeAction.current = false;
      setBusy(false);
    }
  }
  async function decide(event: React.FormEvent<HTMLFormElement>, item: BusinessImage) {
    event.preventDefault();
    if (activeAction.current) return;
    const form = new FormData(event.currentTarget);
    const decision = form.get("decision");
    if (decision === "approved" && !previews[item.id]) {
      setError("Preview the image before approving it.");
      return;
    }
    activeAction.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await imageCommand({
        data: {
          action: "decide",
          id: item.id,
          decision,
          reason: form.get("reason"),
          rightsChecked: form.get("rightsChecked") === "true",
        },
      });
      if (r.ok) {
        setMessage(
          decision === "approved"
            ? "Image approved for this listing."
            : "Image rejected and marked for 30-day quarantine.",
        );
        setAttempt((x) => x + 1);
      } else setError(feedback(r.code));
    } catch {
      setError("Decision could not be confirmed. Retry the same decision to check its receipt.");
    } finally {
      activeAction.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={review ? "Business image review" : "Business images"}
      className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-6"
    >
      <h2 className="font-display text-2xl font-semibold">
        {review ? "Business image review" : "Business images"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        {review
          ? "Review at most five items at a time. Preview the image, verify publication rights, then record a decision. Logos remain separate from gallery photographs."
          : "Upload a business logo or gallery photograph that you own or are licensed to publish. Every submission stays private until Operator approval."}
      </p>
      {error ? (
        <div role="alert" className="mt-4">
          <p>{error}</p>
          <button
            className="action-secondary mt-2"
            disabled={busy}
            onClick={() => setAttempt((x) => x + 1)}
          >
            Reload image status
          </button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="mt-4 text-teal">
          {message}
        </p>
      ) : null}
      {items === null && !error ? (
        <p role="status" className="mt-4">
          Loading image status…
        </p>
      ) : null}
      {!review && items !== null ? (
        <form key={resume?.id ?? "new-image"} onSubmit={submit} className="mt-5 grid gap-4">
          {resume ? (
            <p role="status">
              Resuming saved upload. Select the same original file and confirm its publication
              rights.
            </p>
          ) : null}
          <label className="grid gap-2">
            Image purpose
            <select
              name="kind"
              aria-label="Image purpose"
              defaultValue={resume?.kind ?? "image"}
              className="rounded border p-2"
            >
              <option value="image">Gallery photograph</option>
              <option value="logo">Business logo</option>
            </select>
          </label>
          <label className="grid gap-2">
            Image file (JPEG, PNG or WebP; maximum 2 MB)
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={() => {
                pending.current = null;
              }}
            />
          </label>
          <label className="grid gap-2">
            Describe the image for visitors
            <input
              name="alt"
              defaultValue={resume?.alt ?? ""}
              required
              minLength={3}
              maxLength={200}
              className="rounded border p-2"
            />
          </label>
          <label className="grid gap-2">
            Publication rights
            <select
              name="rightsBasis"
              aria-label="Publication rights"
              defaultValue={resume?.rightsBasis ?? "owned"}
              className="rounded border p-2"
            >
              <option value="owned">Owned by this business</option>
              <option value="licensed">Licensed for directory publication</option>
            </select>
          </label>
          <label className="grid gap-2">
            Source and rights evidence
            <textarea
              name="source"
              defaultValue={resume?.source ?? ""}
              required
              minLength={3}
              maxLength={500}
              className="rounded border p-2"
            />
          </label>
          <label className="flex gap-2">
            <input name="rightsAttested" type="checkbox" value="true" required />I have authority to
            submit this image and permission for its public directory use.
          </label>
          <button className="action-primary justify-self-start" disabled={busy}>
            {busy ? "Saving image…" : "Submit image for review"}
          </button>
          {resume ? (
            <button
              type="button"
              className="action-secondary justify-self-start"
              disabled={busy}
              onClick={() => {
                setResume(null);
                pending.current = null;
              }}
            >
              Start a new image
            </button>
          ) : null}
        </form>
      ) : null}
      <div className="mt-5 grid gap-4">
        {items?.map((item) => (
          <article key={item.id} className="rounded-xl border border-line p-4">
            <p className="font-semibold">
              {item.listingName ? `${item.listingName} · ` : ""}
              {item.kind === "logo" ? "Business logo" : "Gallery photograph"} ·{" "}
              {item.status.replaceAll("_", " ")}
            </p>
            <p className="mt-2">{item.alt}</p>
            {item.reason ? <p className="mt-2 text-sm">{item.reason}</p> : null}
            {!review && item.status === "uploaded" ? (
              <button
                className="action-secondary mt-3"
                disabled={busy}
                onClick={() => {
                  setResume(item);
                  pending.current = null;
                  setError("");
                }}
              >
                Resume upload
              </button>
            ) : null}
            {review ? (
              <p className="mt-2 text-sm break-words">
                Rights: {item.rightsBasis}. Evidence: {item.source}
              </p>
            ) : null}
            <button
              className="action-secondary mt-3"
              disabled={busy || item.status === "uploaded"}
              onClick={() => preview(item.id)}
            >
              Preview image
            </button>
            {previews[item.id] ? (
              <img
                src={previews[item.id]}
                alt={item.alt}
                className="mt-3 max-h-64 max-w-full object-contain"
              />
            ) : null}
            {review ? (
              <form onSubmit={(e) => decide(e, item)} className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  Decision
                  <select name="decision" aria-label="Decision" className="rounded border p-2">
                    <option value="rejected">Reject</option>
                    <option value="approved" disabled={item.status !== "pending_review"}>
                      Approve
                    </option>
                  </select>
                </label>
                <label className="grid gap-2">
                  Review reason
                  <textarea
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                    className="rounded border p-2"
                  />
                </label>
                <label className="flex gap-2">
                  <input name="rightsChecked" type="checkbox" value="true" />I verified publication
                  rights and the image accurately represents this business.
                </label>
                <button className="action-primary justify-self-start" disabled={busy}>
                  Save image decision
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
      {items?.length === 0 ? (
        <p className="mt-4 text-muted">
          {review ? "No pending business images." : "No images submitted yet."}
        </p>
      ) : null}
    </section>
  );
}
