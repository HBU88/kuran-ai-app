// Classifies user messages into intent, theme, emotion, severity, and response type.
//
// Response type rule set:
// - explicit ayah requests should resolve toward direct_ayah
// - emotional ayah-centered comfort should resolve toward supportive_ayah
// - informational answers stay direct_answer unless an ayah is later used as support
// - dua-oriented guidance should resolve toward dua_guidance
// - practice questions stay practice_suggestion
// - high-risk messages stay sensitive_support

const {
  THEMES,
  buildContextSummary,
  inferContextTopic,
  isContextDependentMessage,
  normalize,
  secondaryThemesForContextTopic,
  themeForContextTopic,
} = require("./context_resolver");

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

const PRACTICAL_WORSHIP_PATTERNS = [
  "zikir nasil cekilir",
  "zikir nasıl çekilir",
  "dua nasil edilir",
  "dua nasıl edilir",
  "tesbih nasil cekilir",
  "tesbih nasıl çekilir",
  "tövbe nasil edilir",
  "tövbe nasıl edilir",
  "nasil yapilir",
  "nasıl yapılır",
  "nasil okunur",
  "nasıl okunur",
  "ne cekeyim",
  "ne çekeyim",
  "ne okuyayim",
  "ne okuyayım",
];

const WORSHIP_INVALIDATION_PATTERNS = [
  "bozan şeyler",
  "bozan seyler",
  "namazı bozan",
  "namazi bozan",
  "namaz bozan",
  "abdesti bozan",
  "abdesti bozulan",
  "orucu bozan",
  "oruçu bozan",
  "geçersiz kılan",
  "gecersiz kılan",
  "hangi durumlarda bozulur",
  "hangi durumda bozulur",
  "hangi hallerde bozulur",
  "ne zaman bozulur",
];

const ZIKIR_PRACTICE_PATTERNS = [
  "zikir nasil cekilir",
  "zikir nasıl çekilir",
  "hangi zikir",
  "zikir çekebilirim",
  "zikir cekebilirim",
  "tesbih nasil cekilir",
  "tesbih nasıl çekilir",
  "tesbih çekeyim",
  "tesbih cekeyim",
  "ne cekeyim",
  "ne çekeyim",
];

const DUA_GUIDANCE_PATTERNS = [
  "dua nasil edilir",
  "dua nasıl edilir",
  "buna uygun dua",
  "bir dua oner",
  "bir dua öner",
  "hangi duayi",
  "hangi duayı",
  "nasil dua edeyim",
  "nasıl dua edeyim",
];


const DAILY_ISLAMIC_KNOWLEDGE_PATTERNS = [
  "yemin nedir",
  "yemin kefareti",
  "adak nedir",
  "adak kurbani",
  "adak kurbani nedir",
  "kefaret nedir",
  "tovbe nasil edilir",
  "tevbe nasil edilir",
  "dua nedir",
  "dua nasil edilir",
  "helal haram nedir",
  "faiz nedir",
  "kul hakki nedir",
  "anne baba hakki nedir",
  "anne baba hakki",
  "giybet nedir",
  "giybet",
  "israf nedir",
  "selamlasma adabi",
  "selamlasma adabi nedir",
  "komsuluk hakki nedir",
  "komsuluk hakki",
  "zekat kime verilir",
  "zekat kimlere verilir",
  "zekat kimlere verilmez",
  "zekat nisap nedir",
  "fitre nedir",
  "fitre kime verilir",
  "fitre ne zaman verilir",
  "niyet nasil edilir",
  "niyet nasıl edilir",
  "nasıl niyet edilir",
  "nasil niyet edilir",
  "kandil geceleri nedir",
  "kandil geceleri",
  "mirac kandili",
  "miraç kandili",
  "isra ve mirac",
  "isra mirac gecesi",
  "berat kandili",
  "regaip kandili",
  "mevlid kandili",
];

