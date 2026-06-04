// Resolves short conversation context for follow-up questions.
// Normalization lives here as the single source of truth for Turkish text matching.

const THEMES = [
  "zikir",
  "ibadet",
  "dua",
  "sabır",
  "umut",
  "tevekkül",
  "tövbe",
  "şükür",
  "korku",
  "yalnızlık",
  "irade",
  "sebat",
  "affetmek",
  "şifa",
  "hastalık",
  "kaygı",
  "daralma",
  "çaresizlik",
  "bağışlanma",
  "nefs mücadelesi",
  "ölüm korkusu",
  "aile",
  "rızık",
  "imtihan",
  "iman",
  "kul hakki",
  "evlilik",
  "helal",
  "ahiret",
  "ölüm",
];

const GENERIC_THEMES = new Set(["umut", "tevekkül"]);

const CONTEXT_DEPENDENT_PHRASES = [
  "bununla ilgili",
  "bunun hakkında",
  "buna uygun",
  "bu konuda",
  "buna dair",
  "onunla ilgili",
  "peki",
  "başka ne var",
  "başka ayet",
  "ayet var mı",
  "dua var mı",
];

const TOPIC_PATTERNS = [
  {
    topic: "namaz",
    phrases: ["namaz", "salat", "salah", "ikame", "ruku", "rüku", "secde"],
  },
  {
    topic: "zikir",
    phrases: [
      "zikir",
      "zikredin",
      "zikretmek",
      "tesbih",
      "tesbihat",
      "allahı anma",
      "allah'ı anma",
      "allahi anma",
      "allah i anma",
      "allahı zikret",
      "allah'ı zikret",
      "Allah'ı anmak",
      "hamd",
      "sübhanallah",
      "elhamdülillah",
      "allahu ekber",
    ],
  },
  {
    topic: "tövbe",
    phrases: [
      "tövbe",
      "tevbe",
      "günah",
      "gunah",
      "affeder",
      "affeder mi",
      "bağışlar mı",
      "bagislar mi",
      "bağışlan",
      "bagislan",
      "istiğfar",
      "istigfar",
      "pişman",
      "pisman",
      "pişmanım",
      "pismanim",
    ],
  },
  {
    topic: "aile",
    phrases: [
      "aile",
      "çocuk",
      "çocuğum",
      "çocuklarım",
      "evlat",
      "evladım",
      "oğlum",
      "kızım",
      "nesil",
      "zürriyetim",
      "zürriyetimiz",
    ],
  },
  {
    topic: "nefs mücadelesi",
    phrases: [
      "nefs", "nefis", "nefsi", "nefislerimiz",
      "kendimi kontrol", "irade", "arınmak", "arınma",
      "tezkiye", "kendimi değiştir", "içimdeki",
    ],
  },
  { topic: "dua", phrases: ["dua", "niyaz", "yakarma"] },
  {
    topic: "sabır",
    phrases: [
      "sabır",
      "sabir",
      "sabr",
      "sebat",
      "sabretmek",
      "sabredemiyorum",
      "dayanamıyorum",
      "çok zorlanıyorum",
      "birini kaybettim",
      "yakınımı kaybettim",
      "yas",
      "sabır ayeti",
      "sabir ayeti",
      "zor zamanlarda sabır",
    ],
  },
  { topic: "tevekkül", phrases: ["tevekkül", "tevekkul"] },
  {
    topic: "hz_muhammed",
    phrases: [
      "muhammed",
      "muhammed peygamber",
      "hz muhammed",
      "hz. muhammed",
      "peygamber",
      "peygamberimiz",
      "resulullah insanlara nasıl davranırdı",
      "peygamberimizin ahlakı nasıldı",
      "hz muhammed insanlara nasıl davranırdı",
      "peygamberin karakteri nasıldı",
      "resul",
      "rasul",
      "resulullah",
      "allah resulu",
    ],
  },
  {
    topic: "umut",
    phrases: [
      "umut",
      "umit",
      "motive",
      "motivasyon",
      "moral",
      "teselli",
      "umut veren",
      "motive edici",
      "güçlendirecek",
      "güçlendirici",
      "güç veren",
      "içimi güçlendirecek",
    ],
  },
  {
    topic: "yalnızlık",
    phrases: ["yalnız", "yalnızlık", "yalniz", "yalnizlik", "kimsem yok", "kimsesiz", "Allah benden uzak mı", "Allah bana yakın mı", "Allah beni duyar mı", "uzak hissediyorum", "manevi boşluk", "kalbim soğudu"],
  },
  {
    topic: "korku",
    phrases: [
      "çok korkuyorum",
      "korkuyorum",
      "korku",
      "ölüm korkusu",
      "olum korkusu",
    ],
  },
  {
    topic: "kaygı",
    phrases: [
      "kaygı",
      "kaygi",
      "endişe",
      "endise",
      "endişeliyim",
      "endiseliyim",
      "gelecek için endişeliyim",
      "yarın ne olacak",
      "tedirgin",
      "panik",
      "kötü bir şey",
      "kotu bir sey",
      "başımıza kötü bir şey",
      "basimiza kotu bir sey",
    ],
  },
  {
    topic: "adalet",
    phrases: [
      "adalet",
      "haks?zl?k",
      "haksizl?k",
      "haksizlik",
      "zul?m",
      "zulum",
      "hakk?m yeniyor",
      "hakkim yeniyor",
      "haks?zl??a u?rad?m",
      "haksizliga ugradim",
      "adalet istiyorum",
      "zulüm görüyorum",
      "zulum goruyorum",
    ],
  },
  {
    topic: "r?z?k",
    phrases: [
      "r?z?k",
      "rizik",
      "ge?im",
      "gecim",
      "i? bulam?yorum",
      "is bulamiyorum",
      "maddi s?k?nt?",
      "maddi sikinti",
      "ge?im derdi",
      "gecim derdi",
      "maddi s?k?nt? ya??yorum",
      "maddi sikinti yasiyorum",
      "borcum var",
      "çok borcum var",
      "geçinemiyorum",
      "para yetmiyor",
      "iş bulamıyorum",
    ],
  },
  {
    topic: "daralma",
    phrases: [
      "içim daralıyor",
      "icim daraliyor",
      "bunaldım",
      "bunaldim",
      "bunalıyorum",
      "daralma",
      "sıkışıyorum",
      "sikisiyorum",
      "boğuluyorum",
      "boguluyorum",
      "iç sıkıntısı",
      "ic sikintisi",
    ],
  },
  { topic: "şifa", phrases: ["hasta", "şifa", "sifa", "hastalık", "hastalik"] },
  {
    topic: "çaresizlik",
    phrases: [
      "çaresiz",
      "caresiz",
      "umutsuz",
      "tükenmiş",
      "tukenmis",
      "ne yapacağımı bilmiyorum",
      "ne yapacagimi bilmiyorum",
      "çıkış yok",
      "cikis yok",
    ],
  },
  {
    topic: "ibadet",
    phrases: ["oruç", "sure", "ibadet"],
  },
  {
    topic: "iman",
    phrases: [
      "iman",
      "inanç",
      "inanmak",
      "imanımı güçlendir",
      "imanım güçlensin",
      "imanım zayıflıyor",
      "imanım sarsıldı",
      "imanımı kaybediyorum",
      "iman nedir",
      "iman etmek",
    ],
  },
  { topic: "kul hakki",  phrases: ["kul hakkı", "hakkını yemek", "başkasının hakkı", "ölçüde hile"] },
  { topic: "evlilik",    phrases: ["evlilik", "nikah", "evlenmek", "eşime", "eşimle", "karı koca"] },
  { topic: "helal",      phrases: ["helal", "haram", "helal haram", "helal kazanç"] },
  {
    topic: "ahiret",
    phrases: [
      "ahiret", "öbür dünya", "obur dunya",
      "kıyamet", "kiyamet", "mahşer", "mahser",
      "öldükten sonra", "olduktan sonra",
      "ahirette", "hesap günü", "hesap gunu",
      "cennet ve cehennem", "son gün",
      "ahiret hakkında", "ahiret için",
      "ölüm ve ahiret", "olum ve ahiret",
      "ölüm ve ahiret hakkında", "olum ve ahiret hakkinda",
    ],
  },
  {
    topic: "ölüm",
    phrases: [
      "ölüm hakkında", "olum hakkinda",
      "ölüm gerçeği", "olum gercegi",
      "hayatın sonu", "hayatin sonu",
      "vefat", "öldükten sonra ne olacak",
    ],
  },
];

