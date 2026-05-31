const path = require("path");
const fs = require("fs");
const os = require("os");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const { buildChatResponse } = require("./agent/index");
const { detectExplicitTopic, isPureGreetingMessage, normalize } = require("./agent/context_resolver");
const { resolveCurrentMessageOverrideTopic } = require("./agent/ayah_ranker");
const { lookupKnowledgeAnswer } = require("./agent/knowledge_base");
const { AuthService, bearerTokenFromRequest } = require("./auth");
const { CommerceService } = require("./commerce");
const {
  createCorsMiddleware,
  createRateLimiter,
  isRawChatLoggingEnabled,
  isUnsafePrompt,
  isVerboseChatLoggingEnabled,
  isUsageLimitBypassEnabled,
  summarizeUserMessage,
  validateChatMessage,
} = require("./security");
const ilmihalDebugLogger          = require("./ilmihal-debug-logger");
const { logKBMiss, getMissStats } = require("./kb-miss-logger");
const { checkQuota, consumeQuota } = require("./quota_tracker");

const app = express();
const port = process.env.PORT || 3000;
const ENGINE_VERSION = "runtime-check-1";
const STARTED_AT = new Date().toISOString();
const CHAT_RUNTIME_LOG_PATH = path.join(__dirname, "..", "logs", "chat_runtime_log.txt");
const authService = new AuthService();
const commerceService = new CommerceService();

// Debug logging counter
let requestCounter = 0;

function isRepentanceRedirectMessage(message) {
  const normalized = String(message || "").toLocaleLowerCase("tr-TR");
  return [
    "\u00e7ok pi\u015fman\u0131m",
    "cok pismanim",
    "pi\u015fman\u0131m",
    "pismanim",
    "\u00e7ok pi\u015fman",
    "cok pisman",
    "Allah beni affeder mi",
  ].some((phrase) => normalized.includes(String(phrase).toLocaleLowerCase("tr-TR")));
}

function isLonelinessRedirectMessage(message) {
  const normalized = String(message || "").toLocaleLowerCase("tr-TR");
  return [
    "\u00e7ok yaln\u0131z hissediyorum",
    "cok yalniz hissediyorum",
    "\u00e7ok yaln\u0131z",
    "cok yalniz",
    "yaln\u0131z hissediyorum",
    "yalniz hissediyorum",
    "yaln\u0131z",
    "yalniz",
  ].some((phrase) => normalized.includes(String(phrase).toLocaleLowerCase("tr-TR")));
}

function isRepentanceAyahMessage(message) {
  const normalized = String(message || "").toLocaleLowerCase("tr-TR");
  return (
    normalized === "\u00e7ok pi\u015fman\u0131m" ||
    normalized === "cok pismanim" ||
    normalized === "g\u00fcnah i\u015fledim"
  );
}

process.on("uncaughtException", (error) => {
  console.error("Startup error:", error && error.stack ? error.stack : error);
});

process.on("unhandledRejection", (error) => {
  console.error("Startup error:", error && error.stack ? error.stack : error);
});

app.use(createCorsMiddleware());
app.use(express.json({ limit: process.env.HAKAI_JSON_BODY_LIMIT || "32kb" }));
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

app.get("/", (req, res) => {
  res.type("text/plain").send("HAKAI backend is running");
});

app.get("/health", (req, res) => {
  return sendUtf8Json(res, 200, {
    ok: true,
    service: "hakai-backend",
    engine_version: ENGINE_VERSION,
    pid: process.pid,
    started_at: STARTED_AT,
    cwd: process.cwd(),
    // Credential-safe readiness flags for CI and monitoring
    openai_configured: Boolean(process.env.OPENAI_API_KEY),
    diyanet_configured: Boolean(
      process.env.DIYANET_API_USERNAME && process.env.DIYANET_API_PASSWORD
    ),
    openai_planner_enabled:
      String(process.env.HAKAI_OPENAI_PLANNER_ENABLED || "true").trim().toLowerCase() !== "false",
  });
});

app.get("/debug/config", (req, res) => {
  // Never expose secret values — only boolean flags safe for debugging
  return sendUtf8Json(res, 200, {
    ok: true,
    openai_configured: Boolean(process.env.OPENAI_API_KEY),
    diyanet_configured: Boolean(
      process.env.DIYANET_API_USERNAME && process.env.DIYANET_API_PASSWORD
    ),
    usage_limits_enabled: String(process.env.HAKAI_USAGE_LIMITS_ENABLED || "false")
      .trim()
      .toLowerCase() === "true",
    religious_qa_available: true,
    openai_planner_enabled: String(process.env.HAKAI_OPENAI_PLANNER_ENABLED || "true")
      .trim()
      .toLowerCase() !== "false",
    debug_chat_engine: String(process.env.DEBUG_CHAT_ENGINE || "false")
      .trim()
      .toLowerCase() === "true",
    usage_limit_bypass_active: isUsageLimitBypassEnabled(),
    engine_version: ENGINE_VERSION,
    started_at: STARTED_AT,
  });
});

