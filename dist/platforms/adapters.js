import fs from "node:fs";
import { PLATFORM_REGISTRY } from "./registry.js";
import { sessionManager } from "../browser/sessionManager.js";
function validateMediaFiles(mediaPaths) {
    if (!mediaPaths || mediaPaths.length === 0)
        return [];
    const valid = [];
    for (const p of mediaPaths) {
        if (!fs.existsSync(p)) {
            throw new Error(`Media file does not exist: ${p}`);
        }
        valid.push(p);
    }
    return valid;
}
/**
 * Publishes or drafts a post on a single social media platform using the persistent browser session.
 */
export async function publishToPlatform(platform, input) {
    const meta = PLATFORM_REGISTRY[platform];
    const headless = input.headless ?? false;
    const dryRun = input.dryRun ?? false;
    const mediaFiles = validateMediaFiles(input.mediaPaths);
    const fullText = input.linkUrl
        ? `${input.text}\n\n${input.linkUrl}`
        : input.text;
    const page = await sessionManager.newPage(headless);
    try {
        switch (platform) {
            case "x":
                return await publishX(page, fullText, mediaFiles, input.threadItems, dryRun);
            case "linkedin":
                return await publishLinkedIn(page, fullText, mediaFiles, dryRun);
            case "bluesky":
                return await publishBluesky(page, fullText, mediaFiles, dryRun);
            case "threads":
                return await publishThreads(page, fullText, mediaFiles, dryRun);
            case "reddit":
                return await publishReddit(page, input.title || fullText.slice(0, 120), fullText, input.subreddit || "u_me", mediaFiles, dryRun);
            case "facebook":
                return await publishFacebook(page, fullText, mediaFiles, dryRun);
            case "instagram":
                return await publishInstagram(page, fullText, mediaFiles, dryRun);
            case "tiktok":
                return await publishTikTok(page, fullText, mediaFiles, dryRun);
            case "youtube":
                return await publishYouTube(page, input.title || fullText.slice(0, 95), fullText, mediaFiles, dryRun);
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }
    catch (err) {
        const screenshotPath = await sessionManager
            .takeScreenshot(page, `error-publish-${platform}`)
            .catch(() => undefined);
        return {
            platform,
            status: "error",
            message: `Failed on ${meta.name}: ${err instanceof Error ? err.message : String(err)}`,
            screenshotPath,
        };
    }
    finally {
        // If not dryRun or if headless, close the tab; if dryRun in headed mode, keep tab open briefly then close
        if (!dryRun || headless) {
            await page.close().catch(() => { });
        }
        else {
            await page.waitForTimeout(2000).catch(() => { });
            await page.close().catch(() => { });
        }
    }
}
async function publishX(page, text, mediaFiles, threadItems, dryRun) {
    await page.goto("https://x.com/compose/post", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    if (page.url().includes("login")) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "x-auth-needed");
        return {
            platform: "x",
            status: "auth_required",
            message: "Not logged in to X (Twitter). Call social_open_login for 'x' first.",
            screenshotPath,
        };
    }
    const editor = page.locator('[data-testid="tweetTextarea_0"]').first();
    await editor.waitFor({ state: "visible", timeout: 15000 });
    await editor.click();
    await page.keyboard.insertText(text);
    if (mediaFiles.length > 0) {
        const fileInput = page.locator('input[data-testid="fileInput"]').first();
        await fileInput.setInputFiles(mediaFiles);
        await page.waitForTimeout(4000);
    }
    // Handle additional thread items if provided
    if (threadItems && threadItems.length > 0) {
        for (let i = 0; i < threadItems.length; i++) {
            const addBtn = page.locator('[data-testid="addButton"]').first();
            if ((await addBtn.count()) > 0) {
                await addBtn.click();
                await page.waitForTimeout(1000);
                const nextEditor = page
                    .locator(`[data-testid="tweetTextarea_${i + 1}"]`)
                    .first();
                await nextEditor.click();
                await page.keyboard.insertText(threadItems[i]);
            }
        }
    }
    const screenshotBefore = await sessionManager.takeScreenshot(page, "x-composed");
    if (dryRun) {
        return {
            platform: "x",
            status: "drafted_dry_run",
            message: "X post composed in dryRun mode (not submitted).",
            screenshotPath: screenshotBefore,
        };
    }
    const postBtn = page
        .locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]')
        .first();
    await postBtn.click();
    await page.waitForTimeout(4000);
    const screenshotAfter = await sessionManager.takeScreenshot(page, "x-published");
    return {
        platform: "x",
        status: "published",
        message: "Successfully published post to X (Twitter).",
        screenshotPath: screenshotAfter,
    };
}
async function publishLinkedIn(page, text, mediaFiles, dryRun) {
    await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3500);
    if (page.url().includes("/login") || page.url().includes("/uas/login")) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "linkedin-auth-needed");
        return {
            platform: "linkedin",
            status: "auth_required",
            message: "Not logged in to LinkedIn. Call social_open_login for 'linkedin' first.",
            screenshotPath,
        };
    }
    // Click "Start a post" button
    const startPostBtn = page
        .locator('button.share-box-feed-entry__trigger, button:has-text("Start a post"), [aria-label="Start a post"]')
        .first();
    await startPostBtn.click({ timeout: 15000 });
    await page.waitForTimeout(2000);
    if (mediaFiles.length > 0) {
        const fileInput = page.locator('input[type="file"]').first();
        if ((await fileInput.count()) > 0) {
            await fileInput.setInputFiles(mediaFiles);
            await page.waitForTimeout(3000);
            const nextBtn = page.locator('button:has-text("Next")').first();
            if ((await nextBtn.count()) > 0 && (await nextBtn.isVisible())) {
                await nextBtn.click();
                await page.waitForTimeout(1500);
            }
        }
    }
    const editor = page
        .locator('.ql-editor, [role="textbox"][aria-label*="Text editor"]')
        .first();
    await editor.waitFor({ state: "visible", timeout: 15000 });
    await editor.click();
    await page.keyboard.insertText(text);
    await page.waitForTimeout(1000);
    const screenshotBefore = await sessionManager.takeScreenshot(page, "linkedin-composed");
    if (dryRun) {
        return {
            platform: "linkedin",
            status: "drafted_dry_run",
            message: "LinkedIn post composed in dryRun mode (not submitted).",
            screenshotPath: screenshotBefore,
        };
    }
    const submitBtn = page
        .locator('button.share-actions__primary-action, button:has-text("Post")')
        .first();
    await submitBtn.click();
    await page.waitForTimeout(4000);
    const screenshotAfter = await sessionManager.takeScreenshot(page, "linkedin-published");
    return {
        platform: "linkedin",
        status: "published",
        message: "Successfully published post to LinkedIn.",
        screenshotPath: screenshotAfter,
    };
}
async function publishBluesky(page, text, mediaFiles, dryRun) {
    await page.goto("https://bsky.app/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    const newPostBtn = page
        .locator('[data-testid="composeFAB"], button[aria-label="New post"]')
        .first();
    if ((await newPostBtn.count()) === 0) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "bluesky-auth-needed");
        return {
            platform: "bluesky",
            status: "auth_required",
            message: "Not logged in to Bluesky. Call social_open_login for 'bluesky' first.",
            screenshotPath,
        };
    }
    await newPostBtn.click();
    await page.waitForTimeout(1500);
    const editor = page
        .locator('[data-testid="composerTextInput"], div[contenteditable="true"]')
        .first();
    await editor.click();
    await page.keyboard.insertText(text);
    if (mediaFiles.length > 0) {
        const fileInput = page.locator('input[type="file"]').first();
        if ((await fileInput.count()) > 0) {
            await fileInput.setInputFiles(mediaFiles);
            await page.waitForTimeout(3000);
        }
    }
    const screenshotBefore = await sessionManager.takeScreenshot(page, "bluesky-composed");
    if (dryRun) {
        return {
            platform: "bluesky",
            status: "drafted_dry_run",
            message: "Bluesky post composed in dryRun mode (not submitted).",
            screenshotPath: screenshotBefore,
        };
    }
    const publishBtn = page
        .locator('[data-testid="composerPublishBtn"], button:has-text("Post")')
        .first();
    await publishBtn.click();
    await page.waitForTimeout(3500);
    const screenshotAfter = await sessionManager.takeScreenshot(page, "bluesky-published");
    return {
        platform: "bluesky",
        status: "published",
        message: "Successfully published post to Bluesky.",
        screenshotPath: screenshotAfter,
    };
}
async function publishThreads(page, text, mediaFiles, dryRun) {
    await page.goto("https://www.threads.net/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    if (page.url().includes("/login")) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "threads-auth-needed");
        return {
            platform: "threads",
            status: "auth_required",
            message: "Not logged in to Threads. Call social_open_login for 'threads' first.",
            screenshotPath,
        };
    }
    const createTrigger = page
        .locator('svg[aria-label="Create"], div:has-text("What\'s new?"), [role="button"]:has-text("Start a thread")')
        .first();
    if ((await createTrigger.count()) === 0) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "threads-auth-needed");
        return {
            platform: "threads",
            status: "auth_required",
            message: "Could not find Threads post composer (login required). Call social_open_login for 'threads'.",
            screenshotPath,
        };
    }
    await createTrigger.click();
    await page.waitForTimeout(1500);
    const editor = page.locator('div[contenteditable="true"][role="textbox"]').first();
    await editor.click();
    await page.keyboard.insertText(text);
    if (mediaFiles.length > 0) {
        const fileInput = page.locator('input[type="file"]').first();
        if ((await fileInput.count()) > 0) {
            await fileInput.setInputFiles(mediaFiles);
            await page.waitForTimeout(3500);
        }
    }
    const screenshotBefore = await sessionManager.takeScreenshot(page, "threads-composed");
    if (dryRun) {
        return {
            platform: "threads",
            status: "drafted_dry_run",
            message: "Threads post composed in dryRun mode (not submitted).",
            screenshotPath: screenshotBefore,
        };
    }
    const postBtn = page
        .locator('div[role="button"]:has-text("Post"), button:has-text("Post")')
        .last();
    await postBtn.click();
    await page.waitForTimeout(4000);
    const screenshotAfter = await sessionManager.takeScreenshot(page, "threads-published");
    return {
        platform: "threads",
        status: "published",
        message: "Successfully published post to Threads.",
        screenshotPath: screenshotAfter,
    };
}
async function publishReddit(page, title, body, subreddit, mediaFiles, dryRun) {
    const cleanSub = subreddit.replace(/^\/?r\//, "");
    const submitUrl = cleanSub && cleanSub !== "u_me"
        ? `https://www.reddit.com/r/${cleanSub}/submit`
        : `https://www.reddit.com/submit`;
    await page.goto(submitUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    if (page.url().includes("/login")) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "reddit-auth-needed");
        return {
            platform: "reddit",
            status: "auth_required",
            message: "Not logged in to Reddit. Call social_open_login for 'reddit' first.",
            screenshotPath,
        };
    }
    const titleInput = page
        .locator('textarea[name="title"], input[name="title"], [placeholder*="Title"]')
        .first();
    await titleInput.waitFor({ state: "visible", timeout: 15000 });
    await titleInput.click();
    await page.keyboard.insertText(title);
    if (mediaFiles.length > 0) {
        const fileInput = page.locator('input[type="file"]').first();
        if ((await fileInput.count()) > 0) {
            await fileInput.setInputFiles(mediaFiles);
            await page.waitForTimeout(3500);
        }
    }
    const bodyEditor = page
        .locator('div[contenteditable="true"][name="body"], div[role="textbox"], textarea[name="text"]')
        .first();
    if ((await bodyEditor.count()) > 0 && (await bodyEditor.isVisible())) {
        await bodyEditor.click();
        await page.keyboard.insertText(body);
    }
    const screenshotBefore = await sessionManager.takeScreenshot(page, "reddit-composed");
    if (dryRun) {
        return {
            platform: "reddit",
            status: "drafted_dry_run",
            message: `Reddit post drafted for ${submitUrl} in dryRun mode (not submitted).`,
            screenshotPath: screenshotBefore,
        };
    }
    const submitBtn = page
        .locator('button#inner-post-submit-button, button:has-text("Post")')
        .last();
    await submitBtn.click();
    await page.waitForTimeout(4500);
    const screenshotAfter = await sessionManager.takeScreenshot(page, "reddit-published");
    return {
        platform: "reddit",
        status: "published",
        message: `Successfully published Reddit post.`,
        postUrl: page.url(),
        screenshotPath: screenshotAfter,
    };
}
async function publishFacebook(page, text, mediaFiles, dryRun) {
    await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    if (page.url().includes("/login") ||
        (await page.locator('input#email').count()) > 0) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "facebook-auth-needed");
        return {
            platform: "facebook",
            status: "auth_required",
            message: "Not logged in to Facebook. Call social_open_login for 'facebook' first.",
            screenshotPath,
        };
    }
    const createPostTrigger = page
        .locator('[aria-label="Create a post"] [role="button"], [role="button"]:has-text("What\'s on your mind")')
        .first();
    await createPostTrigger.click({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const editor = page
        .locator('div[role="dialog"] div[contenteditable="true"][role="textbox"]')
        .first();
    await editor.click();
    await page.keyboard.insertText(text);
    if (mediaFiles.length > 0) {
        const fileInput = page.locator('div[role="dialog"] input[type="file"]').first();
        if ((await fileInput.count()) > 0) {
            await fileInput.setInputFiles(mediaFiles);
            await page.waitForTimeout(3500);
        }
    }
    const screenshotBefore = await sessionManager.takeScreenshot(page, "facebook-composed");
    if (dryRun) {
        return {
            platform: "facebook",
            status: "drafted_dry_run",
            message: "Facebook post composed in dryRun mode (not submitted).",
            screenshotPath: screenshotBefore,
        };
    }
    const postBtn = page
        .locator('div[role="dialog"] [aria-label="Post"][role="button"]')
        .first();
    await postBtn.click();
    await page.waitForTimeout(4500);
    const screenshotAfter = await sessionManager.takeScreenshot(page, "facebook-published");
    return {
        platform: "facebook",
        status: "published",
        message: "Successfully published post to Facebook.",
        screenshotPath: screenshotAfter,
    };
}
async function publishInstagram(page, caption, mediaFiles, dryRun) {
    if (mediaFiles.length === 0) {
        return {
            platform: "instagram",
            status: "error",
            message: "Instagram requires at least one image or video file in mediaPaths.",
        };
    }
    await page.goto("https://www.instagram.com/", {
        waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3500);
    if (page.url().includes("/accounts/login") ||
        (await page.locator('input[name="username"]').count()) > 0) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "instagram-auth-needed");
        return {
            platform: "instagram",
            status: "auth_required",
            message: "Not logged in to Instagram. Call social_open_login for 'instagram' first.",
            screenshotPath,
        };
    }
    const newPostBtn = page
        .locator('svg[aria-label="New post"], a:has(svg[aria-label="New post"])')
        .first();
    await newPostBtn.click({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const postMenuOption = page.locator('span:has-text("Post")').first();
    if ((await postMenuOption.count()) > 0 && (await postMenuOption.isVisible())) {
        await postMenuOption.click().catch(() => { });
        await page.waitForTimeout(1000);
    }
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(mediaFiles);
    await page.waitForTimeout(3000);
    // Click Next twice (Crop -> Filter -> Caption)
    for (let step = 0; step < 2; step++) {
        const nextBtn = page
            .locator('div[role="dialog"] div[role="button"]:has-text("Next")')
            .first();
        if ((await nextBtn.count()) > 0) {
            await nextBtn.click();
            await page.waitForTimeout(1800);
        }
    }
    const captionBox = page
        .locator('div[role="dialog"] div[aria-label="Write a caption..."][contenteditable="true"]')
        .first();
    if ((await captionBox.count()) > 0) {
        await captionBox.click();
        await page.keyboard.insertText(caption);
    }
    const screenshotBefore = await sessionManager.takeScreenshot(page, "instagram-composed");
    if (dryRun) {
        return {
            platform: "instagram",
            status: "drafted_dry_run",
            message: "Instagram post prepared in dryRun mode (not shared).",
            screenshotPath: screenshotBefore,
        };
    }
    const shareBtn = page
        .locator('div[role="dialog"] div[role="button"]:has-text("Share")')
        .first();
    await shareBtn.click();
    await page.waitForTimeout(6000);
    const screenshotAfter = await sessionManager.takeScreenshot(page, "instagram-published");
    return {
        platform: "instagram",
        status: "published",
        message: "Successfully shared post to Instagram.",
        screenshotPath: screenshotAfter,
    };
}
async function publishTikTok(page, caption, mediaFiles, dryRun) {
    if (mediaFiles.length === 0) {
        return {
            platform: "tiktok",
            status: "error",
            message: "TikTok requires a video or image file in mediaPaths.",
        };
    }
    await page.goto("https://www.tiktok.com/tiktokstudio/upload", {
        waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4500);
    if (page.url().includes("/login")) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "tiktok-auth-needed");
        return {
            platform: "tiktok",
            status: "auth_required",
            message: "Not logged in to TikTok. Call social_open_login for 'tiktok' first.",
            screenshotPath,
        };
    }
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(mediaFiles);
    await page.waitForTimeout(6000);
    const captionEditor = page
        .locator('.public-DraftEditor-content, div[contenteditable="true"]')
        .first();
    if ((await captionEditor.count()) > 0) {
        await captionEditor.click();
        await page.keyboard.press("Control+A");
        await page.keyboard.press("Backspace");
        await page.keyboard.insertText(caption);
    }
    const screenshotBefore = await sessionManager.takeScreenshot(page, "tiktok-composed");
    if (dryRun) {
        return {
            platform: "tiktok",
            status: "drafted_dry_run",
            message: "TikTok upload prepared in dryRun mode (not posted).",
            screenshotPath: screenshotBefore,
        };
    }
    const postBtn = page
        .locator('button[data-e2e="post_video_button"], button:has-text("Post")')
        .first();
    await postBtn.click();
    await page.waitForTimeout(6000);
    const screenshotAfter = await sessionManager.takeScreenshot(page, "tiktok-published");
    return {
        platform: "tiktok",
        status: "published",
        message: "Successfully submitted TikTok post.",
        screenshotPath: screenshotAfter,
    };
}
async function publishYouTube(page, title, description, mediaFiles, dryRun) {
    await page.goto("https://studio.youtube.com/", {
        waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);
    if (page.url().includes("accounts.google.com")) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "youtube-auth-needed");
        return {
            platform: "youtube",
            status: "auth_required",
            message: "Not logged in to YouTube Studio. Call social_open_login for 'youtube' first.",
            screenshotPath,
        };
    }
    if (mediaFiles.length === 0) {
        const screenshotPath = await sessionManager.takeScreenshot(page, "youtube-studio");
        return {
            platform: "youtube",
            status: "error",
            message: "Please provide a video file in mediaPaths for YouTube Studio upload.",
            screenshotPath,
        };
    }
    const createBtn = page
        .locator('#create-icon, ytcp-button#create-icon, button:has-text("Create")')
        .first();
    await createBtn.click();
    await page.waitForTimeout(1000);
    const uploadOption = page
        .locator('tp-yt-paper-item:has-text("Upload videos"), #text-item-0')
        .first();
    if ((await uploadOption.count()) > 0) {
        await uploadOption.click();
        await page.waitForTimeout(1500);
    }
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(mediaFiles[0]);
    await page.waitForTimeout(5000);
    const titleBoxes = page.locator('#textbox[aria-label*="Add a title"]');
    if ((await titleBoxes.count()) > 0) {
        const titleBox = titleBoxes.first();
        await titleBox.click();
        await page.keyboard.press("Control+A");
        await page.keyboard.insertText(title.slice(0, 100));
    }
    const descBoxes = page.locator('#textbox[aria-label*="Tell viewers"]');
    if ((await descBoxes.count()) > 0) {
        const descBox = descBoxes.first();
        await descBox.click();
        await page.keyboard.insertText(description);
    }
    const screenshotBefore = await sessionManager.takeScreenshot(page, "youtube-composed");
    if (dryRun) {
        return {
            platform: "youtube",
            status: "drafted_dry_run",
            message: "YouTube video uploaded & metadata filled in dryRun mode (saved as draft in YouTube Studio).",
            screenshotPath: screenshotBefore,
        };
    }
    // Click through Next (3 times: Details -> Video Elements -> Checks -> Visibility)
    for (let i = 0; i < 3; i++) {
        const nextBtn = page.locator('#next-button').first();
        if ((await nextBtn.count()) > 0 && (await nextBtn.isVisible())) {
            await nextBtn.click();
            await page.waitForTimeout(1500);
        }
    }
    const doneBtn = page.locator('#done-button').first();
    if ((await doneBtn.count()) > 0 && (await doneBtn.isVisible())) {
        await doneBtn.click();
        await page.waitForTimeout(4000);
    }
    const screenshotAfter = await sessionManager.takeScreenshot(page, "youtube-published");
    return {
        platform: "youtube",
        status: "published",
        message: "YouTube video upload submitted in YouTube Studio.",
        screenshotPath: screenshotAfter,
    };
}
/**
 * Extracts analytics, follower metrics, and recent post performance from a platform.
 */