const MOJIBAKE_REPLACEMENTS = [
  ["Ä±", "ı"],
  ["Ä°", "İ"],
  ["Ã§", "ç"],
  ["Ã‡", "Ç"],
  ["Ã¶", "ö"],
  ["Ã–", "Ö"],
  ["Ã¼", "ü"],
  ["Ãœ", "Ü"],
  ["ÃŸ", "ş"],
  ["ÅŸ", "ş"],
  ["Åž", "Ş"],
  ["ÄŸ", "ğ"],
  ["Äž", "Ğ"],
  ["Ã¢", "â"],
  ["Ã®", "î"],
  ["Ã»", "û"],
  ["â€™", "'"],
  ["â€˜", "'"],
  ["â€œ", "\""],
  ["â€", "\""],
  ["ÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â°", "İ"],
  ["ÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±", "ı"],
  ["ÃƒÆ’Ã¢â‚¬ÂÃƒâ€¦Ã‚Â¸", "ğ"],
  ["ÃƒÆ’Ã¢â‚¬ÂÃƒâ€¦Ã‚Â¾", "Ğ"],
  ["ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§", "ç"],
  ["ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡", "Ç"],
  ["ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¶", "ö"],
  ["ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“", "Ö"],
  ["ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼", "ü"],
  ["ÃƒÆ’Ã†â€™Ãƒâ€¦Ã¢â‚¬Å“", "Ü"],
  ["ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸", "ş"],
  ["ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¾", "Ş"],
  ["ÃƒÆ’Ã¢â‚¬Â¡", "Ç"],
  ["ÃƒÆ’Ã‚Â§", "ç"],
  ["Ãƒâ€Ã…Â¸", "ğ"],
  ["Ãƒâ€Ã…Â¾", "Ğ"],
  ["Ãƒâ€Ã‚Â", "Ğ"],
  ["Ãƒâ€Ã‚Â±", "ı"],
  ["Ãƒâ€Ã‚Â°", "İ"],
  ["ÃƒÆ’Ã‚Â¶", "ö"],
  ["ÃƒÆ’Ã¢â‚¬â€œ", "Ö"],
  ["Ãƒâ€¦Ã…Â¸", "ş"],
  ["Ãƒâ€¦Ã…Â¾", "Ş"],
  ["ÃƒÆ’Ã‚Â¼", "ü"],
  ["ÃƒÆ’Ã…â€œ", "Ü"],
  ["ÃƒÆ’Ã‚Â¢", "â"],
  ["ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€Â¢", "'"],
  ["ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ", "\""],
  ["ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â", "\""],
  ["ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“", "'"],
  ["ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“", "-"],
  ["ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â", "-"],
  ["Ãƒâ€š", ""],
];

