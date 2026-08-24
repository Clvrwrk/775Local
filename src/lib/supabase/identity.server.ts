import type { User } from "@workos/authkit-tanstack-react-start";

function identityTarget() {
  const rawUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("SUPABASE_URL must identify the current Supabase environment.");
  }
  if (serviceRoleKey.length < 24 || serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error("A server-only Supabase service role is required for identity projection.");
  }
  return { url, serviceRoleKey };
}

export async function syncWorkosActor(user: User) {
  const target = identityTarget();
  const response = await fetch(new URL("/rest/v1/rpc/sync_workos_actor", target.url), {
    method: "POST",
    headers: {
      apikey: target.serviceRoleKey,
      Authorization: `Bearer ${target.serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      requested_workos_user_id: user.id,
      requested_primary_email: user.email,
      requested_display_name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Actor projection failed with HTTP ${response.status}.`);
  const actorId = await response.json();
  if (typeof actorId !== "string") throw new Error("Actor projection returned an invalid receipt.");
  return actorId;
}
