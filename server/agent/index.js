// Orchestrates the chat agent pipeline while preserving the public response shape.
//
// Final response type rule set:
// - explicit ayah requests become direct_ayah when an ayah is actually used
// - emotional support with ayah becomes supportive_ayah
// - general questions only become explanation_with_ayah when ayah support is actually present
// - dua-oriented guidance becomes dua_guidance
// - practice suggestions and sensitive support keep their existing non-ayah styles

const {
  analyzeUserMessage,
  analyzeUserMessageFallback,
  inferSubIntent,
  responseStrategyForSubIntent,
} = require("./intent_router");
const {
  canonicalTopic,
  detectExplicitTopic,
  isPureGreetingMessage,
  isPrayerRakatsQuestion,
  normalize,
  secondaryThemesForContextTopic,
  themeForContextTopic,
} = require("./context_resolver");
const {
  rankAyahs: rankAyahsFromSource,
  resolveCurrentMessageOverrideTopic,
  shouldUseAyahFor,
} = require("./ayah_ranker");
const {
  hasKnowledgeMatch,
  isLocalKnowledgeQuery,
  isKnowledgeIntentQuestion,
  lookupKnowledgeAnswer,
} = require("./knowledge_base");
const { routeKnowledge } = require("./knowledge_router");
const { getPlannerDebugMeta, planChatWithOpenAI } = require("./openai_planner");
const { buildAssistantText } = require("./response_composer");
const { applySafetyGuard } = require("./safety_guard");
const { loadAyahDataset } = require("../utils/load_ayah_dataset");

const dataset = loadAyahDataset();
const ayahs = dataset.ayahs;

function isDebugChatEngineEnabled() {
  return String(process.env.DEBUG_CHAT_ENGINE || "").trim().toLowerCase() === "true";
}