let lastContextResolutionMeta = {
  used_topic_recovery: false,
};

function buildContextSummary(history = []) {
  return normalizeHistory(history)
    .slice(-6)
    .map((item) => ({
      role: item.role,
      text: item.text,
      intent: item.intent || null,
      primary_theme: item.primary_theme || null,
      secondary_themes: item.secondary_themes || [],
      emotion: item.emotion || null,
      severity: item.severity || null,
      response_type: item.response_type || null,
      context_topic: item.context_topic || null,
      selected_ayah_id: item.selected_ayah_id || null,
    }));
}

function normalizeHistory(history = []) {
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
        intent: readCleanString(item.intent),
        primary_theme: canonicalTheme(item.primary_theme),
        secondary_themes: readThemeList(item.secondary_themes),
        emotion: readCleanString(item.emotion),
        severity: readAllowedValue(item.severity, ["low", "medium", "high"]),
        response_type: readCleanString(item.response_type),
        context_topic: readContextTopic(item.context_topic),
        selected_ayah_id: readPositiveInt(item.selected_ayah_id),
      };
    })
    .filter(Boolean)
    .slice(-6);
}

function isContextDependentMessage(normalizedMessage) {
  const text = normalize(normalizedMessage);
  return CONTEXT_DEPENDENT_PHRASES.some((phrase) => includesPhrase(text, phrase));
}

function inferContextTopic(message, history = []) {
  const normalizedMessage = normalize(decodeURIComponentSafe(message));
  const normalizedHistory = normalizeHistory(history);
  const explicitTopic = detectExplicitTopic(normalizedMessage);
  const contextDependent = isContextDependentMessage(normalizedMessage);

  lastContextResolutionMeta = {
    used_topic_recovery: false,
  };

  if (explicitTopic) {
    return explicitTopic;
  }

  if (isFollowupAyahQuery(message)) {
    const recovered = recoverLastExplicitTopic(normalizedHistory);
    if (recovered) {
      lastContextResolutionMeta = {
        used_topic_recovery: true,
      };
      return recovered;
    }
  }

  const recentUserTopic = topicFromRecentUserText(normalizedHistory);
  if (recentUserTopic) {
    return recentUserTopic;
  }

  if (contextDependent) {
    const recentAssistantTopic = topicFromRecentAssistantMetadata(normalizedHistory);
    if (recentAssistantTopic) {
      return recentAssistantTopic;
    }
  }

  const recentGeneralTopic = topicFromRecentText(normalizedHistory);
  if (recentGeneralTopic) {
    return recentGeneralTopic;
  }

  const metadataTopic = topicFromRecentMetadata(normalizedHistory);
  return metadataTopic || null;
}

