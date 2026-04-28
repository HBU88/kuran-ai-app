// Scores local curated ayahs and returns the top candidates.

const fs = require("fs");
const path = require("path");
const { canonicalTopic, normalize, themeForContextTopic } = require("./context_resolver");
const {
  emotionalSupportBoost,
  shouldApplyEmotionalSupportRanking,
} = require("./emotional_ayah_profiles");

const repoRoot = path.resolve(__dirname, "..", "..");
const semanticEnrichmentPath = path.join(repoRoot, "assets", "data", "full_quran", "source_enriched.json");

const SEMANTIC_OVERRIDE_USE_CASES = {
  [normalizeThemeKey("yalnızlık")]: "loneliness_support",
  [normalizeThemeKey("tövbe")]: "repentance_support",
  [normalizeThemeKey("sabır")]: "patience_support",
  [normalizeThemeKey("hz_muhammed")]: "prophet_character",
};

const SEMANTIC_ENRICHMENT_INDEX = loadSemanticEnrichmentIndex();
const SOURCE_AYAH_INDEX_CACHE = new WeakMap();

const CURATED_TOPIC_CLUSTERS = {
  [normalizeThemeKey("sabır")]: [
    { surahNumber: 2, ayahNumber: 153 },
    { surahNumber: 2, ayahNumber: 250 },
    { surahNumber: 3, ayahNumber: 200 },
    { surahNumber: 103, ayahNumber: 3 },
    { surahNumber: 2, ayahNumber: 155 },
    { surahNumber: 11, ayahNumber: 115 },
    { surahNumber: 16, ayahNumber: 127 },
    { surahNumber: 42, ayahNumber: 43 },
  ],
  [normalizeThemeKey("hz_muhammed")]: [
    { surahNumber: 33, ayahNumber: 21 },
    { surahNumber: 68, ayahNumber: 4 },
    { surahNumber: 21, ayahNumber: 107 },
    { surahNumber: 48, ayahNumber: 29 },
    { surahNumber: 47, ayahNumber: 7 },
  ],
  [normalizeThemeKey("yalnızlık")]: [
    { surahNumber: 2, ayahNumber: 186 },
    { surahNumber: 50, ayahNumber: 16 },
    { surahNumber: 57, ayahNumber: 4 },
    { surahNumber: 13, ayahNumber: 28 },
  ],
  [normalizeThemeKey("tövbe")]: [
    { surahNumber: 39, ayahNumber: 53 },
    { surahNumber: 2, ayahNumber: 37 },
    { surahNumber: 25, ayahNumber: 70 },
    { surahNumber: 66, ayahNumber: 8 },
  ],
  [normalizeThemeKey("umut")]: [
    { surahNumber: 94, ayahNumber: 5 },
    { surahNumber: 94, ayahNumber: 6 },
    { surahNumber: 39, ayahNumber: 53 },
    { surahNumber: 65, ayahNumber: 3 },
    { surahNumber: 13, ayahNumber: 28 },
    { surahNumber: 93, ayahNumber: 5 },
    { surahNumber: 3, ayahNumber: 139 },
    { surahNumber: 12, ayahNumber: 87 },
  ],
  [normalizeThemeKey("korku")]: [
    { surahNumber: 3, ayahNumber: 173 },
    { surahNumber: 3, ayahNumber: 175 },
    { surahNumber: 9, ayahNumber: 51 },
    { surahNumber: 65, ayahNumber: 2 },
  ],
  [normalizeThemeKey("kaygı")]: [
    { surahNumber: 28, ayahNumber: 7 },
    { surahNumber: 94, ayahNumber: 5 },
    { surahNumber: 94, ayahNumber: 6 },
    { surahNumber: 13, ayahNumber: 28 },
  ],
  [normalizeThemeKey("şifa")]: [
    { surahNumber: 26, ayahNumber: 80 },
    { surahNumber: 17, ayahNumber: 82 },
    { surahNumber: 10, ayahNumber: 57 },
    { surahNumber: 41, ayahNumber: 44 },
  ],
  [normalizeThemeKey("imtihan")]: [
    { surahNumber: 2, ayahNumber: 155 },
    { surahNumber: 2, ayahNumber: 286 },
    { surahNumber: 3, ayahNumber: 200 },
    { surahNumber: 103, ayahNumber: 3 },
  ],
  [normalizeThemeKey("adalet")]: [
    { surahNumber: 4, ayahNumber: 135 },
    { surahNumber: 5, ayahNumber: 8 },
    { surahNumber: 16, ayahNumber: 90 },
    { surahNumber: 42, ayahNumber: 41 },
  ],
  [normalizeThemeKey("rızık")]: [
    { surahNumber: 11, ayahNumber: 6 },
    { surahNumber: 65, ayahNumber: 2 },
    { surahNumber: 65, ayahNumber: 3 },
    { surahNumber: 51, ayahNumber: 58 },
  ],
  [normalizeThemeKey("ölüm korkusu")]: [
    { surahNumber: 3, ayahNumber: 185 },
    { surahNumber: 39, ayahNumber: 30 },
    { surahNumber: 62, ayahNumber: 8 },
    { surahNumber: 21, ayahNumber: 35 },
  ],
  [normalizeThemeKey("sabır_sıkıntı")]: [
    { surahNumber: 2, ayahNumber: 153 },
    { surahNumber: 2, ayahNumber: 155 },
    { surahNumber: 16, ayahNumber: 127 },
    { surahNumber: 103, ayahNumber: 3 },
  ],
  [normalizeThemeKey("umut_sonrasi_zorluk")]: [
    { surahNumber: 94, ayahNumber: 5 },
    { surahNumber: 94, ayahNumber: 6 },
    { surahNumber: 39, ayahNumber: 53 },
    { surahNumber: 13, ayahNumber: 28 },
  ],
};

