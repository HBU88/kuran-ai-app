// Builds the assistant text once intent, themes, routing, and selected ayah are known.

const fs = require("fs");
const path = require("path");

const { isPrayerRakatsQuestion, normalize, decodeURIComponentSafe } = require("./context_resolver");

const ILMIHAL_DATA_DIR = path.join(__dirname, "..", "data", "ilmihal");
const structuredIlmihalCache = new Map();

function buildAssistantText(analysis, ayah, message, routing = {}) {
  const normalizedMessage = normalize(message);
  const prayerContext = inferPrayerContext(routing);
  const isPrayerContextFollowup =
    Boolean(prayerContext) &&
    (
      normalizedMessage.includes("vacip") ||
      normalizedMessage.includes("farz") ||
      normalizedMessage.includes("rekat") ||
      normalizedMessage.includes("rekât") ||
      normalizedMessage.includes("kaç")
    );
  let text;
  if (analysis.intent === "high_risk_sensitive") {
    text =
      "Bunu ciddiye alıyorum. Eğer kendine zarar verme düşüncen varsa lütfen hemen bulunduğun yerdeki acil destek hattına, güvendiğin birine veya en yakın sağlık birimine ulaş. Burada sana sakin biçimde eşlik edebilirim ama acil destek yerine geçemem.";
  } else if (isPrayerContextRulingFollowup(message, routing)) {
    text = buildPrayerRulingAnswer(routing);
  } else if (isPrayerRakatsQuestion(message) || isPrayerContextFollowup) {
    text = buildPrayerRakatsAnswer(message, routing);
  } else if (analysis.intent === "worship_practice_question" && routing.knowledgeResult) {
    text = composeKnowledgeFirstAnswer(routing.knowledgeResult, ayah);
  } else if (routing.knowledgeResult) {
    text = composeKnowledgeFirstAnswer(routing.knowledgeResult, ayah);
  } else if (ayah && isAyahPreferredResponseType(analysis.response_type)) {
    text = composeAssistantText({
      response_type: analysis.response_type,
      selected_ayah: ayah,
      messageAnalysis: analysis,
      recent_assistant_texts: routing.recent_assistant_texts || [],
    });
  } else if (shouldUseGeneralIslamicAnswer(message, routing)) {
    text = buildGeneralIslamicAnswer(message, routing);
  } else if (analysis.intent === "casual_conversation") {
    text = buildCasualConversationAnswer(message);
  } else if (routing.subIntent === "dua_request") {
    text = buildDuaRequestAnswer(message);
  } else if (routing.subIntent === "zikir_request") {
    text = buildZikirRequestAnswer(message);
  } else if (routing.subIntent === "practical_guidance") {
    text = buildPracticalGuidanceAnswer(message);
  } else if (routing.subIntent === "general_information") {
    text = buildGeneralIslamicAnswer(message, routing);
  } else if (analysis.intent === "general_islamic_question") {
    text = buildGeneralIslamicAnswer(message, routing);
  } else if (analysis.intent === "worship_practice_question") {
    text = buildWorshipPracticeAnswer(message, routing);
  } else {
    text = buildAyahCenteredAnswer(analysis, ayah, routing.recent_assistant_texts || []);
  }
  return finalizeAssistantText(text);
}

function shouldUseGeneralIslamicAnswer(message, routing = {}) {
  if (routing.subIntent === "general_information") {
    return true;
  }

  if (routing.knowledgeTopic) {
    return true;
  }

  const normalized = normalize(decodeURIComponentSafe(message));
  const knowledgeTopic = normalize(routing.knowledgeTopic || "");
  const mentionsProphet =
    containsAnyNormalized(normalized, [
      "muhammed",
      "hz muhammed",
      "hz. muhammed",
      "peygamber",
      "peygamberimiz",
      "peygamberimizin",
    ]) ||
    containsAnyNormalized(knowledgeTopic, [
      "muhammed",
      "hz muhammed",
      "peygamber",
    ]);
  const mentionsCharacter =
    containsAnyNormalized(normalized, [
      "nasil biriydi",
      "nasıldı",
      "ahlak",
      "ahlaki",
      "ahlakı",
      "kişilik",
      "karakter",
      "nasildi",
    ]) ||
    containsAnyNormalized(knowledgeTopic, [
      "kişilik",
      "karakter",
      "ahlak",
      "ahlakı",
    ]);

  return mentionsProphet && mentionsCharacter;
}

function composeAssistantText({
  response_type,
  selected_ayah,
  messageAnalysis,
  recent_assistant_texts = [],
}) {
  switch (response_type) {
    case "direct_ayah":
      return composeDirectAyah(selected_ayah, recent_assistant_texts);
    case "supportive_ayah":
      return composeSupportiveAyah(selected_ayah, messageAnalysis, recent_assistant_texts);
    case "explanation_with_ayah":
      return composeExplanationWithAyah(selected_ayah, messageAnalysis, recent_assistant_texts);
    case "dua_guidance":
      return composeDuaGuidance(selected_ayah, messageAnalysis, recent_assistant_texts);
    case "sensitive_support":
      return composeSupportiveAyah(selected_ayah, messageAnalysis, recent_assistant_texts);
    default:
      return buildAyahCenteredAnswer(messageAnalysis, selected_ayah, recent_assistant_texts);
  }
}

function isAyahPreferredResponseType(responseType) {
  return ["direct_ayah", "supportive_ayah", "explanation_with_ayah", "sensitive_support"].includes(responseType);
}

function composeKnowledgeFirstAnswer(knowledgeResult, selectedAyah) {
  const structured = loadStructuredIlmihalContent(knowledgeResult);
  if (structured) {
    return formatStructuredIlmihalAnswer(structured);
  }

  const baseText = knowledgeResult?.answer_text
    ? knowledgeResult.answer_text
    : "Bu konuda kısa ve düzenli bir ibadet pratiğiyle başlamak daha uygun olabilir.";
  return baseText;
}

function loadStructuredIlmihalContent(knowledgeResult) {
  if (!knowledgeResult || typeof knowledgeResult !== "object") {
    return null;
  }

  const structured = findStructuredIlmihalFile(knowledgeResult);
  if (!structured) {
    return null;
  }

  if (looksCorrupted(structured)) {
    return null;
  }

  return structured;
}

function findStructuredIlmihalFile(knowledgeResult) {
  if (!fs.existsSync(ILMIHAL_DATA_DIR)) {
    return null;
  }

  const aliasFile = resolveStructuredIlmihalAlias(knowledgeResult);
  if (aliasFile) {
    const aliased = getParsedIlmihalFile(aliasFile);
    if (aliased) {
      return aliased;
    }
  }

  const files = fs.readdirSync(ILMIHAL_DATA_DIR).filter((file) => file.endsWith(".json"));
  const normalizedId = normalize(String(knowledgeResult.id || ""));
  const normalizedTopic = normalize(String(knowledgeResult.topic || ""));

  for (const fileName of files) {
    const cached = getParsedIlmihalFile(fileName);
    if (!cached) continue;
    const dataId = normalize(String(cached.id || ""));
    const dataTopic = normalize(String(cached.topic || ""));
    if (normalizedId && dataId === normalizedId) return cached;
    if (normalizedTopic && dataTopic === normalizedTopic) return cached;
  }

  return null;
}