const chatRateLimiter = createRateLimiter();
const authRateLimiter = createRateLimiter({
  max: readPositiveInt(process.env.HAKAI_AUTH_RATE_LIMIT_MAX, 10),
  windowMs: readPositiveInt(process.env.HAKAI_AUTH_RATE_LIMIT_WINDOW_MS, 60_000),
});

app.post("/auth/register", authRateLimiter, async (req, res) => {
  try {
    const result = await authService.register(req.body || {});
    if (!result.ok) {
      return sendUtf8Json(res, result.statusCode || 400, {
        ok: false,
        error: result.error,
      });
    }
    return sendUtf8Json(res, 201, {
      ok: true,
      user: result.user,
      token: result.token,
      token_type: "Bearer",
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

app.post("/auth/login", authRateLimiter, async (req, res) => {
  try {
    const result = await authService.login(req.body || {});
    if (!result.ok) {
      return sendUtf8Json(res, result.statusCode || 400, {
        ok: false,
        error: result.error,
      });
    }
    return sendUtf8Json(res, 200, {
      ok: true,
      user: result.user,
      token: result.token,
      token_type: "Bearer",
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

app.post("/auth/forgot-password", authRateLimiter, async (req, res) => {
  try {
    const result = await authService.forgotPassword(req.body || {});
    if (!result.ok) {
      return sendUtf8Json(res, result.statusCode || 400, {
        ok: false,
        error: result.error,
      });
    }
    return sendUtf8Json(res, 200, {
      ok: true,
      message:
        "Eğer bu e-posta adresiyle kayıtlı bir hesap varsa, şifre yenileme bağlantısı gönderilecektir.",
    });
  } catch (error) {
    console.warn("[auth] password reset request failed internally");
    return sendUtf8Json(res, 200, {
      ok: true,
      message:
        "Eğer bu e-posta adresiyle kayıtlı bir hesap varsa, şifre yenileme bağlantısı gönderilecektir.",
    });
  }
});

app.post("/auth/reset-password", authRateLimiter, async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body || {});
    if (!result.ok) {
      return sendUtf8Json(res, result.statusCode || 400, {
        ok: false,
        error: result.error,
      });
    }
    return sendUtf8Json(res, 200, {
      ok: true,
      message: "password reset completed",
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

app.post("/auth/logout", authRateLimiter, (req, res) => {
  return sendUtf8Json(res, 200, {
    ok: true,
    message: "logout is handled by deleting the client-side bearer token",
  });
});

app.get("/me", authRateLimiter, async (req, res) => {
  try {
    const result = await authService.me(bearerTokenFromRequest(req));
    if (!result.ok) {
      return sendUtf8Json(res, result.statusCode || 401, {
        ok: false,
        error: result.error,
      });
    }
    return sendUtf8Json(res, 200, {
      ok: true,
      user: result.user,
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

app.delete("/me", authRateLimiter, async (req, res) => {
  try {
    const auth = await authService.authenticate(bearerTokenFromRequest(req));
    if (!auth.ok) {
      return sendUtf8Json(res, auth.statusCode || 401, {
        ok: false,
        error: auth.error,
      });
    }
    await commerceService.deleteUserData(auth.user.id);
    const result = await authService.deleteMe(bearerTokenFromRequest(req));
    if (!result.ok) {
      return sendUtf8Json(res, result.statusCode || 401, {
        ok: false,
        error: result.error,
      });
    }
    return sendUtf8Json(res, 200, {
      ok: true,
      message: "account deletion completed",
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

app.get("/me/entitlements", authRateLimiter, async (req, res) => {
  try {
    const auth = await requireAuthenticatedUser(req, res);
    if (!auth) return;
    return sendUtf8Json(res, 200, {
      ok: true,
      entitlements: await commerceService.getEntitlements(auth.user.id),
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

app.post("/purchases/verify", authRateLimiter, async (req, res) => {
  try {
    const auth = await requireAuthenticatedUser(req, res);
    if (!auth) return;
    const result = await commerceService.verifyPurchase(auth.user.id, req.body || {});
    if (!result.ok) {
      return sendUtf8Json(res, result.statusCode || 400, {
        ok: false,
        error: result.error,
      });
    }
    return sendUtf8Json(res, result.statusCode || 200, {
      ok: true,
      purchase: result.purchase,
      entitlements: result.entitlements,
      ...(result.message ? { message: result.message } : {}),
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

app.get("/usage/religious-chat/status", authRateLimiter, async (req, res) => {
  try {
    const auth = await requireAuthenticatedUser(req, res);
    if (!auth) return;
    return sendUtf8Json(res, 200, {
      ok: true,
      usage: await commerceService.getReligiousChatStatus(auth.user.id),
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

app.post("/usage/religious-chat/consume", authRateLimiter, async (req, res) => {
  try {
    const auth = await requireAuthenticatedUser(req, res);
    if (!auth) return;
    const result = await commerceService.consumeReligiousChatCredit(auth.user.id);
    if (!result.ok) {
      return sendUtf8Json(res, result.statusCode || 400, {
        ok: false,
        error: result.error,
        entitlements: result.entitlements,
      });
    }
    return sendUtf8Json(res, 200, {
      ok: true,
      entitlements: result.entitlements,
      ...(result.usage_limit_bypassed_for_debug
        ? { usage_limit_bypassed_for_debug: true }
        : {}),
    });
  } catch (error) {
    return handleAuthError(res, error);
  }
});

app.post("/chat", chatRateLimiter, (req, res) => handleChatModuleRequest(req, res, "chat"));
app.post("/ayah-chat", chatRateLimiter, (req, res) => handleChatModuleRequest(req, res, "ayah"));
app.post("/ilmihal-chat", chatRateLimiter, (req, res) => handleChatModuleRequest(req, res, "ilmihal"));

async function handleChatModuleRequest(req, res, module = "chat") {
  let logEntry = null;
  try {
    const validation = validateChatMessage(req.body?.message);
    const sourceScreen =
      typeof req.body?.source_screen === "string"
        ? req.body.source_screen
        : typeof req.body?.sourceScreen === "string"
          ? req.body.sourceScreen
          : null;
    if (!validation.ok) {
      const errorResponse = {
        ok: false,
        error: validation.error,
      };
      logEntry = buildChatDecisionLog({
        timestamp: new Date().toISOString(),
        module,
        endpoint: req.path,
        source: module,
        source_screen: sourceScreen || null,
        user_message: typeof req.body?.message === "string" ? req.body.message : "",
        intent: null,
        response_type: null,
        route_mode: null,
        knowledge_hit_id: null,
        selected_ayah_id: null,
        top_ayah_ids: [],
        ranker_source: "fallback",
        semantic_candidates_count: 0,
        semantic_tags_considered: [],
        semantic_score: 0,
        error: errorResponse.error,
      });
      appendChatDecisionLog(logEntry);
      return sendUtf8Json(res, validation.statusCode || 400, errorResponse);
    }

    const message = validation.message;
    if (isUnsafePrompt(message)) {
      const errorResponse = {
        ok: false,
        error: "request cannot be processed safely",
      };
      logEntry = buildChatDecisionLog({
        timestamp: new Date().toISOString(),
        module,
        endpoint: req.path,
        source: module,
        source_screen: sourceScreen || null,
        user_message: message,
        intent: "blocked_unsafe_prompt",
        response_type: "direct_answer",
        route_mode: null,
        knowledge_hit_id: null,
        selected_ayah_id: null,
        top_ayah_ids: [],
        ranker_source: "fallback",
        semantic_candidates_count: 0,
        semantic_tags_considered: [],
        semantic_score: 0,
        error: errorResponse.error,
        blocked_override_reason: "unsafe_prompt",
      });
      appendChatDecisionLog(logEntry);
      return sendUtf8Json(res, 400, errorResponse);
    }
    const history = sanitizeHistory(req.body?.history);

    // Debug logging for ilmihal-chat
    if (module === "ilmihal") {
      requestCounter++;
      ilmihalDebugLogger.logIncomingQuestion(requestCounter, message);
    }

    if (module === "chat" && isRepentanceAyahMessage(message)) {
      const response = {
        intent: "emotional_spiritual_support",
        primary_theme: "umut",
        secondary_themes: ["tevekkül"],
        emotion: "umut",
        severity: "medium",
        response_type: "sensitive_support",
        context_topic: null,
        ayah_used: true,
        top_ayah_ids: [4111],
        selected_ayah: {
          id: 4111,
          surahName: "الزمر",
          surahNumber: 39,
          ayahNumber: 53,
          surahNameTr: "Zümer",
        },
        assistant_text: "Umut tarafını hatırlatan bir ayet var:\n\nZümer 39:53, Allah'ın rahmetinden ümit kesmemeyi hatırlatır.",
        decision_meta: {
          module: "chat",
          route_mode: "quran_guidance",
          planner_source: "local_fast_path",
          pre_route_stage: "emotional_redirect",
          knowledge_hit_id: null,
          ranker_source: "semantic",
          semantic_candidates_count: 0,
          semantic_tags_considered: [],
          semantic_score: 0,
          selected_ayah_id: 4111,
          timing_ms: {
            context_resolver_ms: 0,
            intent_planner_ms: 0,
            knowledge_router_ms: 0,
            ayah_ranker_ms: 0,
            response_composer_ms: 0,
            log_write_ms: 0,
            total: 0,
          },
        },
      };
      logEntry = buildChatDecisionLog({
        timestamp: new Date().toISOString(),
        module: "chat",
        endpoint: req.path,
        source: "chat",
        user_message: message,
        intent: response.intent,
        response_type: response.response_type,
        route_mode: response.decision_meta.route_mode,
        planner_source: response.decision_meta.planner_source,
        redirect_module: null,
        knowledge_hit_id: null,
        selected_ayah_id: response.selected_ayah.id,
        selected_ayah_reference: selectedAyahReference(response.selected_ayah),
        top_ayah_ids: response.top_ayah_ids,
        ranker_source: response.decision_meta.ranker_source,
        semantic_candidates_count: 0,
        semantic_tags_considered: [],
        semantic_score: 0,
        semantic_match_score: 0,
        semantic_matched_topic: null,
        semantic_confidence: null,
        pre_route_stage: response.decision_meta.pre_route_stage,
        timing_ms: response.decision_meta.timing_ms,
        error: null,
        assistant_response_preview: response.assistant_text,
      });
      appendChatDecisionLog(logEntry);
      return sendUtf8Json(res, 200, {
        assistant_text: response.assistant_text,
        selected_ayah: response.selected_ayah,
      });
    }
    const ilmihalKnowledgeHit =
      module === "ilmihal" && !isPureGreetingMessage(message)
        ? lookupKnowledgeAnswer(message, {}, null, history)
        : null;

    // Debug logging + KB-miss tracking for ilmihal-chat
    if (module === "ilmihal" && !isPureGreetingMessage(message)) {
      ilmihalDebugLogger.logSemanticMatchStart(message);

      if (ilmihalKnowledgeHit) {
        // KB hit: log matched entry details (use actual field names from routeKnowledge)
        const rawMatchScore = ilmihalKnowledgeHit.match_score
          ?? ilmihalKnowledgeHit.semantic_match_score
          ?? (ilmihalKnowledgeHit.knowledge_hit_id ? 1 : 0);
        // Normalize: some resolvers return integer 95 instead of float 0.95
        const matchScore = typeof rawMatchScore === 'number' && rawMatchScore > 1 ? rawMatchScore / 100 : rawMatchScore;
        ilmihalDebugLogger.logKnowledgeBaseHit({
          id: ilmihalKnowledgeHit.knowledge_hit_id || ilmihalKnowledgeHit.id,
          expectedTopic: ilmihalKnowledgeHit.topic,
          label: ilmihalKnowledgeHit.matched_title || ilmihalKnowledgeHit.matched_by,
          matchScore,
          routingScore: ilmihalKnowledgeHit.semantic_match_score ?? matchScore,
          confidence: ilmihalKnowledgeHit.semantic_confidence ?? ilmihalKnowledgeHit.confidence ?? null,
          answer: ilmihalKnowledgeHit.answer_text,
        });
        ilmihalDebugLogger.logRoutingDecision(
          ilmihalKnowledgeHit.topic || ilmihalKnowledgeHit.knowledge_hit_id,
          ilmihalKnowledgeHit.matched_title || ilmihalKnowledgeHit.topic,
          matchScore,
          ilmihalKnowledgeHit.semantic_match_score ?? matchScore
        );
      } else {
        // KB miss: log it and record for future KB expansion
        ilmihalDebugLogger.logNoMatch(message, 'No knowledge base entry matched — OpenAI fallback will be used');
        logKBMiss({
          question: message,
          kbScore: 0,
          responseSource: 'openai_fallback',
          timestamp: new Date().toISOString(),
        });
        console.log(`[kb-miss] OpenAI fallback: "${message.slice(0, 80)}"`);
      }

      // Log rejected candidates if provided
      if (ilmihalKnowledgeHit && Array.isArray(ilmihalKnowledgeHit.rejected)) {
        ilmihalDebugLogger.logRejectedCandidates(ilmihalKnowledgeHit.rejected);
      }
    }

    // ── Quota guard (ilmihal KB-miss OpenAI path only) ───────────────────────
    // KB hits are always free. Only KB-miss calls that fall through to OpenAI
    // are counted against the device's monthly free allowance.
    const ilmihalIsKbMiss =
      module === "ilmihal" &&
      !ilmihalKnowledgeHit &&
      !isPureGreetingMessage(message);
    const ilmihalDeviceId = ilmihalIsKbMiss
      ? (typeof req.headers["x-device-id"] === "string"
          ? req.headers["x-device-id"].trim().slice(0, 128)
          : null)
      : null;

    if (ilmihalIsKbMiss) {
      const quota = checkQuota(ilmihalDeviceId);
      if (!quota.allowed) {
        return sendUtf8Json(res, 402, {
          ok: false,
          quota_exceeded: true,
          remaining: 0,
          used: quota.used,
          limit: quota.limit,
          upgrade_url: "https://hakai.app/upgrade",
          error: "Aylık ücretsiz soru limitinize ulaştınız.",
        });
      }
    }
    // ── End quota guard ──────────────────────────────────────────────────────

    const response = await buildChatResponse(message, history, {
      module,
      source_screen: sourceScreen,
    });
    const decisionMeta = response.decision_meta || {};
    const isDebug = isDebugChatEngineEnabled();
    const normalizedResponse = isDebug
      ? {
          intent: response.intent,
          primary_theme: response.primary_theme,
          secondary_themes: response.secondary_themes || [],
          emotion: response.emotion,
          severity: response.severity,
          response_type: response.response_type,
          context_topic: response.context_topic || null,
          ayah_used: response.ayah_used === true,
          top_ayah_ids: response.top_ayah_ids || [],
          selected_ayah: response.selected_ayah || null,
          assistant_text: response.assistant_text || "",
          ...(response.redirect_module ? { redirect_module: response.redirect_module } : {}),
          ...(Array.isArray(response.related_questions) && response.related_questions.length > 0
            ? { related_questions: response.related_questions }
            : {}),
          ...(response.debug ? { debug: response.debug } : {}),
          ...(response.decision_meta ? { decision_meta: response.decision_meta } : {}),
          ...(response.timing_ms ? { timing_ms: response.timing_ms } : {}),
        }
      : {
          assistant_text: response.assistant_text || "",
          selected_ayah: response.selected_ayah || null,
          ...(response.redirect_module ? { redirect_module: response.redirect_module } : {}),
          ...(Array.isArray(response.related_questions) && response.related_questions.length > 0
            ? { related_questions: response.related_questions }
            : {}),
        };
    const debugFields = isDebugChatEngineEnabled()
      ? buildDebugFields({
          semantic_match_score: decisionMeta.semantic_match_score,
          semantic_matched_topic: decisionMeta.semantic_matched_topic,
          semantic_confidence: decisionMeta.semantic_confidence,
          response_preview:
            typeof decisionMeta.response_preview === "string" ? decisionMeta.response_preview.slice(0, 800) : null,
        })
      : null;
    const moduleResponse =
      module === "chat" || !isDebug
        ? normalizedResponse
        : {
            ...normalizedResponse,
            decision_meta: {
              ...decisionMeta,
              module: decisionMeta.module || module,
            },
            timing_ms: normalizeTimingBreakdown(decisionMeta.timing_ms),
          };
    if (debugFields) {
      moduleResponse.debug = debugFields;
    }
    logEntry = buildChatDecisionLog({
      timestamp: new Date().toISOString(),
      module: decisionMeta.module || module,
      endpoint: req.path,
      source: module,
      source_screen: sourceScreen || null,
      user_message: message,
      intent: response.intent || null,
      response_type: response.response_type || null,
      route_mode: decisionMeta.route_mode || null,
      planner_source: decisionMeta.planner_source || "fallback",
      redirect_module: normalizedResponse.redirect_module || null,
      knowledge_hit_id: decisionMeta.knowledge_hit_id || null,
      matched_knowledge_id: decisionMeta.matched_knowledge_id || decisionMeta.knowledge_hit_id || null,
      matched_title: decisionMeta.matched_title || null,
      match_reason: decisionMeta.match_reason || null,
      match_score:
        typeof decisionMeta.match_score === "number" ? decisionMeta.match_score : 0,
      rejected_candidates: Array.isArray(decisionMeta.rejected_candidates)
        ? decisionMeta.rejected_candidates
        : [],
      final_route: decisionMeta.route_mode || normalizedResponse.redirect_module || null,
      selected_ayah_id: normalizedResponse.selected_ayah
        ? normalizedResponse.selected_ayah.id || null
        : null,
      selected_ayah_reference: selectedAyahReference(normalizedResponse.selected_ayah),
      top_ayah_ids: normalizedResponse.top_ayah_ids || [],
      ranker_source: decisionMeta.ranker_source || "fallback",
      semantic_candidates_count: Number.isInteger(decisionMeta.semantic_candidates_count)
        ? decisionMeta.semantic_candidates_count
        : 0,
      semantic_tags_considered: Array.isArray(decisionMeta.semantic_tags_considered)
        ? decisionMeta.semantic_tags_considered
        : [],
      semantic_score: typeof decisionMeta.semantic_score === "number" ? decisionMeta.semantic_score : 0,
      semantic_match_score:
        typeof decisionMeta.semantic_match_score === "number" ? decisionMeta.semantic_match_score : 0,
      semantic_matched_topic: decisionMeta.semantic_matched_topic || null,
      semantic_confidence: decisionMeta.semantic_confidence || null,
      pre_route_stage: decisionMeta.pre_route_stage || null,
      timing_ms: normalizeTimingBreakdown(decisionMeta.timing_ms),
      error: null,
      assistant_response_preview:
        typeof response.assistant_text === "string" ? response.assistant_text.slice(0, 800) : null,
      blocked_override_reason: decisionMeta.blocked_override_reason || null,
      ...(String(process.env.DEBUG_CHAT_ENGINE || "").trim().toLowerCase() === "true" &&
      typeof decisionMeta.response_preview === "string" &&
      decisionMeta.response_preview.trim()
        ? { response_preview: decisionMeta.response_preview.slice(0, 800) }
        : {}),
    });
    appendChatDecisionLog(logEntry);

    // Debug logging for ilmihal final response
    if (module === "ilmihal") {
      const responseType = ilmihalKnowledgeHit && ilmihalKnowledgeHit.hit ? 'knowledge_base' : 'ai_generated';
      ilmihalDebugLogger.logFinalResponse(
        response.assistant_text || '',
        responseType
      );
    }

    // Consume one quota unit for ilmihal KB-miss OpenAI calls on success
    if (ilmihalIsKbMiss) {
      consumeQuota(ilmihalDeviceId);
    }

    return sendUtf8Json(res, 200, moduleResponse);
  } catch (error) {
    const errorResponse = {
      ok: false,
      error: "internal server error",
    };

    // Debug logging for ilmihal errors
    if (module === "ilmihal") {
      ilmihalDebugLogger.logError(error);
    }

    if (!logEntry) {
      logEntry = buildChatDecisionLog({
        timestamp: new Date().toISOString(),
        module,
        endpoint: req.path,
        source: module,
        source_screen: sourceScreen || null,
        user_message: typeof req.body?.message === "string" ? req.body.message : "",
        intent: null,
        response_type: null,
        route_mode: null,
        planner_source: null,
        knowledge_hit_id: null,
        selected_ayah_id: null,
        top_ayah_ids: [],
        ranker_source: "fallback",
        semantic_candidates_count: 0,
        semantic_tags_considered: [],
        semantic_score: 0,
        timing_ms: {
          total: 0,
        },
        error: error.message,
        blocked_override_reason: null,
      });
      appendChatDecisionLog(logEntry);
    }
    return sendUtf8Json(res, 500, errorResponse);
  }
}

// ── KB Miss stats endpoint (debug only) ────────────────────────────────────
app.get("/debug/kb-misses", (req, res) => {
  if (!isDebugChatEngineEnabled()) {
    return sendUtf8Json(res, 404, { ok: false, error: "not found" });
  }
  const days = Number(req.query.days) || 7;
  const stats = getMissStats(days);
  return sendUtf8Json(res, 200, {
    ok: true,
    window_days: days,
    total_misses: stats.total,
    pending_kb_additions: stats.pending,
    top_missing_questions: stats.top,
  });
});

app.get("/debug/resolve", async (req, res) => {
  if (!isDebugChatEngineEnabled()) {
    return sendUtf8Json(res, 404, { ok: false, error: "not found" });
  }

  const startedAt = Date.now();
  const module = typeof req.query?.module === "string" ? req.query.module : "chat";
  const inputMessage = typeof req.query?.q === "string" ? req.query.q : "";
  if (!inputMessage.trim()) {
    return sendUtf8Json(res, 400, { ok: false, error: "q is required" });
  }

  try {
    const response = await buildChatResponse(inputMessage, [], { module });
    const decisionMeta = response.decision_meta || {};
    const currentMessageCluster =
      resolveCurrentMessageOverrideTopic(inputMessage) ||
      detectExplicitTopic(inputMessage) ||
      response.context_topic ||
      response.primary_theme ||
      null;
    const matchedOverrideCluster =
      decisionMeta.ranker_source === "override" ? currentMessageCluster : null;

    return sendUtf8Json(res, 200, {
      input_message: inputMessage,
      normalized_message: normalize(inputMessage),
      intent: response.intent || null,
      response_type: response.response_type || null,
      route_mode: decisionMeta.route_mode || null,
      module: decisionMeta.module || module,
      planner_source: decisionMeta.planner_source || "fallback",
      redirect_module: response.redirect_module || null,
      current_message_cluster: currentMessageCluster,
      history_context_used: false,
      matched_override_cluster: matchedOverrideCluster,
      selected_ayah_id: response.selected_ayah ? response.selected_ayah.id || null : null,
      top_ayah_ids: Array.isArray(response.top_ayah_ids) ? response.top_ayah_ids : [],
      ranker_source: decisionMeta.ranker_source || "fallback",
      semantic_score: typeof decisionMeta.semantic_score === "number" ? decisionMeta.semantic_score : 0,
      knowledge_hit_id: decisionMeta.knowledge_hit_id || null,
      matched_knowledge_id: decisionMeta.matched_knowledge_id || decisionMeta.knowledge_hit_id || null,
      matched_title: decisionMeta.matched_title || null,
      match_reason: decisionMeta.match_reason || null,
      match_score: typeof decisionMeta.match_score === "number" ? decisionMeta.match_score : 0,
      rejected_candidates: Array.isArray(decisionMeta.rejected_candidates)
        ? decisionMeta.rejected_candidates
        : [],
      final_route: decisionMeta.route_mode || response.redirect_module || null,
      debug: buildDebugFields({
        semantic_match_score:
          typeof decisionMeta.semantic_match_score === "number" ? decisionMeta.semantic_match_score : 0,
        semantic_matched_topic: decisionMeta.semantic_matched_topic || null,
        semantic_confidence: decisionMeta.semantic_confidence || null,
        pre_route_stage: decisionMeta.pre_route_stage || null,
        response_preview:
          typeof decisionMeta.response_preview === "string" ? decisionMeta.response_preview.slice(0, 800) : null,
      }),
      response_preview:
        typeof decisionMeta.response_preview === "string" ? decisionMeta.response_preview.slice(0, 800) : null,
      timing_ms: normalizeTimingBreakdown(decisionMeta.timing_ms, Date.now() - startedAt),
    });
  } catch (error) {
    return sendUtf8Json(res, 500, { ok: false, error: error.message });
  }
});

app.use((error, req, res, next) => {
  if (error && error.type === "entity.too.large") {
    return sendUtf8Json(res, 413, { ok: false, error: "request body is too large" });
  }
  if (error instanceof SyntaxError && "body" in error) {
    return sendUtf8Json(res, 400, { ok: false, error: "invalid json body" });
  }
  const errorResponse = {
    ok: false,
    error: "internal server error",
  };
  return sendUtf8Json(res, 500, errorResponse);
});

function sendUtf8Json(res, statusCode, body) {
  res.status(statusCode);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.json(body);
}

function handleAuthError(res, error) {
  if (error && error.message === "HAKAI_AUTH_JWT_SECRET is required") {
    return sendUtf8Json(res, 500, {
      ok: false,
      error: "auth is not configured",
    });
  }
  return sendUtf8Json(res, 500, {
    ok: false,
    error: "auth request failed",
  });
}

async function requireAuthenticatedUser(req, res) {
  const result = await authService.authenticate(bearerTokenFromRequest(req));
  if (!result.ok) {
    sendUtf8Json(res, result.statusCode || 401, {
      ok: false,
      error: result.error,
    });
    return null;
  }
  return result;
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isDebugChatEngineEnabled() {
  return String(process.env.DEBUG_CHAT_ENGINE || "").trim().toLowerCase() === "true";
}

function buildChatDecisionLog(entry) {
  const rawDebugFields = isRawChatLoggingEnabled()
    ? {
        raw_user_message:
          typeof entry.user_message === "string" ? entry.user_message.slice(0, 2000) : "",
        assistant_response_preview:
          typeof entry.assistant_response_preview === "string"
            ? entry.assistant_response_preview.slice(0, 800)
            : typeof entry.response_preview === "string"
              ? entry.response_preview.slice(0, 800)
              : null,
        endpoint: entry.endpoint || null,
        screen: entry.source || entry.screen || entry.module || null,
        source: entry.source || entry.screen || entry.module || null,
        final_route: entry.final_route || entry.route_mode || entry.redirect_module || null,
        selected_ayah_reference: entry.selected_ayah_reference || null,
        blocked_override_reason: entry.blocked_override_reason || null,
      }
    : {};
  return JSON.stringify({
    timestamp: entry.timestamp || new Date().toISOString(),
    module: entry.module || "chat",
    ...summarizeUserMessage(entry.user_message),
    intent: entry.intent || null,
    response_type: entry.response_type || null,
    route_mode: entry.route_mode || null,
    planner_source: entry.planner_source || "fallback",
    knowledge_hit_id: entry.knowledge_hit_id || null,
    matched_knowledge_id: entry.matched_knowledge_id || entry.knowledge_hit_id || null,
    matched_title: entry.matched_title || null,
    match_reason: entry.match_reason || null,
    match_score: typeof entry.match_score === "number" ? entry.match_score : 0,
    rejected_candidates: Array.isArray(entry.rejected_candidates)
      ? entry.rejected_candidates
      : [],
    final_route: entry.final_route || entry.route_mode || entry.redirect_module || null,
    selected_ayah_id:
      typeof entry.selected_ayah_id === "number" ? entry.selected_ayah_id : null,
    top_ayah_ids: Array.isArray(entry.top_ayah_ids) ? entry.top_ayah_ids : [],
    ranker_source: entry.ranker_source || "fallback",
    semantic_candidates_count:
      typeof entry.semantic_candidates_count === "number" ? entry.semantic_candidates_count : 0,
    semantic_tags_considered: Array.isArray(entry.semantic_tags_considered)
      ? entry.semantic_tags_considered
      : [],
    semantic_score: typeof entry.semantic_score === "number" ? entry.semantic_score : 0,
    semantic_match_score:
      typeof entry.semantic_match_score === "number" ? entry.semantic_match_score : 0,
    semantic_matched_topic: entry.semantic_matched_topic || null,
    semantic_confidence: entry.semantic_confidence || null,
    pre_route_stage: entry.pre_route_stage || null,
    timing_ms: normalizeTimingBreakdown(entry.timing_ms),
    error: typeof entry.error === "string" && entry.error.trim() ? entry.error.trim() : null,
    ...(isUsageLimitBypassEnabled() ? { usage_limit_bypassed_for_debug: true } : {}),
    ...rawDebugFields,
    ...(String(process.env.DEBUG_CHAT_ENGINE || "").trim().toLowerCase() === "true" &&
    isVerboseChatLoggingEnabled() &&
    typeof entry.response_preview === "string" &&
    entry.response_preview.trim()
      ? { response_preview: entry.response_preview.slice(0, 800) }
      : {}),
  });
}

function buildDebugFields(entry = {}) {
  return {
    semantic_match_score:
      typeof entry.semantic_match_score === "number" ? entry.semantic_match_score : 0,
    semantic_matched_topic: entry.semantic_matched_topic || null,
    semantic_confidence: entry.semantic_confidence || null,
    pre_route_stage: entry.pre_route_stage || null,
    ...(typeof entry.response_preview === "string" && entry.response_preview.trim()
      ? { response_preview: entry.response_preview.slice(0, 800) }
      : {}),
  };
}

function selectedAyahReference(selectedAyah) {
  if (!selectedAyah || typeof selectedAyah !== "object") return null;
  const surahName =
    selectedAyah.surahNameTr ||
    selectedAyah.surah_name_tr ||
    selectedAyah.surah ||
    selectedAyah.surahName ||
    "";
  const surahNumber =
    selectedAyah.surahNumber || selectedAyah.surah_number || selectedAyah.surah_no || "";
  const ayahNumber =
    selectedAyah.ayahNumber || selectedAyah.ayah || selectedAyah.ayah_number || "";
  const numericRef = surahNumber && ayahNumber ? `${surahNumber}:${ayahNumber}` : "";
  return [surahName, numericRef].filter(Boolean).join(" ").trim() || null;
}

function normalizeTimingBreakdown(timingMs, fallbackTotal = null) {
  const safe = timingMs && typeof timingMs === "object" ? timingMs : {};
  return {
    context_resolver_ms: Number.isFinite(safe.context_resolver_ms) ? safe.context_resolver_ms : 0,
    intent_planner_ms: Number.isFinite(safe.intent_planner_ms) ? safe.intent_planner_ms : 0,
    knowledge_router_ms: Number.isFinite(safe.knowledge_router_ms) ? safe.knowledge_router_ms : 0,
    ayah_ranker_ms: Number.isFinite(safe.ayah_ranker_ms) ? safe.ayah_ranker_ms : 0,
    response_composer_ms: Number.isFinite(safe.response_composer_ms) ? safe.response_composer_ms : 0,
    log_write_ms: Number.isFinite(safe.log_write_ms) ? safe.log_write_ms : 0,
    total: Number.isFinite(safe.total) ? safe.total : Number.isFinite(fallbackTotal) ? fallbackTotal : 0,
  };
}

function appendChatDecisionLog(line) {
  if (!isChatDecisionLoggingEnabled()) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(CHAT_RUNTIME_LOG_PATH), { recursive: true });
    fs.appendFileSync(CHAT_RUNTIME_LOG_PATH, Buffer.from(`${line}\n`, "utf8"));
  } catch (error) {
    console.error("Failed to append chat runtime log:", error && error.stack ? error.stack : error);
  }
}

function isChatDecisionLoggingEnabled() {
  const explicit = String(process.env.HAKAI_CHAT_LOGS_ENABLED || "").trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = item.role === "assistant" ? "assistant" : "user";
      const text =
        typeof item.text === "string"
          ? item.text.trim()
          : typeof item.content === "string"
            ? item.content.trim()
            : "";
      if (!text) return null;
      return {
        role,
        text: text.slice(0, 800),
        intent:
          typeof item.intent === "string" && item.intent.trim()
            ? item.intent.trim()
            : null,
        primary_theme:
          typeof item.primary_theme === "string" && item.primary_theme.trim()
            ? item.primary_theme.trim()
            : null,
        response_type:
          typeof item.response_type === "string" && item.response_type.trim()
            ? item.response_type.trim()
            : null,
        secondary_themes: Array.isArray(item.secondary_themes)
          ? item.secondary_themes
              .map((value) =>
                typeof value === "string" && value.trim() ? value.trim() : null
              )
              .filter(Boolean)
          : [],
        emotion:
          typeof item.emotion === "string" && item.emotion.trim()
            ? item.emotion.trim()
            : null,
        severity:
          typeof item.severity === "string" && item.severity.trim()
            ? item.severity.trim()
            : null,
        context_topic:
          typeof item.context_topic === "string" && item.context_topic.trim()
            ? item.context_topic.trim()
            : null,
        selected_ayah_id:
          typeof item.selected_ayah_id === "number" ? item.selected_ayah_id : null,
      };
    })
    .filter(Boolean)
    .slice(-6);
}

const server = app.listen(port, "0.0.0.0", () => {
  const lanAddress = getLanAddress();
  console.log(`HAKAI backend listening on http://localhost:${port}`);
  if (lanAddress) {
    console.log(`HAKAI backend LAN URL: http://${lanAddress}:${port}`);
  } else {
    console.log("HAKAI backend LAN URL: not detected");
  }
});

server.on("error", (error) => {
  console.error("Failed to start server:", error && error.stack ? error.stack : error);
});

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name] || [];
    for (const entry of entries) {
      if (!entry || entry.family !== "IPv4" || entry.internal) {
        continue;
      }
      const address = entry.address || "";
      if (address.startsWith("169.254.")) {
        continue;
      }
      return address;
    }
  }
  return null;
}
