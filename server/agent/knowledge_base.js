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
  const ilmihalHit = routeKnowledge(message, analysis, plannerPlan, history);
  if (ilmihalHit) {
    return ilmihalHit;
  }

  if (isSupportiveForgivenessPrompt(message, normalizedMessage) && !hasProceduralKnowledgeCue(message, normalizedMessage)) {
    return null;
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
    "gusul",
    "gusül",
    "seferi",
    "wudu",
    "namaz",
    "teravih",
    "teravi",
    "cuma",
    "bayram",
    "cenaze",
    "kurban",
    "hac",
    "umre",
    "teyemmum",
    "mest",
    "sargi",
    "hayiz",
    "hayız",
    "nifas",
    "istihaze",
    "ozur kani",
    "özür kanı",
    "adetliyken",
    "regl",
    "lohusalık",
    "oruc",
    "oruç",
    "zekat",
    "zekat",
    "fitre",
    "nisap",
    "dua",
    "sahur",
    "vitir",
    "namaz vakitleri",
    "yemin",
    "adak",
    "kefaret",
    "helal",
    "haram",
    "faiz",
    "müzik",
    "muzik",
    "sigara",
    "dövme",
    "dovme",
    "kredi kartı",
    "kredi karti",
    "banka faizi",
    "bahis",
    "kumar",
    "şüpheli kazanç",
    "supheli kazanc",
    "alışverişte kul hakkı",
    "kul hakkı içeren alışveriş",
    "haram para nasıl temizlenir",
    "haram para temizleme",
    "yalan yere yemin",
    "kul hakki",
    "kul hakkı",
    "anne baba",
    "giybet",
    "israf",
    "selamlasma",
    "selamlaşma",
    "komsuluk",
    "komşuluk",
    "niyet",
    "niyet nasil edilir",
    "niyet nasıl edilir",
    "kandil",
    "kandil geceleri",
    "mirac kandili",
    "miraç kandili",
    "isra ve mirac",
    "isra mirac gecesi",
    "berat kandili",
    "regaip kandili",
    "mevlid kandili",
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
    "nasıl alınır",
    "nasil alinir",
    "nedir",
    "nelerdir",
    "kimlere verilir",
    "şart mı",
    "sart mi",
    "farz mı",
    "farz mi",
    "vacip mi",
    "kaç rekat",
    "kac rekat",
    "kaç rekât",
    "kac rekât",
    "niyet nasil edilir",
    "niyet nasıl edilir",
    "nasıl niyet edilir",
    "nasil niyet edilir",
    "zekat nedir",
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
    "kurban nedir",
    "kurban kimlere vaciptir",
    "kurban ne zaman kesilir",
    "kurban eti nasil paylasilir",
    "kurban eti nasıl paylaşılır",
    "kurban keserken nelere dikkat edilir",
    "hac nedir",
    "hac kimlere farzdır",
    "hac kimlere farzdir",
    "haccin farzlari",
    "haccın farzları",
    "umre nedir",
    "hac ile umre farkı",
    "hac ve umre farkı",
    "teyemmum nedir",
    "teyemmum nasıl alınır",
    "teyemmum nasil alinir",
    "teyemmümü bozan şeyler",
    "teyemmumu bozan şeyler",
    "mest üzerine mesh",
    "mest uzerine mesh",
    "sargı üzerine mesh",
    "sargi üzerine mesh",
    "hayız nedir",
    "adet nedir",
    "regl nedir",
    "hayız halinde namaz",
    "adetliyken namaz kılınır mı",
    "adetliyken oruç tutulur mu",
    "adetliyken oruç kazası",
    "adetliyken kuran okunur mu",
    "nifas nedir",
    "lohusalıkta namaz",
    "istihaze nedir",
    "özür kanı",
    "ozur kani",
    "özür kanı namaz",
    "yemin nedir",
    "yemin kefareti",
    "yemin bozulursa",
    "adak nedir",
    "adak kurbanı nedir",
    "adak kurbani nedir",
    "kefaret nedir",
    "tövbe nasıl edilir",
    "tevbe nasıl edilir",
    "dua nedir",
    "dua nasıl edilir",
    "helal haram nedir",
    "faiz nedir",
    "kul hakkı nedir",
    "kul hakki nedir",
    "anne baba hakkı nedir",
    "anne baba hakki nedir",
    "gıybet nedir",
    "giybet nedir",
    "israf nedir",
    "selamlaşma adabı",
    "selamlasma adabi",
    "komşuluk hakkı nedir",
    "komsuluk hakki nedir",
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
    "günah işledim ne yapmalıyım",
    "gunah isledim ne yapmalıyim",
    "tövbenin şartları nelerdir",
    "tevbenin şartları nelerdir",
    "aynı günahı tekrar işliyorum",
    "ayni gunahi tekrar isliyorum",
    "kul hakkı nasıl ödenir",
    "kul hakki nasil odenir",
    "gıybet ettim ne yapmalıyım",
    "giybet ettim ne yapmaliyim",
    "yalan söylemek günah mı",
    "yalan soylemek gunah mi",
    "kalp kırmak kul hakkı mı",
    "kalp kirmak kul hakki mi",
    "haram para kazandım ne yapmalıyım",
    "haram para kazandim ne yapmaliyim",
    "faizli kredi kullanmak caiz mi",
    "zina yaptım tövbe olur mu",
    "zina yaptim tovbe olur mu",
    "tövbe duası",
    "tevbe duası",
    "duası var mı",
    "duasi var mi",
    "nedir",
    "nelerdir",
    "kurban nedir",
    "kurban kimlere vaciptir",
    "kurban ne zaman kesilir",
    "kurban eti nasil paylasilir",
    "kurban eti nasıl paylaşılır",
    "kurban keserken nelere dikkat edilir",
    "hac nedir",
    "hac kimlere farzdır",
    "hac kimlere farzdir",
    "haccin farzlari",
    "haccın farzları",
    "umre nedir",
    "hac ile umre farkı",
    "hac ve umre farkı",
    "teyemmum nedir",
    "teyemmum nasıl alınır",
    "teyemmum nasil alinir",
    "teyemmümü bozan şeyler",
    "teyemmumu bozan şeyler",
    "mest üzerine mesh",
    "mest uzerine mesh",
    "sargı üzerine mesh",
    "sargi üzerine mesh",
    "hayız nedir",
    "adet nedir",
    "regl nedir",
    "hayız halinde namaz",
    "adetliyken namaz kılınır mı",
    "adetliyken oruç tutulur mu",
    "adetliyken oruç kazası",
    "adetliyken kuran okunur mu",
    "nifas nedir",
    "lohusalıkta namaz",
    "istihaze nedir",
    "özür kanı",
    "ozur kani",
    "özür kanı namaz",
    "yemin kefareti",
    "adak kurbani",
    "adak kurbanı",
    "kefaret nedir",
    "dua nedir",
    "dua nasıl edilir",
    "dua nasil edilir",
    "tövbe nasıl edilir",
    "tevbe nasıl edilir",
    "helal haram nedir",
    "faiz nedir",
    "kul hakkı",
    "kul hakki",
    "anne baba hakkı",
    "anne baba hakki",
    "gıybet",
    "giybet",
    "israf",
    "selamlaşma",
    "selamlasma",
    "komşuluk",
    "kandil",
    "kandil geceleri",
    "mirac kandili",
    "miraç kandili",
    "isra ve mirac",
    "isra mirac gecesi",
    "berat kandili",
    "regaip kandili",
    "mevlid kandili",
    "komsuluk",
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
    "gusul",
    "gusül",
    "seferi",
    "namaz vakitleri",
    "nikah",
    "nikâh",
    "bosanma",
    "boşanma",
    "talak",
    "miras",
    "sadaka",
    "kandil",
    "gece ibadetleri",
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
    "nasıl alınır",
    "nasil alinir",
    "nedir",
    "nelerdir",
    "kimlere verilir",
    "şart mı",
    "sart mi",
    "farz mı",
    "farz mi",
    "vacip mi",
    "kaç rekat",
    "kac rekat",
    "kaç rekât",
    "kac rekât",
    "nikâh nedir",
    "nikah nedir",
    "nikâh şartları",
    "nikah şartları",
    "aile hakkı",
    "aile hakki",
    "boşanma nedir",
    "bosanma nedir",
    "talak nedir",
    "miras nedir",
    "miras paylaşımı",
    "miras paylasimi",
    "sadaka nedir",
    "sadaka kime verilir",
    "kandil geceleri nedir",
    "gece ibadetleri nelerdir",
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

