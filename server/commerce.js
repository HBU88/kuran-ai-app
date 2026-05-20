const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_COMMERCE_STORE_PATH = path.join(__dirname, ".data", "commerce.json");

const CREDIT_BY_PRODUCT_ID = {
  support_small: 25,
  support_medium: 50,
  support_special_199: 100,
  support_special_299: 175,
  support_special_499: 300,
};

function isUsageLimitBypassEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.DEBUG_DISABLE_USAGE_LIMITS || "").trim().toLowerCase() === "true"
  );
}

class JsonCommerceStore {
  constructor(filePath = process.env.HAKAI_COMMERCE_STORE_PATH || DEFAULT_COMMERCE_STORE_PATH) {
    this.filePath = filePath;
  }

  async getEntitlements(userId) {
    const data = await this._readData();
    return ensureEntitlement(data, userId);
  }

  async upsertEntitlements(userId, updater) {
    const data = await this._readData();
    const current = ensureEntitlement(data, userId);
    const updated = await updater({ ...current });
    data.entitlements[userId] = {
      ...updated,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    await this._writeData(data);
    return data.entitlements[userId];
  }

  async createPurchase(purchase) {
    const data = await this._readData();
    const now = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      user_id: purchase.user_id,
      platform: purchase.platform,
      product_id: purchase.product_id,
      transaction_id: purchase.transaction_id || null,
      purchase_token_hash: purchase.purchase_token_hash || null,
      status: purchase.status || "pending",
      credits_granted: Number.isInteger(purchase.credits_granted) ? purchase.credits_granted : 0,
      created_at: now,
      updated_at: now,
    };
    data.purchases.push(record);
    ensureEntitlement(data, purchase.user_id);
    await this._writeData(data);
    return record;
  }

  async findPurchaseByTransaction({ platform, transactionId, purchaseTokenHash }) {
    const data = await this._readData();
    return (
      data.purchases.find((purchase) => {
        if (purchase.platform !== platform) return false;
        if (transactionId && purchase.transaction_id === transactionId) return true;
        if (purchaseTokenHash && purchase.purchase_token_hash === purchaseTokenHash) return true;
        return false;
      }) || null
    );
  }

  async consumeReligiousChatCredit(userId) {
    return this.upsertEntitlements(userId, (current) => {
      const remaining = Number.isInteger(current.religious_chat_credits_remaining)
        ? current.religious_chat_credits_remaining
        : 0;
      if (remaining <= 0) {
        return current;
      }
      return {
        ...current,
        religious_chat_credits_remaining: remaining - 1,
      };
    });
  }

  async deleteUserData(userId) {
    const data = await this._readData();
    data.purchases = data.purchases.filter((purchase) => purchase.user_id !== userId);
    delete data.entitlements[userId];
    await this._writeData(data);
  }

  async _readData() {
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return normalizeStoreData(parsed);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return normalizeStoreData({});
      }
      throw error;
    }
  }

  async _writeData(data) {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(normalizeStoreData(data), null, 2), "utf8");
    await fs.promises.rename(tmpPath, this.filePath);
  }
}

class CommerceService {
  constructor(options = {}) {
    this.store = options.store || new JsonCommerceStore(options.storePath);
  }

  async getEntitlements(userId) {
    return publicEntitlements(await this.store.getEntitlements(userId));
  }

  async getReligiousChatStatus(userId) {
    const entitlements = await this.getEntitlements(userId);
    const bypassed = isUsageLimitBypassEnabled();
    return {
      religious_chat_credits_remaining: entitlements.religious_chat_credits_remaining,
      can_consume: bypassed || entitlements.religious_chat_credits_remaining > 0,
      supporter_status: entitlements.supporter_status,
      ...(bypassed ? { usage_limit_bypassed_for_debug: true } : {}),
    };
  }

  async consumeReligiousChatCredit(userId) {
    const current = await this.store.getEntitlements(userId);
    if (isUsageLimitBypassEnabled()) {
      return {
        ok: true,
        statusCode: 200,
        entitlements: publicEntitlements(current),
        usage_limit_bypassed_for_debug: true,
      };
    }
    if ((current.religious_chat_credits_remaining || 0) <= 0) {
      return {
        ok: false,
        statusCode: 402,
        error: "religious chat credits are exhausted",
        entitlements: publicEntitlements(current),
      };
    }
    const updated = await this.store.consumeReligiousChatCredit(userId);
    return {
      ok: true,
      statusCode: 200,
      entitlements: publicEntitlements(updated),
    };
  }

