import { callClaimRpc } from "./claim-commands.mjs";
import { telephoneHref, safeWebsite } from "../directory/presentation.mjs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** @param {unknown} input */
export function studioCommand(input) {
  if (!input || typeof input !== "object") throw new Error("invalid_studio_command");
  const data = /** @type {Record<string, unknown>} */ (input);
  if (data.action === "account") return { rpc: "pilot_account", body: {} };
  if (data.action === "review") return { rpc: "pilot_review_queue", body: {} };
  if (typeof data.id !== "string" || !uuid.test(data.id)) throw new Error("invalid_studio_command");
  if (data.action === "workspace")
    return { rpc: "pilot_workspace", body: { requested_listing_id: data.id } };
  if (
    data.action === "decide" &&
    ["approved", "rejected"].includes(String(data.decision)) &&
    typeof data.reason === "string" &&
    data.reason.trim().length >= 3 &&
    data.reason.trim().length <= 500
  ) {
    return {
      rpc: "decide_listing_proposal",
      body: {
        requested_id: data.id,
        requested_decision: data.decision,
        requested_reason: data.reason.trim(),
      },
    };
  }
  if (
    data.action === "propose" &&
    typeof data.baseVersion === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(data.baseVersion) &&
    Number.isFinite(Date.parse(data.baseVersion)) &&
    typeof data.name === "string" &&
    data.name.trim().length >= 2 &&
    data.name.trim().length <= 200 &&
    typeof data.description === "string" &&
    data.description.trim().length >= 10 &&
    data.description.length <= 5000 &&
    typeof data.website === "string" &&
    typeof data.key === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(data.key)
  ) {
    const phone = telephoneHref(data.phone)?.slice(4);
    const website = data.website.trim() ? safeWebsite(data.website.trim()) : "";
    if (
      !phone ||
      !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone) ||
      website === null ||
      (website && !website.startsWith("https://"))
    )
      throw new Error("invalid_studio_command");
    return {
      rpc: "submit_listing_proposal",
      body: {
        requested_listing_id: data.id,
        requested_key: data.key,
        requested_payload: {
          baseVersion: data.baseVersion,
          name: data.name.trim(),
          description: data.description.trim(),
          phone,
          website,
        },
      },
    };
  }
  throw new Error("invalid_studio_command");
}
/** @param {unknown} input @param {import('./claim-commands.mjs').ClaimOptions} options */
export async function runStudioCommand(input, options) {
  let command;
  try {
    command = studioCommand(input);
  } catch {
    return { ok: false, code: "invalid_studio_command" };
  }
  return callClaimRpc({ ...options, ...command });
}
