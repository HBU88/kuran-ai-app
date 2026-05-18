const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_PASSWORD_RESET_TOKEN_TTL_SECONDS = 30 * 60;
const DEFAULT_USER_STORE_PATH = path.join(__dirname, ".data", "users.json");
const DEFAULT_PASSWORD_RESET_DEV_OUTBOX_PATH = path.join(
  __dirname,
  ".data",
  "password-reset-dev-outbox.json"
);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists for that email, a password reset link will be sent.";

class JsonUserStore {
  constructor(filePath = process.env.HAKAI_USER_STORE_PATH || DEFAULT_USER_STORE_PATH) {
    this.filePath = filePath;
  }

  async findByEmail(email) {
    const users = await this._readUsers();
    const normalizedEmail = normalizeEmail(email);
    return users.find((user) => user.email === normalizedEmail) || null;
  }

  async findById(id) {
    const users = await this._readUsers();
    return users.find((user) => user.id === id) || null;
  }

  async create(user) {
    const users = await this._readUsers();
    users.push(user);
    await this._writeUsers(users);
    return user;
  }

  async updateById(id, updater) {
    const users = await this._readUsers();
    const index = users.findIndex((user) => user.id === id);
    if (index === -1) {
      return null;
    }
    const updated = await updater({ ...users[index] });
    users[index] = updated;
    await this._writeUsers(users);
    return updated;
  }

  async _readUsers() {
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.users) ? parsed.users : [];
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async _writeUsers(users) {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify({ users }, null, 2), "utf8");
    await fs.promises.rename(tmpPath, this.filePath);
  }
}

class AuthService {
  constructor(options = {}) {
    this.store = options.store || new JsonUserStore(options.storePath);
    this.passwordResetMailer = options.passwordResetMailer || new PasswordResetMailer();
    this.jwtSecret = options.jwtSecret || process.env.HAKAI_AUTH_JWT_SECRET || "";
    this.tokenTtlSeconds = Number.isInteger(options.tokenTtlSeconds)
      ? options.tokenTtlSeconds
      : readPositiveInt(process.env.HAKAI_AUTH_TOKEN_TTL_SECONDS, DEFAULT_TOKEN_TTL_SECONDS);
    this.passwordResetTokenTtlSeconds = Number.isInteger(options.passwordResetTokenTtlSeconds)
      ? options.passwordResetTokenTtlSeconds
      : readPositiveInt(
          process.env.HAKAI_PASSWORD_RESET_TOKEN_TTL_SECONDS,
          DEFAULT_PASSWORD_RESET_TOKEN_TTL_SECONDS
        );
  }

  async register(input = {}) {
    const validation = validateRegistrationInput(input);
    if (!validation.ok) {
      return validation;
    }

    const email = normalizeEmail(input.email);
    const existing = await this.store.findByEmail(email);
    if (existing) {
      return { ok: false, statusCode: 409, error: "email already registered" };
    }

    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email,
      password_hash: await hashPassword(input.password),
      created_at: now,
      updated_at: now,
      terms_accepted_at: now,
      privacy_policy_accepted_at: now,
      marketing_consent: input.marketing_consent === true,
      ad_personalization_consent: input.ad_personalization_consent === true,
      // Do not infer or store sensitive religious advertising profiles from chat content.
      religious_ad_profile: null,
    };
    await this.store.create(user);