  async verifyPurchase(userId, input = {}) {
    const validation = validatePurchaseInput(input);
    if (!validation.ok) return validation;

    const platform = input.platform.trim().toLowerCase();
    const productId = input.product_id.trim();
    const transactionId = normalizeOptionalString(input.transaction_id);
    const purchaseTokenHash = input.purchase_token
      ? hashPurchaseToken(input.purchase_token)
      : input.purchase_token_hash
        ? normalizeOptionalString(input.purchase_token_hash)
        : null;

    const existing = await this.store.findPurchaseByTransaction({
      platform,
      transactionId,
      purchaseTokenHash,
    });
    if (existing) {
      return {
        ok: true,
        statusCode: 200,
        purchase: publicPurchase(existing),
        entitlements: await this.getEntitlements(userId),
      };
    }

    // Safe V1 stub: App Store / Play Store server-side receipt validation is
    // required before credits can be granted permanently. Do not trust client
    // purchase callbacks for paid Dinî Bilgiler credits.
    const purchase = await this.store.createPurchase({
      user_id: userId,
      platform,
      product_id: productId,
      transaction_id: transactionId,
      purchase_token_hash: purchaseTokenHash,
      status: "pending",
      credits_granted: 0,
    });

    return {
      ok: true,
      statusCode: 202,
      purchase: publicPurchase(purchase),
      entitlements: await this.getEntitlements(userId),
      message: "purchase verification is pending",
    };
  }

  async deleteUserData(userId) {
    await this.store.deleteUserData(userId);
  }
}

function validatePurchaseInput(input = {}) {
  const platform = typeof input.platform === "string" ? input.platform.trim().toLowerCase() : "";
  if (!["ios", "android"].includes(platform)) {
    return { ok: false, statusCode: 400, error: "platform is invalid" };
  }

  const productId = typeof input.product_id === "string" ? input.product_id.trim() : "";
  if (!Object.hasOwn(CREDIT_BY_PRODUCT_ID, productId)) {
    return { ok: false, statusCode: 400, error: "product_id is invalid" };
  }

  const transactionId = normalizeOptionalString(input.transaction_id);
  const purchaseToken = normalizeOptionalString(input.purchase_token);
  const purchaseTokenHash = normalizeOptionalString(input.purchase_token_hash);
  if (!transactionId && !purchaseToken && !purchaseTokenHash) {
    return {
      ok: false,
      statusCode: 400,
      error: "transaction_id or purchase_token is required",
    };
  }

  return { ok: true };
}

function normalizeStoreData(data) {
  return {
    purchases: Array.isArray(data.purchases) ? data.purchases : [],
    entitlements: data.entitlements && typeof data.entitlements === "object" ? data.entitlements : {},
  };
}

function ensureEntitlement(data, userId) {
  data.entitlements[userId] = {
    user_id: userId,
    religious_chat_credits_remaining: 0,
    supporter_status: false,
    updated_at: new Date().toISOString(),
    ...(data.entitlements[userId] || {}),
  };
  return data.entitlements[userId];
}

function publicEntitlements(entitlements) {
  return {
    user_id: entitlements.user_id,
    religious_chat_credits_remaining:
      Number.isInteger(entitlements.religious_chat_credits_remaining)
        ? entitlements.religious_chat_credits_remaining
        : 0,
    supporter_status: entitlements.supporter_status === true,
    updated_at: entitlements.updated_at,
  };
}

function publicPurchase(purchase) {
  return {
    id: purchase.id,
    user_id: purchase.user_id,
    platform: purchase.platform,
    product_id: purchase.product_id,
    transaction_id: purchase.transaction_id,
    status: purchase.status,
    credits_granted: purchase.credits_granted,
    created_at: purchase.created_at,
  };
}

function hashPurchaseToken(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("base64url");
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

module.exports = {
  CREDIT_BY_PRODUCT_ID,
  CommerceService,
  JsonCommerceStore,
  hashPurchaseToken,
  publicEntitlements,
  publicPurchase,
  validatePurchaseInput,
};
