const fs = require("fs");
const path = require("path");

const { routeKnowledge } = require("./knowledge_router");
const { canonicalTopic, normalize, decodeURIComponentSafe } = require("./context_resolver");

const LEGACY_DIR = path.join(__dirname, "..", "data", "knowledge");
const LEGACY_FILES = ["prayer.json", "wudu.json", "fasting.json", "zakat.json", "dua.json", "prophets.json"];

let cachedLegacyEntries = null;

function loadKnowledgeBase() {
  if (cachedLegacyEntries) return cachedLegacyEntries;

  const entries = [];
  for (const file of LEGACY_FILES) {
    const filePath = path.join(LEGACY_DIR, file);
    if (!fs.existsSync(filePath)) continue;

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const normalizedTopic = normalizeNullableTopic(item.topic) || path.basename(file, ".json");
        entries.push({
          ...item,
          id: typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : `${path.basename(file, ".json")}_${normalizedTopic}`,
          file,
          topic: normalizedTopic,
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          answer_text: typeof item.answer_text === "string" ? item.answer_text : typeof item.answer_tr === "string" ? item.answer_tr : "",
        });
      }
    } catch (error) {
      console.error(`Failed to load legacy knowledge file ${file}:`, error && error.stack ? error.stack : error);
    }
  }

  cachedLegacyEntries = entries;
  return entries;
}

