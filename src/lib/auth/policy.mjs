const WORKOS_REQUIRED = [
  "WORKOS_CLIENT_ID",
  "WORKOS_API_KEY",
  "WORKOS_REDIRECT_URI",
  "WORKOS_COOKIE_PASSWORD",
];

/** @param {Record<string, string | undefined>} env */
export function workosConfigurationIssues(env) {
  const issues = WORKOS_REQUIRED.filter((key) => !env[key]?.trim()).map(
    (key) => `${key} is required`,
  );
  if ((env.WORKOS_COOKIE_PASSWORD?.length ?? 0) < 32) {
    issues.push("WORKOS_COOKIE_PASSWORD must contain at least 32 characters");
  }
  if (env.WORKOS_COOKIE_MAX_AGE !== "604800") {
    issues.push("WORKOS_COOKIE_MAX_AGE must enforce the accepted seven-day maximum");
  }
  try {
    const redirect = new URL(env.WORKOS_REDIRECT_URI ?? "");
    if (redirect.pathname !== "/api/auth/callback") {
      issues.push("WORKOS_REDIRECT_URI must end at /api/auth/callback");
    }
  } catch {
    issues.push("WORKOS_REDIRECT_URI must be an absolute URL");
  }
  return [...new Set(issues)];
}

/** @param {Record<string, string | undefined>} env */
export function isWorkosServerConfigured(env) {
  return workosConfigurationIssues(env).length === 0;
}

/** @param {unknown} value @param {string} [fallback] */
export function safeReturnPath(value, fallback = "/account") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return fallback;
  return value;
}

/** @param {{id:string,email:string,firstName?:string|null,lastName?:string|null,profilePictureUrl?:string|null}} user */
export function toAppUser(user) {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return {
    id: user.id,
    displayName: displayName || null,
    primaryEmail: user.email || null,
    profileImageUrl: user.profilePictureUrl || null,
  };
}
