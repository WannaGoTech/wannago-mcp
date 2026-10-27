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
import { createSocialAccountsFlow, listConnectedPhones, readRecentPhoneOtpCodes, runArtemisTaskOnPhone, } from "./mobile/artemisPhoneManager.js";
import { runBragOmniVideoGeneration, runDesignAuditOnDirectory, runOneShotBrandKitGeneration, } from "./branding/brandKitRunner.js";
import { acpController } from "./acp/acpController.js";
import { assertAuthorized, verifySecurityKey, } from "./security/authGuard.js";
const PlatformEnum = z.enum(SUPPORTED_PLATFORMS);
const server = new McpServer({
    name: "wannago-mcp",
    version: "3.0.0",
});
// Intercept server.tool so every protected tool enforces WANNAGO_API_KEY verification
const rawTool = server.tool.bind(server);
server.tool = (name, description, schema, handler) => {
    return rawTool(name, description, schema, async (...args) => {
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
        hint: check.valid
            ? "Security key verified! All 23 WannaGo MCP & ACP tools are unlocked."
            : "Set WANNAGO_API_KEY in your mcp_config.json 'env' block or pass a valid 'wgo_live_...' key to unlock WannaGo MCP.",
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
    website: z.string().optional().describe("Official website domain (e.g. 'wannamed.com')"),
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
server.tool("wannago_generate_brag_video", "Automated WannaGo Launch Video Generator. Turns any brand, product, or website into a 20-second shareable launch video (brag.mp4) with beat-synced music, sound effects, settled poster frame (brag.jpg) baked into Frame 0 for X/LinkedIn/Discord thumbnails, storyboard (brag-plan.md), and share copy (share-copy.txt).", {
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
        .describe("Brag tone preset controlling pacing, music, and SFX energy"),
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
    const res = await runBragOmniVideoGeneration(options);
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
server.tool("wannago_create_social_accounts", "Assists and automates creating new social media accounts for a brand across any of the 9 platforms (x, linkedin, instagram, facebook, tiktok, youtube, bluesky, threads, reddit) using either the internal persistent browser ('browser'), a connected phone via WannaGo Mobile Bridge ('phone_artemis'), or 'hybrid'.", {
    platforms: z
        .array(PlatformEnum)
        .min(1)
        .describe("Platforms where accounts should be created"),
    mode: z
        .enum(["browser", "phone_artemis", "hybrid"])
        .optional()
        .default("browser")
        .describe("'browser' to open signup flows in persistent browser and pre-fill brand info; 'phone_artemis' to drive native apps on connected Android phone via WannaGo Mobile Bridge; 'hybrid' for browser + phone OTP"),
    brandName: z.string().min(1).describe("Brand display name"),
    desiredHandle: z
        .string()
        .min(2)
        .describe("Desired @username / handle (e.g. 'wannamed')"),
    email: z.string().email().describe("Official brand email for registration"),
    phone: z
        .string()
        .optional()
        .describe("Optional phone number for SMS verification"),
    bioOrTagline: z
        .string()
        .optional()
        .describe("Official brand tagline/bio to set on the profile"),
    website: z.string().optional().describe("Official website URL"),
    avatarPath: z
        .string()
        .optional()
        .describe("Optional path to the generated Avatar PNG (e.g. from 01_Logos/PNG_High_Resolution/Social_Profile_Avatar_800x800.png)"),
    deviceSerial: z.string().optional(),
}, async (options) => {
    const res = await createSocialAccountsFlow({
        platforms: options.platforms,
        mode: options.mode ?? "browser",
        brandName: options.brandName,
        desiredHandle: options.desiredHandle,
        email: options.email,
        phone: options.phone,
        bioOrTagline: options.bioOrTagline,
        website: options.website,
        avatarPath: options.avatarPath,
        deviceSerial: options.deviceSerial,
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
