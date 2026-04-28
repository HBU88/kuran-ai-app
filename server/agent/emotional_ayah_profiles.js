const { normalize } = require("./context_resolver");

const BASE_ANTI_PATTERN_KEYWORDS = [
  "haram",
  "helal",
  "domuz",
  "kan",
  "kesilen",
  "kesilmiş",
  "avlan",
  "miras",
  "borç",
  "alacak",
  "satış",
  "ticaret",
  "faiz",
  "boşama",
  "talak",
  "iddet",
  "nikah",
  "evlilik",
  "savaş",
  "savaşın",
  "öldür",
  "öldürün",
  "düşman",
  "ihram",
  "kurban",
  "fal",
  "oklar",
  "hukuk",
  "hüküm",
  "hükümler",
  "kesilenler",
  "yemek",
];

const EMOTIONAL_PROFILES = {
  korku: {
    key: "korku",
    priority_ayah_ids: [466, 293, 1286, 5220, 1735],
    strong_keywords: ["korkmayın", "korkma", "korku", "ölüm korkusu", "kötü bir şey", "Allah yeter", "kalpler", "yardım", "huzur"],
    anti_pattern_keywords: BASE_ANTI_PATTERN_KEYWORDS,
    priority_bonus: 260,
    keyword_bonus: 72,
    anti_pattern_penalty: 28,
    max_keyword_bonus: 180,
    max_anti_pattern_penalty: 220,
  },
  kaygi: {
    key: "kaygı",
    priority_ayah_ids: [1735, 293, 466, 5220, 1286],
    strong_keywords: ["kaygı", "kaygi", "endişe", "endise", "tedirgin", "panik", "huzur", "sıkıntı", "ferahlık", "kalpler", "gelecek"],
    anti_pattern_keywords: BASE_ANTI_PATTERN_KEYWORDS,
    priority_bonus: 250,
    keyword_bonus: 68,
    anti_pattern_penalty: 26,
    max_keyword_bonus: 170,
    max_anti_pattern_penalty: 210,
  },
  daralma: {
    key: "daralma",
    priority_ayah_ids: [1735, 5220, 293, 4111, 6082],
    strong_keywords: ["daralma", "iç daralması", "içim daralıyor", "bunalm", "boğul", "sıkış", "ferahlık", "teselli", "huzur", "sıkıntı"],
    anti_pattern_keywords: BASE_ANTI_PATTERN_KEYWORDS,
    priority_bonus: 250,
    keyword_bonus: 68,
    anti_pattern_penalty: 26,
    max_keyword_bonus: 170,
    max_anti_pattern_penalty: 210,
  },
  caresizlik: {
    key: "çaresizlik",
    priority_ayah_ids: [4111, 603, 229, 167, 44],
    strong_keywords: ["çaresiz", "çaresizlik", "tükenmiş", "umutsuz", "çıkış yok", "ne yapacağımı bilmiyorum", "rahmet", "af", "yardım", "umut"],
    anti_pattern_keywords: BASE_ANTI_PATTERN_KEYWORDS,
    priority_bonus: 240,
    keyword_bonus: 66,
    anti_pattern_penalty: 24,
    max_keyword_bonus: 160,
    max_anti_pattern_penalty: 200,
  },
  yalnizlik: {
    key: "yalnızlık",
    priority_ayah_ids: [1275, 6082, 1735, 4111],
    strong_keywords: ["yalnız", "yalnızlık", "yalniz", "yalnizlik", "huzur", "yakın", "Allah", "teselli", "kalpler", "beraber"],
    anti_pattern_keywords: BASE_ANTI_PATTERN_KEYWORDS,
    priority_bonus: 240,
    keyword_bonus: 66,
    anti_pattern_penalty: 24,
    max_keyword_bonus: 160,
    max_anti_pattern_penalty: 200,
  },
  tovbe: {
    key: "tövbe",
    priority_ayah_ids: [4111, 603, 229, 167, 44],
    strong_keywords: ["tövbe", "tevbe", "günah", "gunah", "pişman", "pisman", "affet", "bağışla", "bagisla", "istiğfar", "istigfar", "rahmet", "umut"],
    anti_pattern_keywords: BASE_ANTI_PATTERN_KEYWORDS,
    priority_bonus: 250,
    keyword_bonus: 72,
    anti_pattern_penalty: 24,
    max_keyword_bonus: 180,
    max_anti_pattern_penalty: 200,
  },
  umut: {
    key: "umut",
    priority_ayah_ids: [4111, 293, 5220, 1286],
    strong_keywords: ["umut", "rahmet", "ferahlık", "kolaylık", "sabır", "tevekkül", "yakın", "Allah"],
    anti_pattern_keywords: BASE_ANTI_PATTERN_KEYWORDS,
    priority_bonus: 220,
    keyword_bonus: 58,
    anti_pattern_penalty: 22,
    max_keyword_bonus: 150,
    max_anti_pattern_penalty: 180,
  },
  tevekkul: {
    key: "tevekkül",
    priority_ayah_ids: [466, 293, 1286, 5220, 1275],
    strong_keywords: ["tevekkül", "tevekkul", "güven", "Allah yeter", "sabır", "yardım", "kalpler", "huzur"],
    anti_pattern_keywords: BASE_ANTI_PATTERN_KEYWORDS,
    priority_bonus: 250,
    keyword_bonus: 70,
    anti_pattern_penalty: 26,
    max_keyword_bonus: 170,
    max_anti_pattern_penalty: 210,
  },
  sabir: {
    key: "sabır",
    priority_ayah_ids: [160, 162, 163, 164, 1735],
    strong_keywords: ["sabır", "sabir", "sabr", "sebat", "dayanım", "güç", "yardım", "sabredenler", "huzur"],
    anti_pattern_keywords: BASE_ANTI_PATTERN_KEYWORDS,
    priority_bonus: 250,
    keyword_bonus: 70,
    anti_pattern_penalty: 26,
    max_keyword_bonus: 170,
    max_anti_pattern_penalty: 210,
  },
};

