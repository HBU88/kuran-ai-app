"use strict";

/**
 * Device-ID based monthly quota tracker for ilmihal KB-miss OpenAI calls.
 *
 * Design:
 *  - In-memory Map, persisted to JSON file (survives restarts on Render).
 *  - Quota resets at the start of each UTC month.
 *  - Quota is only consumed on KB-miss paths (OpenAI fallback), never on KB hits.
 *  - Requests with no device-id header are allowed (graceful degradation for
 *    older clients), but not tracked against any device's limit.
 *  - Controlled by env: HAKAI_USAGE_LIMITS_ENABLED=true (default: false → disabled).
 *  - Free limit: HAKAI_FREE_QUOTA_LIMIT (default: 20).
 */

const fs = require("fs");
const path = require("path");

const QUOTA_FILE = path.join(__dirname, "..", "data", "quota_state.json");
const FREE_LIMIT = readPositiveInt(process.env.HAKAI_FREE_QUOTA_LIMIT, 20);
const QUOTA_ENABLED =
  String(process.env.HAKAI_USAGE_LIMITS_ENABLED || "false").trim().toLowerCase() === "true";

/** @type {Object.<string, {used: number, month: string, updated_at?: string}>} */
let quotaState = {};
let saveTimer = null;

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function loadState() {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const raw = fs.readFileSync(QUOTA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        quotaState = parsed;
      }
    }
  } catch (error) {
    console.warn("[quota_tracker] Failed to load persisted state:", error.message);
    quotaState = {};
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const dir = path.dirname(QUOTA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(QUOTA_FILE, JSON.stringify(quotaState, null, 2), "utf8");
    } catch (error) {
      console.warn("[quota_tracker] Failed to persist quota state:", error.message);
    }
  }, 5000);
}

function getDeviceRecord(deviceId) {
  const month = getCurrentMonth();
  const record = quotaState[deviceId];
  if (!record || typeof record !== "object" || record.month !== month) {
    // New device or new month → reset counter
    return { used: 0, month };
  }
  return {
    used: Number.isInteger(record.used) ? record.used : 0,
    month,
  };
}

/**
 * Check whether a device is allowed to make a KB-miss OpenAI call.
 *
 * @param {string|null|undefined} deviceId  Value of X-Device-Id request header.
 * @returns {{ allowed: boolean, remaining: number, used: number, limit: number }}
 */
function checkQuota(deviceId) {
  const limit = FREE_LIMIT;
  if (!QUOTA_ENABLED) {
    return { allowed: true, remaining: limit, used: 0, limit };
  }
  if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
    // No device ID → allow gracefully; usage is not tracked
    return { allowed: true, remaining: limit, used: 0, limit };
  }
  const record = getDeviceRecord(deviceId.trim());
  const remaining = Math.max(0, limit - record.used);
  return {
    allowed: record.used < limit,
    remaining,
    used: record.used,
    limit,
  };
}

/**
 * Consume one quota unit for a device.
 * Should be called AFTER a successful KB-miss OpenAI response is delivered.
 *
 * @param {string|null|undefined} deviceId
 */
function consumeQuota(deviceId) {
  if (!QUOTA_ENABLED) return;
  if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) return;
  const id = deviceId.trim();
  const record = getDeviceRecord(id);
  quotaState[id] = {
    used: record.used + 1,
    month: record.month,
    updated_at: new Date().toISOString(),
  };
  scheduleSave();
}

// Load persisted state on module init
loadState();

module.exports = { checkQuota, consumeQuota };