const CURATED_OVERRIDE_MESSAGE_MATCHERS = [
  {
    topic: normalizeThemeKey("yalnızlık"),
    list: [
      "yalnızlık",
      "yalnizlik",
      "yalnız",
      "yalniz",
      "yalnız hissediyorum",
      "yalniz hissediyorum",
      "çok yalnız",
      "cok yalniz",
      "kimsem yok",
      "kimse yok",
      "tek başımayım",
      "tek basimayim",
    ],
  },
  {
    topic: normalizeThemeKey("tövbe"),
    list: [
      "tövbe",
      "tevbe",
      "günah",
      "gunah",
      "pişman",
      "pisman",
      "affeder",
      "bağışlar",
      "bagislar",
      "bağışlan",
      "bagislan",
    ],
  },
  {
    topic: normalizeThemeKey("hz_muhammed"),
    list: [
      "muhammed peygamber",
      "hz muhammed",
      "peygamberimiz",
      "resulullah",
      "resul",
      "rasul",
      "peygamber",
    ],
  },
  {
    topic: normalizeThemeKey("rızık"),
    list: [
      "rızık",
      "rizik",
      "geçim",
      "gecim",
      "iş bulamıyorum",
      "is bulamiyorum",
      "maddi sıkıntı",
      "maddi sikinti",
      "geçim derdi",
      "gecim derdi",
    ],
  },
  {
    topic: normalizeThemeKey("adalet"),
    list: [
      "adalet",
      "zulüm",
      "zulum",
      "haksızlık",
      "haksizlik",
      "hakkım yeniyor",
      "hakkim yeniyor",
      "zulüm görüyorum",
      "zulum goruyorum",
      "haksızlığa uğradım",
      "haksizliga ugradim",
    ],
  },
  {
    topic: normalizeThemeKey("şifa"),
    list: ["hasta", "hastalık", "hastalik", "şifa", "sifa", "hastayım", "hastayim", "iyileş", "iyiles"],
  },
  {
    topic: normalizeThemeKey("ölüm korkusu"),
    list: ["ölüm korkusu", "olum korkusu", "ölmekten korkuyorum", "olmekten korkuyorum", "kabir", "vefat", "ölümden korkuyorum", "olumden korkuyorum"],
  },
  {
    topic: normalizeThemeKey("kaygı"),
    list: [
      "kaygı",
      "kaygi",
      "gelecek kaygısı",
      "gelecek kaygisi",
      "kaygım",
      "kaygim",
      "gelecek kaygım",
      "gelecek kaygim",
      "kaygım arttı",
      "kaygim artti",
      "gelecekten korkuyorum",
      "yarın ne olacak",
      "yarin ne olacak",
      "endişe",
      "endise",
      "gelecek için endişeliyim",
    ],
  },
  {
    topic: normalizeThemeKey("kaygı"),
    list: [
      "içim daralıyor",
      "icim daraliyor",
      "içim sıkılıyor",
      "icim sikiliyor",
      "bunaldım",
      "bunaldim",
      "bunalıyorum",
      "bunalıyorum",
      "sıkışıyorum",
      "sikisiyorum",
      "boğuluyorum",
      "boguluyorum",
      "iç sıkıntısı",
      "ic sikintisi",
      "daralıyorum",
      "daraliyorum",
    ],
  },
  {
    topic: normalizeThemeKey("korku"),
    list: ["korku", "korkuyorum", "çok korkuyorum", "cok korkuyorum", "ölüm korkusu", "olum korkusu", "ölümden korkuyorum", "olumden korkuyorum", "endişe", "endise"],
  },
  {
    topic: normalizeThemeKey("sabır_sıkıntı"),
    list: [
      "sabır",
      "sabir",
      "sabretmek",
      "dayanmak",
      "zor zamanlar",
      "sıkıntı",
      "sikinti",
      "sabrımı",
      "sabrimi",
      "zor zamanlarda sabır",
      "zor zamanlarda sabir",
    ],
  },
  {
    topic: normalizeThemeKey("imtihan"),
    list: ["imtihan", "zorluk", "sıkıntı", "sikinti", "musibet", "darlık", "darlik", "denenme", "sıkıntıdayım", "sikintidayim"],
  },
  {
    topic: normalizeThemeKey("umut_sonrasi_zorluk"),
    list: ["umut", "ümit", "umit", "zor zamanlarda", "zor zamanlardan sonra", "kolaylık", "kolaylik", "ferahlık", "ferahlik", "çıkış", "cikis", "darda kaldım", "darda kaldim"],
  },
  {
    topic: normalizeThemeKey("umut"),
    list: ["umut", "ümit", "umit", "motive", "motivasyon", "moral", "teselli"],
  },
  {
    topic: normalizeThemeKey("sabır"),
    list: ["sabır", "sabir", "sebat", "sabredenler"],
  },
];

const CURATED_OVERRIDE_SIGNAL_KEYS = {
  [normalizeThemeKey("tövbe")]: ["tövbe", "tevbe", "günah", "gunah", "pişman", "pisman", "affeder", "bağışlar", "bagislar", "bağışlan", "bagislan"],
  [normalizeThemeKey("hz_muhammed")]: ["muhammed", "muhammed peygamber", "hz muhammed", "peygamberimiz", "resulullah", "resul", "rasul", "peygamber"],
  [normalizeThemeKey("rızık")]: ["rızık", "rizik", "geçim", "gecim", "iş bulamıyorum", "is bulamiyorum", "maddi sıkıntı", "maddi sikinti", "geçim derdi", "gecim derdi"],
  [normalizeThemeKey("adalet")]: ["adalet", "zulüm", "zulum", "haksızlık", "haksizlik", "hakkım yeniyor", "hakkim yeniyor", "zulüm görüyorum", "zulum goruyorum", "haksızlığa uğradım", "haksizliga ugradim"],
  [normalizeThemeKey("şifa")]: ["hasta", "hastalık", "hastalik", "şifa", "sifa", "hastayım", "hastayim", "iyileş", "iyiles"],
  [normalizeThemeKey("ölüm korkusu")]: ["ölüm korkusu", "olum korkusu", "ölmekten korkuyorum", "olmekten korkuyorum", "kabir", "vefat", "ölümden korkuyorum", "olumden korkuyorum"],
  [normalizeThemeKey("korku")]: ["korku", "korkuyorum", "çok korkuyorum", "cok korkuyorum", "ölüm korkusu", "olum korkusu", "ölümden korkuyorum", "olumden korkuyorum", "endişe", "endise"],
  [normalizeThemeKey("kaygı")]: ["kaygı", "kaygi", "gelecek kaygısı", "gelecek kaygisi", "kaygım", "kaygim", "gelecek kaygım", "gelecek kaygim", "kaygım arttı", "kaygim artti", "gelecekten korkuyorum", "yarın ne olacak", "yarin ne olacak", "endişe", "endise", "gelecek için endişeliyim"],
  [normalizeThemeKey("sabır_sıkıntı")]: ["sabır", "sabir", "sabretmek", "dayanmak", "zor zamanlar", "sıkıntı", "sikinti", "sabrımı", "sabrimi", "zor zamanlarda sabır", "zor zamanlarda sabir"],
  [normalizeThemeKey("imtihan")]: ["imtihan", "zorluk", "sıkıntı", "sikinti", "musibet", "darlık", "darlik", "denenme", "sıkıntıdayım", "sikintidayim"],
  [normalizeThemeKey("umut_sonrasi_zorluk")]: ["umut", "ümit", "umit", "zor zamanlarda", "zor zamanlardan sonra", "kolaylık", "kolaylik", "ferahlık", "ferahlik", "çıkış", "cikis", "darda kaldım", "darda kaldim"],
  [normalizeThemeKey("umut")]: ["umut", "ümit", "umit", "motive", "motivasyon", "moral", "teselli"],
  [normalizeThemeKey("sabır")]: ["sabır", "sabir", "sebat", "sabredenler"],
};

