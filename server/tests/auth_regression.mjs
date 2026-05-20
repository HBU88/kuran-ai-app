import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { AuthService, JsonUserStore } = require("../auth");
const { CommerceService, JsonCommerceStore } = require("../commerce");

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hakai-auth-"));
const storePath = path.join(tmpDir, "users.json");
const commerceStorePath = path.join(tmpDir, "commerce.json");
const sentResetMessages = [];
const service = new AuthService({
  store: new JsonUserStore(storePath),
  jwtSecret: "test-only-secret-with-enough-length",
  tokenTtlSeconds: 3600,
  passwordResetTokenTtlSeconds: 1800,
  passwordResetMailer: {
    async sendPasswordReset(message) {
      sentResetMessages.push(message);
      return true;
    },
  },
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

const authResult = await service.authenticate(loginResult.token);
assert.equal(authResult.ok, true);
assert.equal(authResult.user.email, "user@example.com");

const commerceService = new CommerceService({
  store: new JsonCommerceStore(commerceStorePath),
});

const initialEntitlements = await commerceService.getEntitlements(authResult.user.id);
assert.equal(initialEntitlements.religious_chat_credits_remaining, 0);
assert.equal(initialEntitlements.supporter_status, false);

const invalidPurchaseResult = await commerceService.verifyPurchase(authResult.user.id, {
  platform: "ios",
  product_id: "support_large",
  transaction_id: "bad-product",
});
assert.equal(invalidPurchaseResult.ok, false);
assert.equal(invalidPurchaseResult.statusCode, 400);

const pendingPurchaseResult = await commerceService.verifyPurchase(authResult.user.id, {
  platform: "ios",
  product_id: "support_small",
  transaction_id: "test-transaction-1",
});
assert.equal(pendingPurchaseResult.ok, true);
assert.equal(pendingPurchaseResult.statusCode, 202);
assert.equal(pendingPurchaseResult.purchase.status, "pending");
assert.equal(pendingPurchaseResult.purchase.credits_granted, 0);
assert.equal(pendingPurchaseResult.entitlements.religious_chat_credits_remaining, 0);

const repeatedPurchaseResult = await commerceService.verifyPurchase(authResult.user.id, {
  platform: "ios",
  product_id: "support_small",
  transaction_id: "test-transaction-1",
});
assert.equal(repeatedPurchaseResult.ok, true);
assert.equal(repeatedPurchaseResult.purchase.id, pendingPurchaseResult.purchase.id);

const usageStatus = await commerceService.getReligiousChatStatus(authResult.user.id);
assert.equal(usageStatus.can_consume, false);
assert.equal(usageStatus.religious_chat_credits_remaining, 0);

const consumeWithoutCredits = await commerceService.consumeReligiousChatCredit(authResult.user.id);
assert.equal(consumeWithoutCredits.ok, false);
assert.equal(consumeWithoutCredits.statusCode, 402);

const meWithoutTokenResult = await service.me(null);
assert.equal(meWithoutTokenResult.ok, false);
assert.equal(meWithoutTokenResult.statusCode, 401);

const forgotExistingResult = await service.forgotPassword({
  email: "user@example.com",
});
assert.equal(forgotExistingResult.ok, true);
assert.equal(forgotExistingResult.statusCode, 200);
assert.match(forgotExistingResult.message, /If an account exists/);
assert.equal(sentResetMessages.length, 1);
assert.equal(sentResetMessages[0].email, "user@example.com");
assert.equal(typeof sentResetMessages[0].token, "string");

const storeWithReset = JSON.parse(await fs.readFile(storePath, "utf8"));
const resetTokens = storeWithReset.users[0].password_reset_tokens;
assert.equal(Array.isArray(resetTokens), true);
assert.equal(resetTokens.length, 1);
assert.equal(resetTokens[0].token, undefined);
assert.equal(resetTokens[0].token_hash.length > 20, true);
assert.notEqual(resetTokens[0].token_hash, sentResetMessages[0].token);

const forgotUnknownResult = await service.forgotPassword({
  email: "unknown@example.com",
});
assert.equal(forgotUnknownResult.ok, true);
assert.equal(forgotUnknownResult.statusCode, 200);
assert.match(forgotUnknownResult.message, /If an account exists/);
assert.equal(sentResetMessages.length, 1);

const invalidResetResult = await service.resetPassword({
  token: "not-a-real-token",
  new_password: "new-correct-horse-password",
});
assert.equal(invalidResetResult.ok, false);
assert.equal(invalidResetResult.statusCode, 400);

const validResetResult = await service.resetPassword({
  token: sentResetMessages[0].token,
  new_password: "new-correct-horse-password",
});
assert.equal(validResetResult.ok, true);
assert.equal(validResetResult.statusCode, 200);

const reusedResetResult = await service.resetPassword({
  token: sentResetMessages[0].token,
  new_password: "another-correct-horse-password",
});
assert.equal(reusedResetResult.ok, false);
assert.equal(reusedResetResult.statusCode, 400);

const oldPasswordAfterResetResult = await service.login({
  email: "user@example.com",
  password: "correct-horse-password",
});
assert.equal(oldPasswordAfterResetResult.ok, false);
assert.equal(oldPasswordAfterResetResult.statusCode, 401);

const newPasswordAfterResetResult = await service.login({
  email: "user@example.com",
  password: "new-correct-horse-password",
});
assert.equal(newPasswordAfterResetResult.ok, true);
assert.equal(newPasswordAfterResetResult.statusCode, 200);

const expiredMessages = [];
const expiredService = new AuthService({
  store: new JsonUserStore(storePath),
  jwtSecret: "test-only-secret-with-enough-length",
  tokenTtlSeconds: 3600,
  passwordResetTokenTtlSeconds: -1,
  passwordResetMailer: {
    async sendPasswordReset(message) {
      expiredMessages.push(message);
      return true;
    },
  },
});
const expiredForgotResult = await expiredService.forgotPassword({
  email: "user@example.com",
});
assert.equal(expiredForgotResult.ok, true);
assert.equal(expiredMessages.length, 1);

const expiredResetResult = await expiredService.resetPassword({
  token: expiredMessages[0].token,
  new_password: "expired-correct-horse-password",
});
assert.equal(expiredResetResult.ok, false);
assert.equal(expiredResetResult.error, "password reset token is expired");

const deleteWithoutTokenResult = await service.deleteMe(null);
assert.equal(deleteWithoutTokenResult.ok, false);
assert.equal(deleteWithoutTokenResult.statusCode, 401);

const deleteWithTokenResult = await service.deleteMe(newPasswordAfterResetResult.token);
assert.equal(deleteWithTokenResult.ok, true);
assert.equal(deleteWithTokenResult.statusCode, 200);

const loginAfterDeleteResult = await service.login({
  email: "user@example.com",
  password: "new-correct-horse-password",
});
assert.equal(loginAfterDeleteResult.ok, false);
assert.equal(loginAfterDeleteResult.statusCode, 401);

const meAfterDeleteResult = await service.me(newPasswordAfterResetResult.token);
assert.equal(meAfterDeleteResult.ok, false);
assert.equal(meAfterDeleteResult.statusCode, 401);

await fs.rm(tmpDir, { recursive: true, force: true });

console.log("PASS auth regression");
