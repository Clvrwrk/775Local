import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { inquiryAvailability } from "@/lib/directory/inquiries";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}
export function InquiryForm({ listingId, name }: { listingId: string; name: string }) {
  const [siteKey, setSiteKey] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const element = useRef<HTMLDivElement>(null);
  const widget = useRef("");
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    void inquiryAvailability({ data: listingId })
      .then((result) => {
        if (active && result.available) setSiteKey(result.siteKey);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [listingId]);
  useEffect(() => {
    if (!siteKey) return;
    let active = true;
    function render() {
      if (active && element.current && window.turnstile && !widget.current)
        widget.current = window.turnstile.render(element.current, {
          sitekey: siteKey,
          action: "reno-inquiry",
          callback: setToken,
          "expired-callback": () => setToken(""),
          "error-callback": () => {
            setToken("");
            setError("Verification could not load. Please retry or contact the business directly.");
          },
        });
    }
    let script = document.querySelector<HTMLScriptElement>("script[data-inquiry-verification]");
    if (!script) {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.dataset.inquiryVerification = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    render();
    return () => {
      active = false;
      script?.removeEventListener("load", render);
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = "";
    };
  }, [siteKey]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const data = {
      listingId,
      name: String(fd.get("name")),
      email: String(fd.get("email")),
      phone: String(fd.get("phone")),
      zip: String(fd.get("zip")),
      message: String(fd.get("message")),
      company: String(fd.get("company") ?? ""),
      consent: fd.get("consent") === "on",
    };
    const fingerprint = JSON.stringify(data);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, key: pending.current.key, token }),
        signal: AbortSignal.timeout(25000),
      });
      const result = await response.json();
      if (response.status === 202 && result.status === "received" && typeof result.id === "string")
        setReceipt(result.id);
      else
        setError(
          result.error === "inquiry_rate_limited"
            ? "Too many requests from this email. Please try again later."
            : "Your request could not be confirmed. Retry or contact the business directly.",
        );
    } catch {
      setError("Connection interrupted. Retry to confirm the same request safely.");
    } finally {
      setBusy(false);
      setToken("");
      if (widget.current) window.turnstile?.reset(widget.current);
    }
  }
  if (!siteKey) return null;
  if (receipt)
    return (
      <section role="status" className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h3 className="font-display text-2xl font-semibold">Request received</h3>
        <p className="mt-2 text-sm leading-6">
          Your request is saved for {name}. Delivery and a response are not yet confirmed.
        </p>
        <p className="mt-3 break-all text-xs text-muted">Reference: {receipt}</p>
      </section>
    );
  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 border-t border-line pt-6">
      <h3 className="font-display text-2xl font-semibold">Ask about your project</h3>
      <p className="text-sm text-muted">
        Send a request to {name}’s verified recipient. For urgent help, call directly.
      </p>
      <label className="grid gap-2 text-sm font-medium">
        Your name
        <Input name="name" autoComplete="name" required minLength={2} maxLength={120} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Email
        <Input name="email" type="email" autoComplete="email" required maxLength={254} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Phone (optional)
        <Input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Reno ZIP code
        <Input
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="895[0-9]{2}"
          maxLength={5}
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        How can they help?
        <Textarea name="message" required minLength={10} maxLength={3000} />
      </label>
      <div aria-hidden="true" className="hidden">
        <input name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="flex items-start gap-3 text-sm leading-6">
        <input type="checkbox" name="consent" required className="mt-1 size-5 shrink-0" />
        <span>
          I agree to share this request and my contact details with {name} and its authorized
          recipient so they can respond. No marketing consent is included.{" "}
          <Link to="/privacy" className="font-semibold text-teal underline">
            Privacy policy
          </Link>
        </span>
      </label>
      <div ref={element} />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button className="action-primary" disabled={busy || !token}>
        {busy ? "Submitting…" : "Send request"}
      </button>
    </form>
  );
}
