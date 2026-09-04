import { createHmac } from "node:crypto";
import { telephoneHref } from "./presentation.mjs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** @param {unknown} input */
export function inquiryPayload(input) {
  const d = /** @type {Record<string, unknown>} */ (input);
  if (
    !d ||
    typeof d !== "object" ||
    typeof d.listingId !== "string" ||
    !uuid.test(d.listingId) ||
    typeof d.key !== "string" ||
    !uuid.test(d.key) ||
    d.consent !== true ||
    typeof d.name !== "string" ||
    d.name.trim().length < 2 ||
    d.name.length > 120 ||
    typeof d.message !== "string" ||
    d.message.trim().length < 10 ||
    d.message.length > 3000 ||
    typeof d.email !== "string" ||
    d.email.length > 254 ||
    !/^[^@\s]{1,64}@[^@\s]+\.[a-z]{2,}$/i.test(d.email) ||
    typeof d.zip !== "string" ||
    !/^895\d{2}$/.test(d.zip) ||
    typeof d.token !== "string" ||
    !d.token ||
    d.token.length > 2048 ||
    d.company
  )
    throw new Error("invalid_inquiry");
  const phone = d.phone ? telephoneHref(d.phone)?.slice(4) : "";
  if (phone === undefined || (phone && !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone)))
    throw new Error("invalid_inquiry");
  return {
    listingId: d.listingId,
    key: d.key,
    token: d.token,
    payload: {
      name: d.name.trim(),
      email: d.email.toLowerCase(),
      phone,
      zip: d.zip,
      message: d.message.trim(),
      consent: true,
    },
  };
}
/** @param {NodeJS.ProcessEnv} env */
export function inquiriesConfigured(env) {
  return (
    env.LOCAL775_INQUIRIES_ENABLED === "true" &&
    Boolean(
      env.TURNSTILE_SECRET_KEY &&
      env.TURNSTILE_SITE_KEY &&
      env.INQUIRY_ABUSE_SECRET &&
      env.SUPABASE_SERVICE_ROLE_KEY &&
      /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL ?? "") &&
      /^https:\/\/[a-z0-9.-]+$/.test(env.LOCAL775_PUBLIC_ORIGIN ?? ""),
    )
  );
}
/** @param {unknown} value @param {number} status */
function reply(value, status) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
/** @param {Request} request @param {{env?:NodeJS.ProcessEnv, fetchImpl?:typeof fetch}} [options] */
export async function handleInquiry(request, { env = process.env, fetchImpl = fetch } = {}) {
  if (!inquiriesConfigured(env)) return reply({ error: "inquiries_unavailable" }, 503);
  if (request.headers.get("origin") !== env.LOCAL775_PUBLIC_ORIGIN)
    return reply({ error: "origin_forbidden" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "invalid_inquiry" }, 415);
  let command;
  try {
    // Bound actual body bytes, including requests that omit Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("body_required");
    let bytes = 0;
    let text = "";
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 16000) {
        await reader.cancel();
        return reply({ error: "request_too_large" }, 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    command = inquiryPayload(JSON.parse(text + decoder.decode()));
  } catch {
    return reply({ error: "invalid_inquiry" }, 400);
  }
  try {
    const challenge = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: command.token,
        idempotency_key: command.key,
      }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    const verification = await challenge.json();
    if (
      !challenge.ok ||
      verification.success !== true ||
      verification.hostname !== new URL(env.LOCAL775_PUBLIC_ORIGIN ?? "").hostname ||
      verification.action !== "reno-inquiry"
    )
      return reply({ error: "verification_required" }, 400);
    // A keyed email digest limits repeated requests without storing raw network addresses.
    const abuseKey = createHmac("sha256", env.INQUIRY_ABUSE_SECRET ?? "")
      .update(command.payload.email)
      .digest("hex");
    const response = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/intake_reno_inquiry`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requested_listing_id: command.listingId,
        requested_payload: command.payload,
        requested_key: command.key,
        requested_abuse_key: abuseKey,
      }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      const rateLimited = failure.message === "inquiry_rate_limited";
      return reply(
        { error: rateLimited ? "inquiry_rate_limited" : "inquiry_not_confirmed" },
        rateLimited ? 429 : 503,
      );
    }
    const receipt = await response.json();
    if (typeof receipt.id !== "string" || !uuid.test(receipt.id) || receipt.status !== "received")
      return reply({ error: "inquiry_not_confirmed" }, 503);
    return reply({ id: receipt.id, status: "received" }, 202);
  } catch {
    return reply({ error: "inquiry_not_confirmed" }, 503);
  }
}