export async function getPlatformAnalytics(platform, profileUrlOverride, headless = true) {
    const meta = PLATFORM_REGISTRY[platform];
    const targetUrl = profileUrlOverride || meta.analyticsUrl || meta.baseUrl;
    const page = await sessionManager.newPage(headless);
    try {
        await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await page.waitForTimeout(4000);
        if (page.url().includes("/login") ||
            page.url().includes("ServiceLogin")) {
            const screenshotPath = await sessionManager.takeScreenshot(page, `analytics-auth-${platform}`);
            return {
                platform,
                authenticated: false,
                recentPosts: [],
                screenshotPath,
                error: `Not logged in to ${meta.name}. Call social_open_login for '${platform}' first.`,
            };
        }
        // Extract page summary metrics & recent post cards using generic + platform-aware DOM evaluation
        const extracted = await page.evaluate(() => {
            const bodyText = document.body.innerText || "";
            const summaryMetrics = {};
            // Extract common metric patterns (Followers, Following, Impressions, Views, Subscribers, Karma)
            const patterns = [
                ["followers", /(\d[\d,.]*[KMB]?)\s+Followers/i],
                ["following", /(\d[\d,.]*[KMB]?)\s+Following/i],
                ["subscribers", /(\d[\d,.]*[KMB]?)\s+subscribers/i],
                ["impressions", /Impressions\s*[:\n]\s*(\d[\d,.]*[KMB]?)/i],
                ["engagements", /Engagements?\s*[:\n]\s*(\d[\d,.]*[KMB]?)/i],
                ["profileViews", /Profile\s+views\s*[:\n]\s*(\d[\d,.]*[KMB]?)/i],
                ["karma", /(\d[\d,.]*[KMB]?)\s+karma/i],
            ];
            for (const [key, regex] of patterns) {
                const match = bodyText.match(regex);
                if (match && match[1]) {
                    summaryMetrics[key] = match[1];
                }
            }
            // Extract recent post/article items on page
            const postNodes = Array.from(document.querySelectorAll('article, [data-testid="tweet"], .feed-shared-update-v2, shreddit-post, [data-e2e="user-post-item"]')).slice(0, 10);
            const recentPosts = postNodes.map((node) => {
                const text = node.innerText || "";
                const lines = text
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                const linkEl = node.querySelector('a[href*="/status/"], a[href*="/posts/"], a[href*="/comments/"], a[href*="/video/"], a[href*="/p/"]');
                const ariaMetrics = Array.from(node.querySelectorAll("[aria-label]"))
                    .map((el) => el.getAttribute("aria-label") || "")
                    .filter((label) => /(like|repl|comment|repost|view|impression|upvote|share)/i.test(label))
                    .join(" | ");
                return {
                    url: linkEl ? linkEl.href : undefined,
                    textSnippet: lines.slice(0, 4).join(" ").slice(0, 260),
                    viewsOrImpressions: ariaMetrics || undefined,
                };
            });
            return {
                title: document.title,
                summaryMetrics,
                recentPosts,
            };
        });
        const screenshotPath = await sessionManager.takeScreenshot(page, `analytics-${platform}`);
        return {
            platform,
            authenticated: true,
            profileHandleOrName: extracted.title,
            followersOrSubscribers: extracted.summaryMetrics.followers ||
                extracted.summaryMetrics.subscribers,
            followingCount: extracted.summaryMetrics.following,
            summaryMetrics: extracted.summaryMetrics,
            recentPosts: extracted.recentPosts,
            screenshotPath,
        };
    }
    catch (err) {
        return {
            platform,
            authenticated: false,
            recentPosts: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        await page.close().catch(() => { });
    }
}
/**
 * Reads recent notifications, mentions, comments, or inbox messages from a platform.
 */
export async function readInboxAndNotifications(platform, mode = "notifications", limit = 15, headless = true) {
    const meta = PLATFORM_REGISTRY[platform];
    const targetUrl = mode === "messages" ? meta.messagesUrl : meta.notificationsUrl;
    const page = await sessionManager.newPage(headless);
    try {
        await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await page.waitForTimeout(4000);
        const items = await page.evaluate(({ plat, itemMode, maxItems }) => {
            const selectors = [
                'article',
                '[data-testid="cellInnerDiv"]',
                '[data-testid="conversation"]',
                '.nt-card',
                '.msg-conversation-listitem',
                '[role="listitem"]',
                'li',
            ];
            const results = [];
            const seen = new Set();
            for (const sel of selectors) {
                const nodes = Array.from(document.querySelectorAll(sel));
                for (const node of nodes) {
                    const raw = (node.innerText || "")
                        .replace(/\s+/g, " ")
                        .trim();
                    if (raw.length < 15 || raw.length > 600 || seen.has(raw))
                        continue;
                    seen.add(raw);
                    const anchor = node.querySelector("a[href]");
                    results.push({
                        platform: plat,
                        type: itemMode === "messages" ? "dm" : "notification",
                        text: raw,
                        url: anchor ? anchor.href : undefined,
                    });
                    if (results.length >= maxItems)
                        break;
                }
                if (results.length >= maxItems)
                    break;
            }
            return results;
        }, { plat: platform, itemMode: mode, maxItems: limit });
        const screenshotPath = await sessionManager.takeScreenshot(page, `${mode}-${platform}`);
        return {
            platform,
            mode,
            items,
            screenshotPath,
        };
    }
    catch (err) {
        return {
            platform,
            mode,
            items: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        await page.close().catch(() => { });
    }
}
/**
 * Replies to or comments on a specific post URL on any supported platform.
 */
export async function replyToPostUrl(platform, postUrl, replyText, dryRun = false, headless = false) {
    const page = await sessionManager.newPage(headless);
    try {
        await page.goto(postUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await page.waitForTimeout(4000);
        // Locate comment / reply box across platforms
        const replySelectors = [
            '[data-testid="tweetTextarea_0"]', // X
            '.comments-comment-box-comment__text-editor .ql-editor', // LinkedIn
            'textarea[aria-label*="Add a comment"]', // Instagram
            'div[contenteditable="true"][aria-label*="Write a comment"]', // Facebook
            '[data-e2e="comment-input"] div[contenteditable="true"]', // TikTok
            '#simplebox-placeholder, #contenteditable-root', // YouTube
            '[data-testid="composerTextInput"]', // Bluesky
            'div[contenteditable="true"][role="textbox"]', // Generic / Threads / Reddit
            'textarea[placeholder*="comment" i]',
        ];
        let matchedBox = null;
        for (const sel of replySelectors) {
            const loc = page.locator(sel).first();
            if ((await loc.count()) > 0 && (await loc.isVisible())) {
                matchedBox = loc;
                break;
            }
        }
        // If Bluesky/Threads/X requires clicking a Reply icon first
        if (!matchedBox) {
            const replyTrigger = page
                .locator('[data-testid="reply"], button[aria-label*="Reply" i], button[aria-label*="Comment" i], #simplebox-placeholder')
                .first();
            if ((await replyTrigger.count()) > 0) {
                await replyTrigger.click();
                await page.waitForTimeout(1500);
                for (const sel of replySelectors) {
                    const loc = page.locator(sel).first();
                    if ((await loc.count()) > 0 && (await loc.isVisible())) {
                        matchedBox = loc;
                        break;
                    }
                }
            }
        }
        if (!matchedBox) {
            const screenshotPath = await sessionManager.takeScreenshot(page, `reply-notfound-${platform}`);
            return {
                platform,
                status: "error",
                message: `Could not locate reply/comment input box on ${postUrl}. Check screenshot.`,
                screenshotPath,
            };
        }
        await matchedBox.click();
        await page.keyboard.insertText(replyText);
        await page.waitForTimeout(1000);
        const screenshotBefore = await sessionManager.takeScreenshot(page, `reply-composed-${platform}`);
        if (dryRun) {
            return {
                platform,
                status: "drafted_dry_run",
                message: `Reply composed on ${postUrl} in dryRun mode (not submitted).`,
                postUrl,
                screenshotPath: screenshotBefore,
            };
        }
        const submitSelectors = [
            '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]',
            'button.comments-comment-box__submit-button',
            'div[role="button"]:has-text("Post")',
            'button:has-text("Reply")',
            'button:has-text("Comment")',
            'button:has-text("Post")',
            '#submit-button',
        ];
        let clicked = false;
        for (const sel of submitSelectors) {
            const btn = page.locator(sel).first();
            if ((await btn.count()) > 0 && (await btn.isVisible())) {
                await btn.click();
                clicked = true;
                break;
            }
        }
        if (!clicked) {
            await page.keyboard.press("Control+Enter");
        }
        await page.waitForTimeout(3500);
        const screenshotAfter = await sessionManager.takeScreenshot(page, `reply-published-${platform}`);
        return {
            platform,
            status: "published",
            message: `Successfully posted reply on ${postUrl}.`,
            postUrl,
            screenshotPath: screenshotAfter,
        };
    }
    catch (err) {
        return {
            platform,
            status: "error",
            message: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        await page.close().catch(() => { });
    }
}
/**
 * Searches posts, hashtags, or brand mentions on a platform.
 */
export async function searchPlatformPosts(platform, query, limit = 12, headless = true) {
    const meta = PLATFORM_REGISTRY[platform];
    const searchUrl = meta.buildSearchUrl(query);
    const page = await sessionManager.newPage(headless);
    try {
        await page.goto(searchUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await page.waitForTimeout(4500);
        // Scroll once to trigger lazy loading
        await page.mouse.wheel(0, 900);
        await page.waitForTimeout(1500);
        const results = await page.evaluate(({ plat, maxItems }) => {
            const candidates = Array.from(document.querySelectorAll('article, [data-testid="tweet"], .feed-shared-update-v2, shreddit-post, ytd-video-renderer, [data-e2e="search_top-item"], [data-e2e="search-card-desc"]'));
            const items = [];
            const seen = new Set();
            const elementsToScan = candidates.length > 0
                ? candidates
                : Array.from(document.querySelectorAll('div[role="article"], main a[href]'));
            for (const el of elementsToScan) {
                const text = (el.innerText || "")
                    .replace(/\s+/g, " ")
                    .trim();
                if (text.length < 20 || seen.has(text))
                    continue;
                seen.add(text);
                const linkEl = (el.tagName === "A"
                    ? el
                    : el.querySelector('a[href*="/status/"], a[href*="/watch"], a[href*="/comments/"], a[href*="/video/"], a[href*="/p/"], a[href*="/post/"], a[href]'));
                const ariaMetrics = Array.from(el.querySelectorAll("[aria-label]"))
                    .map((n) => n.getAttribute("aria-label") || "")
                    .filter((l) => /(like|view|repl|comment|repost|share|upvote)/i.test(l))
                    .join(" | ");
                items.push({
                    platform: plat,
                    text: text.slice(0, 420),
                    url: linkEl ? linkEl.href : undefined,
                    metricsSummary: ariaMetrics || undefined,
                });
                if (items.length >= maxItems)
                    break;
            }
            return items;
        }, { plat: platform, maxItems: limit });
        const screenshotPath = await sessionManager.takeScreenshot(page, `search-${platform}`);
        return {
            platform,
            query,
            searchUrl,
            results,
            screenshotPath,
        };
    }
    catch (err) {
        return {
            platform,
            query,
            searchUrl,
            results: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        await page.close().catch(() => { });
    }
}
/**
 * Fetches trending topics / popular posts from a platform.
 */
export async function getPlatformTrends(platform, limit = 15, headless = true) {
    const meta = PLATFORM_REGISTRY[platform];
    const page = await sessionManager.newPage(headless);
    try {
        await page.goto(meta.trendsUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await page.waitForTimeout(4000);
        const trends = await page.evaluate((maxItems) => {
            const nodes = Array.from(document.querySelectorAll('[data-testid="trend"], h1, h2, h3, a[href*="/hashtag/"], a[href*="/search?q="], shreddit-post'));
            const out = [];
            const seen = new Set();
            for (const n of nodes) {
                const text = (n.innerText || "")
                    .replace(/\s+/g, " ")
                    .trim();
                if (text.length < 3 || text.length > 220 || seen.has(text))
                    continue;
                seen.add(text);
                out.push(text);
                if (out.length >= maxItems)
                    break;
            }
            return out;
        }, limit);
        const screenshotPath = await sessionManager.takeScreenshot(page, `trends-${platform}`);
        return {
            platform,
            trendsUrl: meta.trendsUrl,
            trends,
            screenshotPath,
        };
    }
    catch (err) {
        return {
            platform,
            trendsUrl: meta.trendsUrl,
            trends: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        await page.close().catch(() => { });
    }
}
/**
 * Sends or drafts a Direct Message on a platform by opening a conversation thread URL or messages inbox.
 */
export async function sendDirectMessage(platform, recipientOrThreadUrl, messageText, dryRun = false, headless = false) {
    const meta = PLATFORM_REGISTRY[platform];
    const targetUrl = recipientOrThreadUrl.startsWith("http")
        ? recipientOrThreadUrl
        : meta.messagesUrl;
    const page = await sessionManager.newPage(headless);
    try {
        await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await page.waitForTimeout(4000);
        const dmInputSelectors = [
            '[data-testid="dmComposerTextInput"]', // X
            '.msg-form__contenteditable', // LinkedIn
            'div[aria-label="Message"][contenteditable="true"]', // Instagram / Facebook
            '[data-e2e="message-input-area"] div[contenteditable="true"]', // TikTok
            'div[contenteditable="true"][role="textbox"]',
            'textarea[placeholder*="message" i]',
        ];
        let inputLoc = null;
        for (const sel of dmInputSelectors) {
            const loc = page.locator(sel).first();
            if ((await loc.count()) > 0 && (await loc.isVisible())) {
                inputLoc = loc;
                break;
            }
        }
        if (!inputLoc) {
            const screenshotPath = await sessionManager.takeScreenshot(page, `dm-notfound-${platform}`);
            return {
                platform,
                status: "error",
                message: `Could not locate DM text box at ${targetUrl}. Pass the direct message thread URL or open the thread first.`,
                screenshotPath,
            };
        }
        await inputLoc.click();
        await page.keyboard.insertText(messageText);
        await page.waitForTimeout(1000);
        const screenshotBefore = await sessionManager.takeScreenshot(page, `dm-composed-${platform}`);
        if (dryRun) {
            return {
                platform,
                status: "drafted_dry_run",
                message: `Direct message drafted on ${meta.name} in dryRun mode (not sent).`,
                screenshotPath: screenshotBefore,
            };
        }
        await page.keyboard.press("Enter");
        await page.waitForTimeout(3000);
        const screenshotAfter = await sessionManager.takeScreenshot(page, `dm-sent-${platform}`);
        return {
            platform,
            status: "published",
            message: `Direct message sent on ${meta.name}.`,
            screenshotPath: screenshotAfter,
        };
    }
    catch (err) {
        return {
            platform,
            status: "error",
            message: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        await page.close().catch(() => { });
    }
}
/**
 * Low-level authenticated browser inspector & custom action runner for any social media URL.
 */
export async function inspectSocialPage(options) {
    const page = await sessionManager.newPage(options.headless ?? false);
    try {
        await page.goto(options.url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await page.waitForTimeout(options.waitMs ?? 3500);
        if (options.clickSelector) {
            await page.locator(options.clickSelector).first().click();
            await page.waitForTimeout(1500);
        }
        if (options.typeSelector && options.typeText !== undefined) {
            const target = page.locator(options.typeSelector).first();
            await target.click();
            await page.keyboard.insertText(options.typeText);
            if (options.pressEnter) {
                await page.keyboard.press("Enter");
            }
            await page.waitForTimeout(2000);
        }
        const data = await page.evaluate(() => {
            const title = document.title;
            const textExcerpt = (document.body.innerText || "").slice(0, 4000);
            const interactiveNodes = Array.from(document.querySelectorAll('button, a[href], input, textarea, [role="button"], [role="textbox"], [contenteditable="true"]')).slice(0, 60);
            const interactiveElements = interactiveNodes
                .map((el) => {
                const tag = el.tagName.toLowerCase();
                const aria = el.getAttribute("aria-label") || "";
                const testId = el.getAttribute("data-testid") || el.getAttribute("data-e2e") || "";
                const role = el.getAttribute("role") || "";
                const text = (el.innerText || aria || "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 80);
                let selectorHint = tag;
                if (testId)
                    selectorHint = `[data-testid="${testId}"]`;
                else if (aria)
                    selectorHint = `${tag}[aria-label="${aria}"]`;
                else if (role)
                    selectorHint = `${tag}[role="${role}"]`;
                return { tag, text, selectorHint };
            })
                .filter((item) => item.text.length > 0 || item.selectorHint !== item.tag);
            return { title, textExcerpt, interactiveElements };
        });
        const screenshotPath = await sessionManager.takeScreenshot(page, "inspect-page");
        return {
            url: page.url(),
            title: data.title,
            textExcerpt: data.textExcerpt,
            interactiveElements: data.interactiveElements,
            screenshotPath,
        };
    }
    finally {
        await page.close().catch(() => { });
    }
}