function lookupKnowledgeAnswer(message, analysis = {}, plannerPlan = null, history = []) {
  const normalizedMessage = normalizeMessage(message);
  if (isSupportiveForgivenessPrompt(message, normalizedMessage) && !hasProceduralKnowledgeCue(message, normalizedMessage)) {
    return null;
  }

  const ilmihalHit = routeKnowledge(message, analysis, plannerPlan, history);
  if (ilmihalHit) {
    return ilmihalHit;
  }

  const prophetHit = lookupProphetBehaviorAnswer(normalizedMessage);
  if (prophetHit) {
    return prophetHit;
  }

  const normalizedHistory = normalizeHistory(history);
  const topic = normalizeNullableTopic(
    canonicalTopic(plannerPlan?.knowledge_topic || analysis.context_topic || analysis.primary_theme || "")
  );

  let bestEntry = null;
  let bestScore = 0;

  for (const entry of loadKnowledgeBase()) {
    const entryTopic = normalizeNullableTopic(canonicalTopic(entry.topic) || entry.topic);
    const keywords = normalizeList(entry.keywords || entry.triggers || entry.phrases || []);

    let score = 0;
    for (const keyword of keywords) {
      if (!keyword) continue;
      if (normalizedMessage.includes(keyword)) score += 5;
      else if (normalizedHistory.includes(keyword)) score += 2;
    }

    if (topic && entryTopic && topic === entryTopic) score += 2;
    if (analysis.intent === "worship_practice_question" && entryTopic === "namaz") score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (!bestEntry || bestScore <= 0) return null;

  return {
    ...bestEntry,
    file: bestEntry.file || null,
    type: bestEntry.type || "knowledge",
    topic: bestEntry.topic || null,
    answer_text: bestEntry.answer_text || "",
    source_note: bestEntry.source_note || bestEntry.source_type || "curated_internal",
    requires_ayah: false,
    route_mode: "ilmihal_knowledge",
    knowledge_hit_id: bestEntry.id || null,
  };
}

function hasKnowledgeMatch(message, analysis = {}, plannerPlan = null, history = []) {
  return Boolean(lookupKnowledgeAnswer(message, analysis, plannerPlan, history));
}

function isLocalKnowledgeQuery(message, analysis = {}, plannerPlan = null, history = []) {
  const normalized = normalizeMessage(message);
  if (!normalized) return false;
  if (containsAyahLanguage(normalized)) return false;
  if (isSupportiveForgivenessPrompt(message, normalized) && !hasProceduralKnowledgeCue(message, normalized)) return false;
  return Boolean(routeKnowledge(message, analysis, plannerPlan, history) || matchesLocalKnowledgeCue(normalized));
}

function isKnowledgeIntentQuestion(message, analysis = {}, plannerPlan = null, history = []) {
  const normalized = normalizeMessage(message);
  if (!normalized || containsAyahLanguage(normalized)) return false;
  if (isSupportiveForgivenessPrompt(message, normalized) && !hasProceduralKnowledgeCue(message, normalized)) return false;
  return Boolean(lookupKnowledgeAnswer(message, analysis, plannerPlan, history) || matchesKnowledgeQuestionCue(normalized));
}

function matchesLocalKnowledgeCue(normalizedMessage) {
  const cues = [
    "abdest",
    "wudu",
    "namaz",
    "teravih",
    "teravi",
    "cuma",
    "bayram",
    "cenaze",
    "oruc",
    "oruç",
    "zekat",
    "zekat",
    "dua",
    "sahur",
    "vitir",
  ];
  return cues.some((cue) => normalizedMessage.includes(normalize(cue)));
}

function matchesKnowledgeQuestionCue(normalizedMessage) {
  const questionMarkers = [
    "nasıl edilir",
    "nasil edilir",
    "nasıl yapılır",
    "nasil yapilir",
    "nasıl alınır",
    "nasil alinir",
    "nasıl kılınır",
    "nasil kilinir",
    "nasıldı",
    "nasildi",
    "nasıl biriydi",
    "nasil biriydi",
    "nedir",
    "nelerdir",
    "kimlere verilir",
    "şart mı",
    "sart mi",
    "kaç rekat",
    "kac rekat",
    "kaç rekât",
    "kac rekât",
  ];
  return questionMarkers.some((marker) => normalizedMessage.includes(normalize(marker)));
}

function containsAyahLanguage(normalizedMessage) {
  return normalizedMessage.includes(normalize("ayet")) || normalizedMessage.includes(normalize("kur'an"));
}

function hasProceduralKnowledgeCue(message, normalizedMessage) {
  const proceduralMarkers = [
    "nasıl edilir",
    "nasil edilir",
    "nasıl yapılır",
    "nasil yapilir",
    "nasıl alınır",
    "nasil alinir",
    "nasıl kılınır",
    "nasil kilinir",
    "nasıl tövbe",
    "nasil tovbe",
    "tövbe nasıl edilir",
    "tevbe nasıl edilir",
    "nasıl tövbe etmeliyim",
    "nasıl tevbe etmeliyim",
    "tövbe duası",
    "tevbe duası",
    "duası var mı",
    "duasi var mi",
    "nedir",
    "nelerdir",
  ];
  return proceduralMarkers.some((marker) =>
    includesLoose(normalizedMessage, marker) || includesLoose(rawMessageText(message), marker)
  );
}

function isSupportiveForgivenessPrompt(message, normalizedMessage) {
  const supportMarkers = [
    "allah beni affeder mi",
    "çok günah işledim",
    "cok gunah isledim",
    "günah işledim",
    "gunah isledim",
    "çok pişmanım",
    "cok pismanim",
    "pişmanım",
    "pismanim",
    "günah",
    "gunah",
    "affeder mi",
    "bağışlar mı",
    "bagislar mi",
    "bağışlanır mı",
    "bagislanir mi",
    "tövbe etmek istiyorum",
    "tevbe etmek istiyorum",
  ];
  return supportMarkers.some((marker) =>
    includesLoose(normalizedMessage, marker) || includesLoose(rawMessageText(message), marker)
  );
}

function rawMessageText(value) {
  return decodeURIComponentSafe(String(value || ""))
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC");
}

function includesLoose(text, phrase) {
  return String(text || "").includes(String(phrase || "").toLocaleLowerCase("tr-TR"));
}

function normalizeMessage(value) {
  return normalize(decodeURIComponentSafe(String(value || "")));
}

function normalizeHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return "";
  return history
    .slice(-4)
    .map((item) => (item && typeof item.text === "string" ? normalizeMessage(item.text) : ""))
    .join(" ");
}

function normalizeList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeMessage(value))
    .filter(Boolean);
}

function normalizeNullableTopic(value) {
  if (typeof value !== "string") return null;
  const text = normalize(value);
  return text || null;
}


function lookupProphetBehaviorAnswer(normalizedMessage) {
  const hasProphetSubject = /(?:hzs*muhammed|hz.s*muhammed|muhammed|peygamberimiz|resulullah|peygamberin)/i.test(normalizedMessage);
  const hasBehaviorQuestion = /(?:nasil biriydi|nas?ld?|nasildi|ahlak|karakter|davran?rd?|davranirdi|davranir|nas?l davran)/i.test(normalizedMessage);
  if (!hasProphetSubject || !hasBehaviorQuestion) return null;

  return {
    id: "prophet_hz_muhammed_behavior",
    file: "prophets.json",
    type: "knowledge",
    topic: "hz_muhammed",
    answer_text: "Hz. Muhammed g?venilir, merhametli, sab?rl? ve adaletli bir ?rnek olarak anlat?l?r. Onun ahlak? yumu?akl?k, ?l?? ve emanet bilinciyle ?ne ??kar.",
    source_note: "Curated internal knowledge.",
    requires_ayah: false,
    route_mode: "ilmihal_knowledge",
    knowledge_hit_id: "prophet_hz_muhammed_behavior",
  };
}

