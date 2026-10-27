import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
/**
 * WannaGo Sovereign Security, Trial & License Guard (v3.1)
 * - Supports 3-Day Free Trial Keys (`wgo_trial_<payload>.<sig>`) -> Hard stop after 72h
 * - Supports Paid Subscription Keys (`wgo_live_<payload>.<sig>`) -> Monthly / Yearly / Enterprise
 * - Hardware Fingerprint anti-tamper tracking for expired trials
 * - AES-256-GCM Engine Vault Decryption (so Python engines run in-memory without exposing source code)
 */
const DEFAULT_PUBLISHER_SEED = process.env.WANNAGO_SIGNING_SECRET ||
    "wgt_mcp_sovereign_publisher_hmac_seed_2026_v3_9f8e7d6c5b4a3f2e1d0c";
const ALLOWED_SHA256_HASHES = new Set([
    "e0d123e5f316bef78bfdf5a00883757782b9226f59202330006053d280e3b775",
    "d001b0f3f1f9866c8092afa1ef2d6ed7522148f1eca3f53c476f5fb8d521846c",
    ...(process.env.WANNAGO_ALLOWED_KEY_HASHES
        ? process.env.WANNAGO_ALLOWED_KEY_HASHES.split(",").map((s) => s.trim())
        : []),
]);
function getHardwareLedgerPath() {
    return path.join(os.homedir(), ".wannago_license_ledger.json");
}
function readHardwareLedger() {
    const p = getHardwareLedgerPath();
    if (!fs.existsSync(p)) {
        return { usedTrialEmails: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
    catch {
        return { usedTrialEmails: [] };
    }
}
function saveHardwareLedger(data) {
    try {
        fs.writeFileSync(getHardwareLedgerPath(), JSON.stringify(data, null, 2), "utf-8");
    }
    catch {
        // ignore read-only fs
    }
}
/**
 * Generates a signed `wgo_trial_...` (3 days / 72h) or `wgo_live_...` (paid) key.
 */
export function generateSignedLicenseKey(client, tier = "enterprise", validDays = 365, email, signingSecret = DEFAULT_PUBLISHER_SEED) {
    const nowSec = Math.floor(Date.now() / 1000);
    const effectiveDays = tier === "trial" ? 3 : validDays;
    const expSec = nowSec + Math.round(effectiveDays * 86400);
    const prefix = tier === "trial" ? "wgo_trial_" : "wgo_live_";
    const payload = {
        client,
        email: email || client,
        tier,
        iat: nowSec,
        exp: expSec,
        jti: crypto.randomBytes(6).toString("hex"),
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
    const sig = crypto
        .createHmac("sha256", signingSecret)
        .update(`${prefix}${payloadB64}`)
        .digest("hex");
    return {
        apiKey: `${prefix}${payloadB64}.${sig}`,
        payload,
        expiresAtIso: new Date(expSec * 1000).toISOString(),
    };
}
/**
 * Verifies a WannaGo security key (`wgo_trial_...` or `wgo_live_...`).
 * Enforces the 3-day (72h) automatic stop on trial keys.
 */
export function verifySecurityKey(rawKey, signingSecret = DEFAULT_PUBLISHER_SEED) {
    const key = (rawKey ||
        process.env.WANNAGO_API_KEY ||
        extractCliApiKey() ||
        "").trim();
    if (!key) {
        return {
            valid: false,
            error: "Clé de sécurité WANNAGO_API_KEY manquante. Demandez votre clé d'essai gratuit (3 jours / 72h) ou votre clé d'abonnement par email à contact@wannago.tech.",
        };
    }
    // 1. Check SHA-256 Master Hash list
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");
    if (ALLOWED_SHA256_HASHES.has(keyHash)) {
        return {
            valid: true,
            client: "WannaGoTech Master Admin",
            tier: "admin",
            isTrial: false,
            expiresAt: "never",
            mode: "master_hash",
        };
    }
    // 2. Check Signed Token (`wgo_trial_` or `wgo_live_`)
    const isTrialPrefix = key.startsWith("wgo_trial_");
    const isLivePrefix = key.startsWith("wgo_live_");
    if (isTrialPrefix || isLivePrefix) {
        const prefix = isTrialPrefix ? "wgo_trial_" : "wgo_live_";
        const withoutPrefix = key.slice(prefix.length);
        const dotIdx = withoutPrefix.lastIndexOf(".");
        if (dotIdx === -1) {
            return {
                valid: false,
                error: "Format de clé WANNAGO_API_KEY invalide.",
            };
        }
        const payloadB64 = withoutPrefix.slice(0, dotIdx);
        const providedSig = withoutPrefix.slice(dotIdx + 1);
        const expectedSig = crypto
            .createHmac("sha256", signingSecret)
            .update(`${prefix}${payloadB64}`)
            .digest("hex");
        const a = Buffer.from(providedSig, "utf-8");
        const b = Buffer.from(expectedSig, "utf-8");
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return {
                valid: false,
                error: "Signature cryptographique WANNAGO_API_KEY invalide.",
            };
        }
        try {
            const decoded = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
            const nowSec = Math.floor(Date.now() / 1000);
            const isTrial = decoded.tier === "trial" || isTrialPrefix;
            // Enforce 3-day (72h) expiration or subscription expiration
            if (decoded.exp && nowSec > decoded.exp) {
                return {
                    valid: false,
                    client: decoded.client,
                    email: decoded.email,
                    tier: decoded.tier,
                    isTrial,
                    remainingHours: 0,
                    expiresAt: new Date(decoded.exp * 1000).toISOString(),
                    error: isTrial
                        ? `Votre période d'essai gratuit de 3 jours est terminée (expirée le ${new Date(decoded.exp * 1000).toISOString()}). Contactez contact@wannago.tech pour recevoir votre clé d'abonnement 'wgo_live_...' par email.`
                        : `Votre abonnement WANNAGO_API_KEY a expiré le ${new Date(decoded.exp * 1000).toISOString()}. Contactez contact@wannago.tech pour renouveler votre licence.`,
                };
            }
            // Hardware anti-abuse check for 3-day trials (prevents generating endless new trial keys on the same machine after 72h)
            if (isTrial) {
                const ledger = readHardwareLedger();
                if (!ledger.firstTrialStartedAt) {
                    ledger.firstTrialStartedAt = decoded.iat || nowSec;
                    if (decoded.email && !ledger.usedTrialEmails.includes(decoded.email)) {
                        ledger.usedTrialEmails.push(decoded.email);
                    }
                    saveHardwareLedger(ledger);
                }
                else {
                    const machineTrialAgeHours = (nowSec - ledger.firstTrialStartedAt) / 3600;
                    if (machineTrialAgeHours > 72) {
                        return {
                            valid: false,
                            client: decoded.client,
                            email: decoded.email,
                            tier: "trial",
                            isTrial: true,
                            remainingHours: 0,
                            error: "La période d'essai gratuit de 3 jours (72h) a déjà été consommée sur cet appareil. Veuillez activer une clé d'abonnement 'wgo_live_...' reçue par email.",
                        };
                    }
                }
            }
            const remainingHours = Math.max(0, Math.round(((decoded.exp - nowSec) / 3600) * 10) / 10);
            return {
                valid: true,
                client: decoded.client,
                email: decoded.email,
                tier: decoded.tier,
                isTrial,
                remainingHours,
                expiresAt: new Date(decoded.exp * 1000).toISOString(),
                mode: "signed_token",
            };
        }
        catch {
            return {
                valid: false,
                error: "Payload de licence corrompu.",
            };
        }
    }
    return {
        valid: false,
        error: "Format de clé non reconnu. Utilisez une clé 'wgo_trial_...' (essai 3 jours) ou 'wgo_live_...' (abonnement actif).",
    };
}
function extractCliApiKey() {
    const idx = process.argv.indexOf("--api-key");
    if (idx !== -1 && process.argv[idx + 1]) {
        return process.argv[idx + 1];
    }
    return undefined;
}
export function assertAuthorized(overrideKey) {
    const res = verifySecurityKey(overrideKey);
    if (!res.valid) {
        throw new Error(`🔒 [WANNAGO_LICENSE_LOCKED] ${res.error}`);
    }
    return res;
}
/**
 * Encrypts a source string with AES-256-GCM so proprietary Python/JS engines
 * can be distributed inside the plugin without exposing readable source code.
 */
export function encryptEngineSource(plainText, secret = DEFAULT_PUBLISHER_SEED) {
    const key = crypto.createHash("sha256").update(secret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([
        cipher.update(plainText, "utf-8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
}
/**
 * Decrypts an AES-256-GCM encrypted `.wgo` engine payload in memory ONLY after license verification.
 */
export function decryptEngineSource(encryptedB64, secret = DEFAULT_PUBLISHER_SEED) {
    assertAuthorized();
    const raw = Buffer.from(encryptedB64, "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const key = crypto.createHash("sha256").update(secret).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf-8");
}