function resolveStructuredIlmihalAlias(knowledgeResult) {
  const normalizedId = normalize(String(knowledgeResult?.id || ""));
  const normalizedTopic = normalize(String(knowledgeResult?.topic || ""));

  if (normalizedId.startsWith("abdest_") || normalizedTopic === "abdest") {
    return "abdest.json";
  }
  if (normalizedId.startsWith("gusul_") || normalizedTopic.includes("gusul")) {
    return "gusul.json";
  }

  return null;
}

function getParsedIlmihalFile(fileName) {
  const filePath = path.join(ILMIHAL_DATA_DIR, fileName);
  if (structuredIlmihalCache.has(filePath)) {
    return structuredIlmihalCache.get(filePath);
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    structuredIlmihalCache.set(filePath, parsed);
    return parsed;
  } catch (error) {
    structuredIlmihalCache.set(filePath, null);
    return null;
  }
}

function looksCorrupted(value) {
  const text = collectStructuredIlmihalText(value);
  if (!text) {
    return false;
  }

  const badTokens = ["Ã", "Ä", "ÔÇ", "�"];
  return badTokens.some((token) => text.includes(token));
}

function collectStructuredIlmihalText(value) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const parts = [];
  const fields = [
    value.title,
    value.summary,
    value.category,
    value.id,
    value.keywords,
    value.farzlar,
    value.vacipler,
    value.sunnetler,
    value.step_by_step,
    value.attention_points,
    value.common_mistakes,
    value.related_questions,
    value.source_notes,
  ];

  for (const field of fields) {
    if (Array.isArray(field)) {
      for (const item of field) {
        if (typeof item === "string") {
          parts.push(item);
        }
      }
      continue;
    }
    if (typeof field === "string") {
      parts.push(field);
    }
  }

  return parts.join(" ");
}