const CASUAL_CONVERSATION_PATTERNS = [
  "selam",
  "merhaba",
  "nasilsin",
  "nasÄ±lsÄ±n",
  "iyi misin",
  "ne haber",
  "ne yapiyorsun",
  "ne yapÄ±yorsun",
  "gunaydin",
  "gÃ¼naydÄ±n",
  "iyi aksamlar",
  "iyi akÅŸamlar",
];

async function analyzeUserMessage(message, history = []) {
  const fallback = analyzeUserMessageFallback(message, history);
  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are the intent analyzer for HAKAI, a Turkish ayah-centered spiritual guide.",
          "Return structured JSON only.",
          "Do not give fatwas or scholarly rulings.",
          `intent must be one of: ${INTENTS.join(", ")}.`,
          `sub_intent must be one of: ${SUB_INTENTS.join(", ")}.`,
          `primary_theme and secondary_themes must use only: ${THEMES.join(", ")}.`,
          "severity must be low, medium, or high.",
          "Use direct_answer for greetings and casual conversation.",
          "Use direct_ayah for explicit ayah requests.",
          "Use supportive_ayah for emotional support when ayah-centered comfort fits.",
          "Use explanation_with_ayah only when an informational answer is supported by ayah.",
          "Use dua_guidance for dua-oriented guidance.",
          "Use direct_answer for general Islamic questions without ayah support.",
          "Use practice_suggestion for worship practice questions.",
          "Use sensitive_support for high-risk sensitive messages.",
          "Return context_topic as null or a short topic resolved from recent conversation.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Recent conversation context: ${JSON.stringify(buildContextSummary(history))}`,
          `Latest Turkish user message: ${message}`,
          "If the latest message uses references like bununla ilgili, bunun hakkında, buna uygun, peki, or başka ne var, resolve it from the recent context.",
          "Return context_topic as a short Turkish topic such as namaz, zikir, dua, sabır, tevekkül, tövbe, or null.",
        ].join("\n"),
      },
    ],
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return {
    intent: normalizeIntent(parsed.intent),
    primary_theme: normalizeTheme(parsed.primary_theme, fallback.primary_theme),
    secondary_themes: normalizeSecondaryThemes(
      parsed.secondary_themes,
      fallback.secondary_themes
    ),
    emotion:
      typeof parsed.emotion === "string" && parsed.emotion.trim()
        ? parsed.emotion.trim()
        : fallback.emotion,
    severity: normalizeSeverity(parsed.severity, fallback.severity),
    response_type:
      typeof parsed.response_type === "string" && parsed.response_type.trim()
        ? normalizeResponseType(parsed.response_type.trim(), fallback.response_type)
        : fallback.response_type,
    context_topic:
      typeof parsed.context_topic === "string" && parsed.context_topic.trim()
        ? parsed.context_topic.trim()
        : fallback.context_topic,
  };
}

function getOpenAIClient() {
  try {
    const OpenAI = require("openai");
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    throw new Error(
      "OpenAI package is required when OPENAI_API_KEY is configured. Run npm install openai."
    );
  }
}

