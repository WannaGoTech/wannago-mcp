import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT, SCREENSHOTS_DIR, sessionManager, } from "../browser/sessionManager.js";
const execFileAsync = promisify(execFile);
const ADB_CANDIDATES = [
    "C:\\Users\\hp\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
    "c:\\Users\\hp\\Desktop\\Workspace\\AOSP\\platform-tools\\adb.exe",
    "adb",
];
const UV_CANDIDATES = [
    "C:\\Users\\hp\\.local\\bin\\uv.exe",
    "uv",
];
export const ARTEMIS_DIR = path.join(PROJECT_ROOT, "vendor", "artemis");
export function resolveAdbPath() {
    for (const cand of ADB_CANDIDATES) {
        if (cand === "adb" || fs.existsSync(cand)) {
            return cand;
        }
    }
    return "adb";
}
export function resolveUvPath() {
    for (const cand of UV_CANDIDATES) {
        if (cand === "uv" || fs.existsSync(cand)) {
            return cand;
        }
    }
    return "uv";
}
export async function listConnectedPhones() {
    const adbPath = resolveAdbPath();
    const artemisInstalled = fs.existsSync(path.join(ARTEMIS_DIR, "pyproject.toml"));
    try {
        const { stdout } = await execFileAsync(adbPath, ["devices", "-l"], {
            timeout: 10000,
        });
        const lines = stdout
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("List of devices"));
        const devices = lines.map((line) => {
            const parts = line.split(/\s+/);
            const serial = parts[0] || "";
            const state = parts[1] || "unknown";
            const modelMatch = line.match(/model:(\S+)/);
            const prodMatch = line.match(/product:(\S+)/);
            return {
                serial,
                state,
                model: modelMatch ? modelMatch[1] : undefined,
                product: prodMatch ? prodMatch[1] : undefined,
            };
        });
        return {
            adbPath,
            artemisDir: ARTEMIS_DIR,
            artemisInstalled,
            devices,
        };
    }
    catch (err) {
        return {
            adbPath,
            artemisDir: ARTEMIS_DIR,
            artemisInstalled,
            devices: [],
        };
    }
}
/**
 * Reads recent SMS messages on the connected Android phone to extract OTP / verification codes
 * sent during social media account creation or 2FA login.
 */
export async function readRecentPhoneOtpCodes(deviceSerial, limit = 5) {
    const adbPath = resolveAdbPath();
    const baseArgs = deviceSerial ? ["-s", deviceSerial] : [];
    try {
        const { stdout } = await execFileAsync(adbPath, [
            ...baseArgs,
            "shell",
            "content query --uri content://sms/inbox --projection body:date --sort 'date DESC'",
        ], { timeout: 12000 });
        const rows = stdout
            .split(/\r?\n/)
            .filter((r) => r.includes("Row:"))
            .slice(0, limit);
        const messages = rows.map((row) => {
            const codes = Array.from(row.matchAll(/\b(\d{4,8})\b/g)).map((m) => m[1]);
            return {
                body: row.slice(0, 280),
                extractedCodes: codes,
            };
        });
        return {
            deviceSerial,
            messages,
        };
    }
    catch (err) {
        return {
            deviceSerial,
            messages: [],
            error: err instanceof Error
                ? err.message
                : "Unable to read SMS inbox via ADB (check USB debugging / SMS permission on phone).",
        };
    }
}
/**
 * Runs a natural-language mobile automation task on the connected Android phone using Google Artemis
 * (`https://github.com/google/artemis`), with ADB fallback.
 */
