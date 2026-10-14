import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  attachExperiencePhoto,
  getMyLocalMember,
  submitExperience,
} from "@/lib/directory/members";

const errors: Record<string, string> = {
  authentication_required: "Your session expired. Sign in again before sharing this experience.",
  profile_required: "Save a Local Member profile before sharing an experience.",
  invalid_experience: "Use 1 to 5 stars and at least 20 characters about what happened.",
  listing_not_reviewable: "This listing is not open for neighbor experiences.",
  idempotency_conflict: "That experience was already saved with different words. Refresh and try again.",
  photo_rejected: "A photo could not be saved. Use a smaller JPEG, PNG, or WebP.",
  connection_interrupted: "Connection interrupted. Retry to confirm this experience.",
  member_command_unavailable: "Neighbor experiences are not available yet.",
  member_command_failed: "The experience could not be saved. The listing was not changed.",
  experience_command_failed: "The experience could not be saved. The listing was not changed.",
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function toJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("photo");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob || blob.size > 900_000) throw new Error("photo");
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

async function photoBase64(file: File) {
  try {
    return await toJpeg(file);
  } catch {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 900_000 || file.size < 12) {
      throw new Error("photo");
    }
    return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
  }
}

export function ExperienceComposer({
  listingId,
  slug,
  businessName,
}: {
  listingId: string;
  slug: string;
  businessName: string;
}) {
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const next = `/biz/${slug}`;

  useEffect(() => {
    if (!user) {
      setProfileReady(null);
      return;
    }
    let active = true;
    void getMyLocalMember()
      .then((result) => {
        if (active) setProfileReady(Boolean(result.ok && result.member.profile));
      })
      .catch(() => {
        if (active) setProfileReady(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    const fingerprint = `${rating}|${body.trim()}|${files.length}`;
    if (pending.current?.fingerprint !== fingerprint) {
      pending.current = { fingerprint, key: `exp-${crypto.randomUUID()}` };
    }
    let result;
    try {
      result = await submitExperience({
        data: { listingId, rating, body, idempotencyKey: pending.current.key },
      });
    } catch {
      setStatus("idle");
      setError(errors.connection_interrupted);
      return;
    }
    if (!result.ok) {
      setStatus("idle");
      setError(errors[result.code] ?? errors.experience_command_failed);
      return;
    }
    const reviewId = result.experience.reviewId;
    let photoFailed = false;
    for (const [index, file] of files.slice(0, 4).entries()) {
      try {
        const imageBase64 = await photoBase64(file);
        const photo = await attachExperiencePhoto({ data: { reviewId, sort: index, imageBase64 } });
        if (!photo.ok) {
          photoFailed = true;
          break;
        }
      } catch {
        photoFailed = true;
        break;
      }
    }
    if (photoFailed) {
      setStatus("idle");
      setError(
        "Your words are on the listing. A photo could not be saved. Use a smaller JPEG, PNG, or WebP and publish again.",
      );
      await router.invalidate();
      return;
    }
    setStatus("saved");
    setFiles([]);
    await router.invalidate();
  }

  if (isPending) return <p className="listing-note">Checking your sign-in…</p>;
  if (!user) {
    return (
      <div className="mt-4">
        <Link to="/login" search={{ next, error: undefined }} className="action-primary">
          Sign in to share your experience
        </Link>
      </div>
    );
  }
  if (profileReady === null) return <p className="listing-note">Checking your Local Member profile…</p>;
  if (!profileReady) {
    return (
      <div className="mt-4">
        <p className="listing-note">
          Neighbors see your name, town, and photos on a Local Member profile. Your email stays off
          the page.
        </p>
        <Link to="/member" search={{ next }} className="action-primary mt-3">
          Create your Local Member profile
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="experience-form">
      <p className="text-sm font-medium">Share your experience at {businessName}</p>
      <div className="flex gap-1 text-gold" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-checked={rating === value}
            role="radio"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full"
            onClick={() => setRating(value)}
          >
            <Star
              className="size-6"
              fill={value <= rating ? "currentColor" : "none"}
              strokeWidth={1.75}
            />
            <span className="sr-only">{value} stars</span>
          </button>
        ))}
      </div>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        minLength={20}
        maxLength={2000}
        required
        placeholder="What happened, and would you send a neighbor here?"
      />
      <label className="text-sm">
        Photos of your experience
        <input
          className="mt-1 block w-full text-sm"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))}
        />
      </label>
      <p className="listing-note">Up to 4 photos. They publish with your name, not your email.</p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {status === "saved" ? (
        <p role="status" className="text-sm">
          Your experience is on this listing.
        </p>
      ) : null}
      <Button type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Publishing…" : "Publish experience"}
      </Button>
    </form>
  );
}