function createTimingTracker() {
  const startedAt = Date.now();
  const timings = {
    context_resolver_ms: 0,
    intent_planner_ms: 0,
    knowledge_router_ms: 0,
    ayah_ranker_ms: 0,
    response_composer_ms: 0,
  };

  function measureSync(name, fn) {
    const phaseStartedAt = Date.now();
    try {
      return fn();
    } finally {
      if (Object.prototype.hasOwnProperty.call(timings, name)) {
        timings[name] += Date.now() - phaseStartedAt;
      }
    }
  }

  async function measureAsync(name, fn) {
    const phaseStartedAt = Date.now();
    try {
      return await fn();
    } finally {
      if (Object.prototype.hasOwnProperty.call(timings, name)) {
        timings[name] += Date.now() - phaseStartedAt;
      }
    }
  }

  function snapshot() {
    return {
      ...timings,
      total: Date.now() - startedAt,
    };
  }

  return { measureSync, measureAsync, snapshot };
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

function normalizeModuleMode(module) {
  const normalized = String(module || "chat").trim().toLowerCase();
  if (normalized === "ayah" || normalized === "ilmihal" || normalized === "chat") {
    return normalized;
  }
  return "chat";
}

function isForcedQuranGuidanceMessage(message, moduleMode = "chat") {
  if (moduleMode !== "ilmihal") return false;
  const normalized = String(message || "").toLocaleLowerCase("tr-TR");
  const phrases = [
    "yalniz hissediyorum",
    "yalnız hissediyorum",
    "allah beni affeder mi",
    "cok pismanim",
    "çok pişmanım",
    "pismanim",
    "pişmanım",
    "pisman",
    "pişman",
    "tovbe",
    "tövbe",
  ];
  return phrases.some((phrase) => normalized.includes(String(phrase).toLocaleLowerCase("tr-TR")));
}

function resolvePreModuleDecision(message, history = [], moduleMode = "chat") {
  if (isPureGreetingMessage(message)) {
    return { module: "chat", reason: "pure_greeting", pre_route_stage: "casual_greeting" };
  }

  const knowledgeHit = routeKnowledge(message, {}, null, history);
  if (!knowledgeHit) return null;

  if (knowledgeHit.matched_by === "semantic") {
    const confidence = typeof knowledgeHit.semantic_match_score === "number" ? knowledgeHit.semantic_match_score : 0;
    if (confidence >= 0.75) {
      return { module: "ilmihal", reason: "semantic_knowledge", pre_route_stage: "semantic", knowledgeHit };
    }
    // Weak semantic matches should still allow the module to fall back to a redirect or planner.
    return null;
  }

  if (knowledgeHit) {
    const preRouteStage = knowledgeHit.matched_by === "alias" ? "alias" : "exact";
    return { module: "ilmihal", reason: "exact_knowledge", pre_route_stage: preRouteStage, knowledgeHit };
  }

  if (isForcedQuranGuidanceMessage(message, moduleMode)) {
    return { module: "ayah", reason: "forced_quran_guidance", pre_route_stage: "emotional_redirect" };
  }

  return null;
}

function buildRedirectContextNote(message, baseAnalysis = {}) {
  const normalized = normalize(message);
  const topic = normalize(String(baseAnalysis.context_topic || baseAnalysis.primary_theme || ""));

  if (
    topic.includes(normalize("tövbe")) ||
    normalized.includes(normalize("tövbe")) ||
    normalized.includes(normalize("pişman")) ||
    normalized.includes(normalize("affeder mi")) ||
    normalized.includes(normalize("günah"))
  ) {
    return "Tövbe; pişmanlık, günahı bırakma ve yeniden dönmemeye niyet etmektir.";
  }

  if (
    normalized.includes(normalize("yalnız")) ||
    normalized.includes(normalize("yalniz")) ||
    normalized.includes(normalize("korku")) ||
    normalized.includes(normalize("korkuyorum")) ||
    normalized.includes(normalize("endişe")) ||
    normalized.includes(normalize("endise"))
  ) {
    return "Bu soru daha çok kalbi sakinleştiren manevi destekle ilgilidir.";
  }

  return "Bu konu daha çok manevi destekle ilgilidir.";
}

function resolveLocalFastPathPlan(message, history, baseAnalysis, options = {}) {
  const moduleMode = normalizeModuleMode(options.module);
  const normalizedMessage = normalize(message);
  const shortGreetingSignals = [
    "selam",
    "merhaba",
    "nasılsın",
    "nasilsin",
    "iyi misin",
    "günaydın",
    "gunaydin",
    "iyi akşamlar",
    "iyi aksamlar",
  ];
  const emotionalGuidanceSignals = [
    "korku",
    "korkuyorum",
    "çok korkuyorum",
    "cok korkuyorum",
    "endişe",
    "endise",
    "kaygı",
    "kaygi",
    "gelecek için endişeliyim",
    "gelecek icin endiseliyim",
    "maddi sıkıntı",
    "maddi sikinti",
    "maddi sıkıntı yaşıyorum",
    "maddi sikinti yasiyorum",
    "haksızlık",
    "haksizlik",
    "haksızlığa uğradım",
    "haksizliga ugradim",
    "zulüm",
    "zulum",
    "yalnız",
    "yalniz",
    "çok yalnız hissediyorum",
    "cok yalniz hissediyorum",
    "yalnız hissediyorum",
    "yalniz hissediyorum",
    "hasta",
    "hastayım",
    "hastayim",
    "şifa",
    "sifa",
    "ölüm",
    "olum",
    "sabır",
    "sabir",
    "sabretmekte zorlanıyorum",
    "sabretmekte zorlaniyorum",
    "içim daralıyor",
    "icim daraliyor",
    "içim sıkılıyor",
    "icim sikiliyor",
    "üzgün",
    "üzgünüm",
    "mutsuz",
    "mutsuzum",
    "pişman",
    "pisman",
    "pişmanım",
    "pismanim",
    "tövbe",
    "tovbe",
    "tevbe",
    "günah",
    "gunah",
    "affeder mi",
    "bağışlar mı",
    "bagislar mi",
    "bağışlanır mı",
    "bagislanir mi",
  ];
  const guidanceSignals = [
    "korku",
    "korkuyorum",
    "çok korkuyorum",
    "cok korkuyorum",
    "endişe",
    "endise",
    "kaygı",
    "kaygi",
    "gelecek için endişeliyim",
    "gelecek icin endiseliyim",
    "maddi sıkıntı",
    "maddi sikinti",
    "maddi sıkıntı yaşıyorum",
    "maddi sikinti yasiyorum",
    "haksızlık",
    "haksizlik",
    "haksızlığa uğradım",
    "haksizliga ugradim",
    "zulüm",
    "zulum",
    "yalnız",
    "yalniz",
    "çok yalnız hissediyorum",
    "cok yalniz hissediyorum",
    "yalnız hissediyorum",
    "yalniz hissediyorum",
    "hasta",
    "hastayım",
    "hastayim",
    "şifa",
    "sifa",
    "ölüm",
    "olum",
    "sabır",
    "sabir",
    "sabretmekte zorlanıyorum",
    "sabretmekte zorlaniyorum",
    "içim daralıyor",
    "icim daraliyor",
    "içim sıkılıyor",
    "icim sikiliyor",
    "üzgün",
    "üzgünüm",
    "mutsuz",
    "mutsuzum",
  ];

  if (shortGreetingSignals.some((signal) => normalizedMessage === normalize(signal))) {
    return {
      intent: "casual_conversation",
      sub_intent: "casual_conversation",
      needs_ayah: false,
      needs_knowledge: false,
      knowledge_topic: null,
      ayah_topic: null,
      response_type: "direct_answer",
      reasoning_note: "local fast path: casual conversation",
      planner_source: "local_fast_path",
    };
  }

  if (moduleMode !== "ayah" && !isPrayerRakatsQuestion(message)) {
    const localKnowledgeResult = lookupKnowledgeAnswer(message, baseAnalysis, null, history);
    if (localKnowledgeResult) {
      return {
        intent: baseAnalysis.intent === "worship_practice_question" ? "worship_practice_question" : "general_islamic_question",
        sub_intent: "general_information",
        needs_ayah: false,
        needs_knowledge: true,
        knowledge_topic: localKnowledgeResult.topic || baseAnalysis.context_topic || null,
        ayah_topic: null,
        response_type: "direct_answer",
        reasoning_note: "local fast path: ilmihal knowledge",
        planner_source: "local_fast_path",
      };
    }
  }

  const overrideTopic = resolveCurrentMessageOverrideTopic(message);
  const explicitTopic = resolveExplicitTopic(message);
  const hasEmotionalGuidanceSignal = containsAnyRaw(message, emotionalGuidanceSignals);
  if (hasEmotionalGuidanceSignal) {
    const topic = canonicalTopic(overrideTopic || explicitTopic || baseAnalysis.context_topic || baseAnalysis.primary_theme || null);
    const explicitAyahRequest = isExplicitAyahRequest(message, baseAnalysis, null, null) ||
      normalizedMessage.includes(normalize("ayet"));
    const intent = baseAnalysis.intent === "high_risk_sensitive"
      ? "high_risk_sensitive"
      : "emotional_spiritual_support";
    const responseType = explicitAyahRequest
      ? "direct_ayah"
      : baseAnalysis.intent === "high_risk_sensitive"
        ? "sensitive_support"
        : "supportive_ayah";
    return {
      intent: explicitAyahRequest ? "ayah_request" : intent,
      sub_intent: explicitAyahRequest ? "ayah_request" : "emotional_support",
      needs_ayah: true,
      needs_knowledge: false,
      knowledge_topic: null,
      ayah_topic: topic,
      response_type: responseType,
      reasoning_note: "local fast path: quran guidance",
      planner_source: "local_fast_path",
    };
  }

  const shouldUseGuidanceFastPath =
    Boolean(overrideTopic || explicitTopic || containsAnyNormalized(normalizedMessage, guidanceSignals));

  if (shouldUseGuidanceFastPath) {
    const topic = canonicalTopic(overrideTopic || explicitTopic || baseAnalysis.context_topic || baseAnalysis.primary_theme || null);
    const explicitAyahRequest = isExplicitAyahRequest(message, baseAnalysis, null, null) ||
      normalizedMessage.includes(normalize("ayet"));
    const responseType = explicitAyahRequest
      ? "direct_ayah"
      : baseAnalysis.intent === "high_risk_sensitive"
        ? "sensitive_support"
        : baseAnalysis.intent === "emotional_spiritual_support"
          ? "supportive_ayah"
          : "direct_ayah";
    return {
      intent: explicitAyahRequest ? "ayah_request" : (baseAnalysis.intent || "emotional_spiritual_support"),
      sub_intent: explicitAyahRequest ? "ayah_request" : (baseAnalysis.sub_intent || inferSubIntent(message, baseAnalysis)),
      needs_ayah: true,
      needs_knowledge: false,
      knowledge_topic: null,
      ayah_topic: topic,
      response_type: responseType,
      reasoning_note: "local fast path: quran guidance",
      planner_source: "local_fast_path",
    };
  }

  if (isSimpleCasualConversation(message)) {
    return {
      intent: "casual_conversation",
      sub_intent: "casual_conversation",
      needs_ayah: false,
      needs_knowledge: false,
      knowledge_topic: null,
      ayah_topic: null,
      response_type: "direct_answer",
      reasoning_note: "local fast path: casual conversation",
      planner_source: "local_fast_path",
    };
  }

  return null;
}

function isIlmihalModuleQuestion(message, analysis = {}, history = []) {
  if (hasKnowledgeMatch(message, analysis, null, history)) {
    return true;
  }
  return (
    isLocalKnowledgeQuery(message, analysis, null, history) ||
    isPrayerRakatsQuestion(message) ||
    analysis.intent === "worship_practice_question"
  );
}

function buildModuleRedirectResponse(module, message, baseAnalysis, timing, targetModule, redirectContextNote = null, preRouteStage = null) {
  const response_type = "direct_answer";
  const effectiveRedirectContextNote = redirectContextNote || (
    targetModule === "ayah" && isRepentanceRedirectMessage(message)
      ? "Tövbe; pişmanlık, günahı bırakma ve yeniden dönmemeye niyet etmektir."
      : null
  );
  const route_mode = effectiveRedirectContextNote && targetModule === "ayah"
    ? "quran_guidance_redirect"
    : targetModule === "ilmihal"
      ? "ilmihal_knowledge"
      : "quran_guidance";
  const redirectNote = typeof effectiveRedirectContextNote === "string" && effectiveRedirectContextNote.trim()
    ? effectiveRedirectContextNote.trim()
    : null;
  const assistant_text =
    redirectNote && targetModule === "ayah"
      ? `${redirectNote}\n\nBu konuda kalbine eşlik edecek Kur’an merkezli kısa bir rehberlik için Ayet Rehberi bölümünü kullanabilirsin.`
      : targetModule === "ilmihal"
        ? "Bu konu Dinî Bilgiler bölümünde daha pratik ve ölçülü biçimde ele alınabilir."
        : "Bu konu Ayet Rehberi bölümünde Kur’an merkezli rehberlikle daha iyi ele alınabilir.";
  const responsePreview = isDebugChatEngineEnabled() ? assistant_text.slice(0, 800) : null;
  const decision_meta = {
    module,
    route_mode,
    planner_source: "local_fast_path",
    pre_route_stage: preRouteStage || (redirectNote ? "emotional_redirect" : null),
    knowledge_hit_id: null,
    ranker_source: "fallback",
    semantic_candidates_count: 0,
    semantic_tags_considered: [],
    semantic_score: 0,
    selected_ayah_id: null,
    timing_ms: normalizeTimingBreakdown(timing?.snapshot ? timing.snapshot() : null),
    ...(responsePreview ? { response_preview: responsePreview } : {}),
  };

  return applySafetyGuard({
    ...baseAnalysis,
    response_type,
    ayah_used: false,
    top_ayah_ids: [],
    selected_ayah: null,
    decision_meta,
    assistant_text,
    redirect_module: targetModule,
    ...(redirectNote ? { redirect_context_note: redirectNote } : {}),
  });
}

function buildIlmihalModuleResponse(message, history, baseAnalysis, timing, preRouteStage = null) {
  const knowledgeResult = timing.measureSync("knowledge_router_ms", () =>
    lookupKnowledgeAnswer(message, baseAnalysis, null, history)
  );

  if (!knowledgeResult) {
    return buildModuleRedirectResponse("ilmihal", message, baseAnalysis, timing, "ayah");
  }

  const subIntent = resolveSubIntent(message, baseAnalysis, null);
  const responseStrategy = responseStrategyForSubIntent(subIntent);
  const analysis = {
    ...baseAnalysis,
    response_type: "direct_answer",
  };
  const assistantText = timing.measureSync("response_composer_ms", () =>
    buildAssistantText(analysis, null, message, {
      subIntent,
      responseStrategy,
      knowledgeResult,
      knowledgeTopic: knowledgeResult.topic || null,
      recent_assistant_texts: recentAssistantTextsFromHistory(history),
    })
  );
  const responsePreview = isDebugChatEngineEnabled() ? assistantText.slice(0, 800) : null;
  const decisionMeta = buildDecisionMeta(
    [],
    {
      responseType: "direct_answer",
      ayahUsed: false,
      selectedAyah: null,
      topAyahIds: [],
    },
    false,
    knowledgeResult.route_mode || "ilmihal_knowledge",
    knowledgeResult,
    timing.snapshot(),
    "local_fast_path",
    "ilmihal",
    responsePreview,
    null,
    preRouteStage || null
  );

  return applySafetyGuard({
    ...analysis,
    response_type: "direct_answer",
    ayah_used: false,
    top_ayah_ids: [],
    selected_ayah: null,
    decision_meta: decisionMeta,
    assistant_text: assistantText,
  });
}

function buildCasualConversationResponse(message, history, baseAnalysis, timing, moduleMode = "chat") {
  const routeMode = moduleMode === "ilmihal" ? "casual_conversation" : "quran_guidance";
  const analysis = {
    ...baseAnalysis,
    intent: "casual_conversation",
    sub_intent: "casual_conversation",
    response_type: "direct_answer",
    primary_theme: "casual",
    context_topic: "casual",
    emotion: baseAnalysis.emotion || "sakin",
    severity: baseAnalysis.severity || "low",
  };
  const assistantText = timing.measureSync("response_composer_ms", () =>
    buildAssistantText(analysis, null, message, {
      subIntent: "casual_conversation",
      responseStrategy: responseStrategyForSubIntent("casual_conversation"),
      recent_assistant_texts: recentAssistantTextsFromHistory(history),
    })
  );
  const moduleGreeting =
    moduleMode === "ilmihal"
      ? "Merhaba, Dinî Bilgiler bölümündeyim. Namaz, ibadet, helal-haram ve günlük dinî konularda soru sorabilirsin."
      : assistantText;
  const responsePreview = isDebugChatEngineEnabled() ? moduleGreeting.slice(0, 800) : null;
  const decisionMeta = buildDecisionMeta(
    [],
    {
      responseType: "direct_answer",
      ayahUsed: false,
      selectedAyah: null,
      topAyahIds: [],
    },
    false,
    routeMode,
    null,
    timing.snapshot(),
    "local_fast_path",
    moduleMode,
    responsePreview,
    "casual_greeting"
  );

  return applySafetyGuard({
    ...analysis,
    response_type: "direct_answer",
    ayah_used: false,
    top_ayah_ids: [],
    selected_ayah: null,
    decision_meta: decisionMeta,
    assistant_text: moduleGreeting,
  });
}

async function buildChatResponse(message, history = [], options = {}) {
  const moduleMode = normalizeModuleMode(options.module);
  const timing = createTimingTracker();
  const forceIlmihalKnowledge = options.forceIlmihalKnowledge === true;
  if (isPureGreetingMessage(message)) {
    const baseAnalysis = timing.measureSync("context_resolver_ms", () =>
      analyzeUserMessageFallback(message, history)
    );
    return buildCasualConversationResponse(message, history, baseAnalysis, timing, moduleMode);
  }

  const normalizedMessageForRepentance = normalize(message);
  if (
    moduleMode === "ilmihal" &&
    !forceIlmihalKnowledge &&
    (
      normalizedMessageForRepentance.includes(normalize("\u00e7ok pi\u015fman\u0131m")) ||
      normalizedMessageForRepentance.includes(normalize("pi\u015fman\u0131m")) ||
      normalizedMessageForRepentance.includes(normalize("pi\u015fman"))
    )
  ) {
    const baseAnalysis = timing.measureSync("context_resolver_ms", () =>
      analyzeUserMessageFallback(message, history)
    );
    return buildModuleRedirectResponse(
      "ilmihal",
      message,
      baseAnalysis,
      timing,
      "ayah",
      "T\u00f6vbe; pi\u015fmanl\u0131k, g\u00fcnah\u0131 b\u0131rakma ve yeniden d\u00f6nmemeye niyet etmektir.",
      "emotional_redirect"
    );
  }

  const preModuleDecision = timing.measureSync("knowledge_router_ms", () => resolvePreModuleDecision(message, history, moduleMode));
  const preRouteStage = preModuleDecision?.pre_route_stage || null;
  if (preModuleDecision?.module === "ayah" && moduleMode !== "ayah") {
    const baseAnalysis = timing.measureSync("context_resolver_ms", () =>
      analyzeUserMessageFallback(message, history)
    );
    const redirectContextNote = moduleMode === "ilmihal"
      ? buildRedirectContextNote(message, baseAnalysis)
      : null;
    return buildModuleRedirectResponse(moduleMode, message, baseAnalysis, timing, "ayah", redirectContextNote, preRouteStage || "emotional_redirect");
  }
  if (preModuleDecision?.module === "ilmihal" && moduleMode !== "ayah") {
    const baseAnalysis = timing.measureSync("context_resolver_ms", () =>
      analyzeUserMessageFallback(message, history)
    );
    return buildIlmihalModuleResponse(message, history, baseAnalysis, timing, preModuleDecision.pre_route_stage || preModuleDecision.reason || null);
  }

  const baseAnalysis = timing.measureSync("context_resolver_ms", () =>
    analyzeUserMessageFallback(message, history)
  );
  if (moduleMode === "ilmihal" && !forceIlmihalKnowledge) {
    if (!isIlmihalModuleQuestion(message, baseAnalysis, history)) {
      const redirectContextNote = isRepentanceRedirectMessage(message)
        ? "Tövbe; pişmanlık, günahı bırakma ve yeniden dönmemeye niyet etmektir."
        : null;
      return buildModuleRedirectResponse(
        "ilmihal",
        message,
        baseAnalysis,
        timing,
        "ayah",
        redirectContextNote,
        redirectContextNote ? "emotional_redirect" : null
      );
    }
    return buildIlmihalModuleResponse(message, history, baseAnalysis, timing);
  }
  if (moduleMode === "ilmihal" && forceIlmihalKnowledge) {
    return buildIlmihalModuleResponse(message, history, baseAnalysis, timing);
  }
  if (moduleMode === "ayah" && isIlmihalModuleQuestion(message, baseAnalysis, history)) {
    return buildModuleRedirectResponse("ayah", message, baseAnalysis, timing, "ilmihal");
  }
  const localFastPathPlan = timing.measureSync("context_resolver_ms", () =>
    resolveLocalFastPathPlan(message, history, baseAnalysis, { module: moduleMode })
  );
  const plannerResult = localFastPathPlan
    ? localFastPathPlan
    : await timing.measureAsync("intent_planner_ms", () => planChatWithOpenAI(message, history));
  const mergedAnalysis = timing.measureSync("context_resolver_ms", () =>
    mergePlannerIntoAnalysis(baseAnalysis, plannerResult, message)
  );
  const plannerDebugMeta = localFastPathPlan
    ? { planner_source: "local_fast_path" }
    : getPlannerDebugMeta();
  const shouldForceStructuredAyahIntent = timing.measureSync("context_resolver_ms", () =>
    shouldForceExplicitTopicAyahIntent(message, mergedAnalysis, plannerResult)
  );
  const normalizedMergedAnalysis = shouldForceStructuredAyahIntent
    ? timing.measureSync("context_resolver_ms", () => ({
        ...mergedAnalysis,
        intent: "ayah_request",
        response_type: "direct_ayah",
      }))
    : mergedAnalysis;
  const shouldForceCasualConversation = timing.measureSync("context_resolver_ms", () =>
    isSimpleCasualConversation(message) &&
    !hasEmotionalGuidanceSignal(message) &&
    !isExplicitAyahRequest(message, normalizedMergedAnalysis, null, plannerResult)
  );
  const analysis = shouldForceCasualConversation
    ? timing.measureSync("context_resolver_ms", () => ({
        ...normalizedMergedAnalysis,
        intent: "casual_conversation",
        response_type: "direct_answer",
        primary_theme: "casual",
        context_topic: "casual",
        emotion: normalizedMergedAnalysis.emotion || "sakin",
        severity: normalizedMergedAnalysis.severity || "low",
      }))
    : normalizedMergedAnalysis;

  const allowKnowledgeRouting = moduleMode !== "ayah";
  const localKnowledgeIntent = allowKnowledgeRouting
    ? timing.measureSync("knowledge_router_ms", () =>
        isLocalKnowledgeQuery(message, analysis, plannerResult, history)
      )
    : false;
  const knowledgeIntentQuestion = allowKnowledgeRouting
    ? timing.measureSync("knowledge_router_ms", () =>
        isKnowledgeIntentQuestion(message, analysis, plannerResult, history)
      )
    : false;

  const subIntent = resolveSubIntent(message, analysis, plannerResult);
  const responseStrategy = responseStrategyForSubIntent(subIntent);
  const isCasualConversation = analysis.intent === "casual_conversation";
  const explicitAyahRequest = isExplicitAyahRequest(message, analysis, subIntent, plannerResult);
  const shouldUseAyah = localKnowledgeIntent
    ? false
    : shouldUseAyahForRouting(message, analysis, subIntent, plannerResult);
  const knowledgeResult = allowKnowledgeRouting && !isCasualConversation
    ? timing.measureSync("knowledge_router_ms", () =>
        shouldLookupKnowledge(message, analysis, subIntent, plannerResult)
          ? lookupKnowledgeAnswer(message, analysis, plannerResult, history)
          : null
      )
    : null;
  const routeMode = knowledgeResult && knowledgeResult.knowledge_hit_id
    ? knowledgeResult.route_mode || "ilmihal_knowledge"
    : "quran_guidance";
  const shouldBypassAyahSelection = Boolean(knowledgeResult) && !explicitAyahRequest;
  const topicConstraint = plannerAyahTopicConstraint(message, analysis, plannerResult);
  const previouslyUsedAyahIds = previouslyUsedAyahIdsFromHistory(history);
  const rankingResult = shouldUseAyah && !shouldBypassAyahSelection
    ? timing.measureSync("ayah_ranker_ms", () =>
        rankAyahs(analysis, ayahs, {
          previously_used_ayah_ids: previouslyUsedAyahIds,
          history,
          current_message: message,
          preferred_topic: plannerPreferredTopic(message, plannerResult),
          topic_constraint: topicConstraint,
          force_topic_match: plannerResult?.needs_ayah === true && Boolean(topicConstraint),
          explicit_ayah_request: explicitAyahRequest,
          planner_response_type: plannerResult?.response_type || null,
        })
      )
    : [];
  const rankedAyahs = Array.isArray(rankingResult)
    ? rankingResult
    : rankingResult.ayahs || [];
  const topRankedAyah = shouldUseAyah && !shouldBypassAyahSelection ? rankedAyahs[0] || null : null;
  const knowledgeDrivenAnswer = allowKnowledgeRouting &&
    (Boolean(knowledgeResult) || localKnowledgeIntent || knowledgeIntentQuestion) &&
    !explicitAyahRequest &&
    !normalize(message).includes(normalize("ayet"));
  const ayahUsed = knowledgeDrivenAnswer ? false : resolveAyahUsage(message, analysis, rankedAyahs, topRankedAyah);
  const selectedAyah = ayahUsed ? stripRankingFields(topRankedAyah) : null;
  const knowledgeOnlyResponse =
    allowKnowledgeRouting &&
    Boolean(knowledgeResult) &&
    ["wudu.json", "prophets.json", "dua.json"].includes(knowledgeResult.file) &&
    !explicitAyahRequest &&
    !normalize(message).includes(normalize("ayet"));
  const forceKnowledgeOnlyReply =
    !explicitAyahRequest &&
    normalize(message).includes(normalize("tÃ¶vbe nasÄ±l edilir"));
  const finalResponseType = (knowledgeDrivenAnswer || knowledgeOnlyResponse)
    || forceKnowledgeOnlyReply
    ? "direct_answer"
    : resolveFinalResponseType(message, analysis, subIntent, ayahUsed, plannerResult);
  const normalizedFinalResponseType =
    routeMode === "quran_guidance" &&
    ayahUsed &&
    analysis.intent === "emotional_spiritual_support" &&
    finalResponseType === "direct_answer"
      ? "supportive_ayah"
      : finalResponseType;
  const shouldForceAyahStyle = shouldForceAyahStyleResponse(
    explicitAyahRequest,
    normalizedFinalResponseType,
    ayahUsed
  );
  const effectiveKnowledgeResult = shouldForceAyahStyle || explicitAyahRequest ? null : knowledgeResult;
  const finalSelectedAyah =
    ayahUsed &&
    (normalizedFinalResponseType !== "direct_answer" || explicitAyahRequest || routeMode === "quran_guidance")
      ? selectedAyah
      : null;
  const finalTopAyahIds =
    ayahUsed &&
    (normalizedFinalResponseType !== "direct_answer" || explicitAyahRequest || routeMode === "quran_guidance")
      ? rankedAyahs.map((ayah) => ayah.id)
      : [];
  const consistencyGuard = enforceFinalPayloadConsistency({
    responseType: normalizedFinalResponseType,
    ayahUsed,
    selectedAyah: finalSelectedAyah,
    topAyahIds: finalTopAyahIds,
    knowledgeDrivenAnswer,
    routeMode,
  });
  const assistantText = timing.measureSync("response_composer_ms", () =>
    buildAssistantText(
      {
        ...analysis,
        response_type: consistencyGuard.responseType,
      },
      selectedAyah,
      message,
      {
        subIntent,
        responseStrategy,
        knowledgeResult: effectiveKnowledgeResult,
        knowledgeTopic: plannerResult?.knowledge_topic || null,
        recent_assistant_texts: recentAssistantTextsFromHistory(history),
      }
    )
  );
  const responsePreview = isDebugChatEngineEnabled() ? assistantText.slice(0, 800) : null;
  const decisionMeta = buildDecisionMeta(
    rankedAyahs,
    consistencyGuard,
    ayahUsed,
    routeMode,
    knowledgeResult,
    timing.snapshot(),
    plannerDebugMeta.planner_source || "fallback",
    moduleMode,
    responsePreview,
    preRouteStage
  );
  return applySafetyGuard({
    ...analysis,
    response_type: consistencyGuard.responseType,
    ayah_used: consistencyGuard.ayahUsed,
    top_ayah_ids: consistencyGuard.topAyahIds,
    selected_ayah: consistencyGuard.selectedAyah,
    decision_meta: decisionMeta,
    assistant_text: assistantText,
  });
}

function buildDecisionMeta(
  rankedAyahs,
  consistencyGuard,
  ayahUsed,
  routeMode,
  knowledgeResult,
  timingMs = null,
  plannerSource = "fallback",
  module = "chat",
  responsePreview = null,
  preRouteStage = null
) {
  const top = Array.isArray(rankedAyahs) && rankedAyahs.length > 0 ? rankedAyahs[0] : null;
  const topDebug = top?.debug || {};
  const inferredPreRouteStage =
    preRouteStage ||
    (knowledgeResult?.matched_by === "semantic"
      ? "semantic"
      : knowledgeResult?.knowledge_hit_id
        ? (typeof knowledgeResult?.semantic_match_score === "number" && knowledgeResult.semantic_match_score > 0
            ? "semantic"
            : "alias")
        : null);
  return {
    route_mode: knowledgeResult?.knowledge_hit_id ? routeMode || "ilmihal_knowledge" : routeMode,
    knowledge_hit_id: knowledgeResult?.knowledge_hit_id || null,
    planner_source: plannerSource || "fallback",
    module,
    pre_route_stage: inferredPreRouteStage,
    semantic_match_score:
      typeof knowledgeResult?.semantic_match_score === "number" ? knowledgeResult.semantic_match_score : 0,
    semantic_matched_topic: knowledgeResult?.semantic_matched_topic || null,
    semantic_confidence: knowledgeResult?.semantic_confidence || null,
    ranker_source:
      top?.ranker_source ||
      topDebug.ranker_source ||
      (topDebug.semantic_score > 0 && Number.isInteger(topDebug.semantic_candidates_count) && topDebug.semantic_candidates_count > 0
        ? "semantic"
        : "fallback"),
    semantic_candidates_count: Number.isInteger(topDebug.semantic_candidates_count)
      ? topDebug.semantic_candidates_count
      : 0,
    semantic_tags_considered: Array.isArray(topDebug.semantic_tags_considered)
      ? topDebug.semantic_tags_considered
      : [],
    semantic_score: typeof topDebug.semantic_score === "number" ? topDebug.semantic_score : 0,
    selected_ayah_id: consistencyGuard.selectedAyah ? consistencyGuard.selectedAyah.id : null,
    timing_ms: normalizeTimingBreakdown(timingMs),
    ...(responsePreview ? { response_preview: responsePreview.slice(0, 800) } : {}),
  };
}

module.exports = {
  buildChatResponse,
  analyzeUserMessage,
  rankAyahs,
};

function rankAyahs(messageAnalysis, sourceAyahs = ayahs, options = {}) {
  return rankAyahsFromSource(messageAnalysis, sourceAyahs, options);
}

function shouldLookupKnowledge(message, analysis, subIntent, plannerResult) {
  if (analysis.intent === "casual_conversation") {
    return plannerResult?.needs_knowledge === true;
  }
  if (plannerResult?.needs_knowledge === true) return true;
  if (hasKnowledgeMatch(message, analysis, plannerResult)) return true;
  if (isKnowledgeIntentQuestion(message) || isLocalKnowledgeQuery(message)) return true;
  if (analysis.intent === "worship_practice_question") return true;
  return ["practical_guidance", "zikir_request", "dua_request"].includes(subIntent);
}

function shouldUseAyahForRouting(message, analysis, subIntent, plannerResult) {
  const explicitAyahRequest = isExplicitAyahRequest(message, analysis, subIntent, plannerResult);
  const explicitTopic = resolveExplicitTopic(message);
  const forceableTopicAyahRequest = isForceableTopicAyahRequest(message);
  if ((explicitAyahRequest && explicitTopic) || forceableTopicAyahRequest) return true;
  if (analysis.intent === "high_risk_sensitive") return false;
  if (explicitAyahRequest) return true;
  if (looksLikeFactualPracticeQuestion(message)) return false;
  if (analysis.intent === "casual_conversation") return false;
  if (plannerResult?.needs_ayah === true) return true;
  if (plannerResult?.needs_ayah === false && plannerResult?.needs_knowledge === true) return false;
  if (["dua_request", "zikir_request", "practical_guidance"].includes(subIntent)) {
    return false;
  }
  if (looksLikeGeneralIslamicQuestion(message, analysis)) return true;
  if (analysis.intent === "general_islamic_question") return true;
  if (subIntent === "ayah_request") return true;
  if (subIntent === "emotional_support") return shouldUseAyahFor(analysis);
  return false;
}

function resolveAyahUsage(message, analysis, rankedAyahs, topRankedAyah) {
  if (!topRankedAyah) return false;
  if (looksLikeFactualPracticeQuestion(message)) return false;
  if (analysis.intent === "emotional_spiritual_support") return true;
  if (looksLikeGeneralIslamicQuestion(message, analysis)) {
    return shouldAttachAyahForGeneralQuestion(analysis, rankedAyahs);
  }
  if (analysis.intent === "general_islamic_question") {
    return shouldAttachAyahForGeneralQuestion(analysis, rankedAyahs);
  }
  return true;
}

function shouldAttachAyahForGeneralQuestion(analysis, rankedAyahs) {
  if (!Array.isArray(rankedAyahs) || rankedAyahs.length === 0) return false;

  const top = rankedAyahs[0];
  if (!top) return false;

  if (typeof top.final_score === "number" && top.final_score >= 120) {
    return true;
  }

  const strongThemes = new Set(["dua", "zikir", "sabÄ±r", "tevekkÃ¼l", "korku", "imtihan"]);
  return strongThemes.has(normalizeThemeKey(analysis.primary_theme));
}

function normalizeThemeKey(theme) {
  return String(theme || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC");
}

function stripRankingFields(ayah) {
  if (!ayah) return null;
  const {
    final_score,
    ranker_source,
    semantic_candidates_count,
    semantic_tags_considered,
    semantic_score,
    debug,
    ...plainAyah
  } = ayah;
  return plainAyah;
}

function resolveFinalResponseType(message, analysis, subIntent, ayahUsed, plannerResult) {
  const explicitAyahRequest = isExplicitAyahRequest(message, analysis, subIntent, plannerResult);
  const explicitTopic = resolveExplicitTopic(message);
  const forceableTopicAyahRequest = isForceableTopicAyahRequest(message);
  if (((explicitAyahRequest && explicitTopic) || forceableTopicAyahRequest) && ayahUsed) {
    return "direct_ayah";
  }
  if (analysis.intent === "high_risk_sensitive") return "sensitive_support";
  if (explicitAyahRequest && ayahUsed) {
    return "direct_ayah";
  }
  if ((isKnowledgeIntentQuestion(message) || isLocalKnowledgeQuery(message)) && !explicitAyahRequest) {
    return "direct_answer";
  }
  if (analysis.intent === "casual_conversation") return "direct_answer";
  if (analysis.intent === "worship_practice_question" && !ayahUsed) return "direct_answer";
  if (
    plannerResult?.response_type &&
    isPlannerResponseTypeAllowed(plannerResult.response_type, analysis, subIntent, ayahUsed)
  ) {
    return plannerResult.response_type;
  }
  if (subIntent === "dua_request") return "dua_guidance";
  if (subIntent === "zikir_request" || subIntent === "practical_guidance") {
    return "practice_suggestion";
  }
  if (looksLikeFactualPracticeQuestion(message)) {
    return "direct_answer";
  }
  if (looksLikeGeneralIslamicQuestion(message, analysis) && ayahUsed) {
    return "explanation_with_ayah";
  }
  if (looksLikeGeneralIslamicQuestion(message, analysis) && !ayahUsed) {
    return "direct_answer";
  }
  if (analysis.intent === "ayah_request" && ayahUsed) return "direct_ayah";
  if (analysis.intent === "emotional_spiritual_support" && ayahUsed) {
    return "supportive_ayah";
  }
  if (analysis.intent === "general_islamic_question" && ayahUsed) {
    return "explanation_with_ayah";
  }
  return analysis.response_type;
}

function looksLikeGeneralIslamicQuestion(message, analysis) {
  if (analysis.intent === "general_islamic_question") return true;
  const normalizedMessage = normalize(message);
  const signals = [
    "sevap mÄ±",
    "sevap mi",
    "gerekli mi",
    "farz mÄ±",
    "farz mi",
    "ne demek",
    "nedir",
    "neden Ã¶nemli",
    "olur mu",
    "kaÃ§",
    "rekÃ¢t",
    "rekat",
  ];
  return signals.some((signal) => normalizedMessage.includes(normalize(signal)));
}

function looksLikeFactualPracticeQuestion(message) {
  const normalizedMessage = normalize(message);
  const factualSignals = [
    "kaÃ§ rekÃ¢t",
    "kaÃ§ rekat",
    "kaÃ§",
    "rekÃ¢t",
    "rekat",
    "nasÄ±l kÄ±lÄ±nÄ±r",
    "kaÃ§ farz",
    "kaÃ§ sÃ¼nnet",
    "kaÃ§ sunnet",
  ];
  const practiceSignals = ["namaz", "abdest", "oruÃ§", "ezan"];
  return (
    factualSignals.some((signal) => normalizedMessage.includes(normalize(signal))) &&
    practiceSignals.some((signal) => normalizedMessage.includes(normalize(signal)))
  );
}

function buildSelectedReason({
  shouldUseAyah,
  selectedAyah,
  responseStrategy,
  analysis,
  ayahUsed,
}) {
  if (!shouldUseAyah) {
    return `ayah_skipped_for_${responseStrategy}`;
  }
  if (analysis.intent === "general_islamic_question" && !ayahUsed) {
    return "general_question_ayah_not_attached";
  }
  if (selectedAyah) {
    return "top_ranked_ayah_selected";
  }
  return "no_ranked_ayah_available";
}

function previouslyUsedAyahIdsFromHistory(history) {
  if (!Array.isArray(history)) return [];
  return [
    ...new Set(
      history
        .map((item) => item?.selected_ayah_id)
        .map((item) => (typeof item === "number" ? item : Number.parseInt(item, 10)))
        .filter((item) => Number.isInteger(item) && item > 0)
    ),
  ];
}

function recentAssistantTextsFromHistory(history, count = 2) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && item.role === "assistant" && typeof item.text === "string")
    .map((item) => item.text.trim())
    .filter(Boolean)
    .slice(-count);
}

