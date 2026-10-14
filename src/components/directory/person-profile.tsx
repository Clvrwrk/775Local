import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { personProfile, type PersonProfile } from "@/lib/directory/profile";
import { retryIdentity } from "@/lib/directory/retry-key.mjs";

export function PersonProfileBuilder({ displayName }: { displayName: string | null }) {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const alive = useRef(true);
  const lock = useRef(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setError("");
    void personProfile({ data: { action: "get" } })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setProfile(result.receipt);
          setLoaded(true);
        } else setError("Your profile could not be loaded. Retry or sign in again.");
      })
      .catch(() => {
        if (active) setError("Connection interrupted. Retry loading your profile.");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const data = {
      action: "save",
      displayName: String(form.get("displayName")),
      city: String(form.get("city")),
      bio: String(form.get("bio")),
      version: profile?.version ?? 0,
    };
    pending.current = retryIdentity(pending.current, data, () => `profile-${crypto.randomUUID()}`);
    lock.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await personProfile({ data: { ...data, key: pending.current.key } });
      if (!alive.current) return;
      if (result.ok) {
        setProfile(result.receipt);
        pending.current = null;
        setMessage("Your private profile is saved.");
      } else {
        setError(
          result.code === "profile_changed"
            ? "Your profile changed in another session. Reload the current profile before editing again."
            : result.code === "invalid_profile"
              ? "Check your name, city and introduction. Keep your name between 2 and 100 characters and your introduction at most 500."
              : "Your save could not be confirmed. Retry the same details or sign in again.",
        );
      }
    } catch {
      if (alive.current)
        setError("Connection interrupted. Retry the same details to confirm your save.");
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  }
  return (
    <section className="mt-8 max-w-xl rounded-[24px] border border-line bg-card p-6">
      <h2 className="font-display text-2xl font-semibold">Your private profile</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Introduce yourself. These details are private to your account. Business listing access
        requires a separately approved claim or invitation.
      </p>
      {loaded ? (
        <form key={profile?.version ?? 0} onSubmit={save} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Display name
            <Input
              name="displayName"
              required
              minLength={2}
              maxLength={100}
              autoComplete="nickname"
              defaultValue={profile?.displayName ?? displayName ?? ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            City (optional)
            <select
              name="city"
              defaultValue={profile?.city ?? ""}
              className="min-h-11 rounded-lg border border-line bg-paper px-3"
            >
              <option value="">Prefer not to say</option>
              <option value="reno">Reno</option>
              <option value="sparks">Sparks</option>
              <option value="other">Another city</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Introduction (optional)
            <Textarea
              name="bio"
              maxLength={500}
              defaultValue={profile?.bio ?? ""}
              placeholder="Keep private contact details and identity documents out of your introduction."
            />
          </label>
          <button className="action-primary justify-self-start" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      ) : !error ? (
        <p role="status" className="mt-4">
          Loading your profile…
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="mt-4 text-sm leading-6 text-danger">
          <p>{error}</p>
          <button
            type="button"
            disabled={saving}
            className="action-secondary mt-3"
            onClick={() => {
              setMessage("");
              setAttempt((x) => x + 1);
            }}
          >
            Reload profile
          </button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="mt-4 text-sm text-teal">
          {message}
        </p>
      ) : null}
    </section>
  );
}
