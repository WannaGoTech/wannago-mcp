# Security Policy, Permission Boundaries & Cryptographic Architecture — WannaGo MCP & ACP v3.1

## 1. Zero-Invention Human-in-the-Loop Gatekeeper (`wannago_interactive_discovery`)
WannaGo MCP enforces a deterministic chat validation gate (`wannago_interactive_discovery`). No external action, brand generation, or social publication can proceed without explicit user confirmation of visual inspirations, real coordinates, and content drafts in the chat.

## 2. Dry-Run Default on Social & Campaign Tools (`dryRun: true`)
- `acp_launch_brand_one_shot`, `social_publish_post`, `social_reply_to_post`, `social_send_dm`, and `wannago_create_social_accounts` support and prioritize `dryRun: true` preview verification before live publication.
- Browser sessions use isolated local Playwright contexts (`.data/browser-profiles/`) owned solely by the local user. Zero credentials or cookies are ever transmitted to external servers.

## 3. Single-Site Collaborator Isolation on Pressable / WordPress (`wannago_pressable_collaborator_isolation`)
When provisioning or connecting a client WordPress site on Pressable via WannaGoTech's Official Automattic Partnership:
- The client (`collaboratorEmail`) is granted scoped Collaborator access **exclusively to their single assigned `siteId`**.
- `otherWannaGoTechSitesVisible: false` and `masterAccountListingBlocked: true` are strictly enforced so all other WannaGoTech sites remain 100% invisible and isolated.

## 4. Opt-In Hardware Boundary for Android ADB (`wannago_phone_*`)
Tools interacting with Android ADB (`wannago_phone_status`, `wannago_phone_read_otp`, `wannago_phone_artemis_task`) are **100% opt-in**, disabled during standard brand/web/marketing workflows (`socialAccountMode: "skip"` by default), and only execute when a user physically attaches an authorized USB debugging device and explicitly invokes a `wannago_phone_*` tool.

## 5. Built-In Rate-Limiting & Financial Cost Guardrails
- **Zero Unbounded External API Spend**: All brand identity, WCAG token synthesis, 20s `Promo.mp4` rendering, Anti-AI optical calibration, and LinkedIn Boolean/X-Ray suites run locally with **zero metered third-party API billing risk**.
- **Paid Ads Circuit-Breakers**: `wannago_ads_campaign_manager` enforces hard CPA and ROAS kill-switch rules before any campaign budget is committed.
- **72-Hour Trial Auto-Stop**: Trial keys (`wgo_trial_...`) automatically expire after 72 hours (`259,200s`) with zero surprise charges.

## 6. AES-256-GCM In-Memory Vault Protection
The core generation engines (`engine/wannago_brand.wgo` and `engine/wannago_video.wgo`) are encrypted using **AES-256-GCM** and decrypted exclusively in volatile RAM upon verification of a signed `WANNAGO_API_KEY` (`wgo_trial_...` or `wgo_live_...`).

## 7. Vulnerability Reporting
To report a security issue or request a cryptographic license audit, contact: **[contact@wannago.tech](mailto:contact@wannago.tech)**.