function recoverLastExplicitTopic(history) {
  if (!Array.isArray(history)) return null;

  const explicitTopics = ["namaz", "dua", "zikir", "sabır", "tevekkül", "tövbe", "umut", "hz_muhammed", "şifa", "adalet", "rızık", "yalnızlık", "kaygı", "aile", "nefs mücadelesi"];

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (!msg) continue;
    if (explicitTopics.includes(msg.context_topic)) {
      return msg.context_topic;
    }
  }

  return null;
}

function isFollowupAyahQuery(message) {
  const m = String(message || "").toLowerCase();

  return (
    m.includes("baska ayet") ||
    m.includes("başka ayet") ||
    m.includes("benzer ayet") ||
    m.includes("buna uygun ayet")
  );
}

function isPrayerRakatsQuestion(message) {
  const text = normalize(message);
  if (!text) return false;

  const rakatSignals = [
    "kac rekat",
    "kac rek'at",
    "kac rekat",
    "kaç rekat",
    "kaç rekât",
    "kaç rekat",
    "kaç sünnet",
    "kaç sunnet",
    "kaç farz",
    "rekat",
    "rekat",
  ];
  const prayerSignals = [
    "sabah namaz??",
    "ogle namazi",
    "????le namaz??",
    "ikindi namaz??",
    "ak??am namaz??",
    "aksam namazi",
    "yats?? namaz??",
    "yatsi namazi",
    "vitir",
    "teravih",
    "teravi",
    "cuma",
    "bayram",
    "cenaze",
    "namaz",
  ];

  return rakatSignals.some((signal) => text.includes(normalize(signal))) &&
    prayerSignals.some((signal) => text.includes(normalize(signal)));
}

function detectExplicitTopic(message) {
  return topicFromText(message);
}

function topicFromMetadata(item) {
  if (!item) return null;

  if (item.context_topic) {
    return item.context_topic;
  }

  if (item.primary_theme && !GENERIC_THEMES.has(item.primary_theme)) {
    return item.primary_theme;
  }

  if (Array.isArray(item.secondary_themes)) {
    const secondaryTopic = item.secondary_themes.find((theme) => !GENERIC_THEMES.has(theme));
    if (secondaryTopic) {
      return secondaryTopic;
    }
  }

  if (item.intent === "worship_practice_question") return "ibadet";
  if (item.response_type === "practice_suggestion") return "ibadet";
  return null;
}

function topicFromText(value) {
  const text = normalize(decodeURIComponentSafe(value));
  for (const pattern of TOPIC_PATTERNS) {
    if (pattern.phrases.some((phrase) => includesPhrase(text, phrase))) {
      return pattern.topic;
    }
  }
  return null;
}

function canonicalTopic(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const explicitTopic = topicFromText(value);
  if (explicitTopic) return explicitTopic;

  const canonical = canonicalTheme(value);
  if (canonical) return canonical;

  const normalizedTopic = normalize(value);
  const aliases = {
    sabir: "sab?r",
    sabr: "sab?r",
    tevekkul: "tevekk?l",
    tovbe: "t?vbe",
    sukur: "??k?r",
    kaygi: "kayg?",
    adalet: "adalet",
    rizik: "r?z?k",
    yalnizlik: "yaln?zl?k",
    caresizlik: "?aresizlik",
    muhammed: "hz_muhammed",
    peygamber: "hz_muhammed",
    peygamberimiz: "hz_muhammed",
    resul: "hz_muhammed",
    rasul: "hz_muhammed",
    resulullah: "hz_muhammed",
    moral: "umut",
    motive: "umut",
    motivasyon: "umut",
    umit: "umut",
  };
  return aliases[normalizedTopic] || null;
}

function themeForContextTopic(topic) {
  const normalizedTopic = normalize(topic);
  const resolvedTopic = canonicalTopic(topic);
  if (resolvedTopic === "hz_muhammed") return "umut";
  if (resolvedTopic === "casual") return "casual";
  if (resolvedTopic) return resolvedTopic;
  const mapping = {
    "allahi anma": "zikir",
    "allahi zikret": "zikir",
    namaz: "ibadet",
    salat: "ibadet",
    salah: "ibadet",
    sure: "ibadet",
    korku: "korku",
    kaygi: "kaygı",
    adalet: "adalet",
    daralma: "daralma",
    çaresizlik: "çaresizlik",
  };
  if (normalizedTopic === normalize("casual") || normalizedTopic === normalize("selam") || normalizedTopic === normalize("merhaba")) {
    return "casual";
  }
  return mapping[normalizedTopic] || "umut";
}