function rankAyahs(messageAnalysis, sourceAyahs, options = {}) {
  const currentMessage = normalize(options.current_message || "");
  const isFollowupAnotherAyahRequest = detectAnotherAyahFollowup(options.current_message);
  const topicConstraint = resolveTopicConstraint(options.topic_constraint);
  const currentMessageOverrideTopic = resolveCurrentMessageOverrideTopic(options.current_message);
  const explicitTopic = topicConstraint || detectExplicitTopic(options.current_message) || currentMessageOverrideTopic;
  const explicitAyahRequest = options.explicit_ayah_request === true;
  const preferredTopic = normalizePreferredTopic(options.preferred_topic);
  const usePreferredTopicHint = !explicitTopic && !currentMessageOverrideTopic && isWeakTopicSignal(messageAnalysis.context_topic);
  const sameThemeFollowup = !currentMessageOverrideTopic && detectSameThemeFollowup(messageAnalysis, options);
  const previouslyUsedAyahIds = normalizePreviouslyUsedAyahIds(
    options.previously_used_ayah_ids || messageAnalysis.previously_used_ayah_ids
  );
  const usedAyahIdSet = new Set(previouslyUsedAyahIds);
  const emotionalRankingEnabled = shouldApplyEmotionalSupportRanking(messageAnalysis, options);
  const overrideTopic = resolveCuratedOverrideTopic(
    messageAnalysis,
    currentMessage,
    explicitTopic,
    topicConstraint,
    preferredTopic
  );
  const effectiveExplicitTopic = explicitTopic || overrideTopic;
  const semanticContext = buildSemanticContext(
    messageAnalysis,
    options,
    currentMessage,
    effectiveExplicitTopic,
    topicConstraint,
    preferredTopic,
    overrideTopic
  );

  if (currentMessageOverrideTopic) {
    const currentMessageOverrideResults = selectCuratedTopicTopResults(
      sourceAyahs,
      currentMessageOverrideTopic,
      usedAyahIdSet
    );
    if (currentMessageOverrideResults.length > 0) {
      return currentMessageOverrideResults;
    }
  }

  const scored = sourceAyahs.map((ayah) => {
    const tags = Array.isArray(ayah.tags) ? ayah.tags : [];
    const searchable = normalize(
      [
        ayah.surah,
        ayah.surahName,
        ayah.text_tr,
        ayah.text_ar,
        ayah.notes,
        ayah.short_explanation,
        tags.join(" "),
      ].join(" ")
    );

    const primaryThemeScore = scoreTheme(
      messageAnalysis.primary_theme,
      tags,
      searchable,
      100
    );
    let secondaryThemeScore = 0;
    for (const [index, theme] of (messageAnalysis.secondary_themes || []).entries()) {
      secondaryThemeScore += scoreTheme(theme, tags, searchable, 45 - index * 8);
    }

    const emotionScore = emotionBoost(messageAnalysis.emotion, tags, searchable);
    const contextScore = contextTopicBoost(messageAnalysis.context_topic, tags, searchable);
    const severityScore = severityBoost(messageAnalysis.severity, tags);
    const explicitTopicMeta = explicitTopicScore(effectiveExplicitTopic, tags, searchable);
    const semanticMeta = scoreSemanticMatch(ayah, semanticContext);
    const preferredTopicScore = usePreferredTopicHint
      ? contextTopicBoost(preferredTopic, tags, searchable)
      : 0;
    const lonelinessBoostMeta = lonelinessBoost(messageAnalysis, ayah, searchable, tags, currentMessage);
    const emotionalBoostMeta = emotionalRankingEnabled
      ? emotionalSupportBoost(messageAnalysis, ayah, options)
      : {
          emotional_profile_used: null,
          emotional_boost_score: 0,
          anti_pattern_penalty: 0,
          profile_key: null,
          priority_match: false,
          strong_keyword_matches: [],
          anti_pattern_matches: [],
          total_score: 0,
        };
    const compatibilityMeta = emotionCompatibilityGate(messageAnalysis, ayah, tags, searchable);

    let score =
      primaryThemeScore +
      secondaryThemeScore +
      emotionScore +
      contextScore +
      severityScore +
      preferredTopicScore +
      lonelinessBoostMeta.boost +
      lonelinessBoostMeta.penalty +
      semanticMeta.semantic_score +
      emotionalBoostMeta.total_score +
      compatibilityMeta.penalty +
      explicitTopicMeta.bonus +
      explicitTopicMeta.penalty;
    const rawScore = score;

    let repetitionPenalty = 0;
    let diversityBonus = 0;
    if (usedAyahIdSet.has(ayah.id)) {
      score *= isFollowupAnotherAyahRequest ? 0.1 : 0.6;
      repetitionPenalty = rawScore - score;
    } else if (isFollowupAnotherAyahRequest && score > 0) {
      diversityBonus = Math.max(18, Math.round(score * 0.08));
      score += diversityBonus;
    } else if (sameThemeFollowup && score > 0) {
      diversityBonus = Math.max(8, Math.round(score * 0.04));
      score += diversityBonus;
    }

    return {
      ayah,
      rawScore,
      score,
      debug: {
        ayah_id: ayah.id,
        primary_theme_score: primaryThemeScore,
        secondary_theme_score: secondaryThemeScore,
        emotion_score: emotionScore,
        severity_score: severityScore,
        context_score: contextScore,
        preferred_topic: preferredTopic,
        preferred_topic_score: preferredTopicScore,
        loneliness_boost: lonelinessBoostMeta.boost,
        loneliness_penalty: lonelinessBoostMeta.penalty,
        loneliness_priority_match: lonelinessBoostMeta.priority_match,
        emotional_profile_used: emotionalBoostMeta.emotional_profile_used,
        emotional_boost_score: emotionalBoostMeta.emotional_boost_score,
        anti_pattern_penalty: emotionalBoostMeta.anti_pattern_penalty,
        emotional_priority_match: emotionalBoostMeta.priority_match,
        emotional_strong_keyword_matches: emotionalBoostMeta.strong_keyword_matches,
        emotional_anti_pattern_matches: emotionalBoostMeta.anti_pattern_matches,
        emotion_compatibility_blocked: compatibilityMeta.blocked,
        emotion_compatibility_penalty: compatibilityMeta.penalty,
        explicit_topic: effectiveExplicitTopic,
        explicit_topic_matched: explicitTopicMeta.matched,
        explicit_topic_bonus: explicitTopicMeta.bonus,
        explicit_topic_penalty: explicitTopicMeta.penalty,
        semantic_tags_considered: semanticContext.semantic_tags_considered,
        semantic_candidates_count: 0,
        semantic_score: semanticMeta.semantic_score,
        ranker_source: semanticMeta.ranker_source,
        semantic_use_case: semanticMeta.semantic_use_case,
        diversity_bonus: diversityBonus,
        repetition_penalty: repetitionPenalty,
        final_score: score,
        is_followup_another_ayah_request: isFollowupAnotherAyahRequest,
        same_theme_followup: sameThemeFollowup,
      },
    };
  });

  const semanticCandidatesCount = scored.filter((item) => item.debug.semantic_score > 0).length;
  for (const item of scored) {
    item.debug.semantic_candidates_count = semanticCandidatesCount;
  }

  const rawRanked = scored
    .filter((item) => item.rawScore > 0)
    .sort((a, b) => b.rawScore - a.rawScore || a.ayah.id - b.ayah.id);
  const adjustedRanked = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.ayah.id - b.ayah.id)
    .map((item) => ({ ...item }));

  const lonelinessTopItem = selectLonelinessTopItem(
    messageAnalysis,
    sourceAyahs,
    usedAyahIdSet,
    currentMessage
  );
  let selectedItem = adjustedRanked[0] || null;
  const bestUnusedItem = adjustedRanked.find((item) => !usedAyahIdSet.has(item.ayah.id)) || null;
  const bestCompatibleItem = adjustedRanked.find((item) =>
    isEmotionCompatibleAlternative(messageAnalysis, item)
  ) || null;
  const bestUnusedCompatibleItem = adjustedRanked.find(
    (item) => !usedAyahIdSet.has(item.ayah.id) && isEmotionCompatibleAlternative(messageAnalysis, item)
  ) || null;
  if (
    isFollowupAnotherAyahRequest &&
    bestUnusedItem &&
    (!selectedItem || usedAyahIdSet.has(selectedItem.ayah.id))
  ) {
    selectedItem = bestUnusedItem;
  } else if (
    adjustedRanked.length > 1 &&
    selectedItem &&
    usedAyahIdSet.has(selectedItem.ayah.id)
  ) {
    const nextUnusedIndex = adjustedRanked.findIndex(
      (item) => !usedAyahIdSet.has(item.ayah.id)
    );
    if (nextUnusedIndex > 0) {
      selectedItem = adjustedRanked[nextUnusedIndex];
    }
  }

  const bestRawItem = rawRanked[0] || null;
  const bestRawScore = bestRawItem?.rawScore || 0;
  const selectedScore = selectedItem?.score || 0;
  const thresholdPassed = bestRawScore === 0 || selectedScore >= bestRawScore * 0.75;

  const diversityCloseEnough =
    sameThemeFollowup &&
    bestUnusedCompatibleItem &&
    selectedItem &&
    usedAyahIdSet.has(selectedItem.ayah.id) &&
    bestUnusedCompatibleItem.score >= selectedItem.score * 0.9;

  const topSelectionCompatible = selectedItem
    ? isEmotionCompatibleAlternative(messageAnalysis, selectedItem)
    : true;
  const bestCompatibleCloseEnough =
    selectedItem &&
    !topSelectionCompatible &&
    bestCompatibleItem &&
    bestCompatibleItem.score >= selectedItem.score * 0.9;

  if (
    !thresholdPassed &&
    bestRawItem &&
    (!isFollowupAnotherAyahRequest || !bestUnusedItem)
  ) {
    selectedItem = bestRawItem;
  } else if (
    isFollowupAnotherAyahRequest &&
    bestUnusedItem &&
    selectedItem &&
    usedAyahIdSet.has(selectedItem.ayah.id)
  ) {
    selectedItem = bestUnusedItem;
  } else if (diversityCloseEnough) {
    selectedItem = bestUnusedCompatibleItem;
  } else if (bestCompatibleCloseEnough) {
    selectedItem = bestCompatibleItem;
  }

  if (lonelinessTopItem) {
    selectedItem = lonelinessTopItem;
  }

  const ranked = selectedItem
    ? [
        selectedItem,
        ...adjustedRanked.filter((item) => item.ayah.id !== selectedItem.ayah.id),
      ]
    : adjustedRanked;

  const topItems = ranked.slice(0, 3);
  const topResults = topItems.map(toRankedAyahResult);
  const curatedTopicItem = shouldForceCuratedTopicSelection(
    options.current_message,
    effectiveExplicitTopic,
    explicitAyahRequest
  )
    ? selectCuratedTopicAyah(sourceAyahs, effectiveExplicitTopic, usedAyahIdSet)
    : null;
  if (curatedTopicItem) {
    return [
      curatedTopicItem,
      ...topResults.filter((item) => item.id !== curatedTopicItem.id),
    ].slice(0, 3);
  }
  if (options.force_topic_match === true && effectiveExplicitTopic) {
    const forcedItem = selectForcedTopicAyah(sourceAyahs, effectiveExplicitTopic, usedAyahIdSet);
    if (forcedItem) {
      const mergedItems = [
        forcedItem,
        ...topResults.filter((item) => item.id !== forcedItem.id),
      ].slice(0, 3);
      return mergedItems;
    }
  }

  return topResults;
}