    return {
      ok: true,
      statusCode: 201,
      user: publicUser(user),
      token: this.issueToken(user),
    };
  }

  async login(input = {}) {
    const validation = validateLoginInput(input);
    if (!validation.ok) {
      return validation;
    }

    const user = await this.store.findByEmail(input.email);
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      return { ok: false, statusCode: 401, error: "invalid email or password" };
    }

    return {
      ok: true,
      statusCode: 200,
      user: publicUser(user),
      token: this.issueToken(user),
    };
  }

  async forgotPassword(input = {}) {
    const emailValidation = validateEmail(input.email);
    if (!emailValidation.ok) {
      return emailValidation;
    }

    const email = normalizeEmail(input.email);
    const user = await this.store.findByEmail(email);
    if (!user) {
      return genericPasswordResetResult();
    }

    const rawToken = createPasswordResetToken();
    const nowMs = Date.now();
    const resetRecord = {
      id: crypto.randomUUID(),
      token_hash: hashPasswordResetToken(rawToken),
      created_at: new Date(nowMs).toISOString(),
      expires_at: new Date(nowMs + this.passwordResetTokenTtlSeconds * 1000).toISOString(),
      used_at: null,
    };

    await this.store.updateById(user.id, (currentUser) => ({
      ...currentUser,
      password_reset_tokens: [
        resetRecord,
        ...activeResetTokens(currentUser.password_reset_tokens),
      ].slice(0, 5),
      updated_at: new Date(nowMs).toISOString(),
    }));

    await this.passwordResetMailer.sendPasswordReset({
      email,
      token: rawToken,
      resetUrl: buildPasswordResetUrl(rawToken),
    });

    return genericPasswordResetResult();
  }

  async resetPassword(input = {}) {
    const tokenValidation = validatePasswordResetTokenInput(input.token);
    if (!tokenValidation.ok) return tokenValidation;
    const passwordValidation = validatePassword(input.new_password);
    if (!passwordValidation.ok) return passwordValidation;

    const tokenHash = hashPasswordResetToken(input.token);
    const users = await this.store._readUsers();
    const user = users.find((candidate) =>
      activeResetTokens(candidate.password_reset_tokens).some((record) =>
        safeEqualString(record.token_hash, tokenHash)
      )
    );

    if (!user) {
      return { ok: false, statusCode: 400, error: "password reset token is invalid" };
    }

    const matchingToken = activeResetTokens(user.password_reset_tokens).find((record) =>
      safeEqualString(record.token_hash, tokenHash)
    );
    if (!matchingToken) {
      return { ok: false, statusCode: 400, error: "password reset token is invalid" };
    }
    if (matchingToken.used_at) {
      return { ok: false, statusCode: 400, error: "password reset token is already used" };
    }
    if (Date.parse(matchingToken.expires_at) <= Date.now()) {
      return { ok: false, statusCode: 400, error: "password reset token is expired" };
    }

    const now = new Date().toISOString();
    await this.store.updateById(user.id, async (currentUser) => ({
      ...currentUser,
      password_hash: await hashPassword(input.new_password),
      password_reset_tokens: activeResetTokens(currentUser.password_reset_tokens).map((record) => ({
        ...record,
        used_at: record.used_at || now,
      })),
      updated_at: now,
    }));

    return { ok: true, statusCode: 200 };
  }

  issueToken(user) {
    if (!this.jwtSecret) {
      throw new Error("HAKAI_AUTH_JWT_SECRET is required");
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    return signJwt(
      {
        sub: user.id,
        email: user.email,
        iat: nowSeconds,
        exp: nowSeconds + this.tokenTtlSeconds,
      },
      this.jwtSecret
    );
  }

  async me(token) {
    if (!token) {
      return { ok: false, statusCode: 401, error: "authorization token is required" };
    }

    let payload;
    try {
      payload = verifyJwt(token, this.jwtSecret);
    } catch {
      return { ok: false, statusCode: 401, error: "invalid authorization token" };
    }

    const user = await this.store.findById(payload.sub);
    if (!user) {
      return { ok: false, statusCode: 401, error: "invalid authorization token" };
    }
    return { ok: true, statusCode: 200, user: publicUser(user) };
  }
}

class PasswordResetMailer {
  constructor(options = {}) {
    this.env = options.env || process.env.NODE_ENV || "development";
    this.outboxPath = options.outboxPath || process.env.HAKAI_PASSWORD_RESET_DEV_OUTBOX_PATH || DEFAULT_PASSWORD_RESET_DEV_OUTBOX_PATH;
  }