function analyzeUserMessageFallback(message, history = []) {
  const normalized = normalize(message);
  const contextTopic = inferContextTopic(message, history);
  const explicitTopic = detectExplicitTopic(message);
  const contextDependent = isContextDependentMessage(normalized);
  const scores = new Map();

  if (isCasualConversation(normalized)) {
    return {
      intent: "casual_conversation",
      primary_theme: "umut",
      secondary_themes: [],
      emotion: "sakin",
      severity: "low",
      response_type: "direct_answer",
      context_topic: explicitTopic || contextTopic,
    };
  }

  function score(keywords, weights) {
    for (const keyword of keywords) {
      if (!includesNormalized(normalized, keyword)) continue;
      for (const [theme, value] of Object.entries(weights)) {
        scores.set(theme, (scores.get(theme) || 0) + value);
      }
    }
  }

  score(["çok yalnızım", "yalnız", "kimsem yok", "kimsesiz"], {
    yalnızlık: 10,
    tevekkül: 6,
    umut: 4,
  });
  score(["allah beni affeder mi", "affeder mi", "tövbe", "günah", "pişman"], {
    tövbe: 10,
    bağışlanma: 9,
    umut: 5,
  });
  score(["çok hastayım", "hastayım", "şifa", "ağrım", "hasta"], {
    şifa: 10,
    hastalık: 8,
    sabır: 6,
    umut: 4,
  });
  score(["içim daralıyor", "bunaldım", "bunalıyorum", "panik", "kaygı"], {
    kaygı: 10,
    tevekkül: 7,
    çaresizlik: 5,
    umut: 4,
  });
  score(["çok korkuyorum", "korkuyorum", "ölüm korkusu", "korku"], {
    korku: 10,
    tevekkül: 7,
    umut: 4,
  });
  score(["ne yapacağımı bilmiyorum", "çaresiz", "bilmiyorum", "yol göster"], {
    çaresizlik: 9,
    tevekkül: 7,
    sabır: 5,
    umut: 4,
  });
  score(["alkol", "içki", "bağımlılık", "nefs", "bıraktım"], {
    "nefs mücadelesi": 10,
    irade: 8,
    sebat: 7,
    tövbe: 5,
  });
  score(["iyi değilim", "kötüyüm", "yorgunum", "dayanamıyorum"], {
    umut: 9,
    sabır: 7,
    şifa: 4,
  });
  score(["zikir", "tesbih", "allahı anma", "allah'ı anma", "allah i anma"], {
    zikir: 10,
    ibadet: 6,
    tevekkül: 3,
  });
  score(["dua", "niyaz", "yakarma"], {
    dua: 10,
    ibadet: 5,
    tevekkül: 4,
  });
  score(["namaz", "salat", "salah", "rüku", "ruku", "secde"], {
    ibadet: 16,
    dua: 2,
  });
  score(["sabır", "sabir", "sabr"], {
    sabır: 12,
    tevekkül: 5,
    umut: 3,
  });
  score(["tevekkül", "tevekkul"], {
    tevekkül: 12,
    umut: 5,
    sabır: 3,
  });
  score(["tövbe", "tovbe", "istiğfar"], {
    tövbe: 12,
    bağışlanma: 8,
    umut: 3,
  });

  // ── Yeni duygusal temalar ───────────────────────────────────────────────
  score(["öfke", "öfkeli", "kızgın", "sinirli", "hiddet", "öfkemi kontrol", "kızıyorum", "kızdım", "sinirleniyorum"], {
    öfke: 12,
    irade: 7,
    affetmek: 5,
  });
  score(["hüzün", "hüzünlü", "üzgün", "üzülüyorum", "hüzün içindeyim", "ağlıyorum", "üzüldüm", "kederli", "mahzun"], {
    hüzün: 12,
    sabır: 6,
    umut: 4,
  });
  score(["sevinçliyim", "mutluyum", "sevinç", "sevindim", "mutlu oldum", "neşelendim", "neşe", "coşku"], {
    sevinç: 12,
    şükür: 8,
    umut: 3,
  });
  score(["haset", "kıskançlık", "kıskanç", "kıskanıyorum", "çekemiyorum", "çekemez", "haset ediyorum"], {
    haset: 12,
    "nefs mücadelesi": 6,
    irade: 4,
  });
  score(["kibir", "kibirli", "gurur", "mağrur", "büyüklük taslıyor", "büyüklük taslamak", "kendini beğenmiş", "kibirleniyorum"], {
    kibir: 12,
    irade: 6,
    "nefs mücadelesi": 5,
  });

  // ── Ahlaki konular ──────────────────────────────────────────────────────
  score(["haram", "haramdan uzak", "haramlardan kaçınmak", "yasak", "haram işledim", "harama girdim"], {
    haramlar: 12,
    irade: 6,
    tövbe: 4,
  });
  score(["iyilik", "iyilik yap", "hayır işi", "hayır yapmak", "iyilik yapmak", "iyilikler", "hayırsever"], {
    iyilikler: 12,
    merhamet: 6,
    cömertlik: 4,
  });
  score(["kötülük", "kötülükten uzak", "kötülük yapma", "fenalık", "şer", "kötü işler"], {
    kötülükler: 12,
    irade: 6,
    tövbe: 4,
  });
  score(["gıybet", "dedikodu", "arkasından konuşmak", "gıybet ediyor", "gıybet ettim"], {
    gıybet: 12,
    kötülükler: 7,
    "nefs mücadelesi": 4,
  });
  score(["emanet", "emanete ihanet", "emanet verilen", "güven ihlali"], {
    emanet: 12,
    adalet: 6,
    doğruluk: 5,
  });
  score(["doğruluk", "dürüstlük", "dürüst", "sadakat", "doğru sözlü", "yalan söylemem", "doğru olmak"], {
    doğruluk: 12,
    iyilikler: 6,
    irade: 4,
  });
  score(["infak", "sadaka", "zekat", "sadaka vermek", "yoksullara yardım", "bağış", "cömertlik", "infak etmek", "hayır parası"], {
    infak: 12,
    cömertlik: 8,
    iyilikler: 5,
  });

  // ── Ahiret / ölüm / hesap ───────────────────────────────────────────────
  score(["ahiret", "öbür dünya", "mahşer", "cennet", "cehennem", "öldükten sonra", "ahirette"], {
    ahiret: 12,
    ölüm: 6,
    hesap: 5,
  });
  score(["kıyamet", "kıyamet günü", "hesap günü", "son gün", "kıyamet kopmadan önce"], {
    ahiret: 12,
    hesap: 8,
    ölüm: 5,
  });
  score(["ölüm", "vefat", "ölümlü", "hayatın sonu", "öldükten sonra ne olacak", "ölmek üzere"], {
    ölüm: 12,
    ahiret: 7,
    tevekkül: 4,
  });

  // ── Mucizeler / peygamberler ────────────────────────────────────────────
  score(["mucize", "mucizeler", "peygamber mucizesi", "keramet"], {
    mucizeler: 12,
    peygamberler: 7,
    yaratılış: 3,
  });
  score(["hz musa", "hz. musa", "musa peygamber", "asa mucizesi", "denizi yardı", "firavun"], {
    mucizeler: 14,
    "hz. musa": 12,
    peygamberler: 6,
  });
  score(["hz ibrahim", "hz. ibrahim", "ibrahim peygamber", "ateşe atılma", "nemrut"], {
    mucizeler: 14,
    "hz. ibrahim": 12,
    peygamberler: 6,
  });
  score(["hz isa", "hz. isa", "isa peygamber", "meryem oğlu"], {
    mucizeler: 14,
    "hz. isa": 12,
    peygamberler: 6,
  });
  score(["hz süleyman", "hz. süleyman", "süleyman peygamber", "süleyman"], {
    mucizeler: 12,
    "hz. süleyman": 12,
    peygamberler: 6,
  });
  score(["hz davud", "hz. davud", "davud peygamber", "davud"], {
    mucizeler: 12,
    "hz. davud": 12,
    peygamberler: 6,
  });
  score(["hz zekeriyya", "hz. zekeriyya", "zekeriyya peygamber", "zekeriyya"], {
    mucizeler: 12,
    "hz. zekeriyya": 12,
    peygamberler: 6,
  });
  score(["hz meryem", "hz. meryem", "meryem", "meryem annemiz"], {
    mucizeler: 12,
    "hz. meryem": 12,
    peygamberler: 6,
  });
  score(["isra mirac", "isra ve mirac", "miraç gecesi", "miracı", "isra gecesi"], {
    mucizeler: 14,
    "isra ve mirac": 12,
    peygamberler: 6,
  });
  score(["yaratılış", "evrenin yaratılışı", "kainat", "büyük patlama", "tefekkür", "kainatı düşünmek"], {
    yaratılış: 12,
    mucizeler: 8,
    tefekkür: 7,
  });

  if (contextDependent && contextTopic) {
    const topicTheme = themeForContextTopic(contextTopic);
    scores.set(topicTheme, (scores.get(topicTheme) || 0) + 14);
    for (const theme of secondaryThemesForContextTopic(contextTopic)) {
      scores.set(theme, (scores.get(theme) || 0) + 5);
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  let primary = ranked[0]?.[0] || "umut";
  let secondary = ranked
    .slice(1, 4)
    .map(([theme]) => theme)
    .filter((theme) => theme !== primary);

  let intent = inferIntent(normalized, {
    contextDependent,
    contextTopic,
  });
  if (
    !contextDependent &&
    !matchesPracticalWorshipQuestion(normalized) &&
    isDirectTopicQuestion(normalized, contextTopic)
  ) {
    intent = "general_islamic_question";
  }

  // Mucize / peygamber / yaratılış sorguları bilgi sorusudur; duygusal destek sistemi
  // bu ayetleri anti-pattern olarak işaretleyip filtreler — intent'i ayah_request'e zorla.
  const INFORMATIONAL_THEMES = new Set([
    "mucizeler", "peygamberler", "yaratılış", "tefekkür",
    "hz. musa", "hz. ibrahim", "hz. isa", "hz. süleyman",
    "hz. davud", "hz. zekeriyya", "hz. meryem", "isra ve mirac",
  ]);
  if (INFORMATIONAL_THEMES.has(primary) || secondary.some((t) => INFORMATIONAL_THEMES.has(t))) {
    intent = "ayah_request";
  }

  if (intent === "ayah_request" && explicitTopic) {
    primary = themeForExplicitTopic(explicitTopic);
    secondary = secondaryThemesForExplicitTopic(explicitTopic);
  }

  return {
    intent,
    primary_theme: primary,
    secondary_themes: secondary.length ? secondary : ["tevekkül"],
    emotion: inferEmotion(normalized, primary),
    severity: inferSeverity(normalized),
    response_type: responseTypeForIntent(intent),
    context_topic: explicitTopic || contextTopic,
  };
}

function detectExplicitTopic(message) {
  const normalized = normalize(message);
  if (normalized.includes("namaz")) return "namaz";
  if (normalized.includes("dua")) return "dua";
  if (normalized.includes("zikir")) return "zikir";
  if (normalized.includes("sabır") || normalized.includes("sabir") || normalized.includes("sabr")) {
    return "sabır";
  }
  if (normalized.includes("tevekkül") || normalized.includes("tevekkul")) return "tevekkül";
  if (normalized.includes("tövbe") || normalized.includes("tovbe")) return "tövbe";
  return null;
}

function themeForExplicitTopic(topic) {
  if (topic === "namaz") return "ibadet";
  if (topic === "dua") return "dua";
  if (topic === "zikir") return "zikir";
  if (topic === "sabır") return "sabır";
  if (topic === "tevekkül") return "tevekkül";
  if (topic === "tövbe") return "tövbe";
  return "umut";
}

function secondaryThemesForExplicitTopic(topic) {
  const mapping = {
    namaz: ["dua", "zikir"],
    dua: ["ibadet", "tevekkül"],
    zikir: ["ibadet", "tevekkül"],
    sabır: ["tevekkül", "umut"],
    tevekkül: ["sabır", "umut"],
    tövbe: ["bağışlanma", "umut"],
  };
  return mapping[topic] || ["tevekkül"];
}

function isDirectTopicQuestion(normalizedMessage, contextTopic) {
  if (!contextTopic) return false;
  const questionSignals = ["sevap", "gerekli", "farz", "nedir", "nasıl", "olur mu", "caiz"];
  return questionSignals.some((signal) => includesNormalized(normalizedMessage, signal));
}

function normalizeIntent(value) {
  if (value === "casual_conversation") return "casual_conversation";
  if (value === "general_question") return "general_islamic_question";
  if (value === "emotional_support") return "emotional_spiritual_support";
  if (value === "worship_question") return "worship_practice_question";
  return INTENTS.includes(value) ? value : "emotional_spiritual_support";
}

function normalizeTheme(value, fallback) {
  const normalizedValue = normalize(value);
  return THEMES.find((theme) => normalize(theme) === normalizedValue) || fallback;
}

function normalizeSecondaryThemes(value, fallback = []) {
  const themes = Array.isArray(value) ? value : fallback;
  return themes
    .map((theme) => normalizeTheme(theme, null))
    .filter(Boolean)
    .filter((theme, index, all) => all.indexOf(theme) === index)
    .slice(0, 3);
}

function normalizeSeverity(value, fallback) {
  return ["low", "medium", "high"].includes(value) ? value : fallback;
}

function normalizeResponseType(value, fallback) {
  const normalizedValue = String(value || "").trim();
  const allowed = [
    "direct_ayah",
    "supportive_ayah",
    "explanation_with_ayah",
    "dua_guidance",
    "direct_answer",
    "practice_suggestion",
    "sensitive_support",
  ];
  if (normalizedValue === "ayah_guidance") {
    return fallback;
  }
  return allowed.includes(normalizedValue) ? normalizedValue : fallback;
}

function inferIntent(normalized, context = {}) {
  if (
    ["intihar", "kendime zarar", "yaşamak istemiyorum", "ölmek istiyorum"].some((word) =>
      includesNormalized(normalized, word)
    )
  ) {
    return "high_risk_sensitive";
  }
  if (isCasualConversation(normalized)) {
    return "casual_conversation";
  }
  if (matchesPracticalWorshipQuestion(normalized)) {
    return "worship_practice_question";
  }
  if (matchesWorshipInvalidationQuestion(normalized)) {
    return "general_islamic_question";
  }
  if (matchesDailyIslamicKnowledgeQuestion(normalized)) {
    return "general_islamic_question";
  }
  if (
    [
      "kandil",
      "kandil geceleri",
      "mirac",
      "miraç",
      "berat",
      "regaip",
      "mevlid",
      "zekat",
      "fitre",
    ].some((phrase) => includesNormalized(normalized, phrase))
  ) {
    return "general_islamic_question";
  }
  if (
    context.contextDependent &&
    context.contextTopic &&
    (includesNormalized(normalized, "ayet") || includesNormalized(normalized, "ayet var mı"))
  ) {
    return "ayah_request";
  }
  if (
    context.contextDependent &&
    context.contextTopic &&
    (includesNormalized(normalized, "dua") || includesNormalized(normalized, "ne okuyayım"))
  ) {
    return "worship_practice_question";
  }
  if (includesNormalized(normalized, "ayet") || includesNormalized(normalized, "ayet paylaş")) {
    return "ayah_request";
  }
  if (
    [
      "hangi zikir",
      "hangi sure",
      "ne okuyayım",
      "ne okuyabilirim",
      "tesbih çekeyim",
      "zikirleri çekebilirim",
    ].some((phrase) => includesNormalized(normalized, phrase))
  ) {
    return "worship_practice_question";
  }
  if (
    [
      "sevap mı",
      "gerekli mi",
      "farz mı",
      "farz mi",
      "oruç farz mı",
      "oruc farz mi",
      "oruç nedir",
      "oruc nedir",
      "oruç nasıl tutulur",
      "oruc nasil tutulur",
      "orucu bozan",
      "orucu bozmayan",
      "zikir çekmek",
      "dua etmek",
      "tesbih çekmek",
      "nedir",
      "nasıl",
    ].some((phrase) => includesNormalized(normalized, phrase))
  ) {
    return "general_islamic_question";
  }
  if (matchesFastingFactualQuestion(normalized)) {
    return "general_islamic_question";
  }
  return "emotional_spiritual_support";
}

function matchesFastingFactualQuestion(normalized) {
  if (!/[oö]ru[çc]/i.test(normalized)) return false;
  const factualMarkers = [
    "farz mı",
    "farz mi",
    "nedir",
    "nasıl tutulur",
    "nasil tutulur",
    "orucu bozan",
    "orucu bozmayan",
    "bozan şeyler",
    "bozan seyler",
    "hangi durumlarda bozulur",
    "hangi durumlarda bozulmaz",
  ];
  return factualMarkers.some((marker) => includesNormalized(normalized, marker));
}

function includesNormalized(normalizedText, phrase) {
  return normalize(normalizedText).includes(normalize(phrase));
}

function responseTypeForIntent(intent) {
  switch (intent) {
    case "casual_conversation":
      return "direct_answer";
    case "ayah_request":
      return "direct_ayah";
    case "emotional_spiritual_support":
      return "supportive_ayah";
    case "general_islamic_question":
      return "direct_answer";
    case "worship_practice_question":
      return "practice_suggestion";
    case "high_risk_sensitive":
      return "sensitive_support";
    default:
      return "supportive_ayah";
  }
}

function inferSubIntent(message, analysis = {}) {
  const normalized = normalize(message);
  if (analysis.intent === "casual_conversation") {
    return "casual_conversation";
  }
  if (analysis.intent === "high_risk_sensitive") {
    return "emotional_support";
  }
  if (matchesDuaGuidanceRequest(normalized)) {
    return "dua_request";
  }
  if (matchesZikirPracticeRequest(normalized)) {
    return "zikir_request";
  }
  if (matchesDailyIslamicKnowledgeQuestion(normalized)) {
    return "general_information";
  }
  if (matchesPracticalWorshipQuestion(normalized)) {
    return "practical_guidance";
  }
  if (
    includesNormalized(normalized, "dua") ||
    includesNormalized(normalized, "dua var mi") ||
    includesNormalized(normalized, "dua var mı") ||
    includesNormalized(normalized, "buna uygun dua") ||
    includesNormalized(normalized, "hangi duayi") ||
    includesNormalized(normalized, "hangi duayı")
  ) {
    return "dua_request";
  }
  if (
    includesNormalized(normalized, "ayet") ||
    includesNormalized(normalized, "baska ayet") ||
    includesNormalized(normalized, "başka ayet") ||
    includesNormalized(normalized, "ayet var mi") ||
    includesNormalized(normalized, "ayet var mı")
  ) {
    return "ayah_request";
  }
  if (
    includesNormalized(normalized, "hangi zikir") ||
    includesNormalized(normalized, "zikir oner") ||
    includesNormalized(normalized, "zikir öner") ||
    includesNormalized(normalized, "zikir cekebilirim") ||
    includesNormalized(normalized, "zikir çekebilirim") ||
    includesNormalized(normalized, "tesbih cekeyim") ||
    includesNormalized(normalized, "tesbih çekeyim")
  ) {
    return "zikir_request";
  }
  if (
    includesNormalized(normalized, "ne yapayim") ||
    includesNormalized(normalized, "ne yapayım") ||
    includesNormalized(normalized, "ne yapmaliyim") ||
    includesNormalized(normalized, "ne yapmalıyım") ||
    includesNormalized(normalized, "iyi gelir mi") ||
    includesNormalized(normalized, "nasil yapayim") ||
    includesNormalized(normalized, "nasıl yapayım")
  ) {
    return "practical_guidance";
  }
  if (
    analysis.intent === "general_islamic_question" ||
    includesNormalized(normalized, "sevap") ||
    includesNormalized(normalized, "nedir") ||
    includesNormalized(normalized, "gerekli mi") ||
    includesNormalized(normalized, "farz mi") ||
    includesNormalized(normalized, "farz mı")
  ) {
    return "general_information";
  }
  if (analysis.intent === "worship_practice_question") {
    return "practical_guidance";
  }
  return "emotional_support";
}

function responseStrategyForSubIntent(subIntent) {
  switch (subIntent) {
    case "casual_conversation":
      return "casual_reply";
    case "ayah_request":
      return "ayah_centered";
    case "dua_request":
      return "direct_answer_with_dua";
    case "zikir_request":
      return "direct_answer_with_zikir";
    case "practical_guidance":
      return "direct_answer_first";
    case "general_information":
      return "direct_answer";
    case "emotional_support":
    default:
      return "emotional_ayah_support";
  }
}

function inferEmotion(normalized, primaryTheme) {
  if (includesNormalized(normalized, "yalnız")) return "yalnızlık";
  if (includesNormalized(normalized, "kork")) return "korku";
  if (includesNormalized(normalized, "pişman") || includesNormalized(normalized, "affeder")) {
    return "pişmanlık";
  }
  if (includesNormalized(normalized, "hasta") || includesNormalized(normalized, "şifa")) {
    return "hastalık";
  }
  if (includesNormalized(normalized, "bunal") || includesNormalized(normalized, "daral")) {
    return "bunalmış";
  }
  return primaryTheme;
}

function inferSeverity(normalized) {
  if (
    ["çok", "dayanamıyorum", "çaresiz", "nefes alamıyorum", "tükendim"].some((word) =>
      includesNormalized(normalized, word)
    )
  ) {
    return "high";
  }
  if (["biraz", "hafif"].some((word) => includesNormalized(normalized, word))) {
    return "low";
  }
  return "medium";
}

function matchesPracticalWorshipQuestion(normalized) {
  return PRACTICAL_WORSHIP_PATTERNS.some((phrase) => includesNormalized(normalized, phrase));
}

function matchesWorshipInvalidationQuestion(normalized) {
  const normalizedText = normalize(normalized);
  if (!WORSHIP_INVALIDATION_PATTERNS.some((phrase) => normalizedText.includes(normalize(phrase)))) {
    return false;
  }

  return [
    "namaz",
    "abdest",
    "abdesti",
    "oruç",
    "orucu",
    "oruclu",
    "wudu",
    "gusul",
    "gusül",
    "ibadet",
  ].some((anchor) => normalizedText.includes(normalize(anchor)));
}

function matchesZikirPracticeRequest(normalized) {
  return ZIKIR_PRACTICE_PATTERNS.some((phrase) => includesNormalized(normalized, phrase));
}

function matchesDuaGuidanceRequest(normalized) {
  return DUA_GUIDANCE_PATTERNS.some((phrase) => includesNormalized(normalized, phrase));
}

function matchesDailyIslamicKnowledgeQuestion(normalized) {
  return DAILY_ISLAMIC_KNOWLEDGE_PATTERNS.some((phrase) => includesNormalized(normalized, phrase));
}

function isCasualConversation(normalized) {
  const hasCasualSignal = CASUAL_CONVERSATION_PATTERNS.some((phrase) =>
    includesNormalized(normalized, phrase)
  );
  if (!hasCasualSignal) return false;

  const strongerSignals = [
    "ayet",
    "dua",
    "zikir",
    "namaz",
    "sabır",
    "sabir",
    "tevekkül",
    "tevekkul",
    "tövbe",
    "tovbe",
    "korkuyorum",
    "yalnız",
    "iyi değilim",
    "hastayım",
    "içim daralıyor",
    "ne yapacağımı bilmiyorum",
  ];
  return !strongerSignals.some((phrase) => includesNormalized(normalized, phrase));
}

module.exports = {
  INTENTS,
  SUB_INTENTS,
  THEMES,
  analyzeUserMessage,
  analyzeUserMessageFallback,
  inferSubIntent,
  inferIntent,
  responseStrategyForSubIntent,
  responseTypeForIntent,
};