function mergePlannerIntoAnalysis(baseAnalysis, plannerResult, message) {
  if (!plannerResult) {
    return baseAnalysis;
  }

  const explicitTopic = detectStrongExplicitTopic(message);
  const preferredTopic = plannerResult.ayah_topic || plannerResult.knowledge_topic || null;
  const shouldPreferPlannerTopic =
    preferredTopic &&
    !explicitTopic &&
    isWeakContextTopic(baseAnalysis.context_topic);
  const contextTopic = explicitTopic || (shouldPreferPlannerTopic ? preferredTopic : baseAnalysis.context_topic);
  const primaryTheme = contextTopic
    ? themeForContextTopic(contextTopic) || baseAnalysis.primary_theme
    : baseAnalysis.primary_theme;
  const secondaryThemes = contextTopic
    ? secondaryThemesForContextTopic(contextTopic)
    : baseAnalysis.secondary_themes;
  const nextIntent = shouldKeepHighRiskIntent(baseAnalysis, plannerResult)
    ? "high_risk_sensitive"
    : (plannerResult.intent || baseAnalysis.intent);

  return {
    ...baseAnalysis,
    intent: nextIntent,
    primary_theme: primaryTheme || baseAnalysis.primary_theme,
    secondary_themes: Array.isArray(secondaryThemes) && secondaryThemes.length
      ? secondaryThemes
      : baseAnalysis.secondary_themes,
    response_type: plannerResult.response_type || baseAnalysis.response_type,
    context_topic: contextTopic || baseAnalysis.context_topic,
  };
}

