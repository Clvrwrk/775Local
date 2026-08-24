const SECRET_PATTERNS = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: "GitHub token", pattern: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b/ },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "Stripe live secret", pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/ },
  { name: "Google API key", pattern: /\bAIza[A-Za-z0-9_-]{30,}\b/ },
];

/**
 * @param {string} content
 * @returns {string[]}
 */
export function secretKinds(content) {
  return SECRET_PATTERNS
    .filter(({ pattern }) => pattern.test(content))
    .map(({ name }) => name);
}
