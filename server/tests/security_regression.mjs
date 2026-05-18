import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createCorsMiddleware,
  createRateLimiter,
  summarizeUserMessage,
  validateChatMessage,
} = require("../security");

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function runMiddleware(middleware, req) {
  const res = createMockResponse();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

assert.equal(validateChatMessage("merhaba").ok, true);
assert.equal(validateChatMessage("").statusCode, 400);
assert.equal(validateChatMessage(42).error, "message must be a string");
assert.equal(validateChatMessage("x".repeat(6), { maxLength: 5 }).statusCode, 413);

const summary = summarizeUserMessage("kişisel bir mesaj");
assert.equal(summary.user_message_length, 17);
assert.equal(typeof summary.user_message_sha256, "string");
assert.equal(Object.hasOwn(summary, "user_message_preview"), false);

const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 2 });
const req = { headers: {}, ip: "127.0.0.1", socket: {} };
assert.equal(runMiddleware(rateLimiter, req).nextCalled, true);
assert.equal(runMiddleware(rateLimiter, req).nextCalled, true);
const limited = runMiddleware(rateLimiter, req);
assert.equal(limited.nextCalled, false);
assert.equal(limited.res.statusCode, 429);
assert.equal(limited.res.body.error, "too many requests");

const cors = createCorsMiddleware({ allowedOrigins: ["https://app.example"] });
const allowed = runMiddleware(cors, {
  method: "POST",
  headers: { origin: "https://app.example" },
});
assert.equal(allowed.nextCalled, true);
assert.equal(allowed.res.headers["Access-Control-Allow-Origin"], "https://app.example");

const blocked = runMiddleware(cors, {
  method: "POST",
  headers: { origin: "https://evil.example" },
});
assert.equal(blocked.nextCalled, true);
assert.equal(blocked.res.headers["Access-Control-Allow-Origin"], undefined);

console.log("PASS security regression");
