import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { AuthService, JsonUserStore } = require("../auth");

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hakai-auth-"));
const storePath = path.join(tmpDir, "users.json");
const service = new AuthService({
  store: new JsonUserStore(storePath),
  jwtSecret: "test-only-secret-with-enough-length",
  tokenTtlSeconds: 3600,
});

const registerResult = await service.register({
  email: "USER@example.com",
  password: "correct-horse-password",
  terms_accepted: true,
  privacy_policy_accepted: true,
});

assert.equal(registerResult.ok, true);
assert.equal(registerResult.statusCode, 201);
assert.equal(registerResult.user.email, "user@example.com");
assert.equal(registerResult.user.marketing_consent, false);
assert.equal(registerResult.user.ad_personalization_consent, false);
assert.equal(typeof registerResult.token, "string");
assert.equal(Object.hasOwn(registerResult.user, "password_hash"), false);

const rawStore = JSON.parse(await fs.readFile(storePath, "utf8"));
assert.equal(rawStore.users.length, 1);
assert.equal(rawStore.users[0].password, undefined);
assert.match(rawStore.users[0].password_hash, /^scrypt\$/);
assert.notEqual(rawStore.users[0].password_hash, "correct-horse-password");

const duplicateResult = await service.register({
  email: "user@example.com",
  password: "correct-horse-password",
  terms_accepted: true,
  privacy_policy_accepted: true,
});
assert.equal(duplicateResult.ok, false);
assert.equal(duplicateResult.statusCode, 409);

const invalidEmailResult = await service.register({
  email: "not-an-email",
  password: "correct-horse-password",
  terms_accepted: true,
  privacy_policy_accepted: true,
});
assert.equal(invalidEmailResult.ok, false);
assert.equal(invalidEmailResult.error, "email is invalid");

const shortPasswordResult = await service.register({
  email: "short@example.com",
  password: "short",
  terms_accepted: true,
  privacy_policy_accepted: true,
});
assert.equal(shortPasswordResult.ok, false);
assert.equal(shortPasswordResult.error, "password is too short");

const loginResult = await service.login({
  email: "user@example.com",
  password: "correct-horse-password",
});
assert.equal(loginResult.ok, true);
assert.equal(loginResult.statusCode, 200);
assert.equal(typeof loginResult.token, "string");

const wrongPasswordResult = await service.login({
  email: "user@example.com",
  password: "wrong-password",
});
assert.equal(wrongPasswordResult.ok, false);
assert.equal(wrongPasswordResult.statusCode, 401);

const meResult = await service.me(loginResult.token);
assert.equal(meResult.ok, true);
assert.equal(meResult.user.email, "user@example.com");

const meWithoutTokenResult = await service.me(null);
assert.equal(meWithoutTokenResult.ok, false);
assert.equal(meWithoutTokenResult.statusCode, 401);

await fs.rm(tmpDir, { recursive: true, force: true });

console.log("PASS auth regression");