function resolveSubIntent(message, analysis, plannerResult) {
  if (isExplicitAyahRequest(message, analysis, null, plannerResult)) {
    return "ayah_request";
  }
  if (analysis.intent === "casual_conversation") {
    return "casual_conversation";
  }
  if (plannerResult?.sub_intent) {
    if (plannerResult.sub_intent === "emotional_support" && looksLikeFactualPracticeQuestion(message)) {
      return inferSubIntent(message, analysis);
    }
    return plannerResult.sub_intent;
  }
  return inferSubIntent(message, analysis);
}

function plannerPreferredTopic(message, plannerResult) {
  if (!plannerResult) return null;
  if (resolveExplicitTopic(message)) return null;
  return canonicalTopic(plannerResult.ayah_topic || plannerResult.knowledge_topic || null);
}

function detectStrongExplicitTopic(message) {
  return detectExplicitTopic(message);
}

function resolveExplicitTopic(message) {
  return canonicalTopic(message) || detectStrongExplicitTopic(message);
}

function plannerAyahTopicConstraint(message, analysis, plannerResult) {
  if (plannerResult?.needs_ayah !== true) return null;

  return (
    resolveExplicitTopic(message) ||
    canonicalTopic(plannerResult?.ayah_topic) ||
    canonicalTopic(analysis?.context_topic) ||
    canonicalTopic(analysis?.primary_theme)
  );
}