function formatStructuredIlmihalAnswer(data) {
  const parts = [];
  if (data.summary) {
    parts.push(String(data.summary).trim());
  }
  appendSection(parts, "Adım adım", data.step_by_step);
  appendSection(parts, "Farzları", data.farzlar);
  appendSection(parts, "Vacipleri", data.vacipler);
  appendSection(parts, "Sünnetleri", data.sunnetler);
  appendSection(parts, "Dikkat edilmesi gerekenler", data.attention_points);
  appendSection(parts, "Yaygın hatalar", data.common_mistakes);
  if (Array.isArray(data.related_questions) && data.related_questions.length > 0) {
    parts.push(`İlgili sorular: ${data.related_questions.join(" · ")}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function appendSection(parts, title, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }
  const normalizedItems = items.map((item) => String(item).trim()).filter(Boolean);
  if (normalizedItems.length === 0) {
    return;
  }
  parts.push(`${title}:\n- ${normalizedItems.join("\n- ")}`);
}

function composeDirectAyah(selectedAyah, recentAssistantTexts = []) {
  if (!selectedAyah) {
    return "Şu an uygun bir ayet seçemedim; istersen durumunu biraz daha açık yazabilirsin.";
  }

  const leadIn = pickLeadIn({
    mode: "direct",
    analysis: null,
    recentAssistantTexts,
  });

  return `${leadIn}\n\n${formatAyah(selectedAyah)}`;
}

function composeSupportiveAyah(selectedAyah, messageAnalysis, recentAssistantTexts = []) {
  if (!selectedAyah) {
    return buildAyahCenteredAnswer(messageAnalysis, selectedAyah, recentAssistantTexts);
  }

  const templates = getSupportiveLeadTemplates(messageAnalysis);
  const leadIn = selectDistinctTemplate(templates, recentAssistantTexts) || templates[0];

  return `${leadIn}\n\n${formatAyah(selectedAyah)}`;
}

function getSupportiveLeadTemplates(messageAnalysis) {
  const topicKey = resolveSupportiveTopicKey(messageAnalysis);
  switch (topicKey) {
    case "tovbe":
      return [
        "Tövbe ve dönüş isteğini canlı tutan bir ayet var:",
        "Bu konuda rahmeti hatırlatan bir ayet:",
        "Pişmanlık ve umut tarafını birlikte tutan bir ayet:",
        "Rahmet kapısını hatırlatan kısa bir ayet paylaşayım:",
      ];
    case "yalnizlik":
      return [
        "Yalnızlık hissine eşlik edebilecek bir ayet var:",
        "Bu yalnızlıkta kalbi tutan bir ayet:",
        "Yalnız hissettiğinde hatırlanabilecek bir ayet:",
        "Yalnızlık duygusunu hafifleten kısa bir ayete bakalım:",
      ];
    case "korku":
      return [
        "Bu korku halinde seni sakin tutabilecek bir ayet var:",
        "Korku ağır geldiğinde şu ayet kalbe iyi gelebilir:",
        "Bu konuda korku ve endişeyi hafifleten bir ayet:",
        "Korkunun kalbi daraltmasına izin vermeden şu ayete bakalım:",
      ];
    case "kaygi":
      return [
        "Kaygı ve belirsizlikte kalbi toparlayan bir ayet var:",
        "Bu kaygı halinde şu ayet sakinlik verebilir:",
        "Bu konuda içini ferahlatabilecek bir ayet:",
        "Bu endişe halinde kısa bir ayet hatırlatması iyi gelebilir:",
      ];
    case "daralma":
      return [
        "İç daralmasına karşı kısa bir ayet var:",
        "Bu sıkışma hissinde şu ayet iyi gelebilir:",
        "Daralma anında kalbe eşlik eden bir ayet:",
        "İçini biraz rahatlatabilecek bir ayeti birlikte bakalım:",
      ];
    case "caresizlik":
      return [
        "Çaresizlik hissinde rahmeti hatırlatan bir ayet var:",
        "Bu çıkışsızlık duygusunda şu ayet iyi gelebilir:",
        "Bu konuda umut tarafını tutan bir ayet:",
        "Çıkış kapısını hatırlatan kısa bir ayet paylaşayım:",
      ];
    case "umut":
      return [
        "Umut tarafını hatırlatan bir ayet var:",
        "Bu konuda kalbi yumuşatan bir ayet:",
        "Sakin bir umut için şu ayet iyi gelebilir:",
        "Umut duygusunu diri tutan kısa bir ayet paylaşayım:",
      ];
    default:
      return [
        "Bu konuda Allah'ın şu ayeti kalbe ferahlık verir:",
        "Bu durumda kısa bir ayet hatırlatması iyi gelebilir:",
        "Kalbi biraz toparlayabilecek bir ayet şöyle:",
        "Bu konuya sakin bir ayetle bakalım:",
        "Bu durumda Kur'an'dan kısa bir teselli şu olabilir:",
        "Sana sakinlik verebilecek kısa bir ayet var:",
        "Bu meselede ayetin hatırlattığı şey şu:",
        "Kalbi yormadan kısa bir ayet paylaşayım:",
      ];
  }
}

function composeExplanationWithAyah(selectedAyah, messageAnalysis, recentAssistantTexts = []) {
  if (!selectedAyah) {
    return buildAyahCenteredAnswer(messageAnalysis, selectedAyah, recentAssistantTexts);
  }

  const leadIn = pickLeadIn({
    mode: "explanation",
    analysis: messageAnalysis,
    recentAssistantTexts,
  });
  const theme = messageAnalysis?.primary_theme || "bu konu";

  return `${leadIn}\n\n${formatAyah(selectedAyah)}\n\nBu ayet, ${theme} konusunda önemli bir hatırlatma içerir.`;
}

function composeDuaGuidance(selectedAyah, messageAnalysis, recentAssistantTexts = []) {
  if (!selectedAyah) {
    return "Buna uygun kısa ve samimi bir dua edebilirsin; istersen durumunu biraz daha açık yaz.";
  }

  const leadIn = pickLeadIn({
    mode: "dua",
    analysis: messageAnalysis,
    recentAssistantTexts,
  });

  return `${leadIn}\n\n${formatAyah(selectedAyah)}`;
}

function buildAyahCenteredAnswer(analysis, ayah, recentAssistantTexts = []) {
  const introTemplates = {
    yalnızlık: [
      "Yalnızlık hissi ağır gelebilir. Bunu bir hüküm gibi değil, kalbine eşlik edecek sakin bir hatırlatma olarak al.",
      "Yalnız hissettiğinde bunu hafifletebilecek bir ayet seçelim.",
      "Bu yalnızlık hissinde kalbi tutan bir ayet paylaşayım.",
    ],
    tövbe: [
      "Pişmanlık ve dönüş isteği kıymetli bir başlangıç olabilir. Kesin hüküm vermeden rahmet kapısını hatırlatalım.",
      "Tövbe tarafını diri tutan kısa bir hatırlatma iyi gelebilir.",
      "Bu dönüş isteğine eşlik edecek sakin bir ayet paylaşayım.",
    ],
    bağışlanma: [
      "Bağışlanma arayışında kalbin incinmiş olabilir. Rahmeti hatırlatan bir ayetle sakinleşmeye çalışalım.",
      "Rahmet kapısını hatırlatan kısa bir ayet iyi gelebilir.",
      "Bu bağışlanma arayışında umut veren bir ayet paylaşayım.",
    ],
    korku: [
      "Korku ağır gelebilir. Sakin ve güven veren bir ayetle biraz nefes alalım.",
      "Korku halinde kalbi toparlayan kısa bir ayet paylaşayım.",
      "Bu korku hissine iyi gelebilecek bir ayeti birlikte bakalım.",
    ],
    kaygı: [
      "Kaygı ve belirsizlik yorucu olabilir. Tevekkül ve umut tarafını hatırlatan bir ayet iyi gelebilir.",
      "Kaygıyı hafifletmesi umuduyla kısa bir ayet paylaşayım.",
      "Bu kaygı halinde kalbi toparlayan bir ayet iyi gelebilir.",
    ],
    daralma: [
      "İç daralması yorucu olabilir. Ferahlık ve sakinlik tarafını hatırlatan bir ayet iyi gelebilir.",
      "Daralma hissinde içi biraz açacak kısa bir ayet paylaşayım.",
      "Bu sıkışma hissine eşlik eden bir ayeti birlikte bakalım.",
    ],
    çaresizlik: [
      "Çaresizlik hissi ağır gelebilir. Rahmet ve çıkış kapısını hatırlatan bir ayet iyi gelebilir.",
      "Bu çaresizlik halinde umut veren kısa bir ayet paylaşayım.",
      "Çıkış kapısını hatırlatan bir ayet kalbe iyi gelebilir.",
    ],
    şifa: [
      "Hastalık ve yorgunluk insanı zorlar. Bu tıbbi tavsiye değil; sabır ve umut için manevi bir destek.",
      "Şifa tarafını hatırlatan kısa bir ayet paylaşayım.",
    ],
    default: [
      "Yazdığını ayet merkezli ve sakin bir destek niyetiyle ele aldım.",
      "Sakin bir hatırlatma olarak kısa bir ayet paylaşayım.",
      "Bu konuda ayet merkezli ve kısa bir destek iyi gelebilir.",
    ],
  };
  const templates = getSupportiveLeadTemplates(analysis);
  const lead = selectDistinctTemplate(templates, recentAssistantTexts) || templates[0];

  if (!ayah) {
    return `${lead} Şu an uygun bir ayet seçemedim; istersen duygunu biraz daha açık yazabilirsin.`;
  }

  return `${lead} ${formatAyah(ayah)}`;
}

function pickLeadIn({ mode, analysis, recentAssistantTexts = [] }) {
  const topicKey = resolveLeadTopicKey(analysis);
  const templates = getLeadInTemplates(mode, topicKey);
  const selected = selectDistinctTemplate(templates, recentAssistantTexts);
  return selected || templates[0];
}

function getLeadInTemplates(mode, topicKey) {
  const templatesByMode = {
    direct: {
      default: [
        "Şu ayet bu konuda doğrudan yol gösterir:",
        "Buna dair kısa ve net bir ayet şu:",
        "Bu konuda doğrudan işaret eden ayet:",
      ],
    },
    supportive: {
      korku: [
        "Bu korku halinde seni sakin tutabilecek bir ayet var:",
        "Korku ağır geldiğinde şu ayet kalbe iyi gelebilir:",
        "Bu konuda korku ve endişeyi hafifleten bir ayet:",
        "Korkunun kalbi daraltmasına izin vermeden şu ayete bakalım:",
      ],
      kaygı: [
        "Kaygı ve belirsizlikte kalbi toparlayan bir ayet var:",
        "Bu kaygı halinde şu ayet sakinlik verebilir:",
        "Bu konuda içini ferahlatabilecek bir ayet:",
        "Bu endişe halinde kısa bir ayet hatırlatması iyi gelebilir:",
      ],
      daralma: [
        "İç daralmasına karşı kısa bir ayet var:",
        "Bu sıkışma hissinde şu ayet iyi gelebilir:",
        "Daralma anında kalbe eşlik eden bir ayet:",
        "İçini biraz rahatlatabilecek bir ayeti birlikte bakalım:",
      ],
      çaresizlik: [
        "Çaresizlik hissinde rahmeti hatırlatan bir ayet var:",
        "Bu çıkışsızlık duygusunda şu ayet iyi gelebilir:",
        "Bu konuda umut tarafını tutan bir ayet:",
        "Çıkış kapısını hatırlatan kısa bir ayet paylaşayım:",
      ],
      yalnızlık: [
        "Yalnızlık hissine eşlik edebilecek bir ayet var:",
        "Bu yalnızlıkta kalbi tutan bir ayet:",
        "Yalnız hissettiğinde hatırlanabilecek bir ayet:",
        "Yalnızlık duygusunu hafifleten kısa bir ayete bakalım:",
      ],
      tovbe: [
        "Tövbe ve dönüş isteğini canlı tutan bir ayet var:",
        "Bu konuda rahmeti hatırlatan bir ayet:",
        "Pişmanlık ve umut tarafını birlikte tutan bir ayet:",
        "Rahmet kapısını hatırlatan kısa bir ayet paylaşayım:",
      ],
      umut: [
        "Umut tarafını hatırlatan bir ayet var:",
        "Bu konuda kalbi yumuşatan bir ayet:",
        "Sakin bir umut için şu ayet iyi gelebilir:",
        "Umut duygusunu diri tutan kısa bir ayet paylaşayım:",
      ],
      default: [
        "Bu konuda Allah'ın şu ayeti kalbe ferahlık verir:",
        "Bu durumda kısa bir ayet hatırlatması iyi gelebilir:",
        "Kalbi biraz toparlayabilecek bir ayet şöyle:",
        "Bu konuya sakin bir ayetle bakalım:",
        "Bu durumda Kur'an'dan kısa bir teselli şu olabilir:",
        "Sana sakinlik verebilecek kısa bir ayet var:",
        "Bu meselede ayetin hatırlattığı şey şu:",
        "Kalbi yormadan kısa bir ayet paylaşayım:",
      ],
    },
    explanation: {
      korku: [
        "Kur'an korku halinde şu hatırlatmayı yapar:",
        "Korkuya dair Kur'an'da şöyle buyrulur:",
        "Bu korku için ayetin işareti şöyledir:",
      ],
      kaygı: [
        "Kur'an bu kaygı ve belirsizlik için şöyle hatırlatır:",
        "Bu konuda Kur'an'da şöyle buyrulur:",
        "Ayet bu meseleyi şöyle çerçeveler:",
      ],
      daralma: [
        "Kur'an daralma ve sıkışma hissi için şöyle işaret eder:",
        "Bu iç daralmasına dair Kur'an'da şöyle buyrulur:",
        "Ayet bu sıkışmışlık hissini şöyle karşılar:",
      ],
      çaresizlik: [
        "Kur'an çaresizlik hissi için şöyle hatırlatır:",
        "Bu çıkışsızlık duygusuna dair ayet şöyledir:",
        "Kur'an bu konuda umut kapısını şöyle açar:",
      ],
      tovbe: [
        "Kur'an tövbe ve bağışlanma için şöyle buyrur:",
        "Bu dönüş isteğine dair ayet şöyledir:",
        "Kur'an rahmet kapısını bu şekilde hatırlatır:",
      ],
      default: [
        "Bu konuyla ilgili Kur'an'da şöyle buyrulur:",
        "Kur'an bu meseleye kısa bir hatırlatma yapar:",
        "Bu meselede ayetin işareti şu:",
        "Bu konuda ayetin hatırlattığı şey şu:",
        "Kur'an bu konuda sakin bir işaret verir:",
        "Bu mesele için ayetin kısa özeti şu:",
      ],
    },
    dua: {
      korku: [
        "Bu korku halinde ayetle birlikte şöyle dua edebilirsin:",
        "Korkuya karşı bu ayetin ışığında kısa bir dua şöyle olabilir:",
      ],
      kaygı: [
        "Bu kaygı halinde ayetle birlikte şöyle dua edebilirsin:",
        "İçini toparlamak için bu ayetle uyumlu kısa bir dua şöyle olabilir:",
      ],
      daralma: [
        "Bu daralma halinde ayetle birlikte şöyle dua edebilirsin:",
        "Bu sıkışma hissi için kısa bir dua şöyle olabilir:",
      ],
      tovbe: [
        "Bu tövbe çağrısı için ayetle birlikte şöyle dua edebilirsin:",
        "Rahmet tarafını canlı tutan kısa bir dua şöyle olabilir:",
      ],
      default: [
        "Bu ayetle birlikte şöyle dua edebilirsin:",
        "Bu ayetin ışığında kısa bir dua şöyle olabilir:",
        "İstersen bununla uyumlu kısa bir dua şöyle kurabilirsin:",
      ],
    },
  };

  const modeTemplates = templatesByMode[mode] || templatesByMode.supportive;
  return modeTemplates[topicKey] || modeTemplates.default;
}

function resolveLeadTopicKey(analysis) {
  const candidates = [
    analysis?.primary_theme,
    analysis?.context_topic,
    analysis?.emotion,
    analysis?.response_type,
  ];

  for (const value of candidates) {
    const topic = canonicalLeadTopicKey(value);
    if (topic) {
      return topic;
    }
  }

  return "default";
}

function resolveSupportiveTopicKey(analysis) {
  const candidates = [
    analysis?.primary_theme,
    analysis?.context_topic,
    analysis?.emotion,
    analysis?.response_type,
  ];

  for (const value of candidates) {
    const raw = typeof value === "string" ? value.toLowerCase() : "";
    const text = normalize(value);

    if (
      raw.includes("tövbe") ||
      raw.includes("tevbe") ||
      raw.includes("tovbe") ||
      raw.includes("günah") ||
      raw.includes("gunah") ||
      raw.includes("pişman") ||
      raw.includes("pisman") ||
      raw.includes("aff") ||
      raw.includes("bağışla") ||
      raw.includes("bagisla") ||
      raw.includes("istiğfar") ||
      raw.includes("istigfar") ||
      raw.includes("pişmanlık") ||
      raw.includes("pismanlik") ||
      containsAnyNormalized(text, ["tövbe", "tevbe", "tovbe", "günah", "gunah", "pişman", "pisman", "aff", "bağışla", "bagisla", "istiğfar", "istigfar", "pişmanlık", "pismanlik"])
    ) {
      return "tovbe";
    }
    if (
      raw.includes("yalnızlık") ||
      raw.includes("yalnizlik") ||
      raw.includes("yalnız") ||
      raw.includes("yalniz") ||
      raw.includes("kimsesiz") ||
      raw.includes("kimsem yok") ||
      containsAnyNormalized(text, ["yalnızlık", "yalnizlik", "yalnız", "yalniz", "kimsesiz", "kimsem yok"])
    ) return "yalnizlik";
    if (raw.includes("korku") || raw.includes("kork") || raw.includes("ölüm korkusu") || raw.includes("olum korkusu") || containsAnyNormalized(text, ["korku", "kork", "ölüm korkusu", "olum korkusu"])) return "korku";
    if (raw.includes("kaygı") || raw.includes("kaygi") || raw.includes("endişe") || raw.includes("endise") || raw.includes("tedirgin") || raw.includes("panik") || raw.includes("başımıza kötü bir şey") || raw.includes("basimiza kotu bir sey") || containsAnyNormalized(text, ["kaygı", "kaygi", "endişe", "endise", "tedirgin", "panik", "başımıza kötü bir şey", "basimiza kotu bir sey"])) return "kaygi";
    if (raw.includes("daralma") || raw.includes("içim daralıyor") || raw.includes("icim daraliyor") || raw.includes("bunalm") || raw.includes("boğul") || raw.includes("bogul") || raw.includes("sıkış") || raw.includes("sikis") || raw.includes("iç sıkıntısı") || raw.includes("ic sikintisi") || containsAnyNormalized(text, ["daralma", "içim daralıyor", "icim daraliyor", "bunalm", "boğul", "bogul", "sıkış", "sikis", "iç sıkıntısı", "ic sikintisi"])) return "daralma";
    if (raw.includes("çaresiz") || raw.includes("caresiz") || raw.includes("umutsuz") || raw.includes("çıkış yok") || raw.includes("cikis yok") || raw.includes("tüken") || raw.includes("tuken") || raw.includes("tükenmiş") || raw.includes("tukenmis") || containsAnyNormalized(text, ["çaresiz", "caresiz", "umutsuz", "çıkış yok", "cikis yok", "tüken", "tuken", "tükenmiş", "tukenmis"])) return "caresizlik";
    if (raw.includes("umut") || raw.includes("ümit") || raw.includes("umit") || raw.includes("rahmet") || containsAnyNormalized(text, ["umut", "ümit", "umit", "rahmet"])) return "umut";
  }

  return "default";
}

function canonicalLeadTopicKey(value) {
  const text = normalizeLeadText(value);
  if (!text) return null;

  if (containsAnyNormalized(text, ["tövbe", "tevbe", "tovbe", "günah", "gunah", "pişman", "pisman", "aff"])) {
    return "tovbe";
  }
  if (containsAnyNormalized(text, ["daralma", "içim daralıyor", "icim daraliyor", "bunalm", "boğul", "bogul", "sıkış", "sikis", "iç sıkıntısı", "ic sikintisi"])) {
    return "daralma";
  }
  if (containsAnyNormalized(text, ["çaresiz", "caresiz", "umutsuz", "çıkış yok", "cikis yok", "tüken", "tuken", "tükenmiş", "tukenmis"])) {
    return "çaresizlik";
  }
  if (containsAnyNormalized(text, ["yalnız", "yalniz", "yalnızlık", "yalnizlik"])) return "yalnızlık";
  if (containsAnyNormalized(text, ["sabır", "sabir", "sabr"])) return "sabır";
  if (containsAnyNormalized(text, ["tevekkül", "tevekkul"])) return "tevekkül";
  if (containsAnyNormalized(text, ["kaygı", "kaygi", "endişe", "endise", "tedirgin", "panik"])) return "kaygı";
  if (containsAnyNormalized(text, ["korku", "kork", "ölüm korkusu", "olum korkusu"])) return "korku";
  if (containsAnyNormalized(text, ["umut", "ümit", "umit", "rahmet"])) return "umut";
  if (containsAnyNormalized(text, ["şifa", "sifa", "hastalık", "hastalik"])) return "şifa";
  return null;
}

function normalizeLeadTopic(value) {
  return canonicalLeadTopicKey(value);
}

function normalizeLeadText(value) {
  return normalize(value);
}

function containsAnyNormalized(text, needles) {
  return needles.some((needle) => text.includes(normalize(needle)));
}

function selectDistinctTemplate(templates, recentAssistantTexts) {
  const recent = Array.isArray(recentAssistantTexts) ? recentAssistantTexts : [];
  const normalizedRecent = recent
    .map((text) => normalize(extractOpeningLine(text)))
    .filter(Boolean);

  for (const template of templates) {
    const normalizedTemplate = normalize(template);
    if (!normalizedTemplate) continue;
    const alreadyUsed = normalizedRecent.some(
      (recentText) =>
        recentText.startsWith(normalizedTemplate) || normalizedTemplate.startsWith(recentText)
    );
    if (!alreadyUsed) {
      return template;
    }
  }

  return templates[0] || null;
}

function extractOpeningLine(text) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\r?\n\r?\n/);
  return parts[0] || trimmed;
}

function formatAyah(ayah) {
  if (!ayah) {
    return "";
  }

  const surahNumber = Number(ayah.surahNumber || ayah.surah_number || ayah.chapterNumber || ayah.chapter_number);
  const ayahNumber = Number(ayah.ayah || ayah.ayahNumber || ayah.verseNumber || ayah.verse || ayah.aya);
  const surahName = ayah.surahNameTr || ayah.surah_tr || toTurkishSurahName(surahNumber) || ayah.surah || ayah.surahName || "Bilinmeyen sure";
  const text = ayah.text_tr || ayah.text || ayah.text_ar || "";
  const reference = Number.isInteger(surahNumber) && Number.isInteger(ayahNumber)
    ? `${surahName} ${surahNumber}:${ayahNumber}`
    : `${surahName} ${ayahNumber || ""}`.trim();
  return `${reference}: "${text}"`;
}

function buildGeneralIslamicAnswer(message, routing = {}) {
  const structured = loadStructuredIlmihalContent(routing.knowledgeResult);
  if (structured) {
    return formatStructuredIlmihalAnswer(structured);
  }

  if (routing.knowledgeResult?.answer_text) {
    return routing.knowledgeResult.answer_text;
  }

  const normalized = normalize(message);
  const knowledgeTopic = normalize(routing.knowledgeTopic || "");
  const mentionsProphet =
    containsAnyNormalized(normalized, [
      "muhammed",
      "hz muhammed",
      "hz. muhammed",
      "peygamber",
      "peygamberimiz",
      "peygamberimizin",
    ]) ||
    containsAnyNormalized(knowledgeTopic, [
      "muhammed",
      "hz muhammed",
      "peygamber",
    ]);
  const mentionsCharacter =
    containsAnyNormalized(normalized, [
      "nasil biriydi",
      "nasıldı",
      "ahlak",
      "ahlaki",
      "ahlakı",
      "kişilik",
      "karakter",
      "nasildi",
    ]) ||
    containsAnyNormalized(knowledgeTopic, [
      "kişilik",
      "karakter",
      "ahlak",
      "ahlakı",
    ]);

  if (mentionsProphet && mentionsCharacter) {
    return "Hz. Muhammed, İslâm geleneğinde güvenilirliği, merhameti, sabrı, adaleti ve tevazusuyla örnek gösterilen bir peygamberdir. İnsanlara karşı yumuşak davranması, emanete sadakati ve zor zamanlarda metanetini koruması öne çıkar. İstersen bunu ahlâkı, aile hayatı veya liderliği açısından ayrı ayrı da konuşabiliriz.";
  }

  if (normalized.includes("zikir") || normalized.includes("tesbih")) {
    return "Evet, Allah'ı zikretmek genel olarak faziletli ve sevap kabul edilen bir ibadettir. Zikir kalbi diri tutar ve insanın Rabbini hatırlamasına yardımcı olur. Bunu bir fetva gibi değil, genel bir manevi bilgi olarak söyleyebilirim. İstersen sana günlük hayatta kolay çekilebilecek birkaç kısa zikir de önerebilirim.";
  }
  if (normalized.includes("dua")) {
    return "Evet, dua etmek kulun Allah'a yönelmesi bakımından çok kıymetli bir ibadettir. Dua insanın aczini, ihtiyacını ve umudunu Rabbine açmasıdır. Kesin hüküm diliyle değil, genel bir hatırlatma olarak kısa ve samimi dua da değerlidir.";
  }
  if (mentionsProphet) {
    return "Hz. Muhammed, İslâm geleneğinde güvenilirliği, merhameti, sabrı, adaleti ve tevazusuyla örnek gösterilen bir peygamberdir. İnsanlara karşı yumuşak davranması, emanete sadakati ve zor zamanlarda metanetini koruması öne çıkar. İstersen bunu ahlâkı, aile hayatı veya liderliği açısından ayrı ayrı da konuşabiliriz.";
  }
  return "Bu konuda kısa bir genel bilgi verebilirim: İslam'da niyet, samimiyet ve Allah'ı hatırlama çok kıymetlidir. Kesin fetva vermeden, günlük hayatta ölçülü ve samimi bir şekilde hayra yönelmek iyi bir başlangıç olur.";
}

function buildWorshipPracticeAnswer(message, routing = {}) {
  const structured = loadStructuredIlmihalContent(routing.knowledgeResult);
  if (structured) {
    return formatStructuredIlmihalAnswer(structured);
  }

  if (routing.knowledgeResult?.answer_text) {
    return routing.knowledgeResult.answer_text;
  }

  if (isPrayerRakatsQuestion(message)) {
    return buildPrayerRakatsAnswer(message, routing);
  }

  const normalized = normalize(message);
  const prayerContext = inferPrayerContext(routing);
  const explicitCurrentMatch = [
    { keys: ["teravih", "teravi"], answer: "Teravih namaz?n?n rek?t say?s? uygulamada 8 veya 20 olarak bilinir; mezhebe ve yerel uygulamaya g?re de?i?ebilir. Detayl? durumlarda g?venilir bir ilmihal kayna??na veya ehil bir hocaya dan??mak uygun olur." },
    { keys: ["cuma"], answer: "Cuma namaz?n?n farz? 2 rekatt?r; s?nnetlerle birlikte uygulama mezhebe ve yerel gelene?e g?re de?i?ebilir. Detayl? durumlarda g?venilir bir ilmihal kayna??na veya ehil bir hocaya dan??mak uygun olur." },
    { keys: ["bayram"], answer: "Bayram namaz? 2 rekatt?r. Uygulama ayr?nt?lar? i?in g?venilir bir ilmihal kayna??na veya ehil bir hocaya dan??mak uygun olur." },
    { keys: ["cenaze"], answer: "Cenaze namaz? tekbirlerle k?l?n?r; k?sa bir ?ekilde niyet edilir, tekbir al?n?r, dua edilir ve selam verilir. Uygulama ayr?nt?lar? mezhebe g?re de?i?ebilece?i i?in g?venilir bir ilmihal kayna??na veya ehil bir hocaya dan??mak uygun olur." },
  ].find((item) => item.keys.some((key) => normalized.includes(normalize(key))));

  if (explicitCurrentMatch) {
    return explicitCurrentMatch.answer;
  }

  if (prayerContext) {
    if (
      normalized.includes("kaç") ||
      normalized.includes("kac") ||
      normalized.includes("rekat") ||
      normalized.includes("rekât") ||
      normalized.includes("vacip") ||
      normalized.includes("farz") ||
      normalized.includes("sünnet") ||
      normalized.includes("sunnet")
    ) {
      const contextualAnswer = buildPrayerRakatsAnswer(prayerContext, routing);
      if (contextualAnswer) {
        return contextualAnswer;
      }
    }
    if (normalized.includes("nedir") || normalized.includes("ne demek")) {
      return prayerContextDescription(prayerContext);
    }
  }

  if (normalized.includes("zikir")) {
    return "Günlük olarak kısa ve sürdürülebilir zikirler tercih edebilirsin: Subhanallah, Elhamdülillah, Allahu ekber, La ilahe illallah ve salavat gibi. Az ama düzenli yapmak çoğu zaman daha uygulanabilir olur. Özel bir dini hüküm için ehil bir hocaya danışman daha doğru olur.";
  }
  if (normalized.includes("sure")) {
    return "Kendini yormadan kısa surelerle başlayabilirsin: Fatiha, İhlas, Felak, Nas veya İnşirah gibi. İçinde bulunduğun hale göre kısa okuyup anlamını düşünmek de güzel bir pratik olabilir.";
  }
  return "Kısa, düzenli ve sürdürülebilir bir ibadet pratiği seçmek iyi olur. Bugün için küçük bir zikir, kısa bir dua veya bildiğin bir sureyi anlamını düşünerek okumak yeterli bir başlangıç olabilir.";
}

function buildPrayerRakatsAnswer(message, routing = {}) {
  const normalized = normalize(message);
  const prayerContext = inferPrayerContext(routing);
  const explicitCurrentMatch = [
    {
      keys: ["sabah"],
      answer: "Sabah namazı 4 rekattır: 2 sünnet + 2 farz.",
    },
    {
      keys: ["ogle", "öğle"],
      answer: "Öğle namazı 10 rekattır: 4 ilk sünnet + 4 farz + 2 son sünnet.",
    },
    {
      keys: ["ikindi"],
      answer: "İkindi namazı 8 rekattır: 4 sünnet + 4 farz.",
    },
    {
      keys: ["aksam", "akşam"],
      answer: "Akşam namazı 5 rekattır: 3 farz + 2 sünnet.",
    },
    {
      keys: ["yatsi", "yatsı"],
      answer: "Yatsı namazı 13 rekattır: 4 ilk sünnet + 4 farz + 2 son sünnet + 3 vitir.",
    },
    {
      keys: ["vitir"],
      answer: "Vitir namazı 3 rekattır.",
    },
    {
      keys: ["teravih", "teravi"],
      answer:
        "Teravih namazı Ramazan ayında yatsı namazından sonra kılınır. Uygulamada 20 rekât olarak yaygındır; bazı uygulamalarda 8 rekât da kılınır. Genellikle 2'şer rekât hâlinde kılınması tavsiye edilir.",
    },
    {
      keys: ["cuma"],
      answer:
        "Cuma namazının farzı 2 rekattır; sünnetlerle birlikte uygulama mezhebe ve yerel geleneğe göre değişebilir. Detaylı durumlarda güvenilir bir ilmihal kaynağına veya ehil bir hocaya danışmak uygun olur.",
    },
    {
      keys: ["bayram"],
      answer:
        "Bayram namazı 2 rekattır. Uygulama ayrıntıları için güvenilir bir ilmihal kaynağına veya ehil bir hocaya danışmak uygun olur.",
    },
    {
      keys: ["cenaze"],
      answer:
        "Cenaze namazı tekbirlerle kılınır; kısa bir şekilde niyet edilir, tekbir alınır, dua edilir ve selam verilir. Uygulama ayrıntıları mezhebe göre değişebileceği için güvenilir bir ilmihal kaynağına veya ehil bir hocaya danışmak uygun olur.",
    },
  ].find((item) => item.keys.some((key) => normalized.includes(normalize(key))));

  if (explicitCurrentMatch) {
    return explicitCurrentMatch.answer;
  }

  const prayerMap = [
    {
      keys: ["sabah"],
      answer: "Sabah namazı 4 rekattır: 2 sünnet + 2 farz.",
    },
    {
      keys: ["ogle", "öğle"],
      answer: "Öğle namazı 10 rekattır: 4 ilk sünnet + 4 farz + 2 son sünnet.",
    },
    {
      keys: ["ikindi"],
      answer: "İkindi namazı 8 rekattır: 4 sünnet + 4 farz.",
    },
    {
      keys: ["aksam", "akşam"],
      answer: "Akşam namazı 5 rekattır: 3 farz + 2 sünnet.",
    },
    {
      keys: ["yatsi", "yatsı"],
      answer: "Yatsı namazı 13 rekattır: 4 ilk sünnet + 4 farz + 2 son sünnet + 3 vitir.",
    },
    {
      keys: ["vitir"],
      answer: "Vitir namazı 3 rekattır.",
    },
    {
      keys: ["teravih", "teravi"],
      answer:
        "Teravih namazının rekât sayısı uygulamada 8 veya 20 olarak bilinir; mezhebe ve yerel uygulamaya göre değişebilir. Detaylı durumlarda güvenilir bir ilmihal kaynağına veya ehil bir hocaya danışmak uygun olur.",
    },
    {
      keys: ["cuma"],
      answer:
        "Cuma namazının farzı 2 rekattır; sünnetlerle birlikte uygulama mezhebe ve yerel geleneğe göre değişebilir. Detaylı durumlarda güvenilir bir ilmihal kaynağına veya ehil bir hocaya danışmak uygun olur.",
    },
    {
      keys: ["bayram"],
      answer:
        "Bayram namazı 2 rekattır. Uygulama ayrıntıları için güvenilir bir ilmihal kaynağına veya ehil bir hocaya danışmak uygun olur.",
    },
    {
      keys: ["cenaze"],
      answer:
        "Cenaze namazı tekbirlerle kılınır; kısa bir şekilde niyet edilir, tekbir alınır, dua edilir ve selam verilir. Uygulama ayrıntıları mezhebe göre değişebileceği için güvenilir bir ilmihal kaynağına veya ehil bir hocaya danışmak uygun olur.",
    },
  ];

  if (prayerContext) {
    const contextual = prayerMap.find((item) => item.keys.some((key) => prayerContext.includes(normalize(key))));
    if (contextual) {
      return contextual.answer;
    }
  }

  for (const item of prayerMap) {
    if (item.keys.some((key) => normalized.includes(normalize(key)))) {
      return item.answer;
    }
  }

  return "Namazın rekât sayısı (rekat sayısı) mezhebe göre bazı ayrıntılar gösterebilir; istersen sabah, öğle, ikindi, akşam, yatsı veya vitir diye ayrı sorabilirsin.";
}

function isPrayerContextRulingFollowup(message, routing = {}) {
  const normalized = normalize(message);
  const prayerContext = inferPrayerContext(routing);
  if (!prayerContext) return false;
  if (!(normalized.includes("vacip") || normalized.includes("farz") || normalized.includes("sünnet") || normalized.includes("sunnet"))) {
    return false;
  }
  return prayerContext === "vitir";
}

function buildPrayerRulingAnswer(routing = {}) {
  const prayerContext = inferPrayerContext(routing);
  if (prayerContext === "vitir") {
    return "Vitir vaciptir; diğer mezheplerde farklı değerlendirmeler vardır.";
  }
  return "Bu sorunun hükmü, ilgili namaza göre değişebilir; istersen adını açıkça yazarak sorabilirsin.";
}

function inferPrayerContext(routing = {}) {
  const parts = [];
  if (typeof routing.current_message === "string") parts.push(routing.current_message);
  if (typeof routing.knowledgeTopic === "string") parts.push(routing.knowledgeTopic);
  if (Array.isArray(routing.recent_assistant_texts)) parts.push(...routing.recent_assistant_texts);

  const normalized = normalize(parts.join(" "));
  const prayerTopics = [
    ["teravih", ["teravih", "teravi"]],
    ["cuma", ["cuma"]],
    ["bayram", ["bayram"]],
    ["cenaze", ["cenaze"]],
    ["vitir", ["vitir"]],
    ["sabah", ["sabah"]],
    ["ogle", ["öğle", "ogle"]],
    ["ikindi", ["ikindi"]],
    ["aksam", ["akşam", "aksam"]],
    ["yatsi", ["yatsı", "yatsi"]],
  ];

  for (const [topic, variants] of prayerTopics) {
    if (variants.some((variant) => normalized.includes(normalize(variant)))) {
      return topic;
    }
  }
  return null;
}

function prayerContextDescription(prayerContext) {
  const normalized = normalize(prayerContext);
  if (normalized.includes("cuma")) {
    return "Cuma namazı hutbe ve farz namazdan oluşan haftalık toplu bir ibadettir; farzı 2 rekattır. Sünnetlerle ilgili ayrıntılar mezhebe göre değişebilir.";
  }
  if (normalized.includes("teravi")) {
    return "Teravih namazı Ramazan gecelerinde kılınan bir namazdır; rekât sayısı uygulamada 8 veya 20 olarak bilinir. Mezhebe ve yerel uygulamaya göre ayrıntılar değişebilir.";
  }
  if (normalized.includes("bayram")) {
    return "Bayram namazı 2 rekattır. Uygulama ayrıntıları için güvenilir bir ilmihal kaynağına veya ehil bir hocaya danışmak uygun olur.";
  }
  if (normalized.includes("cenaze")) {
    return "Cenaze namazı tekbirlerle kılınır; kısa bir şekilde niyet edilir, dua edilir ve selam verilir. Uygulama ayrıntıları mezhebe göre değişebilir.";
  }
  return "Namaz hakkında kısa bir açıklama istersen sabah, öğle, ikindi, akşam, yatsı, vitir, teravih, cuma, bayram veya cenaze diye ayrı sorabilirsin.";
}

function buildDuaRequestAnswer(message) {
  const normalized = normalize(message);
  if (normalized.includes("yalnız")) {
    return "Buna uygun kısa ve samimi bir dua edebilirsin: Allah'ım, yalnızlık hissimde kalbimi Sana yaklaştır, bana huzur, sabır ve hayırlı insanlar nasip et. Duayı ezber cümle gibi değil, içinden geldiği gibi söylemen de kıymetlidir.";
  }
  if (normalized.includes("tövbe") || normalized.includes("aff")) {
    return "Buna uygun sade bir dua şöyle olabilir: Allah'ım, hatalarımı bağışla, kalbimi temizle ve beni Sana yaklaştıran yollara yönelt. Bu kesin hüküm değil, tövbe ve umut duygusunu destekleyen sakin bir dua önerisidir.";
  }
  return "Buna uygun kısa bir dua şöyle olabilir: Allah'ım, kalbime ferahlık ver, beni hayra yönelt, zorlandığım yerde bana sabır ve güç nasip et. İstersen bunu kendi kelimelerinle daha kişisel hale getirebilirsin.";
}

function buildZikirRequestAnswer(message) {
  const normalized = normalize(message);
  if (normalized.includes("yalnız") || normalized.includes("huzur")) {
    return "Yalnızlık veya iç huzuru için kısa ve sürdürülebilir zikirler tercih edebilirsin: La ilahe illallah, Hasbiyallahu la ilahe illa hu veya salavat. Az ama düzenli yapmak daha uygulanabilir olur.";
  }
  return "Günlük hayatta kolayca sürdürülebilecek zikirler seçebilirsin: Subhanallah, Elhamdülillah, Allahu ekber, La ilahe illallah ve salavat. Bunu kesin bir dini yükümlülük gibi değil, kalbi diri tutan bir pratik olarak düşünebilirsin.";
}

function buildPracticalGuidanceAnswer(message) {
  const normalized = normalize(message);
  if (normalized.includes("zikir")) {
    return "Zikir bu konuda destekleyici bir pratik olabilir. Kısa başlamak daha sağlam olur: günde birkaç dakika salavat, La ilahe illallah veya Hasbiyallah diyebilirsin. Zorlandığında bunu kendine baskıya değil, sakin bir dönüşe çevirmek daha faydalı olur.";
  }
  if (normalized.includes("dua")) {
    return "Dua etmek bu halde iyi bir başlangıç olabilir. Uzun cümleler kurmak zorunda değilsin; kısa, samimi ve düzenli bir dua yeterli olabilir. Bugün sadece kalbinden geçeni Allah'a arz etmek bile anlamlı bir adımdır.";
  }
  return "Bunu küçük ve uygulanabilir bir adıma çevirmek iyi olur. Kısa bir dua, birkaç dakika zikir veya anlamını düşünerek bildiğin bir sureyi okumak başlangıç için yeterli olabilir.";
}

function buildCasualConversationAnswer(message) {
  return "Selam, HAKAI’ye hoş geldin. Sana ayet rehberliği veya ilmihal bilgisiyle yardımcı olabilirim.";
}

function finalizeAssistantText(text) {
  return text;
}

function toTurkishSurahName(surahNumber) {
  switch (surahNumber) {
    case 1: return "Fatiha";
    case 2: return "Bakara";
    case 3: return "Âl-i İmrân";
    case 4: return "Nisa";
    case 5: return "Maide";
    case 6: return "Enam";
    case 7: return "Araf";
    case 8: return "Enfal";
    case 9: return "Tevbe";
    case 10: return "Yunus";
    case 11: return "Hud";
    case 12: return "Yusuf";
    case 13: return "Ra'd";
    case 14: return "İbrahim";
    case 15: return "Hicr";
    case 16: return "Nahl";
    case 17: return "İsra";
    case 18: return "Kehf";
    case 19: return "Meryem";
    case 20: return "Taha";
    case 21: return "Enbiya";
    case 22: return "Hac";
    case 23: return "Müminun";
    case 24: return "Nur";
    case 25: return "Furkan";
    case 26: return "Şuara";
    case 27: return "Neml";
    case 28: return "Kasas";
    case 29: return "Ankebut";
    case 30: return "Rum";
    case 31: return "Lokman";
    case 32: return "Secde";
    case 33: return "Ahzab";
    case 34: return "Sebe";
    case 35: return "Fatır";
    case 36: return "Yasin";
    case 37: return "Saffat";
    case 38: return "Sad";
    case 39: return "Zümer";
    case 40: return "Mümin";
    case 41: return "Fussilet";
    case 42: return "Şura";
    case 43: return "Zuhruf";
    case 44: return "Duhan";
    case 45: return "Casiye";
    case 46: return "Ahkaf";
    case 47: return "Muhammed";
    case 48: return "Fetih";
    case 49: return "Hucurat";
    case 50: return "Kaf";
    case 51: return "Zariyat";
    case 52: return "Tur";
    case 53: return "Necm";
    case 54: return "Kamer";
    case 55: return "Rahman";
    case 56: return "Vakia";
    case 57: return "Hadid";
    case 58: return "Mücadele";
    case 59: return "Haşr";
    case 60: return "Mümtehine";
    case 61: return "Saff";
    case 62: return "Cuma";
    case 63: return "Münafikun";
    case 64: return "Teğabün";
    case 65: return "Talak";
    case 66: return "Tahrim";
    case 67: return "Mülk";
    case 68: return "Kalem";
    case 69: return "Hakka";
    case 70: return "Me'aric";
    case 71: return "Nuh";
    case 72: return "Cin";
    case 73: return "Müzzemmil";
    case 74: return "Müddessir";
    case 75: return "Kıyame";
    case 76: return "İnsan";
    case 77: return "Mürselat";
    case 78: return "Nebe";
    case 79: return "Naziat";
    case 80: return "Abese";
    case 81: return "Tekvir";
    case 82: return "İnfitar";
    case 83: return "Mutaffifin";
    case 84: return "İnşikak";
    case 85: return "Buruc";
    case 86: return "Tarık";
    case 87: return "Ala";
    case 88: return "Gaşiye";
    case 89: return "Fecr";
    case 90: return "Beled";
    case 91: return "Şems";
    case 92: return "Leyl";
    case 93: return "Duha";
    case 94: return "İnşirah";
    case 95: return "Tin";
    case 96: return "Alak";
    case 97: return "Kadir";
    case 98: return "Beyyine";
    case 99: return "Zilzal";
    case 100: return "Adiyat";
    case 101: return "Karia";
    case 102: return "Tekasür";
    case 103: return "Asr";
    case 104: return "Hümeze";
    case 105: return "Fil";
    case 106: return "Kureyş";
    case 107: return "Maun";
    case 108: return "Kevser";
    case 109: return "Kafirun";
    case 110: return "Nasr";
    case 111: return "Tebbet";
    case 112: return "İhlas";
    case 113: return "Felak";
    case 114: return "Nas";
    default: return null;
  }
}

module.exports = {
  buildAssistantText,
  buildCasualConversationAnswer,
  buildDuaRequestAnswer,
  buildGeneralIslamicAnswer,
  buildPracticalGuidanceAnswer,
  buildZikirRequestAnswer,
  buildWorshipPracticeAnswer,
  composeAssistantText,
  composeDirectAyah,
  composeSupportiveAyah,
  composeExplanationWithAyah,
  composeDuaGuidance,
};




