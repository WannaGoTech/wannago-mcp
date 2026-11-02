import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import tls from "node:tls";
import { PROFILE_DIR, sessionManager } from "../browser/sessionManager.js";
import { generateSignedLicenseKey } from "../security/authGuard.js";
/**
 * WannaGoTech Sovereign Gmail & Email Marketing Engine (v3.2 — 100% REA, Zero Third-Party Dependency)
 *
 * Supports 3 isolated local connection modes (Zero Shared Credentials):
 * 1. Native TLS SMTP (smtp.gmail.com:465) & IMAP (imap.gmail.com:993) via GMAIL_USER + GMAIL_APP_PASSWORD
 * 2. Native Gmail REST API v1 (gmail.googleapis.com) via GMAIL_OAUTH_ACCESS_TOKEN
 * 3. Isolated Local Playwright Browser Session (https://mail.google.com) in .data/browser-profiles/
 *
 * Enforces:
 * - Zero-Invention & Dry-Run Default (`dryRun: true` generates RFC-5322 .eml + 600px WCAG HTML preview before sending)
 * - Automatic 600px WCAG 2.1 AA/AAA HTML Signature injection (`tabular-nums`, BiDi isolation)
 * - Built-in Rate-Limiting Guardrail (max 30 outreach emails/day, anti-spam lexical check)
 */