function isWeakContextTopic(topic) {
  if (!topic) return true;
  const normalizedTopic = normalize(topic);
  return normalizedTopic === normalize("ibadet");
}

function isExplicitAyahRequest(message, analysis, subIntent, plannerResult) {
  const normalizedMessage = normalize(message);
  const explicitTopic = resolveExplicitTopic(message);
  const quranTopicSignals = [
    "kuran'da ne geÃ§iyor",
    "kuranda ne geciyor",
    "kuran'da ne var",
    "kuranda ne var",
    "kuran'dan bir ÅŸey sÃ¶yle",
    "kurandan bir sey soyle",
    "ayet gÃ¶ster",
    "ayet goster",
    "ayet paylaÅŸ",
    "ayet paylas",
    "ayet Ã¶ner",
    "ayet oner",
    "ayet isterim",
  ];
  return (
    subIntent === "ayah_request" ||
    analysis?.intent === "ayah_request" ||
    plannerResult?.sub_intent === "ayah_request" ||
    (plannerResult?.response_type === "direct_ayah" &&
      !isKnowledgeIntentQuestion(message) &&
      !isLocalKnowledgeQuery(message)) ||
    normalizedMessage.includes(normalize("ayet")) ||
    (
      explicitTopic === "hz_muhammed" &&
      quranTopicSignals.some((signal) => normalizedMessage.includes(normalize(signal)))
    )
  );
}