function lonelinessBoost(messageAnalysis, ayah, searchable, tags, currentMessage = "") {
  const theme = normalizeThemeKey(messageAnalysis?.primary_theme || messageAnalysis?.context_topic || messageAnalysis?.emotion);
  const emotion = normalizeLoose(messageAnalysis?.emotion || "");
  const current = normalizeLoose(currentMessage || "");
  const isLoneliness =
    theme === normalizeThemeKey("yalnızlık") ||
    containsAnyLoose(emotion, [
      "yalnızlık",
      "yalnız",
      "yalniz",
      "kimsem yok",
      "kimse yok",
      "tek başımayım",
      "tek basimayim",
    ]) ||
    containsAnyLoose(current, [
      "yalnızlık",
      "yalnizlik",
      "yalnız",
      "yalniz",
      "yalnız hissediyorum",
      "yalniz hissediyorum",
      "çok yalnız",
      "cok yalniz",
      "kimsem yok",
      "kimse yok",
      "tek başımayım",
      "tek basimayim",
    ]);
  if (!isLoneliness) {
    return { boost: 0, penalty: 0, priority_match: false };
  }

  const priority = [
    { surahNumber: 2, ayahNumber: 186, boost: 5 },
    { surahNumber: 50, ayahNumber: 16, boost: 5 },
    { surahNumber: 57, ayahNumber: 4, boost: 5 },
    { surahNumber: 13, ayahNumber: 28, boost: 5 },
  ];
  const reduced = [
    { surahNumber: 14, ayahNumber: 12, penalty: -3 },
    { surahNumber: 39, ayahNumber: 38, penalty: -3 },
  ];

  const hit = priority.find((item) => ayah.surahNumber === item.surahNumber && ayah.ayahNumber === item.ayahNumber);
  if (hit) {
    return { boost: hit.boost, penalty: 0, priority_match: true };
  }
  const reducedHit = reduced.find((item) => ayah.surahNumber === item.surahNumber && ayah.ayahNumber === item.ayahNumber);
  if (reducedHit) {
    return { boost: 0, penalty: reducedHit.penalty, priority_match: false };
  }
  if (tags.includes("yalnızlık")) {
    return { boost: 2, penalty: 0, priority_match: false };
  }
  if (searchable.includes(normalize("yalnızlık")) || searchable.includes(normalize("yalnız"))) {
    return { boost: 1, penalty: 0, priority_match: false };
  }
  return { boost: 0, penalty: 0, priority_match: false };
}

function selectLonelinessTopItem(messageAnalysis, sourceAyahs, usedAyahIdSet, currentMessage = "") {
  const theme = normalizeThemeKey(messageAnalysis?.primary_theme || messageAnalysis?.context_topic || messageAnalysis?.emotion);
  const emotion = normalizeLoose(messageAnalysis?.emotion || "");
  const current = normalizeLoose(currentMessage || "");
  const isLoneliness =
    theme === normalizeThemeKey("yalnızlık") ||
    containsAnyLoose(emotion, [
      "yalnızlık",
      "yalnız",
      "yalniz",
      "kimsem yok",
      "kimse yok",
      "tek başımayım",
      "tek basimayim",
    ]) ||
    containsAnyLoose(current, [
      "yalnızlık",
      "yalnizlik",
      "yalnız",
      "yalniz",
      "yalnız hissediyorum",
      "yalniz hissediyorum",
      "çok yalnız",
      "cok yalniz",
      "kimsem yok",
      "kimse yok",
      "tek başımayım",
      "tek basimayim",
    ]);
  if (!isLoneliness || !Array.isArray(sourceAyahs) || sourceAyahs.length === 0) {
    return null;
  }

  const preferredOrder = [
    { surahNumber: 2, ayahNumber: 186 },
    { surahNumber: 50, ayahNumber: 16 },
    { surahNumber: 57, ayahNumber: 4 },
    { surahNumber: 13, ayahNumber: 28 },
  ];

  for (const target of preferredOrder) {
    const preferred = getSourceAyahIndex(sourceAyahs).get(ayahKey(target.surahNumber, target.ayahNumber));
    if (!preferred || usedAyahIdSet.has(preferred.id)) {
      continue;
    }
    if (preferred) {
      return {
        ayah: preferred,
        rawScore: 0,
        score: 1000,
        ranker_source: "override",
        debug: {
          loneliness_forced: true,
          ranker_source: "override",
        },
      };
    }
  }

  return null;
}

function shouldUseAyahFor(analysis) {
  return (
    analysis.response_type === "ayah_guidance" ||
    analysis.response_type === "direct_ayah" ||
    analysis.response_type === "supportive_ayah" ||
    analysis.response_type === "explanation_with_ayah" ||
    analysis.response_type === "dua_guidance" ||
    analysis.intent === "emotional_spiritual_support" ||
    analysis.intent === "ayah_request" ||
    analysis.intent === "general_islamic_question"
  );
}

function toRankedAyahResult(item) {
  return {
    ...item.ayah,
    final_score: item.score,
    ranker_source: item.debug?.ranker_source === "override" ? "override" : item.debug?.semantic_score > 0 ? "semantic" : "fallback",
    semantic_candidates_count: item.debug?.semantic_candidates_count || 0,
    semantic_tags_considered: item.debug?.semantic_tags_considered || [],
    semantic_score: item.debug?.semantic_score || 0,
  };
}

function scoreTheme(theme, tags, searchable, weight) {
  if (!theme) return 0;
  const aliases = datasetTagsForTheme(theme);
  let score = 0;
  for (const [index, alias] of aliases.entries()) {
    if (tags.includes(alias)) {
      score += weight - index * 10;
    }
    if (searchable.includes(normalize(alias))) {
      score += Math.round(weight / 6);
    }
  }
  return score;
}

function emotionBoost(emotion, tags, searchable) {
  if (!emotion) return 0;
  const normalizedEmotion = normalize(emotion);
  if (normalizedEmotion.includes("yalnÄ±z") && tags.includes("yalnÄ±zlÄ±k")) return 24;
  if (normalizedEmotion.includes("kork") && tags.includes("korku")) return 22;
  if (normalizedEmotion.includes("piÅŸman") && tags.includes("tÃ¶vbe")) return 22;
  if (normalizedEmotion.includes("hast") && (tags.includes("sabÄ±r") || tags.includes("umut"))) {
    return 16;
  }
  if (normalizedEmotion.includes("bunalm") && searchable.includes(normalize("kolaylÄ±k"))) {
    return 14;
  }
  return 0;
}

function severityBoost(severity, tags) {
  if (severity !== "high") return 0;
  let score = 0;
  if (tags.includes("umut")) score += 16;
  if (tags.includes("sabÄ±r")) score += 12;
  if (tags.includes("tevekkÃ¼l")) score += 8;
  return score;
}

