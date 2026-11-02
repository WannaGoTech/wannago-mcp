#!/usr/bin/env node
import { sessionManager } from "./browser/sessionManager.js";
import { SUPPORTED_PLATFORMS } from "./types.js";
async function runCliLogin() {
    const args = process.argv.slice(2);
    const requested = args.length > 0
        ? args.filter((a) => SUPPORTED_PLATFORMS.includes(a))
        : [...SUPPORTED_PLATFORMS];
    console.log(`Opening persistent browser login window for: ${requested.join(", ")}...`);
    const res = await sessionManager.openLoginTabs(requested, 0);
    console.log(res.message);
    console.log("Log into your accounts in the opened browser window. Close the browser window when finished.");
}
runCliLogin().catch((err) => {
    console.error(err);
    process.exit(1);
});