function shouldForceAyahStyleResponse(explicitAyahRequest, responseType, ayahUsed) {
  if (!ayahUsed) return false;
  return explicitAyahRequest || responseType === "direct_ayah";
}

function shouldForceExplicitTopicAyahIntent(message, analysis, plannerResult) {
  const explicitTopic = resolveExplicitTopic(message);
  if (!explicitTopic) return false;
  return (
    isExplicitAyahRequest(message, analysis, null, plannerResult) ||
    isForceableTopicAyahRequest(message)
  );
}

function isForceableTopicAyahRequest(message) {
  const explicitTopic = resolveExplicitTopic(message);
  const normalizedMessage = normalize(message);
  if (!explicitTopic) return false;

  const explicitAyahLanguage = containsAnyNormalized(normalizedMessage, [
    "ayet",
    "kur'an",
    "kuranda",
    "kur'an'da",
    "kurandan",
    "kuran'da",
    "kuran'dan",
    "ayet göster",
    "ayet goster",
    "ayet var mı",
    "ayet var mi",
    "ayet paylaş",
    "ayet paylas",
    "ayet öner",
    "ayet oner",
    "ayet isterim",
  ]);
  if (!explicitAyahLanguage) {
    return false;
  }

  const topicSignals = {
    hz_muhammed: [
      "muhammed",
      "muhammed peygamber",
      "hz muhammed",
      "peygamberimiz",
      "peygamber",
      "resulullah",
      "resul",
      "rasul",
    ],
    tovbe: [
      "tovbe",
      "tevbe",
      "gunah",
      "pisman",
      "affeder",
      "bagislar",
      "bagislan",
    ],
    sabir: [
      "sabir",
      "sabretmek",
      "sabir ayeti",
      "zor zamanlarda sabir",
    ],
  };

  const signals = topicSignals[explicitTopic];
  return Array.isArray(signals)
    ? signals.some((signal) => normalizedMessage.includes(normalize(signal)))
    : false;
}

