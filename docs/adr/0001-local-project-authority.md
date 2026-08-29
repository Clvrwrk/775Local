---
status: accepted
---

# Local project authority replaces the inherited Grok sandbox contract

775 Directory is now led from the GitHub repository and its canonical local checkout at `/Volumes/M1 Application SSD/Projects/Local775`. The inherited Grok-only `/workspace`, preview-proxy, branding, tool, and chat-sandbox rules do not govern this project; project-specific local, staging, and production instructions will replace them because carrying environment-specific rules into the new workflow would create false constraints and unsafe deployment assumptions.

## Consequences

The GitHub repository is the canonical source, the M1 checkout is the canonical local working copy, and `AGENTS.md` must be replaced with portable project instructions before implementation begins. Provider provisioning, production changes, spending, external sends, financial effects, security/privacy decisions, and other irreversible actions remain owner-gated.
