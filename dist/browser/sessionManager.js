import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PLATFORM_REGISTRY } from "../platforms/registry.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
export const DATA_DIR = path.join(PROJECT_ROOT, ".data");
export const PROFILE_DIR = path.join(DATA_DIR, "browser-profile");
export const SCREENSHOTS_DIR = path.join(DATA_DIR, "screenshots");
export const AUTH_STATUS_FILE = path.join(DATA_DIR, "auth_status.json");
function ensureDirs() {
    for (const dir of [DATA_DIR, PROFILE_DIR, SCREENSHOTS_DIR]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
export class BrowserSessionManager {
    context = null;
    currentHeadless = null;
    launchingPromise = null;
    constructor() {
        ensureDirs();
    }
    /**
     * Gets or launches the persistent browser context.
     * Reuses the same profile directory so logins across all 9 social networks persist on disk.
     */
    async getContext(headless = false) {
        if (this.context) {
            // Check if context is still alive and matches desired headless mode
            try {
                // Accessing pages() checks if context is still open
                this.context.pages();
                if (this.currentHeadless === headless || headless === true) {
                    // If a headed window is already open, we can reuse it even for headless requests
                    return this.context;
                }
                // Need to switch from headless -> headed so user can see the browser window
                await this.closeContext();
            }
            catch {
                this.context = null;
                this.currentHeadless = null;
            }
        }
        if (this.launchingPromise) {
            return this.launchingPromise;
        }
        this.launchingPromise = this.launchContextInternal(headless);
        try {
            this.context = await this.launchingPromise;
            this.currentHeadless = headless;
            return this.context;
        }
        finally {
            this.launchingPromise = null;
        }
    }
    async launchContextInternal(headless) {
        ensureDirs();
        // Remove stale SingletonLock if present after an unclean shutdown
        const lockFile = path.join(PROFILE_DIR, "SingletonLock");
        if (fs.existsSync(lockFile)) {
            try {
                fs.unlinkSync(lockFile);
            }
            catch {
                // Ignore if locked by active browser
            }
        }
        const commonArgs = [
            "--disable-blink-features=AutomationControlled",
            "--no-default-browser-check",
            "--no-first-run",
            "--disable-infobars",
            "--disable-notifications",
        ];
        const channelsToTry = [
            "chrome",
            "msedge",
            undefined,
        ];
        let lastError;
        for (const channel of channelsToTry) {
            try {
                const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
                    channel,
                    headless,
                    viewport: { width: 1366, height: 860 },
                    ignoreDefaultArgs: ["--enable-automation"],
                    args: commonArgs,
                    acceptDownloads: true,
                });
                await ctx.addInitScript(() => {
                    Object.defineProperty(navigator, "webdriver", {
                        get: () => undefined,
                    });
                });
                ctx.on("close", () => {
                    this.context = null;
                    this.currentHeadless = null;
                });
                return ctx;
            }
            catch (err) {
                lastError = err;
            }
        }
        throw new Error(`Failed to launch browser context (tried Chrome, Edge, and bundled Chromium). Run 'npx playwright install chromium' if needed. Cause: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    }
    async newPage(headless = false) {
        const ctx = await this.getContext(headless);
        const page = await ctx.newPage();
        page.setDefaultTimeout(25000);
        return page;
    }
    async takeScreenshot(page, prefix) {
        ensureDirs();
        const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `${safePrefix}-${Date.now()}.png`;
        const fullPath = path.join(SCREENSHOTS_DIR, filename);
        await page.screenshot({ path: fullPath, fullPage: false });
        return fullPath;
    }
    async checkPlatformAuth(platform, headless = true) {
        const meta = PLATFORM_REGISTRY[platform];
        const page = await this.newPage(headless);
        try {
            await page.goto(meta.baseUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
            });
            await page.waitForTimeout(3500);
            const currentUrl = page.url();
            let isLoggedOut = false;
            // URL-based check
            if (currentUrl.includes("/login") ||
                currentUrl.includes("ServiceLogin") ||
                currentUrl.includes("/i/flow/login")) {
                isLoggedOut = true;
            }
            // Selector checks
            let matchedLoggedInSelector = null;
            for (const sel of meta.loggedInSelectors) {
                const count = await page.locator(sel).count();
                if (count > 0) {
                    matchedLoggedInSelector = sel;
                    break;
                }
            }
            if (!matchedLoggedInSelector) {
                for (const sel of meta.loggedOutSelectors) {
                    const count = await page.locator(sel).count();
                    if (count > 0) {
                        isLoggedOut = true;
                        break;
                    }
                }
            }
            const authenticated = Boolean(matchedLoggedInSelector) && !isLoggedOut;
            const screenshotPath = await this.takeScreenshot(page, `auth-${platform}`);
            this.saveCachedAuthStatus(platform, authenticated);
            return {
                platform,
                authenticated,
                currentUrl,
                screenshotPath,
                details: authenticated
                    ? `Authenticated on ${meta.name} (matched ${matchedLoggedInSelector})`
                    : `Not logged in on ${meta.name} (URL: ${currentUrl}). Use social_open_login to sign in once.`,
            };
        }
        catch (err) {
            return {
                platform,
                authenticated: false,
                currentUrl: meta.baseUrl,
                details: `Error checking ${meta.name}: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
        finally {
            await page.close().catch(() => { });
        }
    }
    /**
     * Opens a visible (headed) browser window with tabs for each requested platform so the user can log in.
     */
    async openLoginTabs(platforms, waitSeconds = 0) {
        const ctx = await this.getContext(false); // Force headed browser
        const openedPlatforms = [];
        for (const platform of platforms) {
            const meta = PLATFORM_REGISTRY[platform];
            const page = await ctx.newPage();
            await page.goto(meta.loginUrl, { waitUntil: "domcontentloaded" }).catch(() => { });
            openedPlatforms.push({
                platform,
                name: meta.name,
                url: meta.loginUrl,
            });
        }
        if (waitSeconds > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
        }
        return {
            openedPlatforms,
            profileDir: PROFILE_DIR,
            message: `Opened visible browser window with ${openedPlatforms.length} tab(s) using persistent profile at ${PROFILE_DIR}. ` +
                `Sign in to your accounts in that browser window; your session cookies and tokens are saved automatically to disk.`,
        };
    }
    saveCachedAuthStatus(platform, authenticated) {
        ensureDirs();
        const existing = this.getCachedAuthStatus();
        existing[platform] = {
            authenticated,
            checkedAt: new Date().toISOString(),
        };
        fs.writeFileSync(AUTH_STATUS_FILE, JSON.stringify(existing, null, 2), "utf-8");
    }
    getCachedAuthStatus() {
        try {
            if (fs.existsSync(AUTH_STATUS_FILE)) {
                return JSON.parse(fs.readFileSync(AUTH_STATUS_FILE, "utf-8"));
            }
        }
        catch {
            // Ignore corrupt cache
        }
        return {};
    }
    async closeContext() {
        if (this.context) {
            try {
                await this.context.close();
            }
            catch {
                // Ignore
            }
            this.context = null;
            this.currentHeadless = null;
        }
    }
}
export const sessionManager = new BrowserSessionManager();