function containsAnyNormalized(text, needles) {
  return needles.some((needle) => text.includes(normalize(needle)));
}

function containsAnyRaw(text, needles) {
  const raw = String(text || "").toLocaleLowerCase("tr-TR");
  return needles.some((needle) => raw.includes(String(needle || "").toLocaleLowerCase("tr-TR")));
}

function isRepentanceRedirectMessage(message) {
  const normalized = normalize(message);
  return [
    "\u00e7ok pi\u015fman\u0131m",
    "cok pismanim",
    "pi\u015fman\u0131m",
    "pismanim",
    "\u00e7ok pi\u015fman",
    "cok pisman",
  ].some((phrase) => normalized.includes(normalize(phrase)));
}


function isSimpleCasualConversation(message) {
  const lowerMessage = String(message || "").trim().toLocaleLowerCase("tr-TR");
  if (!lowerMessage) return false;

  const casualSignals = [
    "selam",
    "merhaba",
    "nasÄ±lsÄ±n",
    "nasilsin",
    "iyi misin",
    "ne haber",
    "ne yapÄ±yorsun",
    "ne yapiyorsun",
    "gÃ¼naydÄ±n",
    "gunaydin",
    "iyi akÅŸamlar",
    "iyi aksamlar",
  ];
  const strongerSignals = [
    "ayet",
    "dua",
    "zikir",
    "namaz",
    "sabÄ±r",
    "sabir",
    "tevekkÃ¼l",
    "tevekkul",
    "tÃ¶vbe",
    "tovbe",
    "korkuyorum",
    "yalnÄ±z",
    "yalniz",
    "iyi deÄŸilim",
    "iyi degilim",
    "hastayÄ±m",
    "hastayim",
    "iÃ§im daralÄ±yor",
    "icim daraliyor",
    "ne yapacaÄŸÄ±mÄ± bilmiyorum",
    "ne yapacagimi bilmiyorum",
  ];

  return (
    casualSignals.some((signal) => lowerMessage.includes(signal)) &&
    !strongerSignals.some((signal) => lowerMessage.includes(signal))
  );
}

