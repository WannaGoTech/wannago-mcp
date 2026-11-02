import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "../browser/sessionManager.js";
import { publishToPlatform } from "../platforms/adapters.js";
const SCHEDULE_FILE = path.join(DATA_DIR, "scheduled_posts.json");
function ensureScheduleFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SCHEDULE_FILE)) {
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify([], null, 2), "utf-8");
    }
}
export class ScheduleStore {
    readAll() {
        ensureScheduleFile();
        try {
            const raw = fs.readFileSync(SCHEDULE_FILE, "utf-8");
            return JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    writeAll(items) {
        ensureScheduleFile();
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(items, null, 2), "utf-8");
    }
    addScheduledPost(scheduledFor, payload) {
        const parsedDate = new Date(scheduledFor);
        if (Number.isNaN(parsedDate.getTime())) {
            throw new Error(`Invalid scheduledFor timestamp '${scheduledFor}'. Provide an ISO 8601 date string (e.g. '2026-10-27T14:00:00Z').`);
        }
        const items = this.readAll();
        const newItem = {
            id: `sched_${crypto.randomBytes(4).toString("hex")}`,
            createdAt: new Date().toISOString(),
            scheduledFor: parsedDate.toISOString(),
            status: "pending",
            payload,
        };
        items.push(newItem);
        this.writeAll(items);
        return newItem;
    }
    cancelScheduledPost(id) {
        const items = this.readAll();
        const target = items.find((i) => i.id === id);
        if (!target)
            return null;
        target.status = "cancelled";
        this.writeAll(items);
        return target;
    }
    async runDuePosts(forceIds) {
        const items = this.readAll();
        const now = Date.now();
        const executed = [];
        for (const item of items) {
            if (item.status !== "pending")
                continue;
            const isForced = forceIds && forceIds.includes(item.id);
            const isDue = new Date(item.scheduledFor).getTime() <= now;
            if (!isForced && !isDue)
                continue;
            item.lastRunAt = new Date().toISOString();
            const results = [];
            for (const platform of item.payload.platforms) {
                const res = await publishToPlatform(platform, item.payload);
                results.push(res);
            }
            item.results = results;
            const allSucceeded = results.every((r) => r.status === "published" || r.status === "drafted_dry_run");
            item.status = allSucceeded ? "completed" : "failed";
            executed.push(item);
        }
        if (executed.length > 0) {
            this.writeAll(items);
        }
        return executed;
    }
}
export const scheduleStore = new ScheduleStore();