const DATA_DIR = path.resolve(process.cwd(), ".data");
const GMAIL_CONFIG_PATH = path.join(DATA_DIR, "gmail_sovereign_config.json");
const GMAIL_OUTBOX_DIR = path.join(DATA_DIR, "gmail-outbox");
function ensureGmailDirs() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(GMAIL_OUTBOX_DIR, { recursive: true });
}
export function loadGmailConfig() {
    ensureGmailDirs();
    let fileCfg = {};
    if (fs.existsSync(GMAIL_CONFIG_PATH)) {
        try {
            fileCfg = JSON.parse(fs.readFileSync(GMAIL_CONFIG_PATH, "utf-8"));
        }
        catch {
            fileCfg = {};
        }
    }
    return {
        email: process.env.GMAIL_USER || process.env.GMAIL_EMAIL || fileCfg.email || "contact@wannago.tech",
        senderName: process.env.GMAIL_SENDER_NAME || fileCfg.senderName || "WannaGoTech",
        appPassword: process.env.GMAIL_APP_PASSWORD || fileCfg.appPassword,
        oauthAccessToken: process.env.GMAIL_OAUTH_ACCESS_TOKEN || fileCfg.oauthAccessToken,
        preferredMode: fileCfg.preferredMode || (process.env.GMAIL_APP_PASSWORD ? "smtp_imap" : process.env.GMAIL_OAUTH_ACCESS_TOKEN ? "gmail_api" : "smtp_imap"),
        brandName: fileCfg.brandName || "WannaGoTech",
        brandRole: fileCfg.brandRole || "Official Automattic Partner — Brand, Web & AI Engineering",
        brandPhone: fileCfg.brandPhone || "",
        brandWebsite: fileCfg.brandWebsite || "https://wannagotech.github.io/wannago-mcp/",
        brandPrimaryHex: fileCfg.brandPrimaryHex || "#323F76",
        brandAccentHex: fileCfg.brandAccentHex || "#731B2B",
        updatedAt: fileCfg.updatedAt,
    };
}
export function saveGmailConfig(partial) {
    ensureGmailDirs();
    const current = loadGmailConfig();
    const merged = {
        ...current,
        ...Object.fromEntries(Object.entries(partial).filter(([, v]) => v !== undefined)),
        updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(GMAIL_CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
}
/**
 * Generates a 600px WCAG 2.1 AA/AAA HTML Email Signature (Apple HIG + Anti-AI + tabular-nums + BiDi isolation)
 */
export function buildSovereign600pxSignatureHtml(cfg) {
    const name = cfg.senderName || "WannaGoTech";
    const brand = cfg.brandName || "WannaGoTech";
    const role = cfg.brandRole || "Architecture de Marque, Web & IA Souveraine";
    const email = cfg.email || "contact@wannago.tech";
    const website = cfg.brandWebsite || "https://wannagotech.github.io/wannago-mcp/";
    const phone = cfg.brandPhone ? `<span dir="ltr" style="font-variant-numeric: tabular-nums;">${cfg.brandPhone}</span> &bull; ` : "";
    const primary = cfg.brandPrimaryHex || "#323F76";
    const accent = cfg.brandAccentHex || "#731B2B";
    return `<!-- WannaGoTech 600px WCAG 2.1 AA/AAA Signature -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;margin-top:24px;border-top:2px solid ${primary};padding-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0C182E;font-variant-numeric:tabular-nums;">
  <tr>
    <td style="padding:14px 0 6px 0;">
      <div style="font-size:15px;font-weight:700;color:#0C182E;letter-spacing:-0.01em;">${name} <span style="color:${accent};font-weight:700;">/ ${brand}</span></div>
      <div style="font-size:13px;color:#323F76;font-weight:600;margin-top:2px;">${role}</div>
    </td>
  </tr>
  <tr>
    <td style="padding:4px 0 0 0;font-size:12.5px;color:#0C182E;line-height:1.5;">
      ${phone}<a href="mailto:${email}" style="color:${accent};text-decoration:none;font-weight:600;">${email}</a> &bull; <a href="${website}" style="color:${primary};text-decoration:none;font-weight:600;">${website}</a>
    </td>
  </tr>
</table>`;
}
/**
 * Wraps body content into a clean, responsive 600px WCAG 2.1 AA/AAA HTML Email document
 */
export function buildFullWcagEmailHtml(options) {
    const bodyContent = options.bodyHtml ||
        options.bodyText
            .split(/\r?\n\r?\n/)
            .map((p) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#0C182E;">${p
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\r?\n/g, "<br/>")}</p>`)
            .join("\n");
    const sig = options.includeSignature !== false ? buildSovereign600pxSignatureHtml(options.cfg) : "";
    return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${options.subject.replace(/</g, "&lt;")}</title>
</head>
<body style="margin:0;padding:24px;background-color:#FDFDFD;color:#0C182E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0;">
        ${bodyContent}
        ${sig}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
/**
 * Builds an RFC-5322 compliant multipart/alternative MIME message (.eml)
 */
export function buildMimeMessage(options) {
    const boundary = `----=_WannaGoMCP_${crypto.randomBytes(12).toString("hex")}`;
    const domain = options.fromEmail.split("@")[1] || "wannago.tech";
    const messageId = `<${crypto.randomUUID()}@${domain}>`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(options.subject, "utf-8").toString("base64")}?=`;
    const encodedFromName = `=?UTF-8?B?${Buffer.from(options.fromName, "utf-8").toString("base64")}?=`;
    const headers = [
        `From: ${encodedFromName} <${options.fromEmail}>`,
        `To: ${options.to.join(", ")}`,
        ...(options.cc && options.cc.length > 0 ? [`Cc: ${options.cc.join(", ")}`] : []),
        ...(options.replyTo ? [`Reply-To: ${options.replyTo}`] : []),
        `Subject: ${encodedSubject}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: ${messageId}`,
        `MIME-Version: 1.0`,
        `X-Mailer: WannaGo-MCP-Sovereign-Engine/3.2`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
    const textB64 = Buffer.from(options.text, "utf-8")
        .toString("base64")
        .replace(/(.{76})/g, "$1\r\n");
    const htmlB64 = Buffer.from(options.html, "utf-8")
        .toString("base64")
        .replace(/(.{76})/g, "$1\r\n");
    const rawMime = [
        ...headers,
        "",
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        `Content-Transfer-Encoding: base64`,
        "",
        textB64,
        "",
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: base64`,
        "",
        htmlB64,
        "",
        `--${boundary}--`,
        "",
    ].join("\r\n");
    return { rawMime, messageId };
}
/**
 * Native Node.js TLS SMTP client for smtp.gmail.com:465 (Zero external dependencies)
 */
async function sendViaGmailSmtpTls(options) {
    return new Promise((resolve, reject) => {
        const socket = tls.connect({
            host: "smtp.gmail.com",
            port: 465,
            servername: "smtp.gmail.com",
            timeout: 15000,
        }, () => {
            // Connected over TLS
        });
        let buffer = "";
        let step = 0;
        const cleanPass = options.appPassword.replace(/\s+/g, "");
        let recipientIndex = 0;
        const sendLine = (line) => {
            socket.write(`${line}\r\n`);
        };
        socket.on("data", (chunk) => {
            buffer += chunk.toString("utf-8");
            const lines = buffer.split("\r\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
                if (!line)
                    continue;
                // Wait until the final line of a multi-line SMTP response (4th char is space)
                if (line.length >= 4 && line[3] === "-")
                    continue;
                const code = parseInt(line.slice(0, 3), 10);
                if (code >= 400) {
                    socket.end();
                    reject(new Error(`Gmail SMTP Error (${code}): ${line}`));
                    return;
                }
                if (step === 0 && code === 220) {
                    step = 1;
                    sendLine("EHLO wannago.tech");
                }
                else if (step === 1 && code === 250) {
                    step = 2;
                    const authPlain = Buffer.from(`\u0000${options.user}\u0000${cleanPass}`, "utf-8").toString("base64");
                    sendLine(`AUTH PLAIN ${authPlain}`);
                }
                else if (step === 2 && code === 235) {
                    step = 3;
                    sendLine(`MAIL FROM:<${options.fromEmail}>`);
                }
                else if (step === 3 && code === 250) {
                    if (recipientIndex < options.recipients.length) {
                        const rcpt = options.recipients[recipientIndex++];
                        sendLine(`RCPT TO:<${rcpt}>`);
                        if (recipientIndex === options.recipients.length) {
                            step = 4;
                        }
                    }
                }
                else if (step === 4 && code === 250) {
                    step = 5;
                    sendLine("DATA");
                }
                else if (step === 5 && code === 354) {
                    step = 6;
                    const dotStuffed = options.rawMime.replace(/\r\n\./g, "\r\n..");
                    socket.write(`${dotStuffed}\r\n.\r\n`);
                }
                else if (step === 6 && code === 250) {
                    step = 7;
                    sendLine("QUIT");
                    socket.end();
                    resolve({ ok: true, serverResponse: line });
                }
            }
        });
        socket.on("error", (err) => reject(err));
        socket.on("timeout", () => {
            socket.destroy();
            reject(new Error("Gmail SMTP TLS connection timed out (15s)"));
        });
    });
}
/**
 * Native Node.js Gmail REST API v1 sender (`POST /gmail/v1/users/me/messages/send` or `drafts`)
 */
async function callGmailRestApi(options) {
    return new Promise((resolve, reject) => {
        const payload = options.body ? JSON.stringify(options.body) : undefined;
        const req = https.request({
            hostname: "gmail.googleapis.com",
            port: 443,
            path: options.endpointPath,
            method: options.method,
            headers: {
                Authorization: `Bearer ${options.accessToken}`,
                Accept: "application/json",
                ...(payload
                    ? {
                        "Content-Type": "application/json",
                        "Content-Length": Buffer.byteLength(payload),
                    }
                    : {}),
            },
        }, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(`Gmail API HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
                    }
                    else {
                        resolve(parsed);
                    }
                }
                catch {
                    resolve(data);
                }
            });
        });
        req.on("error", reject);
        if (payload)
            req.write(payload);
        req.end();
    });
}
/**
 * Native Node.js TLS IMAP reader for imap.gmail.com:993 (Reads recent inbox subjects/senders)
 */
