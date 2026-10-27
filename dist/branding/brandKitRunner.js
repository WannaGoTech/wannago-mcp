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
        phone: options.phone || "+216 99 780 577",
        email: options.email ||
            `contact@${options.brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        website: options.website ||
            `${options.brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        address: options.address || "H3-1, Espace Tunis, Tunis 1071",
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
export async function runBragOmniVideoGeneration(options) {
    const configPath = path.join(DATA_DIR, `brag_config_${options.brandName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.json`);
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