export async function runArtemisTaskOnPhone(options) {
    const phoneStatus = await listConnectedPhones();
    const activeDevices = phoneStatus.devices.filter((d) => d.state === "device");
    if (activeDevices.length === 0) {
        return {
            status: "no_device",
            profile: options.profile || "flash",
            output: "No authorized Android phone detected via ADB. Connect your phone via USB (or Wireless Debugging) with USB Debugging enabled, accept the RSA prompt on the phone screen, and try again.",
        };
    }
    const targetSerial = options.deviceSerial || activeDevices[0].serial;
    const uvPath = resolveUvPath();
    const profile = options.profile || "flash";
    try {
        const args = [
            "run",
            "artemis",
            "run",
            options.prompt,
            "--profile",
            profile,
            "--device",
            targetSerial,
        ];
        const { stdout, stderr } = await execFileAsync(uvPath, args, {
            cwd: ARTEMIS_DIR,
            timeout: 180000,
        });
        return {
            status: "completed",
            deviceSerial: targetSerial,
            profile,
            output: (stdout + "\n" + stderr).trim().slice(0, 4000),
        };
    }
    catch (err) {
        // Capture phone screenshot via ADB as diagnostic fallback
        const adbPath = resolveAdbPath();
        const shotPath = path.join(SCREENSHOTS_DIR, `phone-${targetSerial}-${Date.now()}.png`);
        try {
            await execFileAsync(adbPath, [
                "-s",
                targetSerial,
                "exec-out",
                "screencap",
                "-p",
            ], { encoding: "buffer", maxBuffer: 20 * 1024 * 1024 }).then(({ stdout }) => {
                fs.writeFileSync(shotPath, stdout);
            });
        }
        catch {
            // ignore screenshot failure
        }
        return {
            status: "error",
            deviceSerial: targetSerial,
            profile,
            output: `Artemis execution note: ${err instanceof Error ? err.message : String(err)}`,
            screenshotPath: fs.existsSync(shotPath) ? shotPath : undefined,
        };
    }
}
export const SIGNUP_URLS = {
    x: "https://x.com/i/flow/signup",
    linkedin: "https://www.linkedin.com/signup",
    instagram: "https://www.instagram.com/accounts/emailsignup/",
    facebook: "https://www.facebook.com/r.php",
    tiktok: "https://www.tiktok.com/signup/phone-or-email/email",
    youtube: "https://accounts.google.com/signup",
    bluesky: "https://bsky.app/",
    threads: "https://www.threads.net/login",
    reddit: "https://www.reddit.com/register/",
};
export const PLATFORM_ADMIN_GOVERNANCE = {
    linkedin: {
        platform: "linkedin",
        governanceModel: "page_under_personal_admin",
        pageOrAccountCreationUrl: "https://www.linkedin.com/company/setup/new/",
        adminPermissionsUrl: "https://www.linkedin.com/company/setup/new/",
        adminRoleLabel: "Super Admin (LinkedIn Company Page)",
        description: "Creates an official LinkedIn Company Page under the existing personal LinkedIn profile of the Admin Owner (Super Admin).",
    },
    facebook: {
        platform: "facebook",
        governanceModel: "page_under_personal_admin",
        pageOrAccountCreationUrl: "https://www.facebook.com/pages/create/",
        adminPermissionsUrl: "https://business.facebook.com/latest/settings/business_users",
        adminRoleLabel: "Full Control Page Admin (Facebook Page & Meta Business Suite)",
        description: "Creates an official Facebook Business Page under the existing personal Facebook profile of the Admin Owner with Full Control.",
    },
    youtube: {
        platform: "youtube",
        governanceModel: "page_under_personal_admin",
        pageOrAccountCreationUrl: "https://www.youtube.com/channel_switcher",
        adminPermissionsUrl: "https://myaccount.google.com/brandaccounts",
        adminRoleLabel: "Primary Owner / Manager (YouTube Brand Account Channel)",
        description: "Creates a dedicated YouTube Brand Channel under the Admin Owner's Google account (or assigns Primary Owner in Brand Accounts).",
    },
    reddit: {
        platform: "reddit",
        governanceModel: "page_under_personal_admin",
        pageOrAccountCreationUrl: "https://www.reddit.com/subreddits/create",
        adminPermissionsUrl: "https://www.reddit.com/subreddits/create",
        adminRoleLabel: "Head Moderator / Full Permissions Admin (Subreddit r/<Brand>)",
        description: "Creates the official brand Subreddit community under the Admin Owner's Reddit account with full Moderator permissions (plus optional brand handle).",
    },
    instagram: {
        platform: "instagram",
        governanceModel: "brand_account_with_delegated_admin",
        pageOrAccountCreationUrl: "https://www.instagram.com/accounts/emailsignup/",
        adminPermissionsUrl: "https://business.facebook.com/latest/settings/instagram_account",
        adminRoleLabel: "Meta Accounts Center / Business Suite Admin",
        description: "Creates the brand Instagram Professional account and links it to the Admin Owner's Meta Business Suite / Accounts Center for shared Admin control.",
    },
    threads: {
        platform: "threads",
        governanceModel: "brand_account_with_delegated_admin",
        pageOrAccountCreationUrl: "https://www.threads.net/login",
        adminPermissionsUrl: "https://www.threads.net/settings/account",
        adminRoleLabel: "Instagram-Linked Professional Admin",
        description: "Activates the official Threads profile linked to the brand Instagram Professional account managed by the Admin Owner.",
    },
    x: {
        platform: "x",
        governanceModel: "brand_account_with_delegated_admin",
        pageOrAccountCreationUrl: "https://x.com/i/flow/signup",
        adminPermissionsUrl: "https://x.com/settings/delegate",
        adminRoleLabel: "X Delegate Admin / Contributor",
        description: "Creates the official brand X handle and delegates Admin/Contributor access to the Admin Owner's personal X account via X Delegate.",
    },
    tiktok: {
        platform: "tiktok",
        governanceModel: "brand_account_with_delegated_admin",
        pageOrAccountCreationUrl: "https://www.tiktok.com/signup/phone-or-email/email",
        adminPermissionsUrl: "https://business.tiktok.com/",
        adminRoleLabel: "TikTok Business Center Admin",
        description: "Creates the official brand TikTok Business account and assigns the Admin Owner in TikTok Business Center.",
    },
    bluesky: {
        platform: "bluesky",
        governanceModel: "brand_account_with_delegated_admin",
        pageOrAccountCreationUrl: "https://bsky.app/",
        adminPermissionsUrl: "https://bsky.app/settings/account",
        adminRoleLabel: "Primary Account Owner / Multi-Account Admin",
        description: "Creates the official brand Bluesky handle and links it in the Admin Owner's multi-account switcher.",
    },
};
const PLATFORM_COVER_SPECS = {
    x: { suffix: "Header_X_Twitter_1500x500.png", dim: "1500x500", bioLimit: 160 },
    linkedin: {
        suffix: "Header_LinkedIn_1584x396.png",
        dim: "1584x396",
        bioLimit: 120,
    },
    instagram: {
        suffix: "Header_Instagram_Cover_1080x1920.png",
        dim: "1080x1920",
        bioLimit: 150,
    },
    facebook: {
        suffix: "Header_Facebook_Cover_1640x924.png",
        dim: "1640x924",
        bioLimit: 255,
    },
    tiktok: {
        suffix: "Header_TikTok_Cover_1080x1920.png",
        dim: "1080x1920",
        bioLimit: 80,
    },
    youtube: {
        suffix: "Header_YouTube_Web_2560x1440.png",
        dim: "2560x1440",
        bioLimit: 1000,
    },
    bluesky: {
        suffix: "Header_Bluesky_Banner_1500x500.png",
        dim: "1500x500",
        bioLimit: 256,
    },
    threads: {
        suffix: "Header_Threads_Card_1200x630.png",
        dim: "1200x630",
        bioLimit: 150,
    },
    reddit: {
        suffix: "Header_Reddit_Banner_1920x384.png",
        dim: "1920x384",
        bioLimit: 500,
    },
};
export function buildPlatformSocialProfilePack(platform, options) {
    const slug = options.brandName.replace(/\s+/g, "_");
    const cleanHandle = options.desiredHandle.replace(/^@/, "");
    const cleanWeb = (options.website || `${cleanHandle}.com`)
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
    const spec = PLATFORM_COVER_SPECS[platform];
    const baseTagline = options.bioOrTagline ||
        `${options.brandName} — Official Platform & Digital Ecosystem`;
    const brandDir = options.brandDir ||
        path.join("C:\\Users\\hp\\Desktop\\Workspace\\Marketing", slug);
    const packsDir = path.join(brandDir, "04_Headers_Letterhead_and_Stationery", "Social_Platform_Packs");
    const headersDir = path.join(brandDir, "04_Headers_Letterhead_and_Stationery", "Digital_and_Social_Media_Headers");
    const candidateAvatar = path.join(packsDir, `${slug}_${platform.toUpperCase()}_Avatar_800x800_Dark.png`);
    const fallbackAvatar = options.avatarPath ||
        path.join(brandDir, "01_Logos", "PNG_High_Resolution", "Social_Profile_Avatar_800x800.png");
    const candidateCover = path.join(packsDir, `${slug}_${spec.suffix}`);
    const fallbackCover = path.join(headersDir, `${slug}_${spec.suffix}`);
    return {
        platform,
        displayName: options.brandName,
        desiredHandle: `@${cleanHandle}`,
        bioCharLimit: spec.bioLimit,
        bio: {
            FR: `${baseTagline} | https://${cleanWeb}`.slice(0, spec.bioLimit),
            EN: `${baseTagline} | https://${cleanWeb}`.slice(0, spec.bioLimit),
            DE: `${baseTagline} | https://${cleanWeb}`.slice(0, spec.bioLimit),
            AR: `${options.brandName} | https://${cleanWeb}`.slice(0, spec.bioLimit),
        },
        longDescription: {
            FR: `${options.brandName} : ${baseTagline}\nSite officiel : https://${cleanWeb}`,
            EN: `${options.brandName}: ${baseTagline}\nOfficial Website: https://${cleanWeb}`,
        },
        avatarPath800x800: fs.existsSync(candidateAvatar)
            ? candidateAvatar
            : fallbackAvatar,
        coverBannerPath: fs.existsSync(candidateCover)
            ? candidateCover
            : fallbackCover,
        coverDimensions: spec.dim,
        website: `https://${cleanWeb}`,
    };
}
/**
 * Automates or assists creating new social media accounts & brand pages for any brand using:
 * - "browser": Internal persistent browser (pre-filling brand details and/or creating Company Pages under the chosen Admin Owner)
 * - "phone_artemis": Connected Android phone via WannaGo Mobile Bridge (Google Artemis / ADB)
 * - "hybrid": Phone Artemis + Persistent Browser + ADB SMS OTP extraction
 *
 * Supports generic Admin Owner Governance (`adminOwnerName`, `adminOwnerEmail`, `adminOwnerHandle`, `useExistingAdminForPages`):
 * When an Admin Owner is specified by the user, platforms with Pages/Channels/Communities (LinkedIn, Facebook, YouTube, Reddit)
 * create the Brand Page under the Admin Owner's existing personal account as Super Admin / Primary Owner,
 * while handle-based platforms (X, Instagram, Threads, TikTok, Bluesky) delegate Admin rights to that Admin Owner.
 */