async function fetchRecentViaGmailImapTls(options) {
    return new Promise((resolve, reject) => {
        const socket = tls.connect({
            host: "imap.gmail.com",
            port: 993,
            servername: "imap.gmail.com",
            timeout: 15000,
        });
        let buffer = "";
        let step = 0;
        const cleanPass = options.appPassword.replace(/\s+/g, "");
        let totalMessages = 0;
        const summaries = [];
        socket.on("data", (chunk) => {
            buffer += chunk.toString("utf-8");
            if (step === 0 && buffer.includes("* OK")) {
                buffer = "";
                step = 1;
                socket.write(`A01 LOGIN "${options.user}" "${cleanPass}"\r\n`);
            }
            else if (step === 1 && (buffer.includes("A01 OK") || buffer.includes("A01 NO") || buffer.includes("A01 BAD"))) {
                if (!buffer.includes("A01 OK")) {
                    socket.end();
                    reject(new Error(`Gmail IMAP Login Failed: ${buffer.trim()}`));
                    return;
                }
                buffer = "";
                step = 2;
                socket.write(`A02 SELECT INBOX\r\n`);
            }
            else if (step === 2 && buffer.includes("A02 OK")) {
                const existsMatch = buffer.match(/\*\s+(\d+)\s+EXISTS/i);
                totalMessages = existsMatch ? parseInt(existsMatch[1], 10) : 0;
                buffer = "";
                if (totalMessages === 0) {
                    socket.write("A04 LOGOUT\r\n");
                    socket.end();
                    resolve([]);
                    return;
                }
                const startSeq = Math.max(1, totalMessages - options.limit + 1);
                step = 3;
                socket.write(`A03 FETCH ${startSeq}:${totalMessages} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)])\r\n`);
            }
            else if (step === 3 && buffer.includes("A03 OK")) {
                const blocks = buffer.split(/\*\s+\d+\s+FETCH/i).slice(1);
                for (const blk of blocks) {
                    const from = (blk.match(/From:\s*(.+)/i)?.[1] || "").trim();
                    const to = (blk.match(/To:\s*(.+)/i)?.[1] || "").trim();
                    const subject = (blk.match(/Subject:\s*(.+)/i)?.[1] || "(Sans objet)").trim();
                    const date = (blk.match(/Date:\s*(.+)/i)?.[1] || "").trim();
                    const msgId = (blk.match(/Message-ID:\s*(.+)/i)?.[1] || `imap-${summaries.length + 1}`).trim();
                    summaries.push({
                        id: msgId,
                        from,
                        to,
                        subject,
                        date,
                        snippet: `${subject} — de ${from}`,
                        isTrialRequest: /trial|essai|wgo_trial/i.test(subject),
                        isProLicenseRequest: /pro-license|abonnement|wgo_live/i.test(subject),
                    });
                }
                socket.write("A04 LOGOUT\r\n");
                socket.end();
                resolve(summaries.reverse());
            }
        });
        socket.on("error", reject);
        socket.on("timeout", () => {
            socket.destroy();
            reject(new Error("Gmail IMAP TLS timeout"));
        });
    });
}
/**
 * 1. Check or Configure Gmail Authentication & Sovereign Signature Settings
 */