function shouldApplyEmotionalSupportRanking(messageAnalysis, options = {}) {
  const responseType = normalizeRoutingValue(messageAnalysis?.response_type);
  const plannerResponseType = normalizeRoutingValue(options.planner_response_type);

  return (
    normalizeRoutingValue(messageAnalysis?.intent) === "emotionalspiritualsupport" ||
    ["supportiveayah", "sensitivesupport"].includes(responseType) ||
    ["supportiveayah", "sensitivesupport"].includes(plannerResponseType)
  );
}

function detectEmotionalProfileKey(messageAnalysis, options = {}) {
  const text = [
    messageAnalysis?.emotion,
    messageAnalysis?.primary_theme,
    messageAnalysis?.context_topic,
    options.planner_response_type,
    options.current_message,
  ]
    .map((value) => normalizeValue(value))
    .filter(Boolean)
    .join(" ");

  if (!text) {
    return null;
  }

  if (
    text.includes("yalnız") ||
    text.includes("yalniz") ||
    text.includes("yalnızlık") ||
    text.includes("yalnizlik")
  ) return "yalnizlik";
  if (
    text.includes("tövbe") ||
    text.includes("tevbe") ||
    text.includes("günah") ||
    text.includes("gunah") ||
    text.includes("pişman") ||
    text.includes("pisman") ||
    text.includes("affet") ||
    text.includes("bağışla") ||
    text.includes("bagisla") ||
    text.includes("istiğfar") ||
    text.includes("istigfar")
  ) return "tovbe";
  if (
    text.includes("korku") ||
    text.includes("kork") ||
    text.includes("ölüm korkusu") ||
    text.includes("olum korkusu")
  ) return "korku";
  if (
    text.includes("kaygı") ||
    text.includes("kaygi") ||
    text.includes("endişe") ||
    text.includes("endise") ||
    text.includes("tedirgin") ||
    text.includes("panik")
  ) return "kaygi";
  if (
    text.includes("daralma") ||
    text.includes("içim daral") ||
    text.includes("icim daral") ||
    text.includes("bunalm") ||
    text.includes("boğul") ||
    text.includes("bogul") ||
    text.includes("sıkış") ||
    text.includes("sikis")
  ) return "daralma";
  if (
    text.includes("çaresiz") ||
    text.includes("caresiz") ||
    text.includes("tüken") ||
    text.includes("tuken") ||
    text.includes("umutsuz") ||
    text.includes("çıkış yok") ||
    text.includes("cikis yok")
  ) return "caresizlik";
  if (text.includes("tevekkül") || text.includes("tevekkul")) return "tevekkul";
  if (text.includes("sabır") || text.includes("sabir") || text.includes("sabr")) return "sabir";
  if (
    text.includes("umut") ||
    text.includes("umutlu") ||
    text.includes("ümit") ||
    text.includes("umit") ||
    text.includes("ümitsiz") ||
    text.includes("umitsiz")
  ) return "umut";

  return null;
}