function secondaryThemesForContextTopic(topic) {
  const normalizedTopic = canonicalTopic(topic) || normalize(topic);
  const mapping = {
    namaz: ["ibadet", "dua"],
    zikir: ["ibadet", "tevekkül"],
    dua: ["ibadet", "tevekkül"],
    sabır: ["tevekkül", "umut"],
    tevekkül: ["umut", "sabır"],
    tövbe: ["bağışlanma", "umut"],
    umut: ["tevekkül", "sabır"],
    hz_muhammed: ["sebat", "tevekkül"],
    yalnızlık: ["tevekkül", "umut"],
    şifa: ["hastalık", "sabır"],
    kaygı: ["tevekkül", "umut"],
    adalet: ["sabır", "affetmek"],
    rızık: ["tevekkül", "umut"],
    daralma: ["tevekkül", "umut"],
    korku: ["tevekkül", "umut"],
    çaresizlik: ["tevekkül", "sabır"],
    ibadet: ["zikir", "tevekkül"],
  };
  return mapping[normalizedTopic] || ["tevekkül"];
}

function normalize(value) {
  let text = repairMojibake(decodeURIComponentSafe(String(value || "")));
  text = text
    .replace(/[`´‘’¼]/g, "'")
    .replace(/[âÂ]/g, "a")
    .replace(/[îÎ]/g, "i")
    .replace(/[ûÛ]/g, "u")
    .replace(/[â€œâ€â€]/g, "\"")
    .replace(/[â€â€‘â€’â€“â€”]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC");

  text = text
    .replace(/[^\p{L}\p{N}'\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

function isPureGreetingMessage(value) {
  const normalized = normalize(value);
  return new Set([
    "merhaba",
    "selam",
    "hello",
    "nasılsın",
    "nasilsin",
  ]).has(normalized);
}

function decodeURIComponentSafe(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

function repairMojibake(value) {
  let repaired = value;
  for (const [broken, fixed] of MOJIBAKE_REPLACEMENTS) {
    repaired = repaired.split(broken).join(fixed);
  }
  return repaired;
}

function includesPhrase(normalizedText, phrase) {
  return normalizedText.includes(normalize(phrase));
}

function topicFromRecentMetadata(history) {
  for (const item of [...history].reverse()) {
    const topic = topicFromMetadata(item);
    if (topic) return topic;
  }
  return null;
}

function topicFromRecentAssistantMetadata(history) {
  for (const item of [...history].reverse()) {
    if (item.role !== "assistant") continue;
    const topic = topicFromMetadata(item);
    if (topic) return topic;
  }
  return null;
}

function topicFromRecentUserText(history) {
  for (const item of [...history].reverse()) {
    if (item.role !== "user") continue;
    const topic = topicFromText(item.text);
    if (topic) return topic;
  }
  return null;
}

function topicFromRecentText(history) {
  for (const item of [...history].reverse()) {
    const topic = topicFromText(item.text);
    if (topic) return topic;
  }
  return null;
}

function canonicalTheme(value) {
  const normalizedValue = normalize(value);
  return THEMES.find((theme) => normalize(theme) === normalizedValue) || null;
}

function readThemeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => canonicalTheme(item))
    .filter(Boolean)
    .filter((theme, index, themes) => themes.indexOf(theme) === index)
    .slice(0, 4);
}

function readContextTopic(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  return canonicalTopic(value);
}

function readAllowedValue(value, allowed) {
  if (typeof value !== "string") return null;
  const normalizedValue = value.trim().toLowerCase();
  return allowed.includes(normalizedValue) ? normalizedValue : null;
}

function readCleanString(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function readPositiveInt(value) {
  const number = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function getContextResolutionDebugMeta() {
  if (process.env.DEBUG_CHAT_ENGINE === "true") {
    return { ...lastContextResolutionMeta };
  }
  return {
    used_topic_recovery: false,
  };
}

module.exports = {
  THEMES,
  buildContextSummary,
  getContextResolutionDebugMeta,
  normalizeHistory,
  isContextDependentMessage,
  inferContextTopic,
  detectExplicitTopic,
  isFollowupAyahQuery,
  recoverLastExplicitTopic,
  topicFromText,
  canonicalTopic,
  isPrayerRakatsQuestion,
  topicFromMetadata,
  themeForContextTopic,
  secondaryThemesForContextTopic,
  normalize,
  isPureGreetingMessage,
  decodeURIComponentSafe,
};