  async sendPasswordReset({ email, token, resetUrl }) {
    if (this.env === "production") {
      console.warn("[auth] password reset email provider is not configured");
      return false;
    }

    await appendDevPasswordResetOutbox(this.outboxPath, {
      email,
      reset_url: resetUrl,
      token,
      created_at: new Date().toISOString(),
    });
    console.info(
      `[auth] dev password reset link written to ${this.outboxPath} for email_hash=${hashLogValue(email)} token_prefix=${String(token).slice(0, 8)}`
    );
    return true;
  }
}

function validateRegistrationInput(input = {}) {
  const emailValidation = validateEmail(input.email);
  if (!emailValidation.ok) return emailValidation;
  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.ok) return passwordValidation;
  if (input.terms_accepted !== true) {
    return { ok: false, statusCode: 400, error: "terms acceptance is required" };
  }
  if (input.privacy_policy_accepted !== true) {
    return { ok: false, statusCode: 400, error: "privacy policy acceptance is required" };
  }
  return { ok: true };
}

function validateLoginInput(input = {}) {
  const emailValidation = validateEmail(input.email);
  if (!emailValidation.ok) return emailValidation;
  if (typeof input.password !== "string" || !input.password) {
    return { ok: false, statusCode: 400, error: "password is required" };
  }
  return { ok: true };
}

function validateEmail(email) {
  if (typeof email !== "string" || !email.trim()) {
    return { ok: false, statusCode: 400, error: "email is required" };
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    return { ok: false, statusCode: 400, error: "email is invalid" };
  }
  return { ok: true };
}

function validatePassword(password) {
  if (typeof password !== "string" || !password) {
    return { ok: false, statusCode: 400, error: "password is required" };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, statusCode: 400, error: "password is too short" };
  }
  return { ok: true };
}

function validatePasswordResetTokenInput(token) {
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, statusCode: 400, error: "password reset token is required" };
  }
  return { ok: true };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt);
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedBase64] = parts;
  const derived = await scrypt(password, salt);
  const expected = Buffer.from(expectedBase64, "base64url");
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token, secret) {
  if (!secret) throw new Error("HAKAI_AUTH_JWT_SECRET is required");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("invalid token");
  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  if (!safeEqualString(signature, expected)) throw new Error("invalid signature");

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.sub || typeof payload.exp !== "number" || payload.exp <= nowSeconds) {
    throw new Error("expired token");
  }
  return payload;
}

function safeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createPasswordResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashPasswordResetToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("base64url");
}

function activeResetTokens(tokens) {
  return Array.isArray(tokens) ? tokens.filter((token) => token && typeof token === "object") : [];
}

function genericPasswordResetResult() {
  return {
    ok: true,
    statusCode: 200,
    message: PASSWORD_RESET_GENERIC_MESSAGE,
  };
}

function buildPasswordResetUrl(token) {
  const baseUrl = String(process.env.HAKAI_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

async function appendDevPasswordResetOutbox(filePath, entry) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  let entries = [];
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    entries = Array.isArray(parsed.resets) ? parsed.resets : [];
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }
  entries.push(entry);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify({ resets: entries.slice(-20) }, null, 2), "utf8");
  await fs.promises.rename(tmpPath, filePath);
}

function hashLogValue(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex").slice(0, 16);
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function bearerTokenFromRequest(req) {
  const header = String(req.headers?.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    terms_accepted_at: user.terms_accepted_at,
    privacy_policy_accepted_at: user.privacy_policy_accepted_at,
    marketing_consent: user.marketing_consent === true,
    ad_personalization_consent: user.ad_personalization_consent === true,
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  AuthService,
  JsonUserStore,
  PasswordResetMailer,
  bearerTokenFromRequest,
  hashPasswordResetToken,
  publicUser,
  validateLoginInput,
  validateRegistrationInput,
  validatePasswordResetTokenInput,
  verifyJwt,
};