function detectSameThemeFollowup(messageAnalysis, options = {}) {
  if (!Array.isArray(options.history) || options.history.length === 0) {
    return false;
  }

  const currentTheme = normalizeThemeKey(
    messageAnalysis?.context_topic || messageAnalysis?.primary_theme || messageAnalysis?.emotion
  );
  if (!currentTheme) {
    return false;
  }

  const previousTheme = getRecentThemeFromHistory(options.history);
  if (!previousTheme) {
    return false;
  }

  return areRelatedThemes(currentTheme, previousTheme);
}

function getRecentThemeFromHistory(history) {
  for (const item of [...history].reverse()) {
    if (!item || typeof item !== "object") continue;
    const candidate = normalizeThemeKey(
      item.context_topic || item.primary_theme || item.emotion
    );
    if (!candidate) continue;
    return candidate;
  }
  return null;
}

function areRelatedThemes(currentTheme, previousTheme) {
  const current = normalizeThemeKey(currentTheme);
  const previous = normalizeThemeKey(previousTheme);
  if (!current || !previous) return false;
  if (current === previous) return true;

  const related = {
    [normalizeThemeKey("korku")]: new Set([normalizeThemeKey("kaygı"), normalizeThemeKey("daralma")]),
    [normalizeThemeKey("kaygı")]: new Set([normalizeThemeKey("korku"), normalizeThemeKey("daralma")]),
    [normalizeThemeKey("daralma")]: new Set([normalizeThemeKey("kaygı")]),
    [normalizeThemeKey("tövbe")]: new Set([normalizeThemeKey("umut")]),
    [normalizeThemeKey("umut")]: new Set([normalizeThemeKey("tövbe")]),
    [normalizeThemeKey("yalnızlık")]: new Set([normalizeThemeKey("korku"), normalizeThemeKey("kaygı")]),
    [normalizeThemeKey("çaresizlik")]: new Set([normalizeThemeKey("umut"), normalizeThemeKey("kaygı")]),
  };

  return Boolean(related[current]?.has(previous) || related[previous]?.has(current));
}

function normalizeThemeKey(value) {
  return normalize(value || "");
}

function isEmotionCompatibleAlternative(messageAnalysis, rankedItem) {
  if (!rankedItem || !rankedItem.ayah) return false;

  const currentTheme = normalizeThemeKey(
    messageAnalysis?.context_topic || messageAnalysis?.primary_theme || messageAnalysis?.emotion
  );
  if (!currentTheme) return true;

  const tags = Array.isArray(rankedItem.ayah.tags)
    ? rankedItem.ayah.tags.map((tag) => normalizeThemeKey(tag))
    : [];
  const searchable = normalizeThemeKey(
    [
      rankedItem.ayah.surah,
      rankedItem.ayah.surahName,
      rankedItem.ayah.text_tr,
      rankedItem.ayah.text_ar,
      rankedItem.ayah.notes,
      rankedItem.ayah.short_explanation,
      tags.join(" "),
    ].join(" ")
  );

  const currentHasRepentanceSignal = containsAnyNormalized(
    normalizeThemeKey(
      [
        messageAnalysis?.primary_theme,
        messageAnalysis?.context_topic,
        messageAnalysis?.emotion,
        messageAnalysis?.response_type,
      ].join(" ")
    ),
    ["tövbe", "tevbe", "tovbe", "günah", "gunah", "pişman", "pisman", "aff", "bağışla", "bagisla", "istiğfar", "istigfar", "affeder"]
  );

  const repentanceCandidate = containsAnyNormalized(
    searchable,
    ["tövbe", "tevbe", "tovbe", "günah", "gunah", "pişman", "pisman", "aff", "bağışla", "bagisla", "istiğfar", "istigfar", "rahmet"]
  ) || tags.some((tag) => ["tövbe", "tevbe", "tovbe", "bağışlanma", "bagislanma"].includes(tag));

  if (
    ["korku", "kaygı", "daralma", "çaresizlik"].includes(currentTheme) &&
    repentanceCandidate &&
    !currentHasRepentanceSignal
  ) {
    return false;
  }

  const compatibleKeywords = {
    korku: ["tevekkül", "tevekkul", "güven", "guven", "yardım", "yardim", "vekil", "huzur", "sekinet"],
    kaygı: ["huzur", "sekinet", "ferahlık", "ferahlik", "tevekkül", "tevekkul", "umut", "gönül", "gonul"],
    daralma: ["ferahlık", "ferahlik", "huzur", "sekinet", "kolaylık", "kolaylik", "rahat", "açıl", "acil"],
    tövbe: ["bağışlanma", "bagislanma", "rahmet", "dönüş", "donus", "af", "istiğfar", "istigfar", "günah", "gunah"],
    umut: ["umut", "ümit", "umit", "rahmet", "kolaylık", "kolaylik"],
    yalnızlık: ["yakın", "yakin", "beraber", "teselli", "huzur", "güven", "guven"],
    çaresizlik: ["umut", "ümit", "umit", "rahmet", "kolaylık", "kolaylik", "sabır", "sabir"],
  };

  const keywords = compatibleKeywords[currentTheme] || [];
  if (!keywords.length) return true;

  return keywords.some((keyword) => searchable.includes(normalizeThemeKey(keyword)));
}

function emotionCompatibilityGate(messageAnalysis, ayah, tags, searchable) {
  const currentTheme = normalizeThemeKey(
    messageAnalysis?.context_topic || messageAnalysis?.primary_theme || messageAnalysis?.emotion
  );
  const fearBucket = new Set([
    normalizeThemeKey("korku"),
    normalizeThemeKey("kaygı"),
    normalizeThemeKey("daralma"),
    normalizeThemeKey("çaresizlik"),
  ]);
  if (!fearBucket.has(currentTheme)) {
    return { penalty: 0, blocked: false };
  }

  const currentHasRepentanceSignal = containsAnyNormalized(
    normalizeThemeKey(
      [
        messageAnalysis?.primary_theme,
        messageAnalysis?.context_topic,
        messageAnalysis?.emotion,
        messageAnalysis?.response_type,
        messageAnalysis?.text,
      ].join(" ")
    ),
    ["tövbe", "tevbe", "tovbe", "günah", "gunah", "pişman", "pisman", "aff", "bağışla", "bagisla", "istiğfar", "istigfar", "affeder"]
  );
  if (currentHasRepentanceSignal) {
    return { penalty: 0, blocked: false };
  }

  const searchableText = normalizeThemeKey(
    [
      ayah.surah,
      ayah.surahName,
      ayah.text_tr,
      ayah.text_ar,
      ayah.notes,
      ayah.short_explanation,
      tags.join(" "),
    ].join(" ")
  );
  const repentanceCandidate = containsAnyNormalized(
    searchableText,
    ["tövbe", "tevbe", "tovbe", "günah", "gunah", "pişman", "pisman", "aff", "bağışla", "bagisla", "istiğfar", "istigfar", "rahmet"]
  );
  if (!repentanceCandidate) {
    return { penalty: 0, blocked: false };
  }

  return { penalty: -95, blocked: true };
}

function containsAnyNormalized(text, needles) {
  const normalizedText = normalizeThemeKey(text);
  return needles.some((needle) => normalizedText.includes(normalizeThemeKey(needle)));
}

function contextTopicBoost(contextTopic, tags, searchable) {
  if (!contextTopic) return 0;
  const topic = normalize(contextTopic);
  if (topic.includes("zikir") || topic.includes("allah")) {
    let score = 0;
    if (searchable.includes(normalize("zikir"))) score += 180;
    if (searchable.includes(normalize("Allah'Ä± anmak"))) score += 220;
    if (searchable.includes(normalize("Allah")) && searchable.includes(normalize("anmak"))) {
      score += 180;
    }
    if (searchable.includes(normalize("kalpler"))) score += 18;
    return score;
  }
  if (topic.includes("dua")) {
    let score = 0;
    if (searchable.includes(normalize("dua"))) score += 80;
    if (searchable.includes(normalize("yakÄ±n"))) score += 24;
    return score;
  }
  if (topic.includes("namaz")) {
    let score = 0;
    if (searchable.includes(normalize("namaz"))) score += 140;
    if (searchable.includes(normalize("salat")) || searchable.includes(normalize("salah"))) {
      score += 120;
    }
    if (searchable.includes(normalize("secde")) || searchable.includes(normalize("rÃ¼ku"))) {
      score += 40;
    }
    return score;
  }
  if (topic.includes("ibadet")) {
    return tags.includes("ibadet") || tags.includes("namaz") ? 24 : 0;
  }
  return scoreTheme(themeForContextTopic(contextTopic), tags, searchable, 35);
}