function hasKnowledgeMatch(message, analysis = {}, plannerPlan = null, history = []) {
  return Boolean(lookupKnowledgeAnswer(message, analysis, plannerPlan, history));
}

function isLocalKnowledgeQuery(message, analysis = {}, plannerPlan = null, history = []) {
  const normalized = normalizeMessage(message);
  if (!normalized) return false;
  if (containsAyahLanguage(normalized)) return false;
  return Boolean(routeKnowledge(message, analysis, plannerPlan, history) || matchesLocalKnowledgeCue(normalized));
}

function isKnowledgeIntentQuestion(message, analysis = {}, plannerPlan = null, history = []) {
  const normalized = normalizeMessage(message);
  if (!normalized || containsAyahLanguage(normalized)) return false;
  return Boolean(lookupKnowledgeAnswer(message, analysis, plannerPlan, history) || matchesKnowledgeQuestionCue(normalized));
}

function matchesLocalKnowledgeCue(normalizedMessage) {
  const cues = [
    "abdest",
    "wudu",
    "namaz",
    "teravih",
    "teravi",
    "cuma",
    "bayram",
    "cenaze",
    "oruc",
    "oruç",
    "zekat",
    "zekat",
    "dua",
    "tovbe",
    "tevbe",
    "tövbe",
    "sahur",
    "vitir",
  ];
  return cues.some((cue) => normalizedMessage.includes(normalize(cue)));
}

function matchesKnowledgeQuestionCue(normalizedMessage) {
  const questionMarkers = [
    "nasıl edilir",
    "nasil edilir",
    "nasıl yapılır",
    "nasil yapilir",
    "nasıl alınır",
    "nasil alinir",
    "nasıl kılınır",
    "nasil kilinir",
    "nasıldı",
    "nasildi",
    "nasıl biriydi",
    "nasil biriydi",
    "nedir",
    "nelerdir",
    "kimlere verilir",
    "şart mı",
    "sart mi",
    "kaç rekat",
    "kac rekat",
    "kaç rekât",
    "kac rekât",
  ];
  return questionMarkers.some((marker) => normalizedMessage.includes(normalize(marker)));
}

function containsAyahLanguage(normalizedMessage) {
  return normalizedMessage.includes(normalize("ayet")) || normalizedMessage.includes(normalize("kur'an"));
}

function normalizeMessage(value) {
  return normalize(decodeURIComponentSafe(String(value || "")));
}

function normalizeHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return "";
  return history
    .slice(-4)
    .map((item) => (item && typeof item.text === "string" ? normalizeMessage(item.text) : ""))
    .join(" ");
}

function normalizeList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeMessage(value))
    .filter(Boolean);
}

function normalizeNullableTopic(value) {
  if (typeof value !== "string") return null;
  const text = normalize(value);
  return text || null;
}


function lookupProphetBehaviorAnswer(normalizedMessage) {
  const triggers = [
    "hz muhammed nasil biriydi",
    "hz muhammed nas?l biriydi",
    "peygamberimizin ahlaki nasildi",
    "peygamberimizin ahlak? nas?ld?",
    "peygamberimiz nasil biriydi",
    "peygamberimiz nas?l biriydi",
    "resulullah nasil davran?rdi",
    "resulullah nas?l davran?rd?",
    "resulullah insanlara nasil davran?rdi",
    "resulullah insanlara nas?l davran?rd?",
    "peygamberin karakteri nasildi",
    "peygamberin karakteri nas?ld?",
  ];
  const matched = triggers.some((trigger) => normalizedMessage.includes(normalizeMessage(trigger)));
  if (!matched) return null;

  const answerText = "Hz. Muhammed g?venilir, merhametli, sab?rl? ve adaletli bir ?rnek olarak anlat?l?r. Onun ahlak? yumu?akl?k, ?l?? ve emanet bilinciyle ?ne ??kar.";
  return {
    id: "prophet_hz_muhammed_behavior",
    file: "prophets.json",
    type: "knowledge",
    topic: "hz_muhammed",
    answer_text: answerText,
    source_note: "Curated internal knowledge.",
    requires_ayah: false,
    route_mode: "ilmihal_knowledge",
    knowledge_hit_id: "prophet_hz_muhammed_behavior",
  };
}

module.exports = {
  loadKnowledgeBase,
  hasKnowledgeMatch,
  isLocalKnowledgeQuery,
  isKnowledgeIntentQuestion,
  lookupKnowledgeAnswer,
};