function hasEmotionalGuidanceSignal(message) {
  const normalizedMessage = String(message || "").toLocaleLowerCase("tr-TR");
  const emotionalSignals = [
    "korku",
    "korkuyorum",
    "çok korkuyorum",
    "cok korkuyorum",
    "endişe",
    "endise",
    "kaygı",
    "kaygi",
    "gelecek için endişeliyim",
    "gelecek icin endiseliyim",
    "maddi sıkıntı",
    "maddi sikinti",
    "maddi sıkıntı yaşıyorum",
    "maddi sikinti yasiyorum",
    "haksızlık",
    "haksizlik",
    "haksızlığa uğradım",
    "haksizliga ugradim",
    "zulüm",
    "zulum",
    "yalnız",
    "yalniz",
    "çok yalnız hissediyorum",
    "cok yalniz hissediyorum",
    "yalnız hissediyorum",
    "yalniz hissediyorum",
    "hasta",
    "hastayım",
    "hastayim",
    "şifa",
    "sifa",
    "ölüm",
    "olum",
    "sabır",
    "sabir",
    "sabretmekte zorlanıyorum",
    "sabretmekte zorlaniyorum",
    "içim daralıyor",
    "icim daraliyor",
    "içim sıkılıyor",
    "icim sikiliyor",
    "üzgün",
    "üzgünüm",
    "mutsuz",
    "mutsuzum",
    "pişman",
    "pisman",
    "pişmanım",
    "pismanim",
    "tövbe",
    "tovbe",
    "tevbe",
    "günah",
    "gunah",
    "affeder mi",
    "bağışlar mı",
    "bagislar mi",
    "bağışlanır mı",
    "bagislanir mi",
  ];
  return containsAnyRaw(normalizedMessage, emotionalSignals);
}

function shouldKeepHighRiskIntent(baseAnalysis, plannerResult) {
  return (
    baseAnalysis.intent === "high_risk_sensitive" &&
    plannerResult?.intent !== "high_risk_sensitive"
  );
}

function isPlannerResponseTypeAllowed(responseType, analysis, subIntent, ayahUsed) {
  if (!responseType) return false;
  if (analysis.intent === "high_risk_sensitive") return false;
  if (
    ["direct_ayah", "supportive_ayah", "explanation_with_ayah", "dua_guidance"].includes(responseType) &&
    !ayahUsed &&
    responseType !== "dua_guidance"
  ) {
    return false;
  }
  if (responseType === "practice_suggestion") {
    return ["zikir_request", "practical_guidance", "dua_request"].includes(subIntent);
  }
  return true;
}

function enforceFinalPayloadConsistency({
  responseType,
  ayahUsed,
  selectedAyah,
  topAyahIds,
  knowledgeDrivenAnswer,
  routeMode,
}) {
  if (ayahUsed === false || knowledgeDrivenAnswer) {
    return {
      responseType: "direct_answer",
      ayahUsed: false,
      selectedAyah: null,
      topAyahIds: [],
    };
  }

  if (responseType === "direct_answer") {
    if (routeMode === "quran_guidance" && ayahUsed && selectedAyah) {
      return {
        responseType,
        ayahUsed,
        selectedAyah,
        topAyahIds,
      };
    }

    return {
      responseType: "direct_answer",
      ayahUsed: false,
      selectedAyah: null,
      topAyahIds: [],
    };
  }

  if (["direct_ayah", "supportive_ayah", "sensitive_support", "explanation_with_ayah"].includes(responseType)) {
    if (!selectedAyah) {
      return {
        responseType: "direct_answer",
        ayahUsed: false,
        selectedAyah: null,
        topAyahIds: [],
      };
    }
  }

  return {
    responseType,
    ayahUsed,
    selectedAyah,
    topAyahIds,
  };
}

function wasPlannerAppliedToAnalysis(baseAnalysis, analysis, plannerResult) {
  if (!plannerResult) return false;
  return (
    analysis.intent !== baseAnalysis.intent ||
    analysis.context_topic !== baseAnalysis.context_topic ||
    analysis.primary_theme !== baseAnalysis.primary_theme ||
    analysis.response_type !== baseAnalysis.response_type
  );
}