function datasetTagsForTheme(theme) {
  const normalizedTheme = normalizeThemeKey(theme);
  const aliases = {
    [normalizeThemeKey("zikir")]: ["zikir", "Allah'ı anmak", "Allah'ı anma"],
    [normalizeThemeKey("ibadet")]: ["ibadet", "tevekkül", "sabır", "namaz"],
    [normalizeThemeKey("dua")]: ["dua", "yakın", "tevekkül"],
    [normalizeThemeKey("sabır")]: ["sabır", "sebat", "umut"],
    [normalizeThemeKey("umut")]: ["umut", "tevekkül", "sabır"],
    [normalizeThemeKey("tevekkül")]: ["tevekkül", "umut", "sabır"],
    [normalizeThemeKey("tövbe")]: ["tövbe", "umut", "irade"],
    [normalizeThemeKey("şükür")]: ["şükür", "umut", "tevekkül"],
    [normalizeThemeKey("korku")]: ["korku", "tevekkül", "umut"],
    [normalizeThemeKey("yalnızlık")]: ["yalnızlık", "umut", "tevekkül"],
    [normalizeThemeKey("irade")]: ["irade", "sebat", "tövbe"],
    [normalizeThemeKey("sebat")]: ["sebat", "sabır", "irade"],
    [normalizeThemeKey("affetmek")]: ["affetmek", "sabır", "tövbe"],
    [normalizeThemeKey("şifa")]: ["sabır", "umut", "tevekkül"],
    [normalizeThemeKey("hastalık")]: ["sabır", "umut", "tevekkül"],
    [normalizeThemeKey("kaygı")]: ["kaygı", "korku", "tevekkül", "umut"],
    [normalizeThemeKey("çaresizlik")]: ["umut", "tevekkül", "sabır"],
    [normalizeThemeKey("bağışlanma")]: ["tövbe", "umut"],
    [normalizeThemeKey("nefs mücadelesi")]: ["irade", "sebat", "tövbe"],
    [normalizeThemeKey("ölüm korkusu")]: ["korku", "tevekkül", "umut"],
    [normalizeThemeKey("aile")]: ["sabır", "affetmek", "tevekkül"],
    [normalizeThemeKey("rızık")]: ["tevekkül", "şükür", "umut"],
    [normalizeThemeKey("imtihan")]: ["sabır", "sebat", "tevekkül"],
    [normalizeThemeKey("adalet")]: ["adalet", "zulüm", "haksızlık", "adalet arayışı"],
    [normalizeThemeKey("korku")]: ["korku", "havf", "tehdit", "endişe"],
    [normalizeThemeKey("sabır_sıkıntı")]: ["sabır", "dayanmak", "zorluk", "imtihan"],
    [normalizeThemeKey("umut_sonrasi_zorluk")]: ["umut", "ferahlık", "kolaylık", "çıkış"],
  };
  return aliases[normalizedTheme] || [theme, "umut"];
}

function normalizePreviouslyUsedAyahIds(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => (typeof item === "number" ? item : Number.parseInt(item, 10)))
        .filter((item) => Number.isInteger(item) && item > 0)
    ),
  ];
}

function normalizePreferredTopic(value) {
  const topic = resolveTopicConstraint(value);
  return topic ? normalize(topic) : null;
}

function isWeakTopicSignal(topic) {
  if (!topic) return true;
  const normalizedTopic = normalize(topic);
  return normalizedTopic === normalize("ibadet");
}

function detectAnotherAyahFollowup(message) {
  const normalizedMessage = normalize(message);
  const phrases = [
    "baska ayet var mi",
    "baÅŸka ayet var mÄ±",
    "benzer ayet var mi",
    "benzer ayet var mÄ±",
    "buna uygun baska ayet",
    "buna uygun baÅŸka ayet",
  ];
  return phrases.some((phrase) => normalizedMessage.includes(normalize(phrase)));
}

function detectExplicitTopic(message) {
  return resolveTopicConstraint(message);
}

function explicitTopicScore(explicitTopic, tags, searchable) {
  if (!explicitTopic) return { bonus: 0, penalty: 0, matched: false };

  const normalizedTags = (tags || []).map((t) => normalize(String(t)));
  const text = normalize(String(searchable || ""));

  const aliases = {
    [normalizeThemeKey("namaz")]: ["namaz", "salat", "salah", "ikame", "secde", "ruku", "rüku", "ibadet"],
    [normalizeThemeKey("dua")]: ["dua", "yakarma", "niyaz"],
    [normalizeThemeKey("zikir")]: ["zikir", "tesbih", "Allah'ı anmak", "Allahı anmak"],
    [normalizeThemeKey("sabır")]: ["sabır", "sabr", "sebat"],
    [normalizeThemeKey("sabır_sıkıntı")]: ["sabır", "sabretmek", "dayanmak", "sıkıntı", "imtihan"],
    [normalizeThemeKey("hz_muhammed")]: [
      "muhammed",
      "peygamber",
      "peygamberimiz",
      "resul",
      "rasul",
      "resulullah",
    ],
    [normalizeThemeKey("umut")]: ["umut", "ümit", "umit", "motive", "motivasyon", "moral", "teselli"],
    [normalizeThemeKey("tevekkül")]: ["tevekkül", "tevekkul"],
    [normalizeThemeKey("tövbe")]: ["tövbe", "tovbe", "istiğfar", "bağışlanma"],
    [normalizeThemeKey("şükür")]: ["şükür", "sukur", "şükreden", "hamd"],
    [normalizeThemeKey("korku")]: ["korku", "korkmayın", "korkmayin", "havf"],
    [normalizeThemeKey("kaygı")]: ["kaygı", "kaygi", "endişe", "endise", "tedirgin", "panik"],
    [normalizeThemeKey("yalnızlık")]: ["yalnızlık", "yalnizlik", "yalnız", "yalniz", "kimsesiz", "kimsem yok"],
    [normalizeThemeKey("adalet")]: ["adalet", "zulüm", "zulum", "haksızlık", "haksizlik"],
    [normalizeThemeKey("rızık")]: ["rızık", "rizik", "geçim", "gecim", "maddi sıkıntı", "maddi sikinti"],
    [normalizeThemeKey("ölüm korkusu")]: ["ölüm korkusu", "olum korkusu", "ölmekten", "olmekten", "kabir", "vefat"],
    [normalizeThemeKey("imtihan")]: ["imtihan", "sıkıntı", "sikinti", "zorluk", "musibet"],
    [normalizeThemeKey("şifa")]: ["şifa", "sifa", "hasta", "hastalık", "hastalik"],
    [normalizeThemeKey("umut_sonrasi_zorluk")]: ["umut", "ümit", "umit", "ferahlık", "ferahlik", "kolaylık", "kolaylik", "çıkış", "cikis"],
  };

  const normalizedTopic = normalizeThemeKey(explicitTopic);
  const candidates = (aliases[normalizedTopic] || [explicitTopic]).map((item) => normalize(item));
  const matched =
    candidates.some((item) => normalizedTags.includes(item)) ||
    candidates.some((item) => text.includes(item));

  if (matched) return { bonus: 140, penalty: 0, matched: true };
  return { bonus: 0, penalty: -90, matched: false };
}

function resolveTopicConstraint(value) {
  return canonicalTopic(typeof value === "string" ? value : "");
}

