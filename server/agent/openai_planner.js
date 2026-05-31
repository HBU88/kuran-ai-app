const OpenAI = require("openai");

const INTENTS = [
  "casual_conversation",
  "emotional_spiritual_support",
  "general_islamic_question",
  "ayah_request",
  "worship_practice_question",
  "high_risk_sensitive",
];

const SUB_INTENTS = [
  "casual_conversation",
  "emotional_support",
  "ayah_request",
  "dua_request",
  "zikir_request",
  "practical_guidance",
  "general_information",
];

const RESPONSE_TYPES = [
  "direct_ayah",
  "supportive_ayah",
  "explanation_with_ayah",
  "dua_guidance",
  "direct_answer",
  "practice_suggestion",
  "sensitive_support",
];

let cachedClient = null;
let lastPlannerMeta = createPlannerMeta();

function isOpenAIPlannerEnabled() {
  return String(process.env.HAKAI_OPENAI_PLANNER_ENABLED || "true").trim().toLowerCase() !== "false";
}

function getOpenAIClient() {
  if (!isOpenAIPlannerEnabled()) {
    return null;
  }
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return cachedClient;
}

async function planChatWithOpenAI(message, history = []) {
  if (!isOpenAIPlannerEnabled()) {
    lastPlannerMeta = createPlannerMeta({
      planner_attempted: false,
      planner_used: false,
      planner_valid: false,
      planner_source: "fallback",
      planner_failure_stage: "planner_disabled",
    });
    return null;
  }

  const client = getOpenAIClient();
  if (!client) {
    lastPlannerMeta = createPlannerMeta({
      planner_attempted: false,
      planner_used: false,
      planner_valid: false,
      planner_source: "fallback",
      planner_failure_stage: "no_api_key",
    });
    return null;
  }

  let response;
  try {
    response = await client.responses.create({
      model: process.env.OPENAI_PLANNER_MODEL || "gpt-4o-mini",
      instructions: [
        "You are the routing planner for HAKAI.",
        "You do not generate the final user-facing answer.",
        "Be cautious in religious matters.",
        "Do not act as a fatwa engine.",
        "Prefer the internal knowledge base for practical worship questions.",
        "Prefer ayah retrieval for explicit ayah requests and ayah-centered support.",
        "Prefer supportive tone for emotional struggle.",
        "Treat greetings and casual small talk as casual_conversation with direct_answer, no ayah, and no knowledge lookup.",
        "Avoid generic hope answers when a concrete topic is present.",
        "Return only valid JSON matching the required schema.",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Latest Turkish user message: ${message}`,
                `Recent conversation context: ${JSON.stringify(sanitizeHistory(history))}`,
                "Produce only the planner JSON.",
              ].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "chat_planner",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: { type: "string", enum: INTENTS },
              sub_intent: { type: "string", enum: SUB_INTENTS },
              needs_ayah: { type: "boolean" },
              needs_knowledge: { type: "boolean" },
              knowledge_topic: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              ayah_topic: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              response_type: { type: "string", enum: RESPONSE_TYPES },
              reasoning_note: { type: "string" },
            },
            required: [
              "intent",
              "sub_intent",
              "needs_ayah",
              "needs_knowledge",
              "knowledge_topic",
              "ayah_topic",
              "response_type",
              "reasoning_note",
            ],
          },
        },
      },
    });
  } catch (error) {
    const classifiedError = classifySdkError(error);
    lastPlannerMeta = createPlannerMeta({
      planner_attempted: true,
      planner_used: true,
      planner_valid: false,
      planner_source: "fallback",
      planner_failure_stage: classifiedError.failure_stage,
      sdk_error_message: truncateText(error?.message),
      http_status: classifiedError.http_status,
      error_code: classifiedError.error_code,
    });
    return null;
  }

  const rawText = extractPlannerText(response);
  if (!rawText) {
    lastPlannerMeta = createPlannerMeta({
      planner_attempted: true,
      planner_used: true,
      planner_valid: false,
      planner_source: "fallback",
      planner_failure_stage: "empty_response",
    });
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    lastPlannerMeta = createPlannerMeta({
      planner_attempted: true,
      planner_used: true,
      planner_valid: false,
      planner_source: "fallback",
      planner_failure_stage: "invalid_json",
      raw_text_preview: truncateText(rawText),
    });
    return null;
  }

  const validation = validatePlannerResult(parsed);
  if (!validation.valid) {
    lastPlannerMeta = createPlannerMeta({
      planner_attempted: true,
      planner_used: true,
      planner_valid: false,
      planner_source: "fallback",
      planner_failure_stage: validation.failure_stage,
      raw_text_preview: truncateText(rawText),
      parsed_json_preview: previewJson(parsed),
      validation_errors: validation.errors,
    });
    return null;
  }

  lastPlannerMeta = createPlannerMeta({
    planner_attempted: true,
    planner_used: true,
    planner_valid: true,
    planner_source: "openai",
    planner_reasoning_note: validation.plan.reasoning_note,
    raw_text_preview: truncateText(rawText),
    parsed_json_preview: previewJson(parsed),
  });
  return validation.plan;
}

function extractPlannerText(response) {
  return (
    response?.output_text ||
    response?.output?.[0]?.content?.find((item) => item.type === "output_text")?.text ||
    ""
  );
}

function validatePlannerResult(value) {
  const errors = [];
  if (!value || typeof value !== "object") {
    return {
      valid: false,
      failure_stage: "schema_validation_failed",
      errors: ["planner output is not an object"],
    };
  }

  const requiredFields = [
    "intent",
    "sub_intent",
    "needs_ayah",
    "needs_knowledge",
    "knowledge_topic",
    "ayah_topic",
    "response_type",
    "reasoning_note",
  ];
  const missingFields = requiredFields.filter((field) => !(field in value));
  if (missingFields.length > 0) {
    return {
      valid: false,
      failure_stage: "missing_required_fields",
      errors: missingFields.map((field) => `missing:${field}`),
    };
  }

  if (!INTENTS.includes(value.intent)) {
    errors.push(`invalid intent:${String(value.intent)}`);
  }
  if (!SUB_INTENTS.includes(value.sub_intent)) {
    errors.push(`invalid sub_intent:${String(value.sub_intent)}`);
  }
  if (!RESPONSE_TYPES.includes(value.response_type)) {
    errors.push(`invalid response_type:${String(value.response_type)}`);
  }
  if (typeof value.needs_ayah !== "boolean") {
    errors.push("needs_ayah must be boolean");
  }
  if (typeof value.needs_knowledge !== "boolean") {
    errors.push("needs_knowledge must be boolean");
  }
  if (!isNullableString(value.knowledge_topic)) {
    errors.push("knowledge_topic must be string|null");
  }
  if (!isNullableString(value.ayah_topic)) {
    errors.push("ayah_topic must be string|null");
  }
  if (typeof value.reasoning_note !== "string") {
    errors.push("reasoning_note must be string");
  }

  if (errors.length > 0) {
    const enumError = errors.some((error) => error.startsWith("invalid "));
    return {
      valid: false,
      failure_stage: enumError ? "enum_validation_failed" : "schema_validation_failed",
      errors,
    };
  }

  return {
    valid: true,
    plan: {
      intent: value.intent,
      sub_intent: value.sub_intent,
      needs_ayah: value.needs_ayah,
      needs_knowledge: value.needs_knowledge,
      knowledge_topic: normalizeNullableString(value.knowledge_topic),
      ayah_topic: normalizeNullableString(value.ayah_topic),
      response_type: value.response_type,
      reasoning_note: value.reasoning_note.trim().slice(0, 240),
    },
  };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-6).map((item) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    text: typeof item?.text === "string" ? item.text.slice(0, 400) : "",
    intent: typeof item?.intent === "string" ? item.intent : null,
    primary_theme: typeof item?.primary_theme === "string" ? item.primary_theme : null,
    response_type: typeof item?.response_type === "string" ? item.response_type : null,
    context_topic: typeof item?.context_topic === "string" ? item.context_topic : null,
  }));
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

function normalizeNullableString(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function truncateText(value, max = 300) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function previewJson(value) {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return null;
    return JSON.parse(truncateText(serialized, 300));
  } catch (error) {
    return null;
  }
}

function classifySdkError(error) {
  const status =
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    null;
  const code =
    error?.code ||
    error?.error?.code ||
    error?.response?.data?.error?.code ||
    null;
  const message = String(error?.message || "").toLowerCase();

  if (
    status === 429 &&
    (message.includes("quota") ||
      message.includes("billing") ||
      message.includes("insufficient_quota") ||
      String(code || "").toLowerCase().includes("insufficient_quota"))
  ) {
    return {
      failure_stage: "quota_exceeded",
      http_status: status,
      error_code: code,
    };
  }
  if (status === 401 || status === 403 || message.includes("invalid api key")) {
    return {
      failure_stage: "invalid_api_key",
      http_status: status,
      error_code: code,
    };
  }
  if (status === 429) {
    return {
      failure_stage: "rate_limited",
      http_status: status,
      error_code: code,
    };
  }
  if (message.includes("network") || message.includes("fetch") || message.includes("timeout")) {
    return {
      failure_stage: "network_error",
      http_status: status,
      error_code: code,
    };
  }
  return {
    failure_stage: "sdk_error_unknown",
    http_status: status,
    error_code: code,
  };
}

function createPlannerMeta(overrides = {}) {
  return {
    planner_attempted: false,
    planner_used: false,
    planner_valid: false,
    planner_source: "fallback",
    planner_reasoning_note: null,
    planner_failure_stage: null,
    raw_text_preview: null,
    parsed_json_preview: null,
    validation_errors: [],
    sdk_error_message: null,
    http_status: null,
    error_code: null,
    ...overrides,
  };
}

function getPlannerDebugMeta() {
  return { ...lastPlannerMeta };
}

/**
 * Ilmihal KB-miss fallback — calls OpenAI to answer a religious question directly.
 *
 * Safety rules baked into the system prompt:
 *  - Only Hanafi/Diyanet mainstream perspective
 *  - Returns confidence='uncertain' when unsure → caller must show clarification
 *  - Never issues fatwas or fabricates rulings
 *  - Wrong answer is worse than no answer → strict uncertainty handling
 *
 * Returns { answer, confidence, topic_detected } or null on any failure.
 * confidence: 'high' | 'medium' | 'uncertain'
 */
async function askOpenAIIlmihalFallback(message, history = []) {
  if (!isOpenAIPlannerEnabled()) return null;
  const client = getOpenAIClient();
  if (!client) return null;

  let response;
  try {
    response = await client.responses.create({
      model: process.env.OPENAI_ILMIHAL_MODEL || "gpt-4o-mini",
      instructions: [
        "Sen HAKAI uygulamasının Türkçe ilmihal asistanısın.",
        "Kullanıcıya pratik ilmihal soruları için kısa, güvenilir Türkçe cevap verirsin.",
        "KESİN KURALLAR:",
        "1. Yalnızca Hanefi mezhebine dayalı Diyanet ana çerçevesini kullan.",
        "2. Emin olmadığında veya konu hassas/tartışmalı ise confidence='uncertain' döndür, asla tahmin yürütme.",
        "3. Fetva verme; kesin hüküm gerektiren durumlarda Diyanet veya bir din görevlisine yönlendir.",
        "4. Cevabı 2-4 cümleyle sınırla; kısa ve pratik ol.",
        "5. Yanlış cevap vermek cevap vermemekten çok daha kötüdür — şüpheli durumlarda uncertain döndür.",
        "6. Sadece geçerli JSON döndür, başka hiçbir şey yazma.",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Kullanıcı sorusu: ${message}`,
                history.length > 0
                  ? `Son konuşma bağlamı: ${JSON.stringify(sanitizeHistory(history))}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ilmihal_answer",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              answer: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "uncertain"] },
              topic_detected: { type: "string" },
            },
            required: ["answer", "confidence", "topic_detected"],
          },
        },
      },
    });
  } catch (error) {
    console.warn("[ILMIHAL_FALLBACK] OpenAI call failed:", error?.message || String(error));
    return null;
  }

  const rawText = extractPlannerText(response);
  if (!rawText) return null;

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed.answer !== "string" || !parsed.confidence) return null;
  if (!["high", "medium", "uncertain"].includes(parsed.confidence)) return null;

  return {
    answer: parsed.answer.trim(),
    confidence: parsed.confidence,
    topic_detected: typeof parsed.topic_detected === "string" ? parsed.topic_detected.trim() : "",
  };
}

module.exports = {
  getOpenAIClient,
  isOpenAIPlannerEnabled,
  planChatWithOpenAI,
  askOpenAIIlmihalFallback,
  getPlannerDebugMeta,
};
