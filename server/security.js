const crypto = require("crypto");

const DEFAULT_MAX_CHAT_MESSAGE_LENGTH = 1200;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 30;

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function createCorsMiddleware(options = {}) {
  const allowedOrigins = Array.isArray(options.allowedOrigins)
    ? options.allowedOrigins
    : parseAllowedOrigins(process.env.HAKAI_ALLOWED_ORIGINS);
  const allowAll = allowedOrigins.length === 0 && process.env.NODE_ENV !== "production";

  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;
    if (origin && (allowAll || allowedOrigins.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept,Authorization");
    }

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    return next();
  };
}

function clientKeyFromRequest(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || req.ip || req.socket?.remoteAddress || "unknown";
}

function createRateLimiter(options = {}) {
  const disabled = isRateLimitDisabled();
  const windowMs = Number.isFinite(options.windowMs)
    ? options.windowMs
    : readPositiveInt(process.env.HAKAI_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
  const max = Number.isFinite(options.max)
    ? options.max
    : readPositiveInt(process.env.HAKAI_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX);
  const buckets = new Map();

  return function rateLimiter(req, res, next) {
    if (disabled) {
      return next();
    }

    const now = Date.now();
    const key = clientKeyFromRequest(req);
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({
        ok: false,
        error: "too many requests",
      });
    }
    return next();
  };
}

function isRateLimitDisabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.HAKAI_DISABLE_RATE_LIMITS || "").trim().toLowerCase() === "true"
  );
}

function validateChatMessage(value, options = {}) {
  const maxLength = Number.isFinite(options.maxLength)
    ? options.maxLength
    : readPositiveInt(process.env.HAKAI_MAX_CHAT_MESSAGE_LENGTH, DEFAULT_MAX_CHAT_MESSAGE_LENGTH);
  if (typeof value !== "string") {
    return { ok: false, statusCode: 400, error: "message must be a string" };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, statusCode: 400, error: "message is required" };
  }
  if (trimmed.length > maxLength) {
    return { ok: false, statusCode: 413, error: "message is too long" };
  }
  return { ok: true, message: trimmed };
}

function isVerboseChatLoggingEnabled() {
  return String(process.env.HAKAI_VERBOSE_CHAT_LOGS || "").trim().toLowerCase() === "true";
}

function summarizeUserMessage(message) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) {
    return { user_message_length: 0, user_message_sha256: null };
  }
  return {
    user_message_length: text.length,
    user_message_sha256: crypto.createHash("sha256").update(text).digest("hex").slice(0, 16),
    ...(isVerboseChatLoggingEnabled() ? { user_message_preview: text.slice(0, 120) } : {}),
  };
}

function isUnsafePrompt(message) {
  const normalized = String(message || "").toLocaleLowerCase("tr-TR");
  const unsafePatterns = [
    "mezhep kavgası",
    "kafirleri öldür",
    "öldürmek istiyorum",
    "bomba",
    "terör",
    "nefret",
    "soykırım",
  ];
  return unsafePatterns.some((pattern) => normalized.includes(pattern));
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  DEFAULT_MAX_CHAT_MESSAGE_LENGTH,
  createCorsMiddleware,
  createRateLimiter,
  isUnsafePrompt,
  isRateLimitDisabled,
  isVerboseChatLoggingEnabled,
  parseAllowedOrigins,
  summarizeUserMessage,
  validateChatMessage,
};
