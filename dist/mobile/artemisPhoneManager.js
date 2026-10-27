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
/**
 * Automates or assists creating new social media accounts for a brand using either:
 * - "browser": Internal persistent browser (pre-filling brand email, name, username/handle)
 * - "phone_artemis": Connected Android phone via Google Artemis / ADB
 */
export async function createSocialAccountsFlow(options) {
    const phoneStatus = await listConnectedPhones();
    const platformResults = [];
    for (const platform of options.platforms) {
        const signupUrl = SIGNUP_URLS[platform];
        if (options.mode === "phone_artemis" &&
            phoneStatus.devices.some((d) => d.state === "device")) {
            const prompt = `Open ${platform} (or browser at ${signupUrl}) and start creating an account for brand '${options.brandName}' ` +
                `with username/handle '${options.desiredHandle}', email '${options.email}'` +
                (options.phone ? `, phone '${options.phone}'` : "") +
                `. Stop at the verification code or password confirmation screen.`;
            const artemisRes = await runArtemisTaskOnPhone({
                prompt,
                profile: "pro",
                deviceSerial: options.deviceSerial,
            });
            platformResults.push({
                platform,
                signupUrl,
                status: artemisRes.status,
                details: artemisRes.output,
                screenshotPath: artemisRes.screenshotPath,
            });
            continue;
        }
        // Browser or Hybrid mode: Open persistent headed browser tab and pre-fill available signup fields
        const page = await sessionManager.newPage(false);
        try {
            await page.goto(signupUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
            });
            await page.waitForTimeout(3500);
            // Attempt to pre-fill common registration inputs (email, name, username)
            const emailInputs = page.locator('input[name="email"], input[type="email"], input[name="emailOrPhone"], input#email-address');
            if ((await emailInputs.count()) > 0 && (await emailInputs.first().isVisible())) {
                await emailInputs.first().click();
                await page.keyboard.insertText(options.email);
            }
            const nameInputs = page.locator('input[name="name"], input[name="fullName"], input[name="first-name"]');
            if ((await nameInputs.count()) > 0 && (await nameInputs.first().isVisible())) {
                await nameInputs.first().click();
                await page.keyboard.insertText(options.brandName);
            }
            const userInputs = page.locator('input[name="username"], input[placeholder*="username" i]');
            if ((await userInputs.count()) > 0 && (await userInputs.first().isVisible())) {
                await userInputs.first().click();
                await page.keyboard.insertText(options.desiredHandle.replace(/^@/, ""));
            }
            const screenshotPath = await sessionManager.takeScreenshot(page, `signup-${platform}`);
            platformResults.push({
                platform,
                signupUrl,
                status: "opened_and_prefilled",
                details: `Opened ${signupUrl} in persistent browser and pre-filled brand details (${options.brandName} / ${options.email}). ` +
                    `Complete CAPTCHA/OTP in the open window (or use wannago_phone_read_otp if code was sent to your connected phone).`,
                screenshotPath,
            });
        }
        catch (err) {
            platformResults.push({
                platform,
                signupUrl,
                status: "error",
                details: err instanceof Error ? err.message : String(err),
            });
        }
        // Keep signup tabs open in headed browser so user/agent can finish verification seamlessly
    }
    return {
        mode: options.mode,
        phoneStatus,
        platformResults,
    };
}