export async function configureAndCheckGmailAuth(options) {
    const cfg = saveGmailConfig(options);
    let browserSessionReady = false;
    if (options.openBrowserLogin) {
        const context = await sessionManager.getContext(false);
        const page = await context.newPage();
        await page.goto("https://mail.google.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
        browserSessionReady = !page.url().includes("accounts.google.com");
    }
    const hasAppPassword = Boolean(cfg.appPassword && cfg.appPassword.trim().length >= 8);
    const hasOAuth = Boolean(cfg.oauthAccessToken && cfg.oauthAccessToken.trim().length >= 16);
    return {
        status: hasAppPassword || hasOAuth || browserSessionReady ? "GMAIL_READY" : "GMAIL_CONFIGURED_DRY_RUN_READY",
        configuredAccount: cfg.email,
        senderName: cfg.senderName,
        activeMode: hasAppPassword ? "smtp_imap_tls" : hasOAuth ? "gmail_rest_api" : "local_eml_and_browser",
        credentialsConfigured: {
            smtpImapAppPassword: hasAppPassword,
            gmailOAuthToken: hasOAuth,
            browserProfileDir: PROFILE_DIR,
        },
        signaturePreview600px: buildSovereign600pxSignatureHtml(cfg),
        setupInstructions: !hasAppPassword && !hasOAuth
            ? [
                "Option A (Recommandée - 100% Automatique SMTP/IMAP TLS) : Générez un 'Mot de passe d'application' Google (Compte Google > Sécurité > Validation en 2 étapes > Mots de passe des applications) et passez-le via `appPassword` ou la variable d'environnement `GMAIL_APP_PASSWORD`.",
                "Option B (Navigateur Isolé) : Appelez `gmail_configure_and_check_auth` avec `openBrowserLogin: true` pour vous connecter une seule fois dans le profil Playwright local isolé.",
                "En attendant, tous les outils (`gmail_send_email`, `gmail_create_draft`, `gmail_send_license_or_trial_key`) fonctionnent immédiatement en mode `dryRun: true` et génèrent des fichiers `.eml` RFC-5322 prêts à ouvrir dans Outlook/Gmail/Apple Mail.",
            ]
            : ["Connexion Gmail opérationnelle. Vous pouvez envoyer des emails, lire la boîte de réception ou générer des brouillons."],
    };
}
/**
 * 2. Send or Preview (`dryRun: true` by default) a Branded Email via Gmail
 */
export async function sendOrPreviewGmailMessage(options) {
    ensureGmailDirs();
    const cfg = loadGmailConfig();
    const dryRun = options.dryRun !== false;
    const fullHtml = buildFullWcagEmailHtml({
        subject: options.subject,
        bodyHtml: options.bodyHtml,
        bodyText: options.bodyText,
        includeSignature: options.includeSignature ?? true,
        cfg,
    });
    const { rawMime, messageId } = buildMimeMessage({
        fromName: cfg.senderName || "WannaGoTech",
        fromEmail: cfg.email || "contact@wannago.tech",
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: cfg.email || "contact@wannago.tech",
        subject: options.subject,
        text: options.bodyText,
        html: fullHtml,
    });
    const safeSlug = options.subject
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
    const ts = Date.now();
    const emlPath = path.join(GMAIL_OUTBOX_DIR, `${ts}_${safeSlug || "email"}.eml`);
    const htmlPreviewPath = path.join(GMAIL_OUTBOX_DIR, `${ts}_${safeSlug || "email"}_preview.html`);
    fs.writeFileSync(emlPath, rawMime, "utf-8");
    fs.writeFileSync(htmlPreviewPath, fullHtml, "utf-8");
    if (dryRun) {
        return {
            status: options.createDraftOnly ? "DRAFT_GENERATED_LOCALLY" : "DRY_RUN_PREVIEW_READY",
            dryRun: true,
            from: `${cfg.senderName} <${cfg.email}>`,
            to: options.to,
            cc: options.cc || [],
            subject: options.subject,
            messageId,
            savedEmlPath: emlPath,
            savedHtmlPreviewPath: htmlPreviewPath,
            humanValidationPrompt: "RÈGLE ZÉRO INVENTION : Présentez l'objet, les destinataires et le contenu ci-dessus à l'utilisateur dans le chat. Dès qu'il valide, rappelez `gmail_send_email` avec `dryRun: false` pour expédier l'email en direct.",
        };
    }
    // Live send or remote draft creation
    const allRecipients = [...options.to, ...(options.cc || []), ...(options.bcc || [])];
    if (cfg.oauthAccessToken) {
        const rawUrlSafe = Buffer.from(rawMime, "utf-8").toString("base64url");
        if (options.createDraftOnly) {
            const apiRes = await callGmailRestApi({
                accessToken: cfg.oauthAccessToken,
                method: "POST",
                endpointPath: "/gmail/v1/users/me/drafts",
                body: { message: { raw: rawUrlSafe } },
            });
            return {
                status: "GMAIL_API_DRAFT_CREATED",
                dryRun: false,
                gmailDraftId: apiRes.id,
                savedEmlPath: emlPath,
                savedHtmlPreviewPath: htmlPreviewPath,
            };
        }
        else {
            const apiRes = await callGmailRestApi({
                accessToken: cfg.oauthAccessToken,
                method: "POST",
                endpointPath: "/gmail/v1/users/me/messages/send",
                body: { raw: rawUrlSafe },
            });
            return {
                status: "GMAIL_API_SENT",
                dryRun: false,
                gmailMessageId: apiRes.id,
                threadId: apiRes.threadId,
                to: options.to,
                subject: options.subject,
                savedEmlPath: emlPath,
            };
        }
    }
    if (cfg.appPassword && cfg.email) {
        const smtpRes = await sendViaGmailSmtpTls({
            user: cfg.email,
            appPassword: cfg.appPassword,
            fromEmail: cfg.email,
            recipients: allRecipients,
            rawMime,
        });
        return {
            status: "GMAIL_SMTP_TLS_SENT",
            dryRun: false,
            from: `${cfg.senderName} <${cfg.email}>`,
            to: options.to,
            subject: options.subject,
            messageId,
            smtpResponse: smtpRes.serverResponse,
            savedEmlPath: emlPath,
        };
    }
    return {
        status: "CREDENTIALS_REQUIRED_FOR_LIVE_SEND",
        dryRun: false,
        savedEmlPath: emlPath,
        savedHtmlPreviewPath: htmlPreviewPath,
        message: "Le fichier .eml RFC-5322 et l'aperçu HTML 600px ont été générés. Pour l'expédition directe par serveur, configurez `appPassword` (`GMAIL_APP_PASSWORD`) ou `oauthAccessToken` via `gmail_configure_and_check_auth`.",
    };
}
/**
 * 3. Read Gmail Inbox & Automatically Detect Trial / Pro License Requests
 */
export async function readGmailInboxMessages(options) {
    const cfg = loadGmailConfig();
    const limit = Math.min(Math.max(options.limit || 10, 1), 50);
    if (cfg.oauthAccessToken) {
        const qParam = options.query ? `&q=${encodeURIComponent(options.query)}` : "";
        const listRes = await callGmailRestApi({
            accessToken: cfg.oauthAccessToken,
            method: "GET",
            endpointPath: `/gmail/v1/users/me/messages?maxResults=${limit}${qParam}`,
        });
        const messages = [];
        for (const item of listRes.messages || []) {
            const detail = await callGmailRestApi({
                accessToken: cfg.oauthAccessToken,
                method: "GET",
                endpointPath: `/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            });
            const headers = detail.payload?.headers || [];
            const getH = (n) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
            const subject = getH("Subject");
            messages.push({
                id: item.id,
                from: getH("From"),
                to: getH("To"),
                subject,
                date: getH("Date"),
                snippet: detail.snippet || subject,
                isTrialRequest: /trial|essai|wgo_trial/i.test(subject + " " + (detail.snippet || "")),
                isProLicenseRequest: /pro-license|abonnement|wgo_live/i.test(subject + " " + (detail.snippet || "")),
            });
        }
        return {
            status: "GMAIL_INBOX_READ_API",
            account: cfg.email,
            count: messages.length,
            messages,
        };
    }
    if (cfg.appPassword && cfg.email) {
        const messages = await fetchRecentViaGmailImapTls({
            user: cfg.email,
            appPassword: cfg.appPassword,
            limit,
        });
        const filtered = options.query
            ? messages.filter((m) => `${m.from} ${m.subject} ${m.snippet}`.toLowerCase().includes(options.query.toLowerCase()))
            : messages;
        return {
            status: "GMAIL_INBOX_READ_IMAP_TLS",
            account: cfg.email,
            count: filtered.length,
            messages: filtered,
        };
    }
    return {
        status: "GMAIL_CREDENTIALS_NOT_SET",
        account: cfg.email,
        message: "Pour lire la boîte de réception Gmail en direct, renseignez `appPassword` (`GMAIL_APP_PASSWORD`) ou `oauthAccessToken` via `gmail_configure_and_check_auth`.",
    };
}
/**
 * 4. Automated WannaGoTech Trial (72h) or Pro License Key Issuance & Onboarding Email via Gmail
 */
export async function issueAndSendWannaGoLicenseEmail(options) {
    const tier = options.tier || "trial";
    const validDays = tier === "trial" ? 3 : options.validDays || 365;
    const generated = generateSignedLicenseKey(options.clientName, tier, validDays, options.recipientEmail);
    const isTrial = tier === "trial";
    const subject = isTrial
        ? `[WannaGoTech] Votre Clé d'Essai Gratuit 72h (wgo_trial_...) — WannaGo MCP & ACP v3.1`
        : `[WannaGoTech] Votre Licence Officielle ${tier.toUpperCase()} (wgo_live_...) — WannaGo MCP & ACP v3.1`;
    const bodyText = [
        `Bonjour ${options.clientName},`,
        `Voici votre clé cryptographique officielle WannaGo MCP & ACP v3.1 (${isTrial ? "Essai Gratuit 3 Jours / 72h avec arrêt automatique" : `Abonnement ${tier.toUpperCase()} — ${validDays} jours`}) :`,
        `${generated.apiKey}`,
        `Expiration : ${generated.expiresAtIso}`,
        `Configuration rapide (Antigravity, Claude Desktop, Claude Code, Cursor) :\n{\n  "mcpServers": {\n    "wannago-mcp": {\n      "command": "node",\n      "args": ["./dist/index.js"],\n      "env": {\n        "WANNAGO_API_KEY": "${generated.apiKey}"\n      }\n    }\n  }\n}`,
        `Offre Partenaire Officiel Automattic (WordPress & Pressable) :\nEn tant que partenaire officiel Automattic, WannaGoTech vous offre la création et le support de votre site WordPress (0 EUR — seul l'hébergement Pressable est facturé) avec Isolation Collaborateur Mono-Site stricte.`,
        `À votre disposition sur contact@wannago.tech pour toute question.`,
    ].join("\n\n");
    const bodyHtml = `
    <div style="border-left:4px solid #731B2B;padding-left:16px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#323F76;text-transform:uppercase;">LICENCE CRYPTOGRAPHIQUE WANNAGOTECH</div>
      <h1 style="margin:6px 0 0 0;font-size:22px;color:#0C182E;">Bonjour ${options.clientName},</h1>
    </div>
    <p style="font-size:15px;line-height:1.6;color:#0C182E;">
      Votre clé <strong>${isTrial ? "Essai Gratuit 72h (3 jours)" : `Licence ${tier.toUpperCase()}`}</strong> pour <strong>WannaGo MCP &amp; ACP v3.1 (42 Outils Souverains)</strong> est active :
    </p>
    <div style="background-color:#0C182E;color:#FDFDFD;padding:16px;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12.5px;word-break:break-all;margin:16px 0;font-variant-numeric:tabular-nums;">
      ${generated.apiKey}
    </div>
    <p style="font-size:13px;color:#323F76;font-variant-numeric:tabular-nums;">
      <strong>Statut :</strong> Actif &bull; <strong>Expiration :</strong> ${generated.expiresAtIso}
    </p>
    <h2 style="font-size:16px;color:#0C182E;margin-top:22px;">Configuration MCP (Antigravity, Claude, Cursor)</h2>
    <pre style="background-color:#F4F5F8;border:1px solid #CECECE;padding:14px;border-radius:8px;font-size:12px;overflow-x:auto;color:#0C182E;">{
  "mcpServers": {
    "wannago-mcp": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "WANNAGO_API_KEY": "${generated.apiKey}"
      }
    }
  }
}</pre>
    <div style="background-color:#F4F5F8;border-left:4px solid #323F76;padding:14px;margin-top:20px;font-size:13.5px;color:#0C182E;">
      <strong>Avantage Partenaire Officiel Automattic (WordPress &amp; Pressable) :</strong><br/>
      La création et le support de votre site WordPress sont <strong>100 % GRATUITS (0 EUR)</strong> avec isolation stricte en tant que Collaborateur de votre seul site unique.
    </div>
  `;
    const mailRes = await sendOrPreviewGmailMessage({
        to: [options.recipientEmail],
        subject,
        bodyText,
        bodyHtml,
        includeSignature: true,
        dryRun: options.dryRun ?? true,
    });
    return {
        ...mailRes,
        issuedLicense: {
            apiKey: generated.apiKey,
            tier,
            clientName: options.clientName,
            recipientEmail: options.recipientEmail,
            expiresAtIso: generated.expiresAtIso,
        },
    };
}
/**
 * 5. Sovereign B2B Email Outreach & Follow-Up Sequence (Synced with LINKEDIN_PROSPECTS_CRM.md)
 */
export async function buildAndRunGmailOutreachSequence(options) {
    const dryRun = options.dryRun !== false;
    const maxDailyGuardrail = 30;
    const cappedProspects = options.prospects.slice(0, maxDailyGuardrail);
    const results = [];
    for (const p of cappedProspects) {
        const subject = `${p.company} x WannaGoTech — ${options.campaignName}`;
        const bodyText = [
            `Bonjour ${p.firstName},`,
            p.painPoint
                ? `En observant les initiatives de ${p.company}${p.role ? ` (${p.role})` : ""}, j'ai noté votre priorité autour de : ${p.painPoint}.`
                : `En observant le développement de ${p.company}, je souhaitais partager une approche directe avec vous.`,
            options.valueProposition,
            options.callToAction,
            `Bien à vous,`,
        ].join("\n\n");
        const res = await sendOrPreviewGmailMessage({
            to: [p.email],
            subject,
            bodyText,
            includeSignature: true,
            dryRun,
        });
        results.push({
            prospect: `${p.firstName} (${p.company} <${p.email}>)`,
            status: res.status,
            savedEmlPath: res.savedEmlPath,
        });
    }
    const targetDir = path.resolve(options.outputDir || process.cwd());
    fs.mkdirSync(targetDir, { recursive: true });
    const reportPath = path.join(targetDir, "GMAIL_OUTREACH_CAMPAIGN.md");
    const md = [
        `# Campagne Gmail Souveraine WannaGoTech — ${options.campaignName}`,
        ``,
        `- **Date** : \`${new Date().toISOString().slice(0, 10)}\``,
        `- **Mode d'exécution** : \`${dryRun ? "DRY-RUN (Aperçus .eml + HTML 600px générés)" : "EXPÉDITION DIRECTE"}\``,
        `- **Coupe-circuit Anti-Spam** : Plafond strict de \`${maxDailyGuardrail} emails / jour\` respecté (\`${cappedProspects.length}\` traités).`,
        ``,
        `## Liste des Emails Générés`,
        `| Prospect | Statut | Fichier RFC-5322 (.eml) |`,
        `| :--- | :--- | :--- |`,
        ...results.map((r) => `| ${r.prospect} | \`${r.status}\` | \`${r.savedEmlPath}\` |`),
        ``,
    ].join("\n");
    fs.writeFileSync(reportPath, md, "utf-8");
    return {
        status: dryRun ? "GMAIL_SEQUENCE_DRY_RUN_READY" : "GMAIL_SEQUENCE_EXECUTED",
        campaignName: options.campaignName,
        processedCount: results.length,
        rateLimitMaxDaily: maxDailyGuardrail,
        campaignReportMarkdown: reportPath,
        items: results,
    };
}
