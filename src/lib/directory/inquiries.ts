import { createServerFn } from "@tanstack/react-start";
import { inquiriesConfigured, uuid } from "./inquiry-handler.mjs";
export const inquiryAvailability = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data }) => {
    if (!inquiriesConfigured(process.env) || !uuid.test(data))
      return { available: false, siteKey: "" };
    try {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/rpc/reno_inquiry_available`,
        {
          method: "POST",
          headers: {
            apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requested_listing_id: data }),
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        },
      );
      const available = response.ok && (await response.json()) === true;
      return { available, siteKey: available ? (process.env.TURNSTILE_SITE_KEY ?? "") : "" };
    } catch {
      return { available: false, siteKey: "" };
    }
  });
