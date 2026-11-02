#!/usr/bin/env node
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { SUPPORTED_PLATFORMS, } from "./types.js";
import { PLATFORM_REGISTRY } from "./platforms/registry.js";
import { PROFILE_DIR, SCREENSHOTS_DIR, sessionManager, } from "./browser/sessionManager.js";
import { getPlatformAnalytics, getPlatformTrends, inspectSocialPage, publishToPlatform, readInboxAndNotifications, replyToPostUrl, searchPlatformPosts, sendDirectMessage, } from "./platforms/adapters.js";
import { scheduleStore } from "./scheduler/scheduleStore.js";
import { buildPlatformSocialProfilePack, createSocialAccountsFlow, listConnectedPhones, readRecentPhoneOtpCodes, runArtemisTaskOnPhone, } from "./mobile/artemisPhoneManager.js";
import { embedEverythingApiForProject, prepareWordPressAndPressableBundle, runPromoOmniVideoGeneration, runDesignAuditOnDirectory, runOneShotBrandKitGeneration, WANNAGOTECH_AUTOMATTIC_PARTNER_OFFER, } from "./branding/brandKitRunner.js";
import { acpController } from "./acp/acpController.js";
import { assertAuthorized, verifySecurityKey, } from "./security/authGuard.js";
import { auditAndEnhanceVisualForSocial, buildDatedContentStrategyAndCalendar, buildSovereignAdsCampaignPlan, configureIsolatedPressableCollaborator, designSovereignSocialPostOrCarousel, detectOptimalPeakHours, generateLinkedInProFreeSuite, generateMarketingExecutiveReport, manageMarketingReminders, runInteractiveDiscoveryCheck, } from "./marketing/digitalMarketingEngine.js";
import { buildAndRunGmailOutreachSequence, configureAndCheckGmailAuth, issueAndSendWannaGoLicenseEmail, readGmailInboxMessages, sendOrPreviewGmailMessage, } from "./email/gmailSovereignEngine.js";
const PlatformEnum = z.enum(SUPPORTED_PLATFORMS);
const server = new McpServer({
    name: "wannago-mcp",
    version: "3.2.0",
});
const READ_ONLY_TOOLS = new Set([
    "wannago_verify_license",
    "acp_get_status",
    "wannago_interactive_discovery",
    "wannago_audit_design",
    "wannago_detect_peak_hours",
    "wannago_phone_status",
    "wannago_phone_read_otp",
    "social_list_platforms",
    "social_check_auth",
    "social_get_analytics",
    "social_read_inbox",
    "social_search_posts",
    "social_get_trends",
    "social_browser_inspect",
    "gmail_read_inbox",
]);
// Intercept server.tool so every protected tool enforces WANNAGO_API_KEY verification
// and exposes official MCP ToolAnnotations (readOnlyHint, destructiveHint: false, idempotentHint, openWorldHint)
const rawTool = server.tool.bind(server);
server.tool = (name, description, schema, handler) => {
    const isReadOnly = READ_ONLY_TOOLS.has(name);
    const annotations = {
        title: name,
        readOnlyHint: isReadOnly,
        destructiveHint: false,
        idempotentHint: isReadOnly || name.startsWith("wannago_"),
        openWorldHint: name.startsWith("social_"),
    };
    return rawTool(name, description, schema, annotations, async (...args) => {
        if (name !== "wannago_verify_license") {
            assertAuthorized();
        }
        return handler(...args);
    });
};
function formatJsonResult(data) {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(data, null, 2),
            },
        ],
    };
}
// ============================================================================
// SECURITY GATE: LICENSE & API KEY VERIFICATION / IN-SESSION ACTIVATION
// ============================================================================
server.tool("wannago_verify_license", "Verifies the active WANNAGO_API_KEY security license key or activates a new 'wgo_live_...' security key for the current session without restarting the IDE.", {
    apiKey: z
        .string()
        .optional()
        .describe("Optional 'wgo_live_...' security key to verify and activate in-session; if omitted, checks process.env.WANNAGO_API_KEY"),
}, async ({ apiKey }) => {
    const check = verifySecurityKey(apiKey);
    if (check.valid && apiKey) {
        process.env.WANNAGO_API_KEY = apiKey.trim();
    }
    return formatJsonResult({
        ...check,
        sessionActivated: check.valid,
        automatticPartnerOffer: WANNAGOTECH_AUTOMATTIC_PARTNER_OFFER,
        hint: check.valid
            ? "Security key verified! All 26 WannaGo MCP & ACP tools (including WordPress Studio MCP + Pressable MCP Automattic Partner Stack, Everything-API URL->API converter, and 9-Platform Social Profile Packs) are unlocked. Website support is 100% FREE (charged only for premium hosting) — contact@wannago.tech."
            : "Set WANNAGO_API_KEY in your mcp_config.json 'env' block or pass a valid 'wgo_live_...' / 'wgo_trial_...' key (request at contact@wannago.tech) to unlock WannaGo MCP.",
    });
});
// ============================================================================
// PILLAR 0: ACP (AGENT CONTROL PROTOCOL) — 7-GATE DETERMINISTIC ORCHESTRATOR
// ============================================================================
server.tool("acp_launch_brand_one_shot", "Master WannaGo ACP (Agent Control Protocol) pipeline controller so agents NEVER get lost. Takes ONLY 'logoPath' (or 'auto' to synthesize a geometric vector emblem) + 'brandName' & 'businessDescription', and executes all 7 deterministic ACP Gates: (1) Brief & Logo validation, (2) Equal-Width Logo Lockup (Line 2 == Line 1 to 0.001pt) + Squircle Icons + 3D Interactive Studio, (3) WCAG 2.1 AA/AAA Color Tokens + Binary .ASE + Stationery + 600px Email Signatures, (4) Production Marketing Websites (6 Anatomies, 8 States) + Brand Hubs + 20s Launch Video + Commercial A4 PDFs in FR/EN/DE/AR, (5) Automated WannaGo Quality Audit (0 findings + WCAG math), and optionally (6) Social Account Creation (Browser / Mobile Phone Bridge) & (7) Inaugural Launch Campaign.", {
    logoPath: z
        .string()
        .optional()
        .default("auto")
        .describe("Absolute path to the logo file (.png, .svg, .jpg), or 'auto' to automatically generate a geometric vector emblem + equal-width wordmark"),
    brandName: z.string().min(1).describe("Brand or product name"),
    businessDescription: z
        .string()
        .min(5)
        .describe("Description of the business, products, target audience, and positioning"),
    sector: z.string().optional().describe("Short descriptor / Line 2 subtitle (tracked to 100% of Line 1 width)"),
    taglineFr: z.string().optional(),
    taglineEn: z.string().optional(),
    taglineDe: z.string().optional(),
    taglineAr: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional(),
    address: z.string().optional(),
    parentCompany: z.string().optional().default("WannaGoTech"),
    products: z
        .array(z.object({ name: z.string(), desc: z.string() }))
        .optional(),
    primaryColorOverride: z.string().optional(),
    accentColorOverride: z.string().optional(),
    outputDir: z.string().optional(),
    socialPlatforms: z
        .array(PlatformEnum)
        .optional()
        .describe("Optional platforms to immediately set up in Gate 6"),
    socialAccountMode: z
        .enum(["browser", "phone_artemis", "hybrid", "skip"])
        .optional()
        .default("skip"),
    desiredHandle: z.string().optional(),
    adminOwnerName: z
        .string()
        .optional()
        .describe("Full name of the user's chosen personal Admin / Owner account who becomes Super Admin / Primary Owner of all Brand Pages, Channels, and Communities"),
    adminOwnerEmail: z
        .string()
        .optional()
        .describe("Optional email of the chosen Admin Owner account"),
    adminOwnerHandle: z
        .string()
        .optional()
        .describe("Optional personal @handle of the chosen Admin Owner for X/Instagram/TikTok admin delegation"),
    useExistingAdminForPages: z
        .boolean()
        .optional()
        .default(true)
        .describe("When true (default), platforms with Pages/Channels/Communities (LinkedIn, Facebook, YouTube, Reddit) create the Brand Page under the chosen Admin Owner's existing account as Super Admin"),
    autoDraftLaunchPost: z.boolean().optional().default(false),
}, async (options) => {
    const session = await acpController.executeOneShotBrandLaunch({
        ...options,
        socialPlatforms: options.socialPlatforms,
    });
    return formatJsonResult(session);
});
server.tool("acp_get_status", "Returns the live state of all ACP (Agent Control Protocol) brand launch sessions, showing which of the 7 Gates are PASSED or PENDING and the exact next instruction for the agent.", {
    sessionId: z
        .string()
        .optional()
        .describe("Optional specific ACP session ID; if omitted, returns all sessions"),
}, async ({ sessionId }) => {
    const all = acpController.readSessions();
    if (sessionId) {
        return formatJsonResult({ session: all[sessionId] || null });
    }
    return formatJsonResult({
        totalSessions: Object.keys(all).length,
        sessions: all,
    });
});
// ============================================================================
// PILLAR 1: ONE-SHOT BRAND KIT & COMMERCIAL SUITE (APPLE DESIGN + ANTI-AI 100%)
// ============================================================================
server.tool("wannago_generate_brand_kit", "One-shot generator that takes a user's logo file and brand/business description, and automatically generates a complete multilingual (FR, EN, DE, AR) Brand Kit: 01_Logos (Equal-Width Lockups, Squircle icons, social avatars & banners), 04_Stationery (A4 Letterheads), 05_Email_Signatures (600px Outlook table, tabular-nums, RTL), 07_Colors (WCAG 2.1 AA/AAA mathematically calibrated palette with auto Deep-Ink synthesis), 09_Commercial_Presentations_A4, 11_Production_Website, 20s Launch Video, Brand Guidelines HD PDFs, and Interactive Brand Hub HTML5 portals — certified 100/100 by the WannaGo Quality Engine.", {
    logoPath: z
        .string()
        .describe("Absolute path to the official brand logo file (.png, .jpg, .svg)"),
    brandName: z.string().min(1).describe("Official name of the brand or product"),
    businessDescription: z
        .string()
        .min(5)
        .describe("Description of the business, value proposition, target audience, and core offerings"),
    sector: z
        .string()
        .optional()
        .describe("Short sector / category title (e.g. 'Système ERP Clinique' or 'Plateforme SaaS B2B')"),
    taglineFr: z
        .string()
        .optional()
        .describe("Official French slogan (Golden Rule: never use 'Un produit de WannaGoTech' as a slogan)"),
    taglineEn: z.string().optional().describe("Official English slogan"),
    taglineDe: z.string().optional().describe("Official German slogan"),
    taglineAr: z.string().optional().describe("Official Arabic slogan"),
    phone: z.string().optional().describe("Official contact phone number"),
    email: z.string().optional().describe("Official contact email"),
    website: z.string().optional().describe("Official website domain (e.g. 'example.com')"),
    address: z.string().optional().describe("Official physical address"),
    parentCompany: z
        .string()
        .optional()
        .default("WannaGoTech")
        .describe("Parent publisher company for institutional colophon attribution (default: 'WannaGoTech')"),
    products: z
        .array(z.object({
        name: z.string(),
        desc: z.string(),
    }))
        .optional()
        .describe("Optional list of sub-products or modules to feature in the Brand Hub & Commercial A4 Presentations"),
    primaryColorOverride: z
        .string()
        .optional()
        .describe("Optional HEX override for primary brand color (auto-extracted from logo if omitted)"),
    accentColorOverride: z
        .string()
        .optional()
        .describe("Optional HEX override for highlight accent color (auto-extracted from logo if omitted)"),
    outputDir: z
        .string()
        .optional()
        .describe("Optional output directory path (defaults to C:\\Users\\hp\\Desktop\\Workspace\\Marketing\\<BrandName>)"),
}, async (options) => {
    const res = await runOneShotBrandKitGeneration(options);
    return formatJsonResult(res);
});
server.tool("wannago_audit_design", "Runs the automated WannaGo Static Quality Scanner on any target brand/project directory to verify 0 findings (P0=0, P1=0, P2=0).", {
    targetDir: z
        .string()
        .describe("Absolute path to the folder or HTML file to audit"),
}, async ({ targetDir }) => {
    const res = await runDesignAuditOnDirectory(targetDir);
    return formatJsonResult(res);
});
server.tool("wannago_generate_promo_video", "Automated WannaGo Promo Video Generator. Turns any brand, product, or website into a 20-second shareable launch video (Promo.mp4) with beat-synced music, sound effects, settled poster frame (Promo.jpg) baked into Frame 0 for X/LinkedIn/Discord thumbnails, storyboard (Promo-plan.md), and share copy (share-copy.txt).", {
    brandName: z.string().min(1).describe("Brand or project name"),
    tagline: z
        .string()
        .optional()
        .describe("Hook headline / tagline for the launch video"),
    description: z
        .string()
        .optional()
        .describe("One-sentence description of what the product does"),
    tone: z
        .enum([
        "default",
        "polished",
        "yc-parody",
        "chaotic",
        "deadpan",
        "cinematic",
        "app-store",
    ])
        .optional()
        .default("polished")
        .describe("Promo video tone preset controlling pacing, music, and SFX energy"),
    format: z
        .enum(["landscape", "vertical", "square"])
        .optional()
        .default("landscape")
        .describe("Video aspect ratio: landscape (1920x1080 16:9), vertical (1080x1920 9:16), or square (1080x1080)"),
    mode: z
        .enum(["auto", "omni", "instant"])
        .optional()
        .default("auto")
        .describe("'omni' calls Gemini Omni 1.1 Flash (gemini-omni-1.1-flash) via generate_video.py; 'instant' renders locally with FFmpeg beat-sync in ~4s; 'auto' uses Gemini Omni if GEMINI_API_KEY is set and falls back to instant"),
    primaryColor: z.string().optional().default("#0D5C9E"),
    accentColor: z.string().optional().default("#1498B5"),
    website: z.string().optional(),
    logoPath: z.string().optional(),
    products: z
        .array(z.object({ name: z.string(), desc: z.string() }))
        .optional(),
    outputDir: z.string().optional(),
    includeMusic: z.boolean().optional().default(true),
    includeSfx: z.boolean().optional().default(true),
}, async (options) => {
    const res = await runPromoOmniVideoGeneration(options);
    return formatJsonResult(res);
});
server.tool("wannago_generate_social_profile_packs", "Generates and returns the tailored Bio (within each platform's character limit in FR/EN/DE/AR), Long Description, Profile Picture (800x800 Squircle/Circle Avatar), and exact Cover Banner dimensions & file paths for each of the 9 social media platforms (x, linkedin, instagram, facebook, tiktok, youtube, bluesky, threads, reddit).", {
    brandName: z.string().min(1).describe("Brand display name"),
    desiredHandle: z
        .string()
        .min(2)
        .describe("Desired @handle / slug across platforms"),
    bioOrTagline: z
        .string()
        .optional()
        .describe("Core brand tagline or value proposition"),
    website: z
        .string()
        .optional()
        .describe("Official brand website URL"),
    avatarPath: z.string().optional(),
    brandDir: z.string().optional(),
    platforms: z
        .array(PlatformEnum)
        .optional()
        .describe("Optional subset of platforms; defaults to all 9 platforms"),
}, async (options) => {
    const targetPlatforms = (options.platforms ||
        SUPPORTED_PLATFORMS);
    const packs = targetPlatforms.map((plat) => buildPlatformSocialProfilePack(plat, {
        brandName: options.brandName,
        desiredHandle: options.desiredHandle,
        bioOrTagline: options.bioOrTagline,
        website: options.website,
        avatarPath: options.avatarPath,
        brandDir: options.brandDir,
    }));
    return formatJsonResult({
        brandName: options.brandName,
        totalPlatforms: packs.length,
        packs,
    });
});
server.tool("wannago_url_to_everything_api", "Embeds 'https://github.com/edsadr/everything-api' directly into the user's brand project ('12_Everything_API/'), inspects the user's provided website link (or brand brief), and turns that link into a live REST API with pre-seeded endpoints and an OpenAPI 3.1 specification.", {
    brandName: z.string().min(1).describe("Brand or project name"),
    sourceUrl: z
        .string()
        .min(3)
        .describe("Website URL provided by the user to convert into a live REST API"),
    businessDescription: z
        .string()
        .optional()
        .describe("Optional brand or business description"),
    outputDir: z
        .string()
        .optional()
        .describe("Optional project directory path"),
    port: z.number().optional().default(3000),
}, async (options) => {
    const res = await embedEverythingApiForProject(options);
    return formatJsonResult(res);
});
server.tool("wannago_wordpress_pressable_deploy", "Generates a WannaGo-certified WordPress Block Theme (WCAG 2.1 AA/AAA, Apple HIG + Anti-AI) using WannaGo's design skills and orchestrates website creation & deployment via WordPress Studio MCP ('wordpress-studio') and Pressable MCP ('pressable'). Includes WannaGoTech's Official Automattic Partner program: preferential partner pricing on Pressable & WordPress hosting, 0 EUR FREE website creation & technical support (we charge ONLY for premium hosting), and direct engineering help at contact@wannago.tech.", {
    brandName: z.string().min(1).describe("Brand or website name"),
    businessDescription: z
        .string()
        .min(5)
        .describe("Description of the brand, products/services, and website goals"),
    website: z
        .string()
        .optional()
        .describe("Target custom domain (e.g. 'example.com')"),
    email: z.string().optional(),
    phone: z.string().optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    outputDir: z.string().optional(),
}, async (options) => {
    const res = await prepareWordPressAndPressableBundle(options);
    return formatJsonResult(res);
});
// ============================================================================
// PILLAR 2: PHONE CONNECTION (GOOGLE ARTEMIS + ADB) & ACCOUNT CREATION
// ============================================================================
server.tool("wannago_phone_status", "Checks connected Android phones via ADB (`adb devices -l`) and verifies WannaGo Mobile Bridge readiness.", {}, async () => {
    const res = await listConnectedPhones();
    return formatJsonResult(res);
});
server.tool("wannago_phone_read_otp", "Reads recent incoming SMS messages from the connected Android phone via ADB to automatically extract 4-8 digit OTP / verification codes during social account creation or 2FA login.", {
    deviceSerial: z
        .string()
        .optional()
        .describe("Optional ADB device serial if multiple phones are connected"),
    limit: z.number().min(1).max(20).optional().default(5),
}, async ({ deviceSerial, limit }) => {
    const res = await readRecentPhoneOtpCodes(deviceSerial, limit ?? 5);
    return formatJsonResult(res);
});
server.tool("wannago_phone_artemis_task", "Dispatches a natural-language mobile UI automation task to a connected Android phone using the WannaGo Mobile Bridge (Flash or Pro mode).", {
    prompt: z
        .string()
        .min(3)
        .describe("Natural language instruction for the phone (e.g. 'Open Instagram and tap Create new account' or 'Approve the Google sign-in prompt')"),
    profile: z
        .enum(["flash", "pro"])
        .optional()
        .default("flash")
        .describe("'flash' for fast reactive steps (~3-5s), 'pro' for complex multi-step planning & verification"),
    deviceSerial: z
        .string()
        .optional()
        .describe("Optional specific Android device serial"),
}, async ({ prompt, profile, deviceSerial }) => {
    const res = await runArtemisTaskOnPhone({
        prompt,
        profile: profile ?? "flash",
        deviceSerial,
    });
    return formatJsonResult(res);
});
server.tool("wannago_create_social_accounts", "Assists and automates creating new social media accounts and official Brand Pages across any of the 9 platforms (x, linkedin, instagram, facebook, tiktok, youtube, bluesky, threads, reddit) using either the internal persistent browser ('browser'), a connected phone via WannaGo Mobile Bridge ('phone_artemis'), or 'hybrid'. Supports Admin Owner Governance: platforms with Pages/Channels/Communities (LinkedIn Company Page, Facebook Business Page, YouTube Brand Channel, Reddit Subreddit) are created under the existing personal account of the user's chosen 'adminOwnerName' as Super Admin / Primary Owner, while handle-based platforms delegate Admin access to that Admin Owner.", {
    platforms: z
        .array(PlatformEnum)
        .min(1)
        .describe("Platforms where accounts or Brand Pages should be created"),
    mode: z
        .enum(["browser", "phone_artemis", "hybrid"])
        .optional()
        .default("hybrid")
        .describe("'browser' to open Page/Signup flows in persistent browser; 'phone_artemis' to drive native apps on connected Android phone via WannaGo Mobile Bridge; 'hybrid' for Phone Artemis + Browser + SMS OTP"),
    brandName: z.string().min(1).describe("Brand display name"),
    desiredHandle: z
        .string()
        .min(2)
        .describe("Desired @username / handle / page slug"),
    email: z.string().email().describe("Official brand email for registration"),
    phone: z
        .string()
        .optional()
        .describe("Optional phone number for SMS verification"),
    bioOrTagline: z
        .string()
        .optional()
        .describe("Official brand tagline/bio to set on the profile/page"),
    website: z.string().optional().describe("Official website URL"),
    avatarPath: z
        .string()
        .optional()
        .describe("Optional path to the generated Avatar PNG (e.g. from 01_Logos/PNG_High_Resolution/Social_Profile_Avatar_800x800.png)"),
    deviceSerial: z.string().optional(),
    adminOwnerName: z
        .string()
        .optional()
        .describe("Full name of the user's chosen personal Admin / Owner account who must be Super Admin / Primary Owner across all Brand Pages, Channels, and delegated accounts"),
    adminOwnerEmail: z
        .string()
        .optional()
        .describe("Optional email of the chosen Admin Owner account"),
    adminOwnerHandle: z
        .string()
        .optional()
        .describe("Optional personal @username of the chosen Admin Owner (e.g. for X Delegate / Instagram Business Suite / Reddit Mod)"),
    useExistingAdminForPages: z
        .boolean()
        .optional()
        .default(true)
        .describe("If true (default), creates LinkedIn Company Pages, Facebook Pages, YouTube Brand Channels, and Reddit Subreddits under the chosen Admin Owner's existing personal account as Super Admin"),
}, async (options) => {
    const res = await createSocialAccountsFlow({
        platforms: options.platforms,
        mode: options.mode ?? "hybrid",
        brandName: options.brandName,
        desiredHandle: options.desiredHandle,
        email: options.email,
        phone: options.phone,
        bioOrTagline: options.bioOrTagline,
        website: options.website,
        avatarPath: options.avatarPath,
        deviceSerial: options.deviceSerial,
        adminOwnerName: options.adminOwnerName,
        adminOwnerEmail: options.adminOwnerEmail,
        adminOwnerHandle: options.adminOwnerHandle,
        useExistingAdminForPages: options.useExistingAdminForPages ?? true,
    });
    return formatJsonResult(res);
});
// ============================================================================
// PILLAR 3: 9-PLATFORM SOCIAL MEDIA MANAGEMENT HUB
// ============================================================================
server.tool("social_list_platforms", "Lists all 9 supported social media platforms (x, linkedin, instagram, facebook, tiktok, youtube, bluesky, threads, reddit), their capabilities, persistent browser profile path, and last known login status.", {}, async () => {
    const cachedAuth = sessionManager.getCachedAuthStatus();
    const platforms = SUPPORTED_PLATFORMS.map((id) => {
        const meta = PLATFORM_REGISTRY[id];
        return {
            id: meta.id,
            name: meta.name,
            baseUrl: meta.baseUrl,
            loginUrl: meta.loginUrl,
            capabilities: meta.capabilities,
            cachedAuth: cachedAuth[id] || {
                authenticated: false,
                checkedAt: "never",
            },
        };
    });
    return formatJsonResult({
        mcpName: "WannaGo MCP",
        profileDirectory: PROFILE_DIR,
        screenshotsDirectory: SCREENSHOTS_DIR,
        platforms,
    });
});
server.tool("social_open_login", "Opens a visible (non-headless) browser window using the persistent social profile so the user can sign in once to one or more social media platforms. Session cookies and tokens are saved automatically to disk.", {
    platforms: z
        .array(PlatformEnum)
        .min(1)
        .describe("Platforms to open login tabs for (e.g. ['x', 'linkedin', 'instagram', 'tiktok'])"),
    waitSeconds: z
        .number()
        .min(0)
        .max(120)
        .optional()
        .default(5)
        .describe("Optional seconds to wait after opening the tabs before returning"),
}, async ({ platforms, waitSeconds }) => {
    const result = await sessionManager.openLoginTabs(platforms, waitSeconds ?? 5);
    return formatJsonResult(result);
});
server.tool("social_check_auth", "Checks whether the persistent browser profile is currently logged into the specified social media platform(s) and captures a verification screenshot.", {
    platforms: z
        .array(PlatformEnum)
        .min(1)
        .describe("Platforms to verify login state for"),
    headless: z
        .boolean()
        .optional()
        .default(true)
        .describe("Run check in headless mode (default true)"),
}, async ({ platforms, headless }) => {
    const results = [];
    for (const platform of platforms) {
        const res = await sessionManager.checkPlatformAuth(platform, headless ?? true);
        results.push(res);
    }
    return formatJsonResult({ results });
});
server.tool("social_publish_post", "Publishes (or composes in dryRun preview mode) a post with text, images/videos, links, or thread items across one or multiple social media platforms simultaneously.", {
    platforms: z
        .array(PlatformEnum)
        .min(1)
        .describe("Target social platforms to publish to"),
    text: z.string().min(1).describe("Main post caption / body text"),
    mediaPaths: z
        .array(z.string())
        .optional()
        .describe("Optional absolute file paths to images or videos to attach/upload"),
    threadItems: z
        .array(z.string())
        .optional()
        .describe("Optional follow-up posts for a thread (supported on X, Bluesky, Threads)"),
    title: z
        .string()
        .optional()
        .describe("Optional title (used for Reddit posts and YouTube videos)"),
    subreddit: z
        .string()
        .optional()
        .describe("Optional subreddit for Reddit posts (e.g. 'r/entrepreneur')"),
    linkUrl: z
        .string()
        .optional()
        .describe("Optional URL to append/attach to the post"),
    dryRun: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, fills the post composer, attaches media, and takes a screenshot WITHOUT clicking the final Publish/Post button"),
    headless: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to run browser automation headlessly (default false)"),
}, async (input) => {
    const results = [];
    for (const platform of input.platforms) {
        const res = await publishToPlatform(platform, {
            platforms: input.platforms,
            text: input.text,
            mediaPaths: input.mediaPaths,
            threadItems: input.threadItems,
            title: input.title,
            subreddit: input.subreddit,
            linkUrl: input.linkUrl,
            dryRun: input.dryRun,
            headless: input.headless,
        });
        results.push(res);
    }
    return formatJsonResult({ results });
});
server.tool("social_schedule_post", "Schedules a multi-platform social media post for a future ISO 8601 timestamp in the persistent local schedule queue.", {
    scheduledFor: z
        .string()
        .describe("ISO 8601 date-time string when the post should be published (e.g. '2026-10-27T15:00:00+01:00')"),
    platforms: z.array(PlatformEnum).min(1).describe("Target social platforms"),
    text: z.string().min(1).describe("Main post caption / body text"),
    mediaPaths: z.array(z.string()).optional(),
    threadItems: z.array(z.string()).optional(),
    title: z.string().optional(),
    subreddit: z.string().optional(),
    linkUrl: z.string().optional(),
}, async ({ scheduledFor, platforms, text, mediaPaths, threadItems, title, subreddit, linkUrl, }) => {
    const item = scheduleStore.addScheduledPost(scheduledFor, {
        platforms: platforms,
        text,
        mediaPaths,
        threadItems,
        title,
        subreddit,
        linkUrl,
        dryRun: false,
        headless: false,
    });
    return formatJsonResult({
        message: `Scheduled post ${item.id} for ${item.scheduledFor}`,
        scheduledPost: item,
    });
});
server.tool("social_manage_schedules", "Lists all scheduled posts in the queue, cancels a specific scheduled post by ID, or runs due posts.", {
    action: z.enum(["list", "cancel", "run_due"]),
    scheduleId: z.string().optional(),
    statusFilter: z
        .enum(["all", "pending", "completed", "failed", "cancelled"])
        .optional()
        .default("all"),
}, async ({ action, scheduleId, statusFilter }) => {
    if (action === "cancel") {
        if (!scheduleId) {
            return formatJsonResult({
                error: "scheduleId is required when action is 'cancel'.",
            });
        }
        const cancelled = scheduleStore.cancelScheduledPost(scheduleId);
        return formatJsonResult({
            cancelled,
            message: cancelled
                ? `Cancelled schedule ${scheduleId}`
                : `Schedule ${scheduleId} not found`,
        });
    }
    if (action === "run_due") {
        const executed = await scheduleStore.runDuePosts(scheduleId ? [scheduleId] : undefined);
        return formatJsonResult({
            executedCount: executed.length,
            executed,
        });
    }
    const all = scheduleStore.readAll();
    const filtered = statusFilter && statusFilter !== "all"
        ? all.filter((i) => i.status === statusFilter)
        : all;
    return formatJsonResult({
        total: filtered.length,
        schedules: filtered,
    });
});
server.tool("social_get_analytics", "Extracts profile metrics (followers, subscribers, impressions, profile views) and recent post performance metrics from one or more social media platforms.", {
    platforms: z.array(PlatformEnum).min(1),
    profileUrlOverride: z.string().optional(),
    headless: z.boolean().optional().default(true),
}, async ({ platforms, profileUrlOverride, headless }) => {
    const analytics = [];
    for (const platform of platforms) {
        const res = await getPlatformAnalytics(platform, profileUrlOverride, headless ?? true);
        analytics.push(res);
    }
    return formatJsonResult({ analytics });
});
server.tool("social_read_inbox", "Reads recent notifications, mentions, comments, or direct message previews from one or more social media platforms.", {
    platforms: z.array(PlatformEnum).min(1),
    mode: z.enum(["notifications", "messages"]).optional().default("notifications"),
    limit: z.number().min(1).max(50).optional().default(15),
    headless: z.boolean().optional().default(true),
}, async ({ platforms, mode, limit, headless }) => {
    const results = [];
    for (const platform of platforms) {
        const res = await readInboxAndNotifications(platform, mode ?? "notifications", limit ?? 15, headless ?? true);
        results.push(res);
    }
    return formatJsonResult({ results });
});
server.tool("social_reply_to_post", "Navigates to a specific post URL on any supported platform and publishes (or drafts with dryRun=true) a comment/reply.", {
    platform: PlatformEnum,
    postUrl: z.string().url(),
    replyText: z.string().min(1),
    dryRun: z.boolean().optional().default(false),
    headless: z.boolean().optional().default(false),
}, async ({ platform, postUrl, replyText, dryRun, headless }) => {
    const result = await replyToPostUrl(platform, postUrl, replyText, dryRun ?? false, headless ?? false);
    return formatJsonResult(result);
});
server.tool("social_send_dm", "Sends (or drafts with dryRun=true) a direct message on a social media platform given a DM conversation thread URL.", {
    platform: PlatformEnum,
    threadUrl: z.string(),
    messageText: z.string().min(1),
    dryRun: z.boolean().optional().default(false),
    headless: z.boolean().optional().default(false),
}, async ({ platform, threadUrl, messageText, dryRun, headless }) => {
    const result = await sendDirectMessage(platform, threadUrl, messageText, dryRun ?? false, headless ?? false);
    return formatJsonResult(result);
});
server.tool("social_search_posts", "Searches for posts, keywords, hashtags, or brand mentions across one or multiple social media platforms and returns structured post snippets, URLs, and engagement metrics.", {
    platforms: z.array(PlatformEnum).min(1),
    query: z.string().min(1),
    limit: z.number().min(1).max(30).optional().default(10),
    headless: z.boolean().optional().default(true),
}, async ({ platforms, query, limit, headless }) => {
    const searches = [];
    for (const platform of platforms) {
        const res = await searchPlatformPosts(platform, query, limit ?? 10, headless ?? true);
        searches.push(res);
    }
    return formatJsonResult({ query, searches });
});
server.tool("social_get_trends", "Fetches trending topics, hashtags, or popular posts from one or more social platforms.", {
    platforms: z.array(PlatformEnum).min(1),
    limit: z.number().min(1).max(30).optional().default(15),
    headless: z.boolean().optional().default(true),
}, async ({ platforms, limit, headless }) => {
    const results = [];
    for (const platform of platforms) {
        const res = await getPlatformTrends(platform, limit ?? 15, headless ?? true);
        results.push(res);
    }
    return formatJsonResult({ results });
});
server.tool("social_browser_inspect", "Opens any URL inside the authenticated persistent browser session, optionally clicks or types into an element, and returns visible text, interactive selectors, and a screenshot.", {
    url: z.string().url(),
    clickSelector: z.string().optional(),
    typeSelector: z.string().optional(),
    typeText: z.string().optional(),
    pressEnter: z.boolean().optional().default(false),
    headless: z.boolean().optional().default(false),
    waitMs: z.number().min(500).max(15000).optional().default(3500),
}, async (options) => {
    const result = await inspectSocialPage(options);
    return formatJsonResult(result);
});
// ============================================================================
// PILLAR 4: ZERO-INVENTION CHAT DISCOVERY, SINGLE-SITE PRESSABLE ISOLATION,
// ANTI-AI VISUAL AUDITOR, DIGITAL MARKETING, LINKEDIN PRO-FREE & PEAK HOURS
// ============================================================================
server.tool("wannago_interactive_discovery", "MANDATORY Zero-Invention Interactive Chat Gatekeeper (WannaGoTech Sovereign Engine). Evaluates what the user has provided for any action ('brand_kit', 'website', 'content_strategy', 'social_post', 'linkedin_growth', 'paid_ads') and returns the exact clarifying questions (inspirations, color preferences/taboos, real verified contacts, audience, tone) that the agent MUST ask the user in chat BEFORE generating anything, so NOTHING is ever invented.", {
    brandName: z.string().min(1).describe("Brand or project name"),
    actionType: z
        .enum([
        "brand_kit",
        "website",
        "content_strategy",
        "social_post",
        "linkedin_growth",
        "paid_ads",
    ])
        .describe("The user's current goal or action"),
    userConfirmedInChat: z.boolean().optional().default(false),
    inspirationsProvided: z
        .string()
        .optional()
        .describe("Brands, websites, or visual styles the user explicitly stated in chat"),
    visualStylePreferences: z.string().optional(),
    colorPreferences: z
        .string()
        .optional()
        .describe("Colors the user wants to keep or forbid, as stated in chat"),
    forbiddenElements: z.string().optional(),
    targetAudience: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    website: z.string().optional(),
    collaboratorEmailForWordPress: z.string().optional(),
}, async (options) => {
    const res = runInteractiveDiscoveryCheck(options);
    return formatJsonResult(res);
});
server.tool("wannago_pressable_collaborator_isolation", "Enforces WannaGoTech Single-Site Collaborator Isolation on Pressable & WordPress. Ensures that when a client site is created or connected, the user (collaboratorEmail) is invited ONLY as a Collaborator on their single dedicated site (siteNameSlug), keeping all other WannaGoTech sites 100% isolated and invisible.", {
    brandName: z.string().min(1).describe("Brand or project name"),
    siteNameSlug: z
        .string()
        .min(2)
        .describe("Dedicated Pressable site slug for this single client project"),
    collaboratorEmail: z
        .string()
        .email()
        .describe("Email of the user who will be added as Collaborator on their own site ONLY"),
    customDomain: z.string().optional().describe("Optional custom domain for the site"),
    collaboratorRole: z
        .enum(["collaborator", "wp_admin_scoped"])
        .optional()
        .default("collaborator"),
}, async (options) => {
    const res = configureIsolatedPressableCollaborator(options);
    return formatJsonResult(res);
});
server.tool("wannago_audit_visual_and_post", "WannaGoTech Sovereign Anti-AI Visual Authenticity & Social Media Render Auditor. Audits any generated or uploaded image/post for: (1) Anti-AI Optical Authenticity (detects AI neon oversaturation, plastic skin/surface smoothing, and synthetic edge artifacts), (2) Automatic Natural Optical Calibration (applies ISO-100 photographic sensor micro-grain, highlights roll-off, and lens micro-contrast so the image NEVER looks AI-generated), and (3) Social Feed Rendering & UI Safe Zones across all 9 platforms (4:5 portrait priority on mobile feeds, safe margins away from TikTok/Reels/LinkedIn UI overlays).", {
    imagePath: z
        .string()
        .describe("Absolute path to the image file (.png, .jpg) to audit and calibrate"),
    targetPlatform: PlatformEnum.optional()
        .default("linkedin")
        .describe("Target social media platform for feed render & safe-zone validation"),
    autoFixAntiAiOptics: z
        .boolean()
        .optional()
        .default(true)
        .describe("When true (default), automatically generates a calibrated '_wgt_natural_optical.png' version with natural optical sensor grain and compressed neon peaks"),
    outputEnhancedPath: z.string().optional(),
}, async (options) => {
    const res = await auditAndEnhanceVisualForSocial({
        imagePath: options.imagePath,
        targetPlatform: (options.targetPlatform || "linkedin"),
        autoFixAntiAiOptics: options.autoFixAntiAiOptics ?? true,
        outputEnhancedPath: options.outputEnhancedPath,
    });
    return formatJsonResult(res);
});
server.tool("wannago_design_social_post", "WannaGoTech Sovereign Post & Carousel Designer (Apple HIG + Anti-AI + Natural Optical Grain). Generates high-converting social media visuals in 1080x1350 (4:5 vertical feed), 1080x1080 (1:1), 1080x1920 (9:16 Story/Reel), 1920x1080 (16:9), or multi-slide Native LinkedIn PDF Carousels (Carousel_LinkedIn_<Brand>.pdf).", {
    brandName: z.string().min(1),
    platform: PlatformEnum,
    format: z
        .enum([
        "portrait_4_5",
        "square_1_1",
        "story_9_16",
        "landscape_16_9",
        "linkedin_pdf_carousel",
    ])
        .default("portrait_4_5"),
    headline: z.string().min(2).describe("Main bold editorial headline for the post or slide 1"),
    subheadline: z.string().optional().describe("Supporting subtitle or key takeaway"),
    slides: z
        .array(z.object({
        title: z.string(),
        body: z.string(),
        metricOrProof: z.string().optional(),
    }))
        .optional()
        .describe("Optional array of slides for multi-slide LinkedIn PDF carousels"),
    primaryHex: z.string().optional().default("#323F76"),
    accentHex: z.string().optional().default("#731B2B"),
    darkHex: z.string().optional().default("#0C182E"),
    logoPath: z.string().optional(),
    ctaText: z.string().optional(),
    websiteOrContact: z.string().optional(),
    outputDir: z.string().optional(),
}, async (options) => {
    const res = await designSovereignSocialPostOrCarousel({
        ...options,
        platform: options.platform,
    });
    return formatJsonResult(res);
});
server.tool("wannago_detect_peak_hours", "WannaGoTech Chrono-Algorithmic Peak-Hour Detector. Computes the exact highest-reach publication windows ('Golden Velocity Windows') for any of the 9 platforms based on audience segment ('B2B', 'B2C', 'Tech_SaaS', 'Mixed') — preventing random low-reach publishing.", {
    platforms: z.array(PlatformEnum).optional(),
    audienceType: z
        .enum(["B2B", "B2C", "Tech_SaaS", "Mixed"])
        .optional()
        .default("B2B"),
    referenceDateIso: z.string().optional(),
}, async (options) => {
    const res = detectOptimalPeakHours({
        platforms: options.platforms,
        audienceType: options.audienceType,
        referenceDateIso: options.referenceDateIso,
    });
    return formatJsonResult(res);
});
server.tool("wannago_linkedin_sovereign_suite", "Complete LinkedIn Management & B2B Growth Engine WITHOUT Sales Navigator or Paid LinkedIn Pro Subscription. Generates: (1) Advanced Boolean Search strings, (2) Google X-Ray Profile & Buying-Intent Search queries (bypassing LinkedIn commercial search limits), (3) Competitor Viral Post Commenter Extraction workflow, (4) Dwell-Time Post Architect (<140 chars hook before 'see more', 0 external links in body + link in 1st comment to avoid -40% penalty), (5) Free-Tier Connection Note Optimizer (<195 chars), and (6) Local Markdown CRM ('LINKEDIN_PROSPECTS_CRM.md').", {
    brandName: z.string().min(1),
    targetRoles: z
        .array(z.string())
        .min(1)
        .describe("Target decision-maker roles, e.g. ['CEO', 'Founder', 'Directeur Marketing']"),
    targetSectors: z
        .array(z.string())
        .min(1)
        .describe("Target industries or niches, e.g. ['SaaS B2B', 'Santé']"),
    targetLocations: z
        .array(z.string())
        .optional()
        .default(["France", "Europe"]),
    coreOffer: z
        .string()
        .min(5)
        .describe("Clear outcome/result your brand delivers"),
    postTopic: z.string().optional(),
    websiteUrl: z.string().optional(),
    outputDir: z.string().optional(),
}, async (options) => {
    const res = generateLinkedInProFreeSuite({
        ...options,
        targetLocations: options.targetLocations || ["France", "Europe"],
    });
    return formatJsonResult(res);
});
server.tool("wannago_content_strategy_planner", "Builds a comprehensive Digital Marketing Strategy and writes a dated, interactive Markdown tracking calendar ('CONTENT_STRATEGY_CALENDAR.md') with exact dates, Peak-Hour timestamps, 4 Content Pillars, formats, KPIs, and automatically schedules pre-publication reminders.", {
    brandName: z.string().min(1),
    businessDescription: z.string().min(5),
    targetAudience: z.string().min(2),
    inspirationsAndTone: z
        .string()
        .min(2)
        .describe("Visual and editorial inspirations confirmed with the user in chat"),
    platforms: z.array(PlatformEnum).min(1),
    durationDays: z.number().min(7).max(365).optional().default(30),
    postsPerWeek: z.number().min(1).max(14).optional().default(4),
    startDateIso: z.string().optional(),
    autoCreateReminders: z.boolean().optional().default(true),
    outputDir: z.string().optional(),
}, async (options) => {
    const res = buildDatedContentStrategyAndCalendar({
        ...options,
        platforms: options.platforms,
    });
    return formatJsonResult(res);
});
server.tool("wannago_schedule_reminders", "Manages scheduled marketing reminders ('.data/marketing_reminders.json') so the user and agent are notified in chat before every content creation, design validation, peak-hour publication, or weekly KPI report.", {
    action: z.enum(["list", "add", "complete", "check_due"]),
    brandName: z.string().optional(),
    title: z.string().optional(),
    dueAtIso: z.string().optional(),
    channel: z
        .union([
        PlatformEnum,
        z.literal("all"),
        z.literal("strategy"),
        z.literal("report"),
        z.literal("ads"),
    ])
        .optional(),
    actionRequired: z.string().optional(),
    reminderId: z.string().optional(),
}, async (options) => {
    const res = manageMarketingReminders({
        ...options,
        channel: options.channel,
    });
    return formatJsonResult(res);
});
server.tool("wannago_generate_marketing_report", "Generates a dated Executive Digital Marketing Report ('MARKETING_REPORT_<DATE>.md') consolidating published vs scheduled posts, reminders status, platform performance metrics, Peak-Hour compliance, Anti-AI visual score, and concrete strategic recommendations.", {
    brandName: z.string().min(1),
    periodLabel: z.string().optional(),
    metricsSummary: z
        .array(z.object({
        platform: z.string(),
        postsPublished: z.number(),
        impressions: z.number(),
        engagementRatePct: z.number(),
        leadsOrClicks: z.number(),
        bestPeakHourObserved: z.string().optional(),
    }))
        .optional(),
    highlightsAndWins: z.array(z.string()).optional(),
    nextWeekActions: z.array(z.string()).optional(),
    outputDir: z.string().optional(),
}, async (options) => {
    const res = generateMarketingExecutiveReport(options);
    return formatJsonResult(res);
});
server.tool("wannago_ads_campaign_manager", "WannaGoTech Sovereign Paid Ads Campaign Architect. Designs a complete, ready-to-launch multi-platform Paid Media plan ('ADS_CAMPAIGN_MASTERPLAN.md') across Meta Ads, Google Ads, LinkedIn Ads, TikTok Ads, and X Ads with TOF/MOF/BOF budget allocation, A/B anti-AI creative variants, UTM tracking links, and automated CPA/ROAS kill-switch rules.", {
    brandName: z.string().min(1),
    coreOffer: z.string().min(3),
    targetAudience: z.string().min(3),
    monthlyBudgetEur: z.number().min(50),
    targetCpaEur: z.number().min(1).optional().default(45),
    channels: z
        .array(z.enum(["meta_ads", "google_ads", "linkedin_ads", "tiktok_ads", "x_ads"]))
        .min(1),
    landingPageUrl: z.string().min(3),
    outputDir: z.string().optional(),
}, async (options) => {
    const res = buildSovereignAdsCampaignPlan({
        ...options,
        targetCpaEur: options.targetCpaEur ?? 45,
    });
    return formatJsonResult(res);
});
// ═══════════════════════════════════════════════════════════════════════════
// SOVEREIGN GMAIL & EMAIL MARKETING SUITE (100% REA — Zero Third-Party Dependency)
// ═══════════════════════════════════════════════════════════════════════════
server.tool("gmail_configure_and_check_auth", "WannaGoTech Sovereign Gmail & Google Workspace Configuration (100% Native TLS SMTP/IMAP + Gmail REST API + Isolated Local Playwright Session). Configures your Gmail account, 600px WCAG 2.1 AA/AAA HTML signature (`tabular-nums`, BiDi isolation), and checks authentication status.", {
    email: z.string().email().optional().describe("Gmail or Google Workspace email address (e.g., 'contact@wannago.tech')"),
    senderName: z.string().optional().describe("Display name for outgoing emails (e.g., 'WannaGoTech')"),
    appPassword: z.string().optional().describe("Google 16-char App Password for direct native TLS SMTP (465) & IMAP (993)"),
    oauthAccessToken: z.string().optional().describe("Optional Google OAuth2 Access Token for Gmail REST API v1"),
    preferredMode: z.enum(["smtp_imap", "gmail_api", "browser"]).optional(),
    brandName: z.string().optional(),
    brandRole: z.string().optional(),
    brandPhone: z.string().optional(),
    brandWebsite: z.string().optional(),
    openBrowserLogin: z
        .boolean()
        .optional()
        .default(false)
        .describe("When true, opens an isolated local Playwright browser window on https://mail.google.com for interactive sign-in"),
}, async (options) => {
    const res = await configureAndCheckGmailAuth(options);
    return formatJsonResult(res);
});
server.tool("gmail_read_inbox", "Reads recent Gmail messages from INBOX via native IMAP TLS (imap.gmail.com:993) or Gmail REST API v1, and automatically flags incoming WannaGo 72h Trial ('[TRIAL-72H]') or Pro License ('[PRO-LICENSE]') requests.", {
    limit: z.number().min(1).max(50).optional().default(10),
    query: z.string().optional().describe("Optional search filter (e.g., 'TRIAL-72H', 'is:unread', 'from:client@company.com')"),
}, async (options) => {
    const res = await readGmailInboxMessages(options);
    return formatJsonResult(res);
});
server.tool("gmail_send_email", "Sends or previews (`dryRun: true` by default) a WCAG-certified HTML & Plain-Text email via Gmail (SMTP TLS 465 or Gmail REST API) with automatic 600px WannaGoTech HTML signature injection and local RFC-5322 `.eml` export.", {
    to: z.array(z.string().email()).min(1).describe("Recipient email addresses"),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subject: z.string().min(1).describe("Email subject line"),
    bodyText: z.string().min(1).describe("Plain-text body of the email"),
    bodyHtml: z.string().optional().describe("Optional custom HTML body (automatically wrapped in 600px WCAG layout)"),
    includeSignature: z.boolean().optional().default(true).describe("Automatically append the 600px WCAG 2.1 AA/AAA signature"),
    dryRun: z
        .boolean()
        .optional()
        .default(true)
        .describe("Default true (Zero-Invention rule): generates local .eml + HTML preview for chat confirmation before live sending"),
}, async (options) => {
    const res = await sendOrPreviewGmailMessage({
        ...options,
        dryRun: options.dryRun ?? true,
    });
    return formatJsonResult(res);
});
server.tool("gmail_create_draft", "Creates a ready-to-send email draft in Gmail (`[Gmail]/Drafts` via Gmail API or local RFC-5322 `.eml` + 600px HTML preview in `.data/gmail-outbox/`) with embedded 600px WCAG HTML signature.", {
    to: z.array(z.string().email()).min(1),
    cc: z.array(z.string().email()).optional(),
    subject: z.string().min(1),
    bodyText: z.string().min(1),
    bodyHtml: z.string().optional(),
    includeSignature: z.boolean().optional().default(true),
    syncToRemoteGmailDrafts: z.boolean().optional().default(false),
}, async (options) => {
    const res = await sendOrPreviewGmailMessage({
        to: options.to,
        cc: options.cc,
        subject: options.subject,
        bodyText: options.bodyText,
        bodyHtml: options.bodyHtml,
        includeSignature: options.includeSignature ?? true,
        dryRun: !options.syncToRemoteGmailDrafts,
        createDraftOnly: true,
    });
    return formatJsonResult(res);
});
server.tool("gmail_send_license_or_trial_key", "Automated WannaGoTech Licensing & Onboarding Dispatcher. Generates a cryptographically signed 72h Free Trial key (`wgo_trial_...`) or commercial license (`wgo_live_...`), builds the branded 600px HTML onboarding email with ready-to-use `mcp_config.json` and Automattic Partner WordPress offer, and previews (`dryRun: true`) or sends it via Gmail.", {
    recipientEmail: z.string().email().describe("Client email address receiving the key"),
    clientName: z.string().min(1).describe("Client or company name"),
    tier: z.enum(["trial", "standard", "pro", "enterprise"]).optional().default("trial"),
    validDays: z.number().min(1).max(3650).optional().default(3),
    dryRun: z
        .boolean()
        .optional()
        .default(true)
        .describe("When true (default), previews the generated key and .eml/.html onboarding email before sending"),
}, async (options) => {
    const res = await issueAndSendWannaGoLicenseEmail({
        recipientEmail: options.recipientEmail,
        clientName: options.clientName,
        tier: options.tier ?? "trial",
        validDays: options.validDays ?? 3,
        dryRun: options.dryRun ?? true,
    });
    return formatJsonResult(res);
});
server.tool("gmail_campaign_sequence", "Sovereign B2B Email Outreach & Follow-Up Sequence Engine synced with `LINKEDIN_PROSPECTS_CRM.md`. Enforces a strict 30 emails/day anti-spam rate-limit guardrail, injects personalized prospect hooks and 600px WCAG signatures, and writes `GMAIL_OUTREACH_CAMPAIGN.md`.", {
    campaignName: z.string().min(2),
    prospects: z
        .array(z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        company: z.string().min(1),
        role: z.string().optional(),
        painPoint: z.string().optional(),
    }))
        .min(1),
    valueProposition: z.string().min(5),
    callToAction: z.string().min(3),
    dryRun: z.boolean().optional().default(true),
    outputDir: z.string().optional(),
}, async (options) => {
    const res = await buildAndRunGmailOutreachSequence({
        ...options,
        dryRun: options.dryRun ?? true,
    });
    return formatJsonResult(res);
});
async function main() {
    const isHttp = process.argv.includes("--http") || process.env.MCP_TRANSPORT === "http";
    if (!isHttp) {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        return;
    }
    // Remote HTTP / SSE Server Mode with Mandatory Bearer Security Key Verification
    const portIdx = process.argv.indexOf("--port");
    const port = portIdx !== -1 && process.argv[portIdx + 1]
        ? parseInt(process.argv[portIdx + 1], 10)
        : parseInt(process.env.PORT || "8787", 10);
    let sseTransport = null;
    const httpServer = http.createServer(async (req, res) => {
        const urlObj = new URL(req.url || "/", `http://localhost:${port}`);
        // Health check endpoint (public)
        if (req.method === "GET" && urlObj.pathname === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                name: "wannago-mcp",
                version: "3.0.0",
                status: "ok",
                authRequired: true,
            }));
            return;
        }
        // Extract Security Key from Authorization: Bearer <key>, X-WannaGo-Key, or ?apiKey=
        const authHeader = req.headers["authorization"] || "";
        const bearerKey = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : undefined;
        const customHeaderKey = typeof req.headers["x-wannago-key"] === "string"
            ? req.headers["x-wannago-key"].trim()
            : undefined;
        const queryKey = urlObj.searchParams.get("apiKey") || undefined;
        const candidateKey = bearerKey || customHeaderKey || queryKey;
        const check = verifySecurityKey(candidateKey);
        if (!check.valid) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                error: "Unauthorized",
                message: check.error,
                hint: "Pass header 'Authorization: Bearer wgo_live_...' or 'X-WannaGo-Key: wgo_live_...'",
            }));
            return;
        }
        // Activate verified key for tool invocations
        if (candidateKey) {
            process.env.WANNAGO_API_KEY = candidateKey;
        }
        if (req.method === "GET" && urlObj.pathname === "/sse") {
            sseTransport = new SSEServerTransport("/messages", res);
            await server.connect(sseTransport);
            return;
        }
        if (req.method === "POST" && urlObj.pathname === "/messages") {
            if (!sseTransport) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "No active SSE session" }));
                return;
            }
            await sseTransport.handlePostMessage(req, res);
            return;
        }
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            error: "Not Found",
            endpoints: ["/health", "/sse", "/messages"],
        }));
    });
    httpServer.listen(port, () => {
        console.error(`[wannago-mcp v3.0.0] Secured Remote MCP Server listening on http://localhost:${port}/sse (WANNAGO_API_KEY required)`);
    });
}
main().catch((err) => {
    console.error("Fatal error in wannago-mcp:", err);
    process.exit(1);
});