export async function createSocialAccountsFlow(options) {
    const adminOwnerName = options.adminOwnerName?.trim() || null;
    const useExistingAdminForPages = options.useExistingAdminForPages ?? Boolean(adminOwnerName);
    const cleanHandle = options.desiredHandle.replace(/^@/, "");
    const adminLabel = adminOwnerName || "Designated Admin Owner";
    const phoneStatus = await listConnectedPhones();
    const hasConnectedPhone = phoneStatus.devices.some((d) => d.state === "device");
    const recentOtpMessages = hasConnectedPhone
        ? await readRecentPhoneOtpCodes(options.deviceSerial, 5)
        : undefined;
    const platformResults = [];
    for (const platform of options.platforms) {
        const gov = PLATFORM_ADMIN_GOVERNANCE[platform];
        const profilePack = buildPlatformSocialProfilePack(platform, {
            brandName: options.brandName,
            desiredHandle: cleanHandle,
            bioOrTagline: options.bioOrTagline,
            website: options.website,
            avatarPath: options.avatarPath,
        });
        const isPageUnderAdmin = useExistingAdminForPages &&
            gov.governanceModel === "page_under_personal_admin";
        const targetUrl = isPageUnderAdmin
            ? gov.pageOrAccountCreationUrl
            : SIGNUP_URLS[platform];
        // Option B: Phone Artemis execution when an Android device is authorized over ADB
        if ((options.mode === "phone_artemis" || options.mode === "hybrid") &&
            hasConnectedPhone) {
            const prompt = isPageUnderAdmin
                ? `Open ${platform} (or browser at ${targetUrl}) using ${adminLabel}'s existing logged-in personal account. ` +
                    `Create an official Brand Page / Channel / Community for '${options.brandName}' (handle/slug '${cleanHandle}', website '${profilePack.website}', bio '${profilePack.bio.FR}'). ` +
                    `Ensure '${adminLabel}' is set as ${gov.adminRoleLabel}. Stop if a confirmation or 2FA prompt requires review.`
                : `Open ${platform} (or browser at ${targetUrl}) and create or connect the official brand account for '${options.brandName}' ` +
                    `with handle '@${cleanHandle}', email '${options.email}', bio '${profilePack.bio.FR}'` +
                    (options.phone ? `, phone '${options.phone}'` : "") +
                    (adminOwnerName
                        ? `. Then link or delegate Admin permissions (${gov.adminRoleLabel}) to '${adminOwnerName}'` +
                            (options.adminOwnerHandle ? ` (${options.adminOwnerHandle})` : "")
                        : "") +
                    `. Stop at verification code or password confirmation screen.`;
            const artemisRes = await runArtemisTaskOnPhone({
                prompt,
                profile: "pro",
                deviceSerial: options.deviceSerial,
            });
            if (options.mode === "phone_artemis") {
                platformResults.push({
                    platform,
                    governanceModel: gov.governanceModel,
                    adminOwnerAssigned: adminOwnerName,
                    adminRoleLabel: gov.adminRoleLabel,
                    targetUrl,
                    adminPermissionsUrl: gov.adminPermissionsUrl,
                    profilePack,
                    status: artemisRes.status,
                    details: `${artemisRes.output} | Admin Governance: ${adminLabel} -> ${gov.adminRoleLabel}`,
                    screenshotPath: artemisRes.screenshotPath,
                });
                continue;
            }
        }
        // Browser or Hybrid fallback: Open persistent headed browser tab for either Page Creation under Admin or Brand Account + Admin Delegation
        const page = await sessionManager.newPage(false);
        try {
            await page.goto(targetUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
            });
            await page.waitForTimeout(3500);
            if (isPageUnderAdmin) {
                // Attempt to pre-fill Company Page / Facebook Page / Channel / Subreddit name & slug inputs if visible
                const pageNameInputs = page.locator('input[name="name"], input[placeholder*="company" i], input[placeholder*="page name" i], input#organization-name, input[aria-label*="Page name" i]');
                if ((await pageNameInputs.count()) > 0 &&
                    (await pageNameInputs.first().isVisible())) {
                    await pageNameInputs.first().click();
                    await page.keyboard.insertText(options.brandName);
                }
                const slugInputs = page.locator('input[name="universal-name"], input[placeholder*="linkedin.com/company/" i], input[name="slug"]');
                if ((await slugInputs.count()) > 0 &&
                    (await slugInputs.first().isVisible())) {
                    await slugInputs.first().click();
                    await page.keyboard.insertText(cleanHandle);
                }
                const websiteInputs = page.locator('input[name="website"], input[type="url"], input[placeholder*="website" i]');
                if (options.website &&
                    (await websiteInputs.count()) > 0 &&
                    (await websiteInputs.first().isVisible())) {
                    await websiteInputs.first().click();
                    await page.keyboard.insertText(options.website);
                }
                const bioInputs = page.locator('textarea[name*="tagline" i], textarea[name*="bio" i], textarea[name*="description" i], input[name*="tagline" i]');
                if ((await bioInputs.count()) > 0 &&
                    (await bioInputs.first().isVisible())) {
                    await bioInputs.first().click();
                    await page.keyboard.insertText(profilePack.bio.FR);
                }
            }
            else {
                // Brand Account registration inputs (email, brand display name, @handle)
                const emailInputs = page.locator('input[name="email"], input[type="email"], input[name="emailOrPhone"], input#email-address');
                if ((await emailInputs.count()) > 0 &&
                    (await emailInputs.first().isVisible())) {
                    await emailInputs.first().click();
                    await page.keyboard.insertText(options.email);
                }
                const nameInputs = page.locator('input[name="name"], input[name="fullName"], input[name="first-name"]');
                if ((await nameInputs.count()) > 0 &&
                    (await nameInputs.first().isVisible())) {
                    await nameInputs.first().click();
                    await page.keyboard.insertText(options.brandName);
                }
                const userInputs = page.locator('input[name="username"], input[placeholder*="username" i]');
                if ((await userInputs.count()) > 0 &&
                    (await userInputs.first().isVisible())) {
                    await userInputs.first().click();
                    await page.keyboard.insertText(cleanHandle);
                }
            }
            const screenshotPath = await sessionManager.takeScreenshot(page, `setup-${platform}-${isPageUnderAdmin ? "admin-page" : "brand-account"}`);
            platformResults.push({
                platform,
                governanceModel: gov.governanceModel,
                adminOwnerAssigned: adminOwnerName,
                adminRoleLabel: gov.adminRoleLabel,
                targetUrl,
                adminPermissionsUrl: gov.adminPermissionsUrl,
                profilePack,
                status: isPageUnderAdmin
                    ? "page_creation_under_admin_opened"
                    : "brand_account_and_admin_delegation_opened",
                details: isPageUnderAdmin
                    ? `Opened ${targetUrl} for ${platform.toUpperCase()} so existing account '${adminLabel}' creates & owns the '${options.brandName}' Page/Channel as ${gov.adminRoleLabel}. Bio (${profilePack.bioCharLimit}c max), Avatar (800x800), and Cover (${profilePack.coverDimensions}) ready.`
                    : `Opened ${targetUrl} for '${options.brandName}' (@${cleanHandle} / ${options.email}) with Bio (${profilePack.bioCharLimit}c max), Avatar (800x800), Cover (${profilePack.coverDimensions}), and Admin Delegation (${gov.adminRoleLabel}) for '${adminLabel}'.`,
                screenshotPath,
            });
        }
        catch (err) {
            platformResults.push({
                platform,
                governanceModel: gov.governanceModel,
                adminOwnerAssigned: adminOwnerName,
                adminRoleLabel: gov.adminRoleLabel,
                targetUrl,
                adminPermissionsUrl: gov.adminPermissionsUrl,
                profilePack,
                status: "error",
                details: err instanceof Error ? err.message : String(err),
            });
        }
    }
    return {
        mode: options.mode,
        adminGovernance: {
            adminOwnerName,
            adminOwnerEmail: options.adminOwnerEmail,
            adminOwnerHandle: options.adminOwnerHandle,
            useExistingAdminForPages,
            policySummary: `Page-supporting platforms (LinkedIn, Facebook, YouTube, Reddit) create official Brand Pages/Channels/Communities under ${adminLabel}'s existing personal account as Super Admin / Primary Owner. ` +
                `Handle-based platforms (X, Instagram, Threads, TikTok, Bluesky) register @${cleanHandle} and delegate Admin access to ${adminLabel}.`,
        },
        phoneStatus,
        recentOtpMessages,
        platformResults,
    };
}
