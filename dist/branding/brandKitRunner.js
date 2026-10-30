import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, PROJECT_ROOT } from "../browser/sessionManager.js";
import { decryptEngineSource } from "../security/authGuard.js";
const execFileAsync = promisify(execFile);
/**
 * Executes either an AES-256-GCM encrypted `.wgo` vault in memory (via Python stdin pipe, zero source code on disk)
 * or the local `.py` script if in development workspace.
 */
async function executeProtectedPythonEngine(vaultFileName, devScriptName, cliArgs, timeoutMs = 180000) {
    const vaultPath = path.join(PROJECT_ROOT, "engine", vaultFileName);
    const devScriptPath = path.join(PROJECT_ROOT, "scripts", devScriptName);
    if (fs.existsSync(vaultPath)) {
        const encryptedB64 = fs.readFileSync(vaultPath, "utf-8").trim();
        const pythonCode = decryptEngineSource(encryptedB64);
        return new Promise((resolve, reject) => {
            const child = spawn("python", ["-", ...cliArgs], {
                env: {
                    ...process.env,
                    WANNAGO_ENGINE_ROOT: PROJECT_ROOT,
                    PYTHONIOENCODING: "utf-8",
                },
                stdio: ["pipe", "pipe", "pipe"],
            });
            let stdout = "";
            let stderr = "";
            const timer = setTimeout(() => {
                child.kill();
                reject(new Error(`WannaGo Engine timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            child.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
            child.stderr.on("data", (d) => (stderr += d.toString("utf-8")));
            child.on("error", (err) => {
                clearTimeout(timer);
                reject(err);
            });
            child.on("close", (code) => {
                clearTimeout(timer);
                if (code !== 0) {
                    reject(new Error(`WannaGo Engine exited with code ${code}: ${stderr || stdout}`));
                }
                else {
                    resolve(stdout);
                }
            });
            child.stdin.write(pythonCode, "utf-8");
            child.stdin.end();
        });
    }
    const { stdout } = await execFileAsync("python", [devScriptPath, ...cliArgs], {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: {
            ...process.env,
            WANNAGO_ENGINE_ROOT: PROJECT_ROOT,
            PYTHONIOENCODING: "utf-8",
        },
    });
    return stdout;
}
export async function runOneShotBrandKitGeneration(options) {
    if (options.logoPath &&
        options.logoPath.toLowerCase() !== "auto" &&
        !fs.existsSync(options.logoPath)) {
        throw new Error(`Logo file not found at path: ${options.logoPath}`);
    }
    const configPath = path.join(DATA_DIR, `brand_config_${options.brandName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.json`);
    const payload = {
        logo_path: options.logoPath,
        brand_name: options.brandName,
        description: options.businessDescription,
        sector: options.sector || "Solutions Technologiques & Plateforme Métier",
        tagline_fr: options.taglineFr,
        tagline_en: options.taglineEn,
        tagline_de: options.taglineDe,
        tagline_ar: options.taglineAr,
        phone: options.phone || "",
        email: options.email ||
            `contact@${options.brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        website: options.website ||
            `${options.brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        address: options.address || "",
        parent_company: options.parentCompany || "WannaGoTech",
        products: options.products && options.products.length > 0
            ? options.products
            : [
                {
                    name: `${options.brandName} Core Platform`,
                    desc: options.businessDescription,
                },
            ],
        primary_color_override: options.primaryColorOverride,
        accent_color_override: options.accentColorOverride,
        output_dir: options.outputDir,
    };
    fs.writeFileSync(configPath, JSON.stringify(payload, null, 2), "utf-8");
    const stdout = await executeProtectedPythonEngine("wannago_brand.wgo", "wannago_brand_engine.py", ["--config-json", configPath], 180000);
    return JSON.parse(stdout.trim());
}
export async function runDesignAuditOnDirectory(targetDir) {
    const detectScript = path.join(PROJECT_ROOT, "engine", "scanners", "detect.mjs");
    if (!fs.existsSync(detectScript)) {
        return {
            targetDir,
            detectMjsPassed: false,
            detectMjsOutput: `detect.mjs not found at ${detectScript}`,
        };
    }
    try {
        const { stdout, stderr } = await execFileAsync("node", [detectScript, targetDir], { timeout: 30000 });
        const out = (stdout + "\n" + stderr).trim();
        return {
            targetDir,
            detectMjsPassed: out.includes("0 findings"),
            detectMjsOutput: out,
        };
    }
    catch (err) {
        return {
            targetDir,
            detectMjsPassed: false,
            detectMjsOutput: err?.stdout || err?.stderr || String(err),
        };
    }
}
export async function runPromoOmniVideoGeneration(options) {
    const configPath = path.join(DATA_DIR, `promo_config_${options.brandName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.json`);
    const payload = {
        brand_name: options.brandName,
        tagline: options.tagline ||
            `${options.brandName}: Engineered for Precision & Speed`,
        description: options.description ||
            `${options.brandName} delivers automated, zero-friction workflows.`,
        tone: options.tone || "polished",
        format: options.format || "landscape",
        mode: options.mode || "auto",
        primary_color: options.primaryColor || "#0D5C9E",
        accent_color: options.accentColor || "#1498B5",
        website: options.website ||
            `${options.brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        logo_path: options.logoPath,
        products: options.products || [],
        output_dir: options.outputDir,
        include_music: options.includeMusic ?? true,
        include_sfx: options.includeSfx ?? true,
    };
    fs.writeFileSync(configPath, JSON.stringify(payload, null, 2), "utf-8");
    const stdout = await executeProtectedPythonEngine("wannago_video.wgo", "wannago_brag_omni_engine.py", ["--config", configPath], 300000);
    return JSON.parse(stdout.trim());
}
export const WANNAGOTECH_AUTOMATTIC_PARTNER_OFFER = {
    partnerStatus: "WannaGoTech is an Official Automattic Partner (WordPress.com, Pressable Managed WordPress, WooCommerce)",
    pricingBenefit: "Preferential Automattic Partner pricing on enterprise WordPress & Pressable Managed Hosting",
    websiteSupportFee: "0 EUR / FREE — WannaGoTech does NOT charge for website creation, theme setup, migration, or technical support",
    billingModel: "We charge ONLY for Premium Managed Hosting (zero fee for website build or engineering support)",
    directHelpContact: "contact@wannago.tech",
    credentialIsolationPolicy: "STRICT ZERO-SHARED-CREDENTIALS: WannaGo MCP never embeds or shares any developer/partner login or token. Each user connects their own personal WordPress Studio, Pressable API token (<YOUR_OWN_PRESSABLE_API_TOKEN>), and social media accounts on their own machine (or receives dedicated individual client hosting credentials when subscribing via contact@wannago.tech).",
    includedMcpServers: {
        wordpressStudioMcp: "wordpress-studio (local & remote WordPress connected to the user's own account)",
        pressableMcp: "pressable (connected using the user's own Pressable API token or dedicated client token)",
        wannagoMcp: "wannago-mcp (isolated per-user local session, browser profile, and WANNAGO_API_KEY)",
    },
};
/**
 * Embeds `https://github.com/edsadr/everything-api` into the user's project directory (`12_Everything_API/`)
 * and turns the user's provided website URL (or brand brief) into a live, pre-seeded REST API + OpenAPI 3.1 spec.
 */
export async function embedEverythingApiForProject(options) {
    const slug = options.brandName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const outRoot = options.outputDir ||
        path.join("C:\\Users\\hp\\Desktop\\Workspace\\Marketing", options.brandName.replace(/\s+/g, "_"));
    const apiDir = path.join(outRoot, "12_Everything_API");
    fs.mkdirSync(path.join(apiDir, "lib"), { recursive: true });
    fs.mkdirSync(path.join(apiDir, "resources"), { recursive: true });
    fs.mkdirSync(path.join(apiDir, ".cache"), { recursive: true });
    const vendorDir = path.join(PROJECT_ROOT, "vendor", "everything-api");
    const filesToCopy = [
        "index.js",
        "package.json",
        "README.md",
        "LICENSE",
        ".env-template",
        path.join("lib", "app.js"),
        path.join("lib", "arguments.js"),
        path.join("lib", "openAI.js"),
        path.join("lib", "validateKey.js"),
        path.join("resources", "help.md"),
        path.join("resources", "rest.md"),
    ];
    for (const rel of filesToCopy) {
        const src = path.join(vendorDir, rel);
        const dst = path.join(apiDir, rel);
        if (fs.existsSync(src)) {
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.copyFileSync(src, dst);
        }
    }
    // Attempt lightweight non-blocking fetch of the user's provided URL to extract live metadata
    const normalizedUrl = options.sourceUrl.startsWith("http")
        ? options.sourceUrl
        : `https://${options.sourceUrl}`;
    const extractedWebMetadata = { fetchedLive: false };
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const resp = await fetch(normalizedUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (resp.ok) {
            const html = await resp.text();
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
            const hMatches = Array.from(html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi))
                .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
                .filter(Boolean)
                .slice(0, 8);
            extractedWebMetadata.title = titleMatch
                ? titleMatch[1].trim()
                : options.brandName;
            extractedWebMetadata.description = descMatch
                ? descMatch[1].trim()
                : options.businessDescription;
            extractedWebMetadata.headings = hMatches;
            extractedWebMetadata.fetchedLive = true;
        }
    }
    catch {
        extractedWebMetadata.title = options.brandName;
        extractedWebMetadata.description = options.businessDescription;
    }
    const port = options.port || 3000;
    const endpoints = {
        "GET /": "Welcome to the Everything API",
        [`GET /${slug}/brand`]: `Brand identity & metadata extracted from ${normalizedUrl}`,
        [`GET /${slug}/products`]: `Products & services API generated from ${normalizedUrl}`,
        [`GET /${slug}/social`]: `9-platform social profiles, bios, avatars & covers for ${options.brandName}`,
        "GET /*": "Dynamic AI-generated JSON REST endpoint powered by everything-api (https://github.com/edsadr/everything-api)",
    };
    const manifest = {
        brandName: options.brandName,
        sourceUrl: normalizedUrl,
        everythingApiRepository: "https://github.com/edsadr/everything-api",
        embeddedAt: new Date().toISOString(),
        port,
        extractedWebMetadata,
        endpoints,
    };
    const manifestPath = path.join(apiDir, "brand_everything_api_manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    const openApiSpec = {
        openapi: "3.1.0",
        info: {
            title: `${options.brandName} — Everything API (Converted from ${normalizedUrl})`,
            version: "1.0.0",
            description: extractedWebMetadata.description ||
                options.businessDescription ||
                `Dynamic Everything API for ${options.brandName}`,
        },
        servers: [{ url: `http://localhost:${port}` }],
        paths: {
            "/": {
                get: { summary: "Everything API Root Healthcheck" },
            },
            [`/${slug}/brand`]: {
                get: { summary: `Brand profile & metadata from ${normalizedUrl}` },
            },
            [`/${slug}/products`]: {
                get: { summary: `Products & services catalog from ${normalizedUrl}` },
            },
            [`/${slug}/social`]: {
                get: { summary: `9-platform social media profiles & assets` },
            },
            "/{anyEndpointPath}": {
                get: {
                    summary: "Dynamic AI-generated JSON endpoint for any path (powered by https://github.com/edsadr/everything-api)",
                },
            },
        },
    };
    const openApiSpecPath = path.join(apiDir, "openapi.json");
    fs.writeFileSync(openApiSpecPath, JSON.stringify(openApiSpec, null, 2), "utf-8");
    return {
        status: "EVERYTHING_API_EMBEDDED_AND_READY",
        sourceUrl: normalizedUrl,
        everythingApiRepo: "https://github.com/edsadr/everything-api",
        embeddedProjectDir: apiDir,
        manifestPath,
        openApiSpecPath,
        extractedWebMetadata,
        endpoints,
        startCommand: `cd "${apiDir}" && npx everything-api --port ${port}`,
    };
}
/**
 * Generates a WannaGo-certified WordPress Block Theme (WCAG 2.1 AA/AAA, Apple HIG + Anti-AI)
 * and prepares the deployment plan for both WordPress Studio MCP (`wordpress-studio`) and Pressable MCP (`pressable`),
 * including WannaGoTech's Official Automattic Partner offer (preferential hosting prices + FREE website support).
 */
export async function prepareWordPressAndPressableBundle(options) {
    const slug = options.brandName.replace(/\s+/g, "_");
    const themeSlug = options.brandName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const outRoot = options.outputDir ||
        path.join("C:\\Users\\hp\\Desktop\\Workspace\\Marketing", slug);
    const websitesDir = path.join(outRoot, "11_Production_Website");
    const wpThemeDir = path.join(websitesDir, `WordPress_Block_Theme_${slug}`, themeSlug);
    fs.mkdirSync(path.join(wpThemeDir, "templates"), { recursive: true });
    fs.mkdirSync(path.join(wpThemeDir, "parts"), { recursive: true });
    const primary = options.primaryColor || "#034479";
    const accent = options.accentColor || "#007A8C";
    const website = options.website?.replace(/^https?:\/\//, "") || `${themeSlug}.com`;
    const email = options.email || `contact@${website}`;
    const phone = options.phone || "";
    fs.writeFileSync(path.join(wpThemeDir, "style.css"), `/*
Theme Name: ${options.brandName} Official Theme
Theme URI: https://${website}
Author: WannaGoTech (Official Automattic Partner)
Author URI: https://wannago.tech
Description: ${options.businessDescription} — Engineered with WannaGo MCP & ACP for WordPress Studio MCP and Pressable Managed Hosting. Free website support at contact@wannago.tech (charged only for premium hosting).
Version: 3.0.0
Requires at least: 6.4
Tested up to: 6.7
Requires PHP: 8.2
Text Domain: ${themeSlug}
*/
:root {
  --wp--preset--color--primary: ${primary};
  --wp--preset--color--accent: ${accent};
  --wp--preset--color--obsidian: #07111E;
  --wp--preset--color--surface: #F4F8FB;
}
body {
  overflow-x: clip;
  font-variant-numeric: tabular-nums;
}
`, "utf-8");
    fs.writeFileSync(path.join(wpThemeDir, "theme.json"), JSON.stringify({
        $schema: "https://schemas.wp.org/trunk/theme.json",
        version: 3,
        settings: {
            appearanceTools: true,
            layout: { contentSize: "860px", wideSize: "1180px" },
            color: {
                palette: [
                    {
                        slug: "primary",
                        color: primary,
                        name: `${options.brandName} Primary`,
                    },
                    {
                        slug: "accent",
                        color: accent,
                        name: `${options.brandName} Accent`,
                    },
                    { slug: "obsidian", color: "#07111E", name: "Obsidian Dark" },
                    { slug: "surface", color: "#F4F8FB", name: "Surface Ice" },
                    { slug: "white", color: "#FFFFFF", name: "Pure White" },
                ],
            },
        },
    }, null, 2), "utf-8");
    fs.writeFileSync(path.join(wpThemeDir, "functions.php"), `<?php
// ${options.brandName} Official Block Theme — WannaGoTech Automattic Partner Stack
add_action('wp_enqueue_scripts', function() {
    wp_enqueue_style('${themeSlug}-style', get_stylesheet_uri(), array(), '3.0.0');
});
`, "utf-8");
    fs.writeFileSync(path.join(wpThemeDir, "parts", "header.html"), `<!-- wp:group {"layout":{"type":"constrained"}} -->
<header class="wp-block-group" style="padding:18px 28px;border-bottom:1px solid #D8E2EE;display:flex;justify-content:space-between;align-items:center">
  <strong>${options.brandName}</strong>
  <span>${phone} | ${email}</span>
</header>
<!-- /wp:group -->\n`, "utf-8");
    fs.writeFileSync(path.join(wpThemeDir, "parts", "footer.html"), `<!-- wp:group {"layout":{"type":"constrained"}} -->
<footer class="wp-block-group" style="padding:28px;border-top:1px solid #D8E2EE;font-size:13px">
  <span>${options.brandName} — https://${website} | Powered by WannaGoTech (Official Automattic Partner — Free Website Support: contact@wannago.tech)</span>
</footer>
<!-- /wp:group -->\n`, "utf-8");
    fs.writeFileSync(path.join(wpThemeDir, "templates", "index.html"), `<!-- wp:template-part {"slug":"header","tagName":"header"} /-->
<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} -->
<main class="wp-block-group">
  <!-- wp:post-content {"layout":{"type":"constrained"}} /-->
</main>
<!-- /wp:group -->
<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->\n`, "utf-8");
    const partnerGuidePath = path.join(websitesDir, "WORDPRESS_AND_PRESSABLE_PARTNER_GUIDE.md");
    fs.writeFileSync(partnerGuidePath, `# ${options.brandName} — WordPress (\`wordpress-studio\` MCP) & Pressable (\`pressable\` MCP) Guide
## WannaGoTech Official Automattic Partner Program

- **Automattic Partner Preferential Pricing**: **WannaGoTech** is an official **Automattic Partner**, providing preferential partner rates on **Pressable** and **WordPress** enterprise hosting.
- **FREE Website Support (\`0 EUR\` Support Fee)**: **We do NOT charge for website creation, theme setup, migration, or technical support.** We charge **only for Premium Managed Hosting**.
- **Need Help?**: If you are stuck at any step, email **` +
        `contact@wannago.tech` +
        `** and our team will assist you free of charge.
`, "utf-8");
    return {
        brandName: options.brandName,
        themeSlug,
        wordpressBlockThemeDir: wpThemeDir,
        partnerGuidePath,
        automatticPartnerOffer: WANNAGOTECH_AUTOMATTIC_PARTNER_OFFER,
        mcpDeploymentWorkflows: {
            wordpressStudioMcpSteps: [
                `1. Call 'wordpress-studio:site_create' with name='${options.brandName}'`,
                `2. Call 'wordpress-studio:scaffold_theme' with name='${options.brandName} Theme', slug='${themeSlug}' (or copy ${wpThemeDir} to wp-content/themes/${themeSlug})`,
                `3. Call 'wordpress-studio:site_start' and 'wordpress-studio:preview_create' to preview live`,
                `4. Call 'wordpress-studio:site_push' to push to your connected Pressable / WordPress remote site`,
            ],
            pressableMcpSteps: [
                `1. Call 'pressable:execute_tool' -> 'get_account_site_counts' & 'get_site_creation_options'`,
                `2. Call 'pressable:execute_tool' -> 'validate_site_name' with name='${themeSlug}'`,
                `3. Call 'pressable:execute_tool' -> 'create_site' with name='${themeSlug}'`,
                `4. Call 'pressable:execute_tool' -> 'add_site_domain' with domain_name='${website}'`,
                `5. Call 'pressable:execute_tool' -> 'onepress_login' for instant WP-Admin access (or email contact@wannago.tech for FREE website setup & Automattic Partner hosting activation)`,
            ],
        },
    };
}