function topicConstraintAliases(topic) {
  const aliases = {
    [normalizeThemeKey("namaz")]: ["namaz", "salat", "salah", "ikame", "secde", "ruku", "rüku"],
    [normalizeThemeKey("dua")]: ["dua", "yakarma", "niyaz"],
    [normalizeThemeKey("zikir")]: ["zikir", "tesbih", "Allah'ı anmak", "Allahı anmak"],
    [normalizeThemeKey("sabır")]: ["sabır", "sabr", "sebat", "sabredenler"],
    [normalizeThemeKey("sabır_sıkıntı")]: ["sabır", "sabretmek", "dayanmak", "sıkıntı", "imtihan"],
    [normalizeThemeKey("hz_muhammed")]: [
      "muhammed",
      "peygamber",
      "peygamberimiz",
      "resul",
      "rasul",
      "resulullah",
    ],
    [normalizeThemeKey("umut")]: ["umut", "ümit", "umit", "motive", "motivasyon", "moral", "teselli"],
    [normalizeThemeKey("tevekkül")]: ["tevekkül", "tevekkul", "vekil", "güven", "guven"],
    [normalizeThemeKey("tövbe")]: ["tövbe", "tovbe", "istiğfar", "bağışlanma", "günah", "gunah"],
    [normalizeThemeKey("şükür")]: ["şükür", "sukur", "şükreden", "hamd"],
    [normalizeThemeKey("korku")]: ["korku", "korkmayın", "korkmayin", "havf"],
    [normalizeThemeKey("kaygı")]: ["kaygı", "kaygi", "endişe", "endise", "tedirgin", "panik", "korku"],
    [normalizeThemeKey("yalnızlık")]: ["yalnızlık", "yalnizlik", "yalnız", "yalniz", "kimsesiz", "kimsem yok"],
    [normalizeThemeKey("korku")]: ["korku", "korkuyorum", "ölüm korkusu", "olum korkusu", "endişe"],
    [normalizeThemeKey("şifa")]: ["şifa", "sifa", "hasta", "hastalık", "hastalik"],
    [normalizeThemeKey("imtihan")]: ["imtihan", "zorluk", "sıkıntı", "sikinti", "musibet", "darlık", "darlik"],
    [normalizeThemeKey("adalet")]: ["adalet", "zulüm", "zulum", "haksızlık", "haksizlik"],
    [normalizeThemeKey("rızık")]: ["rızık", "rizik", "geçim", "gecim", "iş", "is", "maddi sıkıntı", "maddi sikinti"],
    [normalizeThemeKey("ölüm korkusu")]: ["ölüm korkusu", "olum korkusu", "kabir", "vefat"],
    [normalizeThemeKey("umut_sonrasi_zorluk")]: ["umut", "ümit", "umit", "ferahlık", "ferahlik", "kolaylık", "kolaylik", "çıkış", "cikis"],
  };

  return (aliases[normalizeThemeKey(topic)] || [topic]).map((item) => normalize(item));
}

function selectCuratedTopicAyah(sourceAyahs, topicConstraint, usedAyahIdSet) {
  const normalizedTopic = resolveTopicConstraint(topicConstraint);
  if (!normalizedTopic) return null;

  const cluster = CURATED_TOPIC_CLUSTERS[normalizeThemeKey(normalizedTopic)];
  if (!Array.isArray(cluster) || cluster.length === 0) return null;

  const ayahIndex = getSourceAyahIndex(sourceAyahs);

  const available = cluster
    .map((reference, index) => {
      const ayah = ayahIndex.get(ayahKey(reference.surahNumber, reference.ayahNumber));
      if (!ayah) return null;
      return { ayah, index };
    })
    .filter(Boolean);

  if (available.length === 0) return null;

  const preferred = available.find((item) => !usedAyahIdSet.has(item.ayah.id)) || available[0];
  return {
    ...preferred.ayah,
    final_score: 10000 - preferred.index * 100,
    ranker_source: "override",
  };
}