function emotionalSupportBoost(messageAnalysis, ayah, options = {}) {
  if (!shouldApplyEmotionalSupportRanking(messageAnalysis, options)) {
    return {
      emotional_profile_used: null,
      emotional_boost_score: 0,
      anti_pattern_penalty: 0,
      profile_key: null,
      priority_match: false,
    };
  }

  const profileKey = detectEmotionalProfileKey(messageAnalysis, options);
  const profile = profileKey ? EMOTIONAL_PROFILES[profileKey] : null;
  if (!profile) {
    return {
      emotional_profile_used: null,
      emotional_boost_score: 0,
      anti_pattern_penalty: 0,
      profile_key: null,
      priority_match: false,
    };
  }

  const ayahId = Number(ayah?.id);
  const searchable = normalize([
    ayah?.surah,
    ayah?.surahName,
    ayah?.text_tr,
    ayah?.text_ar,
    ayah?.notes,
    ayah?.short_explanation,
    Array.isArray(ayah?.tags) ? ayah.tags.join(" ") : "",
  ].join(" "));

  const priorityMatch = profile.priority_ayah_ids.includes(ayahId);
  const strongMatches = uniqueMatches(profile.strong_keywords, searchable);
  const antiPatternMatches = uniqueMatches(profile.anti_pattern_keywords, searchable);

  let emotionalBoostScore = 0;
  if (priorityMatch) {
    emotionalBoostScore += profile.priority_bonus;
  }
  emotionalBoostScore += Math.min(
    strongMatches.length * profile.keyword_bonus,
    profile.max_keyword_bonus
  );

  const antiPatternPenalty = Math.min(
    antiPatternMatches.length * profile.anti_pattern_penalty,
    profile.max_anti_pattern_penalty
  );

  return {
    emotional_profile_used: profile.key,
    emotional_boost_score: emotionalBoostScore,
    anti_pattern_penalty: antiPatternPenalty,
    profile_key: profile.key,
    priority_match: priorityMatch,
    strong_keyword_matches: strongMatches,
    anti_pattern_matches: antiPatternMatches,
    total_score: emotionalBoostScore - antiPatternPenalty,
  };
}

function normalizeValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  return normalize(value);
}

function normalizeRoutingValue(value) {
  return normalizeValue(value).replace(/[\s_-]+/g, "");
}

function includesAny(text, needles) {
  return needles.some((needle) => text.includes(normalizeValue(needle)));
}

function uniqueMatches(needles, searchable) {
  const results = [];
  const seen = new Set();
  for (const needle of needles) {
    const normalizedNeedle = normalizeValue(needle);
    if (!normalizedNeedle || seen.has(normalizedNeedle)) {
      continue;
    }
    if (searchable.includes(normalizedNeedle)) {
      seen.add(normalizedNeedle);
      results.push(normalizedNeedle);
    }
  }
  return results;
}

module.exports = {
  EMOTIONAL_PROFILES,
  shouldApplyEmotionalSupportRanking,
  detectEmotionalProfileKey,
  emotionalSupportBoost,
};
