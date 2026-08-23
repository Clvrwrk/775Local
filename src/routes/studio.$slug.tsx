import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addListingPhoto,
  deleteListingPhoto,
  getOwnerOffer,
  listOwnerPhotos,
  photoCap,
  saveOffer,
  setFeaturedPackage,
} from "@/lib/directory/package";
import { getBusiness } from "@/lib/directory/queries";
import type { ListingPhoto, Offer } from "@/lib/directory/types";

export const Route = createFileRoute("/studio/$slug")({
  loader: async ({ params }) => {
    const biz = await getBusiness({ data: params.slug });
    if (!biz) throw notFound();
    return { biz };
  },
  component: StudioPage,
});

function StudioPage() {
  const { biz } = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="h-10 w-48 animate-pulse rounded bg-paper-2" />
        </div>
      </SiteShell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (biz.claimedBy !== user.id) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="font-display text-3xl font-semibold">Not your listing</h1>
          <p className="mt-2 text-sm text-muted">Claim it first, then the studio opens.</p>
          <Link to="/biz/$slug" params={{ slug: biz.slug }} className="mt-4 inline-block text-teal">
            View listing
          </Link>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell wash>
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-2">Owner studio</p>
        <h1 className="mt-1 font-display text-4xl font-semibold">{biz.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {biz.cityName} · {biz.primaryCategory}
        </p>
        <div className="mt-8 grid gap-8">
          <FeaturedPanel businessId={biz.id} initial={biz.featured} />
          <GalleryPanel businessId={biz.id} featured={biz.featured} />
          <OfferPanel businessId={biz.id} featured={biz.featured} />
        </div>
        <p className="mt-8 text-sm">
          <Link to="/biz/$slug" params={{ slug: biz.slug }} className="text-teal hover:underline">
            View public listing
          </Link>
        </p>
      </section>
    </SiteShell>
  );
}

function FeaturedPanel({ businessId, initial }: { businessId: number; initial: boolean }) {
  const [featured, setFeatured] = useState(initial);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const res = await setFeaturedPackage({ data: { businessId, featured: !featured } });
      setFeatured(res.featured);
      setStatus(res.featured ? "Featured package is on." : "Back to a claimed listing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update Featured.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-line bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-2">Featured package</p>
      <h2 className="mt-1 font-display text-2xl font-semibold">
        {featured ? "You’re Featured" : "Claimed listing"}
      </h2>
      <ul className="mt-3 grid gap-1.5 text-sm text-ink-soft">
        <li>Rank first on this town × service page</li>
        <li>{featured ? "12" : "6"} photos on the listing{featured ? "" : " (12 when Featured)"}</li>
        <li>One coupon on the listing{featured ? " + ZIP mail insert" : ". Mail insert is Featured-only"}</li>
        <li>Homepage Featured row</li>
      </ul>
      <p className="mt-3 text-xs text-muted">
        One Featured shop per category per town (two in Reno and Sparks).
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {status ? <p className="mt-2 text-sm text-teal">{status}</p> : null}
      <Button className="mt-4" type="button" onClick={() => void toggle()} disabled={saving}>
        {saving ? "Saving…" : featured ? "Turn Featured off" : "Activate Featured"}
      </Button>
    </div>
  );
}

function GalleryPanel({ businessId, featured }: { businessId: number; featured: boolean }) {
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [cap, setCap] = useState(photoCap(featured));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listOwnerPhotos({ data: businessId }).then((r) => {
      setPhotos(r.photos);
      setCap(r.cap);
    });
  }, [businessId]);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await readDataUrl(file);
      const photo = await addListingPhoto({
        data: { businessId, dataUrl, caption: file.name.replace(/\.[^.]+$/, "").slice(0, 80) },
      });
      setPhotos((p) => [...p, photo]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add photo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    await deleteListingPhoto({ data: { businessId, photoId: id } });
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="rounded-[24px] border border-line bg-card p-5">
      <h2 className="font-display text-2xl font-semibold">Photos</h2>
      <p className="mt-1 text-sm text-muted">
        Real jobs, trucks, storefronts. {photos.length} of {cap}. First photo is the cover.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p) => (
          <figure key={p.id} className="relative overflow-hidden rounded-[14px]">
            <img src={p.url} alt={p.caption} className="aspect-square w-full object-cover" />
            <button
              type="button"
              onClick={() => void remove(p.id)}
              className="absolute right-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] text-paper"
            >
              Remove
            </button>
          </figure>
        ))}
      </div>
      <label className="mt-4 inline-flex h-11 cursor-pointer items-center rounded-full bg-gold px-4 text-sm font-medium text-ink">
        {busy ? "Adding…" : "Add photo"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy || photos.length >= cap}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function OfferPanel({ businessId, featured }: { businessId: number; featured: boolean }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [code, setCode] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getOwnerOffer({ data: businessId }).then((r) => {
      if (!r.offer) return;
      setOffer(r.offer);
      setTitle(r.offer.title);
      setDetails(r.offer.details);
      setCode(r.offer.code);
      setExpiresOn((r.offer.expiresOn ?? "").slice(0, 10));
      setActive(r.offer.active);
    });
  }, [businessId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await saveOffer({ data: { businessId, title, details, code, expiresOn, active } });
      setStatus("Offer saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save offer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-[24px] border border-line bg-card p-5">
      <h2 className="font-display text-2xl font-semibold">Coupon / offer</h2>
      <p className="text-sm text-muted">
        One active offer per shop. {featured ? "Featured drops this into ZIP mail." : "On the listing now. Featured adds the mail insert."}
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="$25 off pet-mesh recut" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="details">Details</Label>
        <Textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="code">Code</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAT775" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="expires">Expires</Label>
          <Input id="expires" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active on the listing
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {status ? <p className="text-sm text-teal">{status}</p> : null}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : offer ? "Update offer" : "Publish offer"}
      </Button>
    </form>
  );
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}
