const path = require("path");
const fs = require("fs");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const { buildChatResponse } = require("./agent/index");
const { detectExplicitTopic, normalize } = require("./agent/context_resolver");
const { resolveCurrentMessageOverrideTopic } = require("./agent/ayah_ranker");

const app = express();
const port = process.env.PORT || 3000;
const ENGINE_VERSION = "runtime-check-1";
const STARTED_AT = new Date().toISOString();
const CHAT_RUNTIME_LOG_PATH = path.join(__dirname, "..", "logs", "chat_runtime_log.txt");

process.on("uncaughtException", (error) => {
  console.error("Startup error:", error && error.stack ? error.stack : error);
});

process.on("unhandledRejection", (error) => {
  console.error("Startup error:", error && error.stack ? error.stack : error);
});

app.use(express.json());

app.get("/", (req, res) => {
  res.type("text/plain").send("HAKAI backend is running");
});

app.get("/health", (req, res) => {
  return sendUtf8Json(res, 200, {
    ok: true,
    service: "ayet-rehberi-chat-agent",
    engine_version: ENGINE_VERSION,
    pid: process.pid,
    started_at: STARTED_AT,
    cwd: process.cwd(),
  });
});

app.post("/chat", (req, res) => handleChatModuleRequest(req, res, "chat"));
app.post("/ayah-chat", (req, res) => handleChatModuleRequest(req, res, "ayah"));
app.post("/ilmihal-chat", (req, res) => handleChatModuleRequest(req, res, "ilmihal"));

async function handleChatModuleRequest(req, res, module = "chat") {
  let logEntry = null;
  try {
    const message = req.body?.message;
    if (typeof message !== "string" || message.trim().length === 0) {
      const errorResponse = {
        ok: false,
        error: "message is required",
      };
      logEntry = buildChatDecisionLog({
        timestamp: new Date().toISOString(),
        module,
        user_message: typeof message === "string" ? message : "",
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
      return sendUtf8Json(res, 400, errorResponse);
    }

    const history = sanitizeHistory(req.body?.history);
    const response = await buildChatResponse(message, history, { module });
    const normalizedResponse = {
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
    };
    const decisionMeta = response.decision_meta || {};
    const moduleResponse =
      module === "chat"
        ? normalizedResponse
        : {
            ...normalizedResponse,
            decision_meta: {
              ...decisionMeta,
              module: decisionMeta.module || module,
            },
            timing_ms: normalizeTimingBreakdown(decisionMeta.timing_ms),
          };
    logEntry = buildChatDecisionLog({
      timestamp: new Date().toISOString(),
      module: decisionMeta.module || module,
      user_message: message,
      intent: normalizedResponse.intent,
      response_type: normalizedResponse.response_type,
      route_mode: decisionMeta.route_mode || null,
      planner_source: decisionMeta.planner_source || "fallback",
      redirect_module: normalizedResponse.redirect_module || null,
      knowledge_hit_id: decisionMeta.knowledge_hit_id || null,
      selected_ayah_id: normalizedResponse.selected_ayah
        ? normalizedResponse.selected_ayah.id || null
        : null,
      top_ayah_ids: normalizedResponse.top_ayah_ids || [],
      ranker_source: decisionMeta.ranker_source || "fallback",
      semantic_candidates_count: Number.isInteger(decisionMeta.semantic_candidates_count)
        ? decisionMeta.semantic_candidates_count
        : 0,
      semantic_tags_considered: Array.isArray(decisionMeta.semantic_tags_considered)
        ? decisionMeta.semantic_tags_considered
        : [],
      semantic_score: typeof decisionMeta.semantic_score === "number" ? decisionMeta.semantic_score : 0,
      timing_ms: normalizeTimingBreakdown(decisionMeta.timing_ms),
      error: null,
    });
    appendChatDecisionLog(logEntry);
    return sendUtf8Json(res, 200, moduleResponse);
  } catch (error) {
    const errorResponse = {
      ok: false,
      error: error.message,
    };
    if (!logEntry) {
      logEntry = buildChatDecisionLog({
        timestamp: new Date().toISOString(),
        module,
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
      });
      appendChatDecisionLog(logEntry);
    }
    return sendUtf8Json(res, 500, errorResponse);
  }
}

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
      timing_ms: normalizeTimingBreakdown(decisionMeta.timing_ms, Date.now() - startedAt),
    });
  } catch (error) {
    return sendUtf8Json(res, 500, { ok: false, error: error.message });
  }
});

app.use((error, req, res, next) => {
  const errorResponse = {
    ok: false,
    error: error.message,
  };
  return sendUtf8Json(res, 500, errorResponse);
});

function sendUtf8Json(res, statusCode, body) {
  res.status(statusCode);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.json(body);
}

function isDebugChatEngineEnabled() {
  return String(process.env.DEBUG_CHAT_ENGINE || "").trim().toLowerCase() === "true";
}

function buildChatDecisionLog(entry) {
  return JSON.stringify({
    timestamp: entry.timestamp || new Date().toISOString(),
    module: entry.module || "chat",
    user_message: typeof entry.user_message === "string" ? entry.user_message : "",
    intent: entry.intent || null,
    response_type: entry.response_type || null,
    route_mode: entry.route_mode || null,
    planner_source: entry.planner_source || "fallback",
    knowledge_hit_id: entry.knowledge_hit_id || null,
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
    timing_ms: normalizeTimingBreakdown(entry.timing_ms),
    error: typeof entry.error === "string" && entry.error.trim() ? entry.error.trim() : null,
  });
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
  try {
    fs.mkdirSync(path.dirname(CHAT_RUNTIME_LOG_PATH), { recursive: true });
    fs.appendFileSync(CHAT_RUNTIME_LOG_PATH, Buffer.from(`${line}\n`, "utf8"));
  } catch (error) {
    console.error("Failed to append chat runtime log:", error && error.stack ? error.stack : error);
  }
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = item.role === "assistant" ? "assistant" : "user";
      const text = typeof item.text === "string" ? item.text.trim() : "";
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

const server = app.listen(port, () => {
  console.log(`HAKAI chat agent listening on port ${port}`);
});

server.on("error", (error) => {
  console.error("Failed to start server:", error && error.stack ? error.stack : error);
});