function selectCuratedTopicTopResults(sourceAyahs, topicConstraint, usedAyahIdSet) {
  const normalizedTopic = resolveTopicConstraint(topicConstraint);
  if (!normalizedTopic) return [];

  const cluster = CURATED_TOPIC_CLUSTERS[normalizeThemeKey(normalizedTopic)];
  if (!Array.isArray(cluster) || cluster.length === 0) return [];

  const ayahIndex = getSourceAyahIndex(sourceAyahs);

  return cluster
    .map((reference, index) => {
      const ayah = ayahIndex.get(ayahKey(reference.surahNumber, reference.ayahNumber));
      if (!ayah) return null;
      return {
        ...ayah,
        final_score: 10000 - index * 100,
        ranker_source: "override",
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function shouldForceCuratedTopicSelection(message, explicitTopic, explicitAyahRequest) {
  if (!explicitTopic) return false;
  if (explicitAyahRequest) return true;

  const normalizedMessage = normalize(message);
  const signals = CURATED_OVERRIDE_SIGNAL_KEYS[normalizeThemeKey(explicitTopic)];
  return Array.isArray(signals)
    ? signals.some((signal) => normalizedMessage.includes(normalize(signal)))
    : false;
}

function resolveCuratedOverrideTopic(messageAnalysis, currentMessage, explicitTopic, topicConstraint, preferredTopic) {
  const normalizedMessage = normalize(currentMessage);
  for (const matcher of CURATED_OVERRIDE_MESSAGE_MATCHERS) {
    if (matcher.list.some((phrase) => normalizedMessage.includes(normalize(phrase)))) {
      return matcher.topic;
    }
  }

  const candidates = [
    topicConstraint,
    explicitTopic,
    preferredTopic,
    messageAnalysis?.context_topic,
    messageAnalysis?.primary_theme,
    messageAnalysis?.emotion,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeThemeKey(candidate);
    if (!normalized) continue;
    if (CURATED_TOPIC_CLUSTERS[normalized]) return normalized;
  }

  return null;
}

function resolveCurrentMessageOverrideTopic(currentMessage) {
  const normalizedMessage = normalize(currentMessage);
  if (!normalizedMessage) return null;

  for (const matcher of CURATED_OVERRIDE_MESSAGE_MATCHERS) {
    if (matcher.list.some((phrase) => normalizedMessage.includes(normalize(phrase)))) {
      return matcher.topic;
    }
  }

  return null;
}

function getSourceAyahIndex(sourceAyahs) {
  if (!Array.isArray(sourceAyahs)) {
    return new Map();
  }

  const cached = SOURCE_AYAH_INDEX_CACHE.get(sourceAyahs);
  if (cached) {
    return cached;
  }

  const index = new Map();
  for (const ayah of sourceAyahs) {
    if (!ayah) continue;
    index.set(ayahKey(ayah.surahNumber, ayah.ayahNumber || ayah.ayah), ayah);
  }
  SOURCE_AYAH_INDEX_CACHE.set(sourceAyahs, index);
  return index;
}

function selectForcedTopicAyah(sourceAyahs, topicConstraint, usedAyahIdSet) {
  const normalizedTopic = resolveTopicConstraint(topicConstraint);
  if (!normalizedTopic) return null;
  const candidates = topicConstraintAliases(normalizedTopic);

  const ranked = (Array.isArray(sourceAyahs) ? sourceAyahs : [])
    .map((ayah) => {
      const tags = Array.isArray(ayah.tags) ? ayah.tags : [];
      const normalizedTags = tags.map((tag) => normalize(String(tag)));
      const searchable = normalize(
        [
          ayah.surah,
          ayah.surahName,
          ayah.text_tr,
          ayah.text_ar,
          ayah.notes,
          ayah.short_explanation,
          tags.join(" "),
        ].join(" ")
      );
      const explicitTopicMeta = explicitTopicScore(normalizedTopic, tags, searchable);
      const exactTagMatch = tags.some(
        (tag) => normalizeThemeKey(tag) === normalizeThemeKey(normalizedTopic)
      );
      const matchedTagCount = candidates.filter((candidate) => normalizedTags.includes(candidate)).length;
      const matchedTextCount = candidates.filter((candidate) => searchable.includes(candidate)).length;
      let score =
        matchedTagCount * 180 +
        matchedTextCount * 100 +
        contextTopicBoost(normalizedTopic, tags, searchable);

      if (exactTagMatch) {
        score += 240;
      }
      if (score === 0 && explicitTopicMeta.matched) {
        score =
          explicitTopicMeta.bonus +
          scoreTheme(normalizedTopic, tags, searchable, 70) +
          contextTopicBoost(normalizedTopic, tags, searchable);
      }
      if (usedAyahIdSet.has(ayah.id)) {
        score *= 0.7;
      }

      return {
        ayah,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.ayah.id - b.ayah.id);

  const best = ranked[0];
  if (!best) return null;

  return {
    ...best.ayah,
    final_score: best.score,
    ranker_source: "override",
  };
}

function loadSemanticEnrichmentIndex() {
  try {
    if (!fs.existsSync(semanticEnrichmentPath)) {
      return new Map();
    }

    const raw = JSON.parse(fs.readFileSync(semanticEnrichmentPath, "utf8"));
    if (!Array.isArray(raw)) {
      return new Map();
    }

    const entries = raw
      .map((record) => normalizeSemanticRecord(record))
      .filter(
        (record) =>
          Number.isInteger(record.surahNumber) && Number.isInteger(record.ayahNumber)
      )
      .map((record) => [ayahKey(record.surahNumber, record.ayahNumber), record]);

    return new Map(entries);
  } catch (error) {
    return new Map();
  }
}

function normalizeSemanticRecord(record) {
  const safeRecord = record && typeof record === "object" ? record : {};
  return {
    ...safeRecord,
    theme: normalizeSemanticArray(safeRecord.theme),
    emotion: normalizeSemanticArray(safeRecord.emotion),
    category: normalizeSemanticArray(safeRecord.category),
    context: normalizeSemanticArray(safeRecord.context),
    tags: normalizeSemanticArray(safeRecord.tags),
    use_cases: normalizeSemanticArray(safeRecord.use_cases),
    sources: normalizeSemanticSources(safeRecord.sources),
  };
}

function normalizeSemanticArray(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [
    ...new Set(
      values
        .map((item) => (typeof item === "string" ? item.trim() : String(item || "").trim()))
        .filter(Boolean)
    ),
  ];
}

function normalizeSemanticSources(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSemanticContext(messageAnalysis, options, currentMessage, explicitTopic, topicConstraint, preferredTopic, overrideTopic) {
  const semanticTagsConsidered = [];
  const queryTerms = new Set();
  const candidateValues = [
    currentMessage,
    messageAnalysis?.primary_theme,
    messageAnalysis?.context_topic,
    messageAnalysis?.emotion,
    messageAnalysis?.severity,
    explicitTopic,
    topicConstraint,
    preferredTopic,
    overrideTopic,
    options?.current_message,
  ];

  for (const value of candidateValues) {
    const loose = normalizeLoose(value);
    if (loose) {
      queryTerms.add(loose);
      semanticTagsConsidered.push(loose);
    }

    const normalizedTopic = normalizeThemeKey(value);
    if (!normalizedTopic) continue;
    for (const alias of topicConstraintAliases(normalizedTopic)) {
      const looseAlias = normalizeLoose(alias);
      if (looseAlias) {
        queryTerms.add(looseAlias);
        semanticTagsConsidered.push(looseAlias);
      }
    }
  }

  const overrideUseCase = resolveSemanticUseCase(
    messageAnalysis,
    currentMessage,
    explicitTopic,
    topicConstraint,
    preferredTopic,
    overrideTopic
  );

  if (overrideUseCase) {
    const looseUseCase = normalizeLoose(overrideUseCase);
    if (looseUseCase) {
      queryTerms.add(looseUseCase);
      semanticTagsConsidered.push(looseUseCase);
    }
  }

  return {
    override_use_case: overrideUseCase,
    semantic_tags_considered: [...new Set(semanticTagsConsidered.filter(Boolean))],
    query_terms: [...queryTerms].filter(Boolean),
  };
}

function resolveSemanticUseCase(messageAnalysis, currentMessage, explicitTopic, topicConstraint, preferredTopic, overrideTopic) {
  const normalizedMessage = normalizeLoose(currentMessage);
  const candidates = [
    topicConstraint,
    explicitTopic,
    messageAnalysis?.context_topic,
    messageAnalysis?.primary_theme,
    messageAnalysis?.emotion,
    preferredTopic,
    overrideTopic,
  ];

  for (const candidate of candidates) {
    const key = normalizeThemeKey(candidate);
    if (key && Object.prototype.hasOwnProperty.call(SEMANTIC_OVERRIDE_USE_CASES, key)) {
      return SEMANTIC_OVERRIDE_USE_CASES[key];
    }
  }

  const phraseMatchers = [
    {
      use_case: "loneliness_support",
      phrases: [
        "yalnız",
        "yalniz",
        "yalnızlık",
        "yalnizlik",
        "yalnız hissediyorum",
        "yalniz hissediyorum",
        "çok yalnız",
        "cok yalniz",
        "kimsem yok",
        "kimse yok",
        "kimsem yok gibi hissediyorum",
        "tek başımayım",
        "tek basimayim",
      ],
    },
    {
      use_case: "repentance_support",
      phrases: ["tövbe", "tevbe", "günah", "affeder mi", "bağışlar mı", "pişmanım", "pişman"],
    },
    {
      use_case: "patience_support",
      phrases: ["sabır", "sabret", "sabretmek", "dayanmak", "sabır hakkında", "sabır ayeti", "zor zamanlarda sabır"],
    },
    {
      use_case: "prophet_character",
      phrases: ["peygamberimiz", "resulullah", "hz muhammed", "muhammed peygamber", "muhammed"],
    },
  ];

  for (const matcher of phraseMatchers) {
    if (matcher.phrases.some((phrase) => normalizedMessage.includes(normalizeLoose(phrase)))) {
      return matcher.use_case;
    }
  }

  return null;
}

function scoreSemanticMatch(ayah, semanticContext) {
  if (!ayah || !semanticContext) {
    return {
      semantic_score: 0,
      ranker_source: "fallback",
      semantic_use_case: null,
    };
  }

  const record = SEMANTIC_ENRICHMENT_INDEX.get(ayahKey(ayah.surahNumber, ayah.ayahNumber));
  if (!record) {
    return {
      semantic_score: 0,
      ranker_source: "fallback",
      semantic_use_case: semanticContext.override_use_case || null,
    };
  }

  const searchable = normalizeLoose(
    [
      ayah.surah,
      ayah.surahName,
      ayah.text_tr,
      ayah.text_ar,
      ayah.notes,
      ayah.short_explanation,
      record.theme.join(" "),
      record.emotion.join(" "),
      record.category.join(" "),
      record.context.join(" "),
      record.tags.join(" "),
      record.use_cases.join(" "),
    ].join(" ")
  );

  const candidateTerms = semanticContext.query_terms || [];
  const matchedTerms = candidateTerms.filter((term) => term && searchable.includes(term));
  const exactUseCase = semanticContext.override_use_case
    ? record.use_cases.some(
        (value) => normalizeLoose(value) === normalizeLoose(semanticContext.override_use_case)
      )
    : false;

  let semanticScore = 0;
  if (exactUseCase) {
    semanticScore += 1000;
  } else if (matchedTerms.length >= 2) {
    semanticScore += 120 + matchedTerms.length * 20;
  } else if (matchedTerms.length === 1) {
    semanticScore += 35;
  }

  if (semanticScore === 0) {
    return {
      semantic_score: 0,
      ranker_source: "fallback",
      semantic_use_case: semanticContext.override_use_case || null,
    };
  }

  return {
    semantic_score: semanticScore,
    ranker_source: exactUseCase ? "override" : "semantic",
    semantic_use_case: semanticContext.override_use_case || null,
  };
}

function normalizeLoose(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAnyLoose(text, phrases) {
  const normalizedText = normalizeLoose(text);
  return (Array.isArray(phrases) ? phrases : []).some((phrase) => normalizedText.includes(normalizeLoose(phrase)));
}

function ayahKey(surahNumber, ayahNumber) {
  return `${Number(surahNumber)}:${Number(ayahNumber)}`;
}

module.exports = {
  rankAyahs,
  shouldUseAyahFor,
  datasetTagsForTheme,
  resolveCurrentMessageOverrideTopic,
};




