const fs = require("fs");
const path = require("path");
const { normalize, decodeURIComponentSafe, canonicalTopic } = require("./context_resolver");
const { matchSemanticTopic } = require("./semantic_topic_matcher");
const { compareQuestions, getSynonyms, extractSemanticTokens, calculateSemanticSimilarity } = require("./turkish_nlp_utils");

const ILMIHAL_PATH = path.join(__dirname, "..", "..", "assets", "data", "knowledge", "ilmihal_knowledge_base.json");
// Server-side detailed KB (server/data/ilmihal/*.json) — used when semantic matcher
// returns an id that doesn't exist in the client-side ilmihal_knowledge_base.json
const ILMIHAL_DATA_PATH = path.join(__dirname, "..", "data", "ilmihal");

let cachedIlmihal = null;

function loadIlmihalKnowledge() {
  if (cachedIlmihal) return cachedIlmihal;
  if (!fs.existsSync(ILMIHAL_PATH)) {
    cachedIlmihal = [];
    return cachedIlmihal;
  }
  const raw = fs.readFileSync(ILMIHAL_PATH, "utf8");
  const parsed = JSON.parse(raw);
  cachedIlmihal = Array.isArray(parsed) ? parsed : [];
  return cachedIlmihal;
}

function resolveKandilSpecialTopic(normalizedMessage) {
  if (
    includesLoose(normalizedMessage, "mirac kandili") ||
    includesLoose(normalizedMessage, "miraç kandili") ||
    includesLoose(normalizedMessage, "isra ve mirac") ||
    includesLoose(normalizedMessage, "isra mirac gecesi") ||
    includesLoose(normalizedMessage, "miraç") ||
    includesLoose(normalizedMessage, "mirac")
  ) {
    return "mirac_kandili_nedir";
  }
  return null;
}

/**
 * server/data/ilmihal/{entryId}.json dosyasından doğrudan yükle.
 * Explicit router kurallarının flat KB'de bulunmayan entry'leri döndürmesini sağlar.
 */
function buildServerSideHit(entryId) {
  try {
    const filePath = path.join(ILMIHAL_DATA_PATH, `${entryId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const serverEntry = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const answerParts = [];
    if (serverEntry.summary) answerParts.push(serverEntry.summary);
    if (Array.isArray(serverEntry.step_by_step) && serverEntry.step_by_step.length > 0) {
      answerParts.push(serverEntry.step_by_step.join(" "));
    }
    const answerText = answerParts.join("\n\n") || serverEntry.title || "";
    if (!answerText) return null;
    return {
      id: serverEntry.id || entryId,
      file: `ilmihal/${entryId}.json`,
      type: serverEntry.category || "worship_practice",
      topic: serverEntry.id || entryId,
      answer_text: answerText,
      source_note: (serverEntry.source_notes || [])[0] || "Diyanet-based curated internal knowledge.",
      requires_ayah: false,
      route_mode: "ilmihal_knowledge",
      knowledge_hit_id: serverEntry.id || entryId,
      matched_title: serverEntry.title || null,
      matched_by: "explicit_router_rule",
    };
  } catch (err) {
    console.warn(`[ROUTER] buildServerSideHit failed for "${entryId}":`, err.message);
    return null;
  }
}

function routeKnowledge(message, analysis = {}, plannerPlan = null, history = []) {
  const normalizedMessage = normalizeLoose(message);
  const normalizedHistory = buildHistoryContext(history);
  const topicHint = normalizeLoose(
    canonicalTopic(plannerPlan?.knowledge_topic || analysis.context_topic || analysis.primary_theme || "")
  );
  const entries = loadIlmihalKnowledge();

  const kandilSpecialTopic = resolveKandilSpecialTopic(normalizedMessage);
  if (kandilSpecialTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(kandilSpecialTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
  }

  const prayerCountTopic = resolvePrayerCountTopic(message, normalizedMessage, history);
  if (prayerCountTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(prayerCountTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
  }

  const vitirVacipTopic = resolveVitirVacipTopic(message, normalizedMessage, history);
  if (vitirVacipTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(vitirVacipTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
  }

  const prayerFollowupTopic = resolvePrayerFollowupTopic(message, normalizedMessage, history);
  if (prayerFollowupTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(prayerFollowupTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
  }

  // Oruç "kimlere farzdır" soruları — "ramazan_nedir" catch-all'dan önce yakala
  if (
    (includesLoose(normalizedMessage, "oruc") || includesLoose(normalizedMessage, "oruç") || includesLoose(normalizedMessage, "ramazan")) &&
    (includesLoose(normalizedMessage, "kimlere farz") || includesLoose(normalizedMessage, "kimlere farzdir") ||
     includesLoose(normalizedMessage, "kimlere zorunlu") || includesLoose(normalizedMessage, "kim tutmali") ||
     (includesLoose(normalizedMessage, "kimlere") && (includesLoose(normalizedMessage, "farz") || includesLoose(normalizedMessage, "zorunlu"))))
  ) {
    const serverHit = buildServerSideHit("oruc_kimlere_farzdir");
    if (serverHit) return serverHit;
  }

  // say_nedir — "Sa'y" title normalizes to "sa y" (apostrophe→space), keyword "say nedir" won't substring-match
  if (
    includesLoose(normalizedMessage, "say nedir") ||
    normalizedMessage.includes(normalizeLoose("sa y nedir")) ||
    includesLoose(normalizedMessage, "safa merve say") ||
    (includesLoose(normalizedMessage, "safa") && includesLoose(normalizedMessage, "merve") &&
     (includesLoose(normalizedMessage, "nedir") || includesLoose(normalizedMessage, "nasil")))
  ) {
    const sayHit = buildServerSideHit("say_nedir");
    if (sayHit) return sayHit;
  }

  const zekatFitreTopic = resolveZekatFitreTopic(normalizedMessage);
  if (zekatFitreTopic) {
    // resolveZekatFitreTopic may return a full hit object (from buildServerSideHit inside it)
    if (typeof zekatFitreTopic === "object") return zekatFitreTopic;
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(zekatFitreTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
    // Fallback: entry is in server-side KB but not in flat client-side KB
    const zekatServerHit = buildServerSideHit(zekatFitreTopic);
    if (zekatServerHit) return zekatServerHit;
  }

  const abdestTopic = resolveAbdestTopic(message, normalizedMessage);
  if (abdestTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(abdestTopic.topic));
    if (hit) {
      return buildIlmihalHit(hit, {
        matchReason: abdestTopic.match_reason,
        matchScore: abdestTopic.match_score,
      });
    }
  }

  const kurbanMatch = resolveKurbanTopic(message, normalizedMessage);
  if (kurbanMatch) {
    if (kurbanMatch.clarification) {
      return {
        id: null,
        file: null,
        type: "clarification",
        topic: null,
        matched_title: null,
        answer_text: "Bu konuda güvenilir cevap verebilmem için sorunu biraz daha netleştirir misin?",
        source_note: "clarification_needed",
        requires_ayah: false,
        route_mode: "ilmihal_clarification",
        knowledge_hit_id: null,
        matched_knowledge_id: null,
        matched_by: kurbanMatch.match_reason,
        match_reason: kurbanMatch.match_reason,
        match_score: kurbanMatch.match_score,
        rejected_candidates: kurbanMatch.rejected_candidates || [],
      };
    }
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(kurbanMatch.topic));
    if (hit) {
      return buildIlmihalHit(hit, {
        matchReason: kurbanMatch.match_reason,
        matchScore: kurbanMatch.match_score,
      });
    }
    // Fallback: entry is in server-side KB but not in flat client-side KB
    if (kurbanMatch.topic) {
      const kurbanServerHit = buildServerSideHit(kurbanMatch.topic);
      if (kurbanServerHit) return kurbanServerHit;
    }
  }

  const hacUmreTopic = resolveHacUmreTopic(message, normalizedMessage);
  if (hacUmreTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(hacUmreTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
    // Fallback: entry is in server-side KB but not in flat client-side KB
    const hacServerHit = buildServerSideHit(hacUmreTopic);
    if (hacServerHit) return hacServerHit;
  }

  const teyemmumMeshTopic = resolveTeyemmumMeshTopic(message, normalizedMessage);
  if (teyemmumMeshTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(teyemmumMeshTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
  }

  const womenStateTopic = resolveWomenStateTopic(message, normalizedMessage);
  if (womenStateTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(womenStateTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
  }

  const cumaBayramTopic = resolveCumaBayramTopic(message, normalizedMessage);
  if (cumaBayramTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(cumaBayramTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
  }

  // namaz_niyeti — must be BEFORE resolveNamazScenarioTopic which broadly catches "namaz"+"nasıl"
  if (
    includesLoose(normalizedMessage, "namaz niyeti") ||
    (includesLoose(normalizedMessage, "namaz") && includesLoose(normalizedMessage, "niyet") &&
     (includesLoose(normalizedMessage, "nasil") || includesLoose(normalizedMessage, "yapilir")))
  ) {
    const namazNiyetiHit = buildServerSideHit("namaz_niyeti");
    if (namazNiyetiHit) return namazNiyetiHit;
  }

  const namazScenarioTopic = resolveNamazScenarioTopic(message, normalizedMessage);
  if (namazScenarioTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(namazScenarioTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
  }

  // oruc_kefaret — must be BEFORE resolveDailyPracticeTopic which has a broad "kefaret" catch-all
  if (
    (includesLoose(normalizedMessage, "oruc") || includesLoose(normalizedMessage, "oruç")) &&
    includesLoose(normalizedMessage, "kefaret")
  ) {
    const orucKefaretHit = buildServerSideHit("oruc_kefaret");
    if (orucKefaretHit) return orucKefaretHit;
  }

  const dailyPracticeTopic = resolveDailyPracticeTopic(message, normalizedMessage);
  if (dailyPracticeTopic) {
    const hit = entries.find((entry) => topicKey(entry.topic || "") === topicKey(dailyPracticeTopic));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
      };
    }
  }

  // oruc_ve_hastalar — must be BEFORE genericSupportPrompt which catches "hastalık"
  if (
    includesLoose(normalizedMessage, "hastalikta oruc") ||
    includesLoose(normalizedMessage, "hastada oruc") ||
    includesLoose(normalizedMessage, "hasta oruc tutabilir mi") ||
    includesLoose(normalizedMessage, "hastalıkta oruç") ||
    (includesLoose(normalizedMessage, "hasta") && (includesLoose(normalizedMessage, "oruc") || includesLoose(normalizedMessage, "oruç")))
  ) {
    const orucHastaHit = buildServerSideHit("oruc_ve_hastalar");
    if (orucHastaHit) return orucHastaHit;
  }

  const genericSupportPrompt =
    includesLoose(normalizedMessage, "çok korkuyorum") ||
    includesLoose(normalizedMessage, "korkuyorum") ||
    includesLoose(normalizedMessage, "endişeliyim") ||
    includesLoose(normalizedMessage, "endise") ||
    includesLoose(normalizedMessage, "yalnızım") ||
    includesLoose(normalizedMessage, "yalnizim") ||
    includesLoose(normalizedMessage, "üzgünüm") ||
    includesLoose(normalizedMessage, "uzgunum") ||
    includesLoose(normalizedMessage, "içim sıkılıyor") ||
    includesLoose(normalizedMessage, "icim sikiliyor") ||
    includesLoose(normalizedMessage, "çok hastayım") ||
    includesLoose(normalizedMessage, "hastayım") ||
    includesLoose(normalizedMessage, "hastalik") ||
    includesLoose(normalizedMessage, "hastalık") ||
    includesLoose(normalizedMessage, "şifa istiyorum") ||
    includesLoose(normalizedMessage, "sifa istiyorum") ||
    includesLoose(normalizedMessage, "iyileşmek istiyorum") ||
    includesLoose(normalizedMessage, "iyilesmek istiyorum") ||
    includesLoose(normalizedMessage, "acı çekiyorum") ||
    includesLoose(normalizedMessage, "aci cekiyorum");
  if (
    genericSupportPrompt &&
    !includesLoose(normalizedMessage, "vesvese") &&
    !includesLoose(normalizedMessage, "nazar") &&
    !includesLoose(normalizedMessage, "büyü") &&
    !includesLoose(normalizedMessage, "buyu") &&
    !includesLoose(normalizedMessage, "cin") &&
    !includesLoose(normalizedMessage, "korku gelince") &&
    !includesLoose(normalizedMessage, "gece korkusu") &&
    !includesLoose(normalizedMessage, "kötü rüya") &&
    !includesLoose(normalizedMessage, "kotu ruya") &&
    !includesLoose(normalizedMessage, "namaz") &&
    !includesLoose(normalizedMessage, "oruc") &&
    !includesLoose(normalizedMessage, "oruç")
  ) {
    return null;
  }

  const hardMatches = [
    { match: /terav/i, topic: "teravih_namazi" },
    { match: /cuma/, topic: "cuma_namazi" },
    { match: /bayram/, topic: "bayram_namazi" },
    { match: /cenaze/, topic: "cenaze_namazi" },
    { match: /vitir/, topic: "vitir_namazi" },
    { match: /sabah/, topic: "sabah_namazi" },
    { match: /ogle/i, topic: "ogle_namazi" },
    { match: /ikindi/, topic: "ikindi_namazi" },
    { match: /aksam/i, topic: "aksam_namazi" },
    { match: /yatsi/i, topic: "yatsi_namazi" },
  ];
  const hasCountCue = /kaÃ§|kac|rekat|rekÃ¢t/.test(normalizedMessage);
  for (const rule of hardMatches) {
    if (rule.topic === "vitir_namazi" && (!hasCountCue || /vacip|farz/.test(normalizedMessage))) {
      continue;
    }
    if (rule.match.test(normalizedMessage) && (rule.topic !== "cuma_namazi" || normalizedMessage.includes("namaz"))) {
      const hardEntry = entries.find((entry) => topicKey(entry.topic || "") === topicKey(rule.topic));
      if (hardEntry) {
        return {
          id: hardEntry.id || null,
          file: "ilmihal_knowledge_base.json",
          type: hardEntry.type || "worship_practice",
          topic: hardEntry.topic || null,
          answer_text: hardEntry.answer_tr || "",
          source_note: hardEntry.source_note || "Diyanet-based curated internal knowledge.",
          requires_ayah: hardEntry.requires_ayah === true,
          route_mode: "ilmihal_knowledge",
          knowledge_hit_id: hardEntry.id || null,
        };
      }
    }
  }

  const semanticMatch = matchSemanticTopic(normalizedMessage, entries);
  if (semanticMatch) {
    // 1) Try client-side ilmihal_knowledge_base.json first
    const hit = entries.find((entry) => topicKey(entry.topic || entry.id || "") === topicKey(semanticMatch.topic_id));
    if (hit) {
      return {
        id: hit.id || null,
        file: "ilmihal_knowledge_base.json",
        type: hit.type || "worship_practice",
        topic: hit.topic || null,
        answer_text: hit.answer_tr || "",
        source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: hit.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: hit.id || null,
        semantic_match_score: semanticMatch.score,
        semantic_confidence: semanticMatch.confidence,
        semantic_matched_topic: semanticMatch.topic_id,
        matched_by: semanticMatch.matched_by || "semantic",
      };
    }

    // 2) Fallback: load directly from server/data/ilmihal/{id}.json
    //    This covers entries that exist in the server KB but not in the client-side JSON.
    try {
      const serverFilePath = path.join(ILMIHAL_DATA_PATH, `${semanticMatch.topic_id}.json`);
      if (fs.existsSync(serverFilePath)) {
        const serverEntry = JSON.parse(fs.readFileSync(serverFilePath, "utf8"));
        // Build answer text from server KB fields
        const answerParts = [];
        if (serverEntry.summary) answerParts.push(serverEntry.summary);
        if (Array.isArray(serverEntry.step_by_step) && serverEntry.step_by_step.length > 0) {
          answerParts.push(serverEntry.step_by_step.join(" "));
        }
        const answerText = answerParts.join("\n\n") || serverEntry.title || "";
        if (answerText) {
          return {
            id: serverEntry.id || semanticMatch.topic_id,
            file: `ilmihal/${semanticMatch.topic_id}.json`,
            type: serverEntry.category || "worship_practice",
            topic: serverEntry.id || semanticMatch.topic_id,
            answer_text: answerText,
            source_note: (serverEntry.source_notes || [])[0] || "Diyanet-based curated internal knowledge.",
            requires_ayah: false,
            route_mode: "ilmihal_knowledge",
            knowledge_hit_id: serverEntry.id || semanticMatch.topic_id,
            matched_title: serverEntry.title || null,
            semantic_match_score: semanticMatch.score,
            semantic_confidence: semanticMatch.confidence,
            semantic_matched_topic: semanticMatch.topic_id,
            matched_by: semanticMatch.matched_by || "semantic",
          };
        }
      }
    } catch (err) {
      console.warn(`[ROUTER] Server KB fallback failed for "${semanticMatch.topic_id}":`, err.message);
    }
  }

  const isIncompleteFollowup = isFollowupPrompt(normalizedMessage);
  const recoveredHistoryTopic = isIncompleteFollowup ? recoverTopicFromRawHistory(history) : null;
  const candidateText = isIncompleteFollowup && normalizedHistory ? `${normalizedHistory} ${normalizedMessage}` : normalizedMessage;

  let bestEntry = null;
  let bestScore = 0;

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const entryTriggers = Array.isArray(entry.triggers) ? entry.triggers : [];
    const entryTopic = normalizeLoose(entry.topic || "");
    const exactTriggerScore = scoreTriggers(candidateText, normalizedMessage, entryTriggers);
    const contextScore =
      isIncompleteFollowup && normalizedHistory && entryTopic && normalizedHistory.includes(entryTopic) ? 2 : 0;
    const recoveredTopicScore =
      isIncompleteFollowup && recoveredHistoryTopic && entryTopic && topicKey(entryTopic) === topicKey(recoveredHistoryTopic)
        ? 2
        : 0;
    const topicScore = topicHint && entryTopic && topicHint === entryTopic ? 3 : 0;
    const totalScore =
      exactTriggerScore +
      contextScore +
      recoveredTopicScore +
      (exactTriggerScore > 0 || contextScore > 0 || recoveredTopicScore > 0 ? topicScore : 0);

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestEntry = entry;
    }
  }

  if (!bestEntry || bestScore <= 0) {
  return null;
}

  return {
    id: bestEntry.id || null,
    file: "ilmihal_knowledge_base.json",
    type: bestEntry.type || "worship_practice",
    topic: bestEntry.topic || null,
    answer_text: bestEntry.answer_tr || "",
    source_note: bestEntry.source_note || "Diyanet-based curated internal knowledge.",
    requires_ayah: bestEntry.requires_ayah === true,
    route_mode: "ilmihal_knowledge",
    knowledge_hit_id: bestEntry.id || null,
  };
}

function isFollowupPrompt(normalizedMessage) {
  const prompts = [
    "kaÃ§ rekat",
    "kac rekat",
    "rekat",
    "farzÄ± kaÃ§",
    "farzi kac",
    "farz mÄ±",
    "farz mi",
    "vacip mi",
    "sÃ¼nneti var mÄ±",
    "sunneti var mi",
    "nasÄ±l kÄ±lÄ±nÄ±r",
    "nasil kilinir",
    "nasÄ±l alÄ±nÄ±r",
    "nasil alinir",
  ];
  return prompts.some((prompt) => normalizedMessage.includes(normalizeLoose(prompt)));
}

function scoreTriggers(candidateText, normalizedMessage, triggers) {
  let score = 0;
  for (const trigger of triggers) {
    const normalizedTrigger = normalizeLoose(trigger);
    if (!normalizedTrigger) continue;
    if (normalizedMessage.includes(normalizedTrigger)) {
      score += 6;
    } else if (candidateText.includes(normalizedTrigger)) {
      score += 3;
    }
  }
  return score;
}

function buildHistoryContext(history) {
  if (!Array.isArray(history) || history.length === 0) return "";
  return history
    .slice(-4)
    .map((item) => (item && typeof item.text === "string" ? normalizeLoose(decodeURIComponentSafe(item.text)) : ""))
    .join(" ");
}

function includesLoose(text, phrase) {
  return normalizeLoose(String(text || "")).includes(normalizeLoose(String(phrase || "")));
}

function buildIlmihalHit(hit, { matchReason = "exact", matchScore = 1, rejectedCandidates = [] } = {}) {
  return {
    id: hit.id || null,
    file: "ilmihal_knowledge_base.json",
    type: hit.type || "worship_practice",
    topic: hit.topic || null,
    matched_title: resolveKnowledgeTitle(hit),
    answer_text: hit.answer_tr || "",
    source_note: hit.source_note || "Diyanet-based curated internal knowledge.",
    requires_ayah: hit.requires_ayah === true,
    route_mode: "ilmihal_knowledge",
    knowledge_hit_id: hit.id || null,
    matched_knowledge_id: hit.id || null,
    matched_by: matchReason,
    match_reason: matchReason,
    match_score: matchScore,
    rejected_candidates: rejectedCandidates,
  };
}

function resolveAbdestTopic(message, normalizedMessage) {
  const raw = normalizeRawText(message);
  const hasAbdest = includesLoose(normalizedMessage, "abdest") || raw.includes("abdest");
  if (!hasAbdest) return null;
  if (
    includesLoose(normalizedMessage, "abdesti bozan") ||
    includesLoose(normalizedMessage, "abdest bozan") ||
    raw.includes("abdesti bozan") ||
    raw.includes("abdest bozan")
  ) {
    return topicMatch("abdest_bozanlar", "intent_phrase", 95);
  }
  if (
    includesLoose(normalizedMessage, "abdest nasil alinir") ||
    includesLoose(normalizedMessage, "abdest nasıl alınır") ||
    includesLoose(normalizedMessage, "abdest alma") ||
    includesLoose(normalizedMessage, "abdest adimlari") ||
    includesLoose(normalizedMessage, "abdest adımları") ||
    raw.includes("abdest nasil alinir") ||
    raw.includes("abdest alma")
  ) {
    return topicMatch("abdest_howto", "intent_phrase", 90);
  }
  return null;
}

function resolveZekatFitreTopic(normalizedMessage) {
  if (includesLoose(normalizedMessage, "zekat kimlere verilmez") || includesLoose(normalizedMessage, "zekÃ¢t kimlere verilmez")) {
    return "zekat_kime_verilmez";
  }
  if (
    includesLoose(normalizedMessage, "zekat kime verilir") ||
    includesLoose(normalizedMessage, "zekat kimlere verilir") ||
    includesLoose(normalizedMessage, "zekÃ¢t kime verilir") ||
    includesLoose(normalizedMessage, "zekÃ¢t kimlere verilir")
  ) {
    return "zekat_kime_verilir";
  }
  if (
    includesLoose(normalizedMessage, "zekat nisap nedir") ||
    includesLoose(normalizedMessage, "zekÃ¢t nisap nedir") ||
    includesLoose(normalizedMessage, "nisap nedir")
  ) {
    return "zekat_nisap_nedir";
  }
  if (
    includesLoose(normalizedMessage, "zekat orani nedir") ||
    includesLoose(normalizedMessage, "zekat oranı nedir") ||
    includesLoose(normalizedMessage, "zekat orani") ||
    includesLoose(normalizedMessage, "zekat oranı")
  ) {
    return "zekat_orani";
  }
  if (includesLoose(normalizedMessage, "fitre ne zaman verilir")) {
    return "fitre_ne_zaman_verilir";
  }
  if (includesLoose(normalizedMessage, "fitre kime verilir")) {
    return "fitre_kime_verilir";
  }
  if (includesLoose(normalizedMessage, "fitre nedir")) {
    return "fitre_nedir";
  }
  if (includesLoose(normalizedMessage, "fitre")) {
    return "fitre_nedir";
  }
  // "kimlere farzdır/farz" sorularını genel "zekat_nedir" catch-all'dan önce yakala
  if (
    includesLoose(normalizedMessage, "zekat kimlere farzdir") ||
    includesLoose(normalizedMessage, "zekat kimlere farz") ||
    includesLoose(normalizedMessage, "zekata kim") ||
    (includesLoose(normalizedMessage, "zekat") && includesLoose(normalizedMessage, "kimlere"))
  ) {
    const serverHit = buildServerSideHit("zekat_kimlere_farzdir");
    if (serverHit) return serverHit;
    return "zekat_kimlere_farzdir"; // flat KB fallback
  }
  // Zekat hesaplama — must be before generic "zekat" catch-all
  if (
    includesLoose(normalizedMessage, "zekat hesaplama") ||
    includesLoose(normalizedMessage, "zekat nasil hesaplanir") ||
    includesLoose(normalizedMessage, "zekat nasıl hesaplanır") ||
    includesLoose(normalizedMessage, "zekat miktari") ||
    includesLoose(normalizedMessage, "zekat miktarı") ||
    includesLoose(normalizedMessage, "yuzde kac zekat") ||
    includesLoose(normalizedMessage, "yüzde kaç zekat")
  ) {
    return "zekat_hesaplama";
  }
  // Zekat ve sadaka farkı — must be before generic "zekat" catch-all
  if (
    includesLoose(normalizedMessage, "zekat") &&
    includesLoose(normalizedMessage, "sadaka") &&
    (includesLoose(normalizedMessage, "fark") || includesLoose(normalizedMessage, "ayirt") || includesLoose(normalizedMessage, "ne fark"))
  ) {
    return "zekat_ve_sadaka_farki";
  }
  if (includesLoose(normalizedMessage, "zekat nedir") || includesLoose(normalizedMessage, "zekÃ¢t nedir")) {
    return "zekat_nedir";
  }
  if (includesLoose(normalizedMessage, "zekat")) {
    return "zekat_nedir";
  }
  return null;
}

function resolveKurbanTopic(message, normalizedMessage) {
  const raw = normalizeRawText(message);
  const hasKurban = includesLoose(normalizedMessage, "kurban") || raw.includes("kurban");
  const hasEti = includesLoose(normalizedMessage, "kurban eti") || raw.includes("kurban eti");
  const hasPaylas = includesLoose(normalizedMessage, "paylas") || includesLoose(normalizedMessage, "paylaş") || raw.includes("pay");

  if (
    includesLoose(normalizedMessage, "adak kurbani") ||
    includesLoose(normalizedMessage, "adak kurbanı") ||
    includesLoose(normalizedMessage, "adak kurbani nedir") ||
    includesLoose(normalizedMessage, "adak kurbanı nedir")
  ) {
    return topicMatch("adak_kurbani", "exact_normalized_question", 100);
  }

  if (
    includesLoose(normalizedMessage, "kurban kimlere vaciptir") ||
    includesLoose(normalizedMessage, "kurban kime vaciptir") ||
    raw.includes("kurban kimlere vaciptir") ||
    raw.includes("kurban kime vaciptir")
  ) {
    return topicMatch("kurban_kime_vaciptir", "exact_normalized_question", 100);
  }

  // Check for semantic variations: "kurban kimlere" with obligation verb synonyms (gerekir, farzdır, zorunludur, lazım)
  if (hasKurban && (includesLoose(normalizedMessage, "kurban kimlere") || includesLoose(normalizedMessage, "kurban kime"))) {
    const obligationSynonyms = ['gerekir', 'farzdır', 'farz', 'zorunlu', 'zorunludur', 'lazım', 'lazımdir', 'lazımdır'];
    const hasObligationVerb = obligationSynonyms.some(verb =>
      includesLoose(normalizedMessage, verb) || raw.includes(verb)
    );

    if (hasObligationVerb) {
      // This is asking about who must do kurban - match to kurban_kime_vaciptir
      return topicMatch("kurban_kime_vaciptir", "semantic_synonym_match", 85);
    }
  }

  // Check for "kurban kesmek [obligation verb]" - asking if it's obligatory to cut kurban
  if (hasKurban && (includesLoose(normalizedMessage, "kurban kesmek") || includesLoose(normalizedMessage, "kurban kes"))) {
    const obligationSynonyms = ['gerekir', 'farzdır', 'farz', 'zorunlu', 'zorunludur', 'vacip', 'vaciptir', 'lazım', 'lazımdir', 'lazımdır', 'mi'];
    const hasObligationVerb = obligationSynonyms.some(verb =>
      includesLoose(normalizedMessage, verb) || raw.includes(verb)
    );

    if (hasObligationVerb) {
      // This is asking about obligation of cutting kurban - match to kurban_kime_vaciptir
      return topicMatch("kurban_kime_vaciptir", "semantic_synonym_match", 80);
    }
  }
  if (
    hasKurban &&
    (includesLoose(normalizedMessage, "kimlere vacip") ||
      includesLoose(normalizedMessage, "kime vacip") ||
      includesLoose(normalizedMessage, "kimler kurban keser") ||
      includesLoose(normalizedMessage, "kurban yükümlülüğü") ||
      includesLoose(normalizedMessage, "kurban yukumlulugu") ||
      includesLoose(normalizedMessage, "kurban kesmek kimlere gerekir") ||
      raw.includes("kimlere vacip") ||
      raw.includes("kime vacip") ||
      raw.includes("kimler kurban keser") ||
      raw.includes("kurban yukumlulugu") ||
      raw.includes("kurban kesmek kimlere gerekir"))
  ) {
    return topicMatch("kurban_kime_vaciptir", "intent_phrase", 90);
  }
  if (
    hasKurban &&
    (includesLoose(normalizedMessage, "kurban keserken nelere dikkat edilir") ||
      includesLoose(normalizedMessage, "kurban keserken") ||
      includesLoose(normalizedMessage, "kurban nasil kesilir") ||
      includesLoose(normalizedMessage, "kurban nasıl kesilir") ||
      includesLoose(normalizedMessage, "kurban kesimi") ||
      raw.includes("kurban keserken") ||
      raw.includes("kurban nasil kesilir") ||
      raw.includes("kurban kesimi"))
  ) {
    return topicMatch("kurban_keserken_nelere_dikkat_edilir", "intent_phrase", 95);
  }
  if (
    includesLoose(normalizedMessage, "kurban eti nasil paylasilir") ||
    includesLoose(normalizedMessage, "kurban eti nasıl paylaşılır") ||
    (hasEti && hasPaylas)
  ) {
    return topicMatch("kurban_eti_nasil_paylasilir", hasEti && hasPaylas ? "intent_phrase" : "exact_normalized_question", hasEti && hasPaylas ? 90 : 100);
  }
  if ((includesLoose(normalizedMessage, "kurban ne zaman kesilir") || includesLoose(normalizedMessage, "kurban zamani") || raw.includes("kurban ne zaman")) && hasKurban) {
    return topicMatch("kurban_ne_zaman_kesilir", "exact_normalized_question", 100);
  }
  if (
    includesLoose(normalizedMessage, "büyükbaş kurbana kaç kişi ortak olabilir") ||
    includesLoose(normalizedMessage, "kurban hisse") ||
    includesLoose(normalizedMessage, "hisse kurban") ||
    includesLoose(normalizedMessage, "ortak kurban")
  ) {
    return topicMatch("kurban_hisse_olur_mu", "intent_phrase", 90);
  }
  if (
    includesLoose(normalizedMessage, "kurban yerine para verilir mi") ||
    includesLoose(normalizedMessage, "kurban yerine para bağışı") ||
    includesLoose(normalizedMessage, "kesmeden bağış") ||
    includesLoose(normalizedMessage, "online kurban bağışı")
  ) {
    return topicMatch("kurban_yerine_para_verilir_mi", "intent_phrase", 90);
  }
  if (
    includesLoose(normalizedMessage, "kurban eti kimlere verilir") ||
    includesLoose(normalizedMessage, "tamamı dağıtılır mı") ||
    includesLoose(normalizedMessage, "aile yiyebilir mi")
  ) {
    return topicMatch("kurban_eti_kimlere_verilir", "intent_phrase", 90);
  }
  if (
    // "kurbanlık hayvan" prefix matches both the title and the specific question
    includesLoose(normalizedMessage, "kurbanlık hayvan") ||
    includesLoose(normalizedMessage, "kurbanlık hayvan nasıl olmalı") ||
    includesLoose(normalizedMessage, "kusurlu hayvan kurban olur mu") ||
    includesLoose(normalizedMessage, "yaş şartı") ||
    includesLoose(normalizedMessage, "kurbanlik hayvan sartlari")
  ) {
    return topicMatch("kurbanlik_hayvan_sartlari", "intent_phrase", 90);
  }
  if (
    includesLoose(normalizedMessage, "vekaletle kurban") ||
    includesLoose(normalizedMessage, "vekâletle kurban") ||
    includesLoose(normalizedMessage, "vekalet nasıl verilir") ||
    includesLoose(normalizedMessage, "online kurban bağışı")
  ) {
    return topicMatch("vekaletle_kurban", "intent_phrase", 90);
  }
  if (includesLoose(normalizedMessage, "kurban nedir") || raw.includes("kurban nedir")) {
    return topicMatch("kurban_nedir", "exact_normalized_question", 100);
  }
  if (hasKurban) {
    return {
      clarification: true,
      match_reason: "low_confidence_topic_keyword",
      match_score: 20,
      rejected_candidates: [
        { id: "kurban_nedir", reason: "broad_topic_keyword" },
        { id: "bayram_namazi_nedir", reason: "wrong_domain_contains_kurban_bayram" },
      ],
    };
  }
  return null;
}

function topicMatch(topic, match_reason, match_score) {
  return { topic, match_reason, match_score };
}

function resolveKnowledgeTitle(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (typeof entry.title === "string" && entry.title.trim()) return entry.title.trim();
  const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
  const aliasTitle = aliases.find((alias) => typeof alias === "string" && alias.trim());
  if (aliasTitle) return aliasTitle.trim();
  return typeof entry.topic === "string" && entry.topic.trim() ? entry.topic.trim() : entry.id || null;
}

function resolveHacUmreTopic(message, normalizedMessage) {
  const raw = normalizeRawText(message);
  const hasHac = includesLoose(normalizedMessage, "hac") || raw.includes("hac");
  const hasUmre = includesLoose(normalizedMessage, "umre") || raw.includes("umre");

  if (
    includesLoose(normalizedMessage, "hac ile umre fark") ||
    includesLoose(normalizedMessage, "hac ve umre fark") ||
    // normalizeLoose preserves Turkish chars (farkı≠farki), so use the shorter prefix "fark"
    (normalizedMessage.includes("hac") && normalizedMessage.includes("umre") && normalizedMessage.includes("fark"))
  ) {
    return "hac_ile_umre_farki";
  }
  if (
    includesLoose(normalizedMessage, "hac kimlere farzdir") ||
    includesLoose(normalizedMessage, "hac kimlere farzıdır") ||
    includesLoose(normalizedMessage, "hac kimlere farzdır") ||
    raw.includes("hac kimlere farz")
  ) {
    return "hac_kimlere_farzdır";
  }
  if (
    includesLoose(normalizedMessage, "haccin farzlari") ||
    includesLoose(normalizedMessage, "haccin farzlari nelerdir") ||
    includesLoose(normalizedMessage, "haccın farzları") ||
    includesLoose(normalizedMessage, "haccın farzları nelerdir") ||
    raw.includes("haccin farzlari") ||
    (hasHac && /farz/.test(raw))
  ) {
    return "haccin_farzlari";
  }
  if (includesLoose(normalizedMessage, "hac nedir") || raw.includes("hac nedir")) {
    return "hac_nedir";
  }
  if (includesLoose(normalizedMessage, "umre nedir") || raw.includes("umre nedir")) {
    return "umre_nedir";
  }
  if (hasHac && !hasUmre) {
    return "hac_nedir";
  }
  if (hasUmre && !hasHac) {
    return "umre_nedir";
  }
  return null;
}

function resolveTeyemmumMeshTopic(message, normalizedMessage) {
  const raw = normalizeRawText(message);

  if (
    includesLoose(normalizedMessage, "teyemmum nasil alinir") ||
    includesLoose(normalizedMessage, "teyemmüm nasıl alınır") ||
    raw.includes("teyemmum nasil alinir")
  ) {
    return "teyemmum_nasil_alinir";
  }
  if (
    includesLoose(normalizedMessage, "teyemmum nedir") ||
    includesLoose(normalizedMessage, "teyemmüm nedir") ||
    raw.includes("teyemmum nedir")
  ) {
    return "teyemmum_nedir";
  }
  if (
    includesLoose(normalizedMessage, "teyemmumu bozan") ||
    includesLoose(normalizedMessage, "teyemumu bozan") ||
    raw.includes("teyemmumu bozan")
  ) {
    return "teyemmumu_bozanlar";
  }
  if (
    includesLoose(normalizedMessage, "mest uzerine mesh") ||
    includesLoose(normalizedMessage, "mest üzerine mesh") ||
    raw.includes("mest uzerine mesh")
  ) {
    return "mest_uzerine_mesh";
  }
  if (
    includesLoose(normalizedMessage, "sargi uzerine mesh") ||
    includesLoose(normalizedMessage, "sargı üzerine mesh") ||
    raw.includes("sargi uzerine mesh")
  ) {
    return "sargi_uzerine_mesh";
  }
  if (includesLoose(normalizedMessage, "teyemmum") || raw.includes("teyemmum")) {
    return "teyemmum_nedir";
  }
  if (includesLoose(normalizedMessage, "mest") && includesLoose(normalizedMessage, "mesh")) {
    return "mest_uzerine_mesh";
  }
  if (includesLoose(normalizedMessage, "sargi") && includesLoose(normalizedMessage, "mesh")) {
    return "sargi_uzerine_mesh";
  }
  return null;
}

function resolveWomenStateTopic(message, normalizedMessage) {
  const raw = normalizeRawText(message);

  if (
    includesLoose(normalizedMessage, "adetliyken namaz kılınır mı") ||
    includesLoose(normalizedMessage, "regl iken namaz") ||
    includesLoose(normalizedMessage, "hayız halinde namaz") ||
    includesLoose(normalizedMessage, "hayız halinde oruç") ||
    includesLoose(normalizedMessage, "adetliyken oruç tutulur mu")
  ) {
    return "hayiz_halinde_namaz_oruc";
  }
  if (
    includesLoose(normalizedMessage, "adetliyken oruç kazası") ||
    includesLoose(normalizedMessage, "adetliyken tutulamayan oruç kaza edilir mi") ||
    includesLoose(normalizedMessage, "ramazanda adet nedeniyle tutulamayan oruç") ||
    raw.includes("adetliyken oruc kazasi")
  ) {
    return "adetliyken_oruc_kazasi";
  }
  if (
    includesLoose(normalizedMessage, "adetliyken kuran okunur mu") ||
    // "Kur'an" normalizes to "kur an" (apostrophe→space), so check for the split form too
    (includesLoose(normalizedMessage, "adetliyken") && includesLoose(normalizedMessage, "okunur")) ||
    includesLoose(normalizedMessage, "hayız halinde kuran okunur mu") ||
    (includesLoose(normalizedMessage, "hayiz halinde") && includesLoose(normalizedMessage, "okunur")) ||
    raw.includes("adetliyken kuran okunur mu")
  ) {
    return "adetliyken_kuran_okunur_mu";
  }
  if (
    includesLoose(normalizedMessage, "özür kanı namaz") ||
    includesLoose(normalizedMessage, "ozur kani namaz") ||
    includesLoose(normalizedMessage, "özür kanı olan kişi namaz kılabilir mi") ||
    includesLoose(normalizedMessage, "ozur kani olan kisi namaz kilabilir mi")
  ) {
    return "ozur_kani_namaz";
  }
  if (
    includesLoose(normalizedMessage, "hayız nedir") ||
    // "adet nedir" must match as a whole word — "şehadet nedir" normalises to "sehadet nedir"
    // which contains "adet nedir" as a substring, causing a false-positive.
    /(?:^|\s)adet nedir/.test(normalizeLoose(normalizedMessage)) ||
    includesLoose(normalizedMessage, "regl nedir")
  ) {
    return "hayiz_nedir";
  }
  if (includesLoose(normalizedMessage, "nifas nedir") || includesLoose(normalizedMessage, "lohusalık nedir") || includesLoose(normalizedMessage, "lohusalik nedir")) {
    return "nifas_nedir";
  }
  if (includesLoose(normalizedMessage, "istihaze nedir") || includesLoose(normalizedMessage, "özür kanı") || includesLoose(normalizedMessage, "ozur kani")) {
    return "istihaze_nedir";
  }
  if (includesLoose(normalizedMessage, "adetliyken") || includesLoose(normalizedMessage, "hayız") || includesLoose(normalizedMessage, "nifas") || includesLoose(normalizedMessage, "istihaze")) {
    return "hayiz_halinde_namaz_oruc";
  }
  return null;
}

function resolveCumaBayramTopic(message, normalizedMessage) {
  const raw = normalizeRawText(message);
  const hasCuma = includesLoose(normalizedMessage, "cuma") || raw.includes("cuma");
  const hasBayram = includesLoose(normalizedMessage, "bayram") || raw.includes("bayram");

  if (
    hasCuma &&
    (includesLoose(normalizedMessage, "kimlere farz") ||
      includesLoose(normalizedMessage, "kimlere farzdır") ||
      raw.includes("kimlere farz"))
  ) {
    return "cuma_namazi_kimlere_farzdır";
  }
  if (
    hasCuma &&
    (includesLoose(normalizedMessage, "kaç rekat") ||
      includesLoose(normalizedMessage, "kaç rekât") ||
      includesLoose(normalizedMessage, "kac rekat") ||
      includesLoose(normalizedMessage, "kac rekât"))
  ) {
    return "cuma_namazi_kac_rekat";
  }
  if (hasCuma && (includesLoose(normalizedMessage, "cuma namazı nedir") || includesLoose(normalizedMessage, "cuma namazi nedir"))) {
    return "cuma_namazi_nedir";
  }
  if (
    hasBayram &&
    (includesLoose(normalizedMessage, "nasıl kılınır") ||
      includesLoose(normalizedMessage, "nasil kilinir"))
  ) {
    return "bayram_namazi_nasil_kilinir";
  }
  if (
    hasBayram &&
    (includesLoose(normalizedMessage, "kaç rekat") ||
      includesLoose(normalizedMessage, "kaç rekât") ||
      includesLoose(normalizedMessage, "kac rekat") ||
      includesLoose(normalizedMessage, "kac rekât"))
  ) {
    return "bayram_namazi_kac_rekat";
  }
  if (hasBayram && (includesLoose(normalizedMessage, "bayram namazı nedir") || includesLoose(normalizedMessage, "bayram namazi nedir"))) {
    return "bayram_namazi_nedir";
  }
  if (hasCuma && includesLoose(normalizedMessage, "cuma namazı")) {
    return "cuma_namazi_nedir";
  }
  if (hasBayram && includesLoose(normalizedMessage, "bayram namazı")) {
    return "bayram_namazi_nedir";
  }
  if (
    includesLoose(normalizedMessage, "cuma namazı kaç rekat") ||
    includesLoose(normalizedMessage, "cuma namazı kaç rekât") ||
    includesLoose(normalizedMessage, "cuma namazi kac rekat") ||
    includesLoose(normalizedMessage, "cuma namazi kac rekât") ||
    raw.includes("cuma namazi kac rekat")
  ) {
    return "cuma_namazi_kac_rekat";
  }
  return null;
}

function resolvePrayerCountTopic(message, normalizedMessage, history = []) {
  const compactRawMessage = String(message || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

  if (Array.isArray(history) && history.length > 0 && compactRawMessage.length <= 32) {
    const recoveredTopic = recoverTopicFromRawHistory(history);
    if (recoveredTopic) {
      return recoveredTopic;
    }
  }

  const hasCountCue =
    compactRawMessage.includes("rekat") ||
    compactRawMessage.includes("rekât") ||
    compactRawMessage.includes("kaç rekat") ||
    compactRawMessage.includes("kaç rekât") ||
    compactRawMessage.includes("kac rekat") ||
    compactRawMessage.includes("kac rekât");
  const hasSpecificPrayerName =
    compactRawMessage.includes("cuma") ||
    compactRawMessage.includes("bayram") ||
    compactRawMessage.includes("vitir") ||
    compactRawMessage.includes("teravih") ||
    compactRawMessage.includes("teravi") ||
    compactRawMessage.includes("sabah") ||
    compactRawMessage.includes("ogle") ||
    compactRawMessage.includes("öğle") ||
    compactRawMessage.includes("ikindi") ||
    compactRawMessage.includes("aksam") ||
    compactRawMessage.includes("akşam") ||
    compactRawMessage.includes("yatsi") ||
    compactRawMessage.includes("yatsı");

  if (compactRawMessage.includes("namaz") && hasCountCue && !hasSpecificPrayerName) {
    return "namaz_nasil_kilinir";
  }

  return null;
}

function resolvePrayerFollowupTopic(message, normalizedMessage, history = []) {
  const compactRawMessage = String(message || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
  const recoveredTopic = Array.isArray(history) && history.length > 0 ? recoverTopicFromRawHistory(history) : null;

  if (!recoveredTopic) return null;
  if (!compactRawMessage.includes("vacip") && !compactRawMessage.includes("farz") && !compactRawMessage.includes("sünnet") && !compactRawMessage.includes("sunnet")) {
    return null;
  }

  if (topicKey(recoveredTopic) === topicKey("vitir_namazi")) {
    return "vitir_vacip";
  }

  return null;
}

function resolveNamazScenarioTopic(message, normalizedMessage) {
  const normalized = normalizeRawText(message);

  // "Namazın farzları nelerdir?" — must resolve before semantic matcher picks haccin_farzlari
  if (
    includesLoose(normalizedMessage, "namazin farzlari") ||
    includesLoose(normalizedMessage, "namaz farzlari") ||
    includesLoose(normalizedMessage, "namazın farzları") ||
    includesLoose(normalizedMessage, "namaz farzları") ||
    includesLoose(normalizedMessage, "namazin dis farzlari") ||
    includesLoose(normalizedMessage, "namazin ic farzlari") ||
    (
      normalizedMessage.includes("namaz") &&
      normalizedMessage.includes("farz") &&
      !normalizedMessage.includes("hac") &&
      !normalizedMessage.includes("kimlere") &&
      !normalizedMessage.includes("kac") &&
      !normalizedMessage.includes("kaç")
    )
  ) {
    return "namaz_farzlari";
  }

  if (
    includesLoose(normalizedMessage, "namaz kaçırınca") ||
    includesLoose(normalizedMessage, "namaz kacirinca") ||
    includesLoose(normalizedMessage, "kaçırılan namaz") ||
    includesLoose(normalizedMessage, "kacirilan namaz") ||
    includesLoose(normalizedMessage, "kılınmayan namaz") ||
    includesLoose(normalizedMessage, "kilinmayan namaz")
  ) {
    return "namaz_kacirinca_ne_yapilir";
  }

  if (
    includesLoose(normalizedMessage, "işyerinde namaz") ||
    includesLoose(normalizedMessage, "isyerinde namaz") ||
    includesLoose(normalizedMessage, "ofiste namaz") ||
    includesLoose(normalizedMessage, "çalışırken namaz") ||
    includesLoose(normalizedMessage, "calisirken namaz")
  ) {
    return "isyerinde_namaz_kilinir_mi";
  }

  if (
    includesLoose(normalizedMessage, "oturarak namaz") ||
    includesLoose(normalizedMessage, "oturarak farz namaz") ||
    includesLoose(normalizedMessage, "hasta iken namaz kılınır mı") ||
    includesLoose(normalizedMessage, "hastayken namaz kılınır mı") ||
    includesLoose(normalizedMessage, "hastayken namaz")
  ) {
    return "oturarak_namaz_kilinir_mi";
  }

  if (
    includesLoose(normalizedMessage, "araçta namaz") ||
    includesLoose(normalizedMessage, "aracta namaz") ||
    includesLoose(normalizedMessage, "arabada namaz") ||
    includesLoose(normalizedMessage, "otobüste namaz") ||
    includesLoose(normalizedMessage, "otobuste namaz")
  ) {
    return "aracta_namaz_kilinir_mi";
  }

  if (
    includesLoose(normalizedMessage, "namaz hızlı") ||
    includesLoose(normalizedMessage, "namaz hizli") ||
    includesLoose(normalizedMessage, "acele namaz") ||
    includesLoose(normalizedMessage, "hızlı namaz") ||
    includesLoose(normalizedMessage, "hizli namaz")
  ) {
    return "namaz_hizli_kilinirsa_olur_mu";
  }

  if (
    includesLoose(normalizedMessage, "cem edilerek namaz") ||
    includesLoose(normalizedMessage, "namazları birleştirmek") ||
    includesLoose(normalizedMessage, "namazlari birlestirmek") ||
    includesLoose(normalizedMessage, "cem etmek") ||
    includesLoose(normalizedMessage, "namaz cem")
  ) {
    return "cem_edilerek_namaz_kilinir_mi";
  }

  if (
    includesLoose(normalizedMessage, "yolculukta namaz") ||
    includesLoose(normalizedMessage, "seferi namaz") ||
    includesLoose(normalizedMessage, "seferî namaz") ||
    includesLoose(normalizedMessage, "seferi namaz nasil") ||
    includesLoose(normalizedMessage, "sefer halinde namaz") ||
    includesLoose(normalizedMessage, "sefer halinde namaz kisaltilir") ||
    (includesLoose(normalizedMessage, "sefer") && includesLoose(normalizedMessage, "namaz") && includesLoose(normalizedMessage, "kisaltilir"))
  ) {
    return "yolculukta_namaz_nasil_kilinir";
  }

  if (
    includesLoose(normalizedMessage, "geç kalınan namaz") ||
    includesLoose(normalizedMessage, "gec kalinan namaz") ||
    includesLoose(normalizedMessage, "vakti geçen namaz") ||
    includesLoose(normalizedMessage, "vakti gecen namaz") ||
    includesLoose(normalizedMessage, "kaza namazı nasıl kılınır") ||
    includesLoose(normalizedMessage, "kaza namazi nasil kilinir")
  ) {
    return "gec_kalinan_namaz_nasil_kilinir";
  }

  if (
    includesLoose(normalizedMessage, "vitir kılınmazsa") ||
    includesLoose(normalizedMessage, "vitir kilinmazsa") ||
    includesLoose(normalizedMessage, "vitir kaçırılırsa") ||
    includesLoose(normalizedMessage, "vitir kacirilirsa")
  ) {
    return "vitir_kilinmazsa_ne_olur";
  }

  if (
    includesLoose(normalizedMessage, "namazda şaşırma") ||
    includesLoose(normalizedMessage, "namazda sasirma") ||
    includesLoose(normalizedMessage, "namazda şaşırınca") ||
    includesLoose(normalizedMessage, "namazda sasirinca") ||
    includesLoose(normalizedMessage, "sehiv secdesi")
  ) {
    return "namazda_sasirma_ne_yapilir";
  }

  return null;
}

function resolveVitirVacipTopic(message, normalizedMessage, history = []) {
  const compactRawMessage = String(message || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
  const recoveredTopic = Array.isArray(history) && history.length > 0 ? recoverTopicFromRawHistory(history) : null;

  if (compactRawMessage.includes("vitir") && (compactRawMessage.includes("vacip") || compactRawMessage.includes("farz"))) {
    return "vitir_vacip";
  }

  if (
    recoveredTopic &&
    topicKey(recoveredTopic) === topicKey("vitir_namazi") &&
    (compactRawMessage === "vacip mi?" || compactRawMessage === "vacip mi" || compactRawMessage === "farz mi?" || compactRawMessage === "farz mi")
  ) {
    return "vitir_vacip";
  }

  return null;
}

function resolveDailyPracticeTopic(message, normalizedMessage) {
  const raw = normalizeRawText(message);

  const hasCountCue =
    includesLoose(normalizedMessage, "kaç rekat") ||
    includesLoose(normalizedMessage, "kaç rekât") ||
    includesLoose(normalizedMessage, "kac rekat") ||
    includesLoose(normalizedMessage, "kac rekât") ||
    includesLoose(normalizedMessage, "rekat") ||
    includesLoose(normalizedMessage, "rekât");
  const hasSpecificPrayerName =
    includesLoose(normalizedMessage, "cuma") ||
    includesLoose(normalizedMessage, "bayram") ||
    includesLoose(normalizedMessage, "vitir") ||
    includesLoose(normalizedMessage, "teravih") ||
    includesLoose(normalizedMessage, "teravi") ||
    includesLoose(normalizedMessage, "sabah") ||
    includesLoose(normalizedMessage, "ogle") ||
    includesLoose(normalizedMessage, "öğle") ||
    includesLoose(normalizedMessage, "ikindi") ||
    includesLoose(normalizedMessage, "aksam") ||
    includesLoose(normalizedMessage, "akşam") ||
    includesLoose(normalizedMessage, "yatsi") ||
    includesLoose(normalizedMessage, "yatsı");

  if (includesLoose(normalizedMessage, "namaz") && hasCountCue && !hasSpecificPrayerName) {
    return "namaz_nasil_kilinir";
  }

  if (
    includesLoose(normalizedMessage, "niyet nasil edilir") ||
    includesLoose(normalizedMessage, "niyet nasıl edilir") ||
    includesLoose(normalizedMessage, "nasil niyet edilir") ||
    includesLoose(normalizedMessage, "nasıl niyet edilir")
  ) {
    return "niyet_nasil";
  }
  if (
    includesLoose(normalizedMessage, "nikah nedir") ||
    includesLoose(normalizedMessage, "nik?h nedir") ||
    includesLoose(normalizedMessage, "nikah ?artlar?") ||
    includesLoose(normalizedMessage, "nik?h ?artlar?") ||
    includesLoose(normalizedMessage, "aile hakk?") ||
    includesLoose(normalizedMessage, "aile hakki")
  ) {
    if (includesLoose(normalizedMessage, "?art") || includesLoose(normalizedMessage, "sart")) return "nikah_sartlari";
    if (includesLoose(normalizedMessage, "aile hakk?") || includesLoose(normalizedMessage, "aile hakki")) return "aile_hakki";
    return "nikah_nedir";
  }
  if (includesLoose(normalizedMessage, "bo?anma nedir") || includesLoose(normalizedMessage, "bosanma nedir") || includesLoose(normalizedMessage, "talak nedir") || includesLoose(normalizedMessage, "talak")) {
    return includesLoose(normalizedMessage, "talak") && !includesLoose(normalizedMessage, "bo?anma") ? "talak_nedir" : "bosanma_nedir";
  }
  if (includesLoose(normalizedMessage, "miras nedir") || includesLoose(normalizedMessage, "miras payla??m?") || includesLoose(normalizedMessage, "miras paylasimi")) {
    return includesLoose(normalizedMessage, "payla?") || includesLoose(normalizedMessage, "paylas") ? "miras_paylasimi_genel" : "miras_nedir";
  }
  if (includesLoose(normalizedMessage, "sadaka nedir") || includesLoose(normalizedMessage, "sadaka kime verilir") || includesLoose(normalizedMessage, "sadaka")) {
    return includesLoose(normalizedMessage, "kime verilir") ? "sadaka_kime_verilir" : "sadaka_nedir";
  }
  if (
    includesLoose(normalizedMessage, "mirac kandili") ||
    includesLoose(normalizedMessage, "miraç kandili") ||
    includesLoose(normalizedMessage, "isra ve mirac") ||
    includesLoose(normalizedMessage, "isra mirac gecesi") ||
    includesLoose(normalizedMessage, "miraç") ||
    includesLoose(normalizedMessage, "mirac")
  ) {
    return "mirac_kandili_nedir";
  }
  if (includesLoose(normalizedMessage, "kandil geceleri nedir") || includesLoose(normalizedMessage, "kandil geceleri") || includesLoose(normalizedMessage, "kandil")) {
    return "kandil_geceleri_nedir";
  }
  if (includesLoose(normalizedMessage, "gece ibadetleri") || includesLoose(normalizedMessage, "gece ibadetleri nelerdir")) {
    return "gece_ibadetleri";
  }

  if (
    includesLoose(normalizedMessage, "nikah nedir") ||
    includesLoose(normalizedMessage, "nikah şartları") ||
    includesLoose(normalizedMessage, "nikâh nedir") ||
    includesLoose(normalizedMessage, "nikâh şartları") ||
    includesLoose(normalizedMessage, "aile hakkı") ||
    includesLoose(normalizedMessage, "aile hakki")
  ) {
    return includesLoose(normalizedMessage, "şart") || includesLoose(normalizedMessage, "sart")
      ? "nikah_sartlari"
      : includesLoose(normalizedMessage, "aile hakkı") || includesLoose(normalizedMessage, "aile hakki")
        ? "aile_hakki"
        : "nikah_nedir";
  }
  if (
    includesLoose(normalizedMessage, "boşanma nedir") ||
    includesLoose(normalizedMessage, "bosanma nedir") ||
    includesLoose(normalizedMessage, "talak nedir") ||
    includesLoose(normalizedMessage, "talak")
  ) {
    return includesLoose(normalizedMessage, "talak") && !includesLoose(normalizedMessage, "boşanma")
      ? "talak_nedir"
      : "bosanma_nedir";
  }
  if (
    includesLoose(normalizedMessage, "miras nedir") ||
    includesLoose(normalizedMessage, "miras paylaşımı") ||
    includesLoose(normalizedMessage, "miras paylasimi")
  ) {
    return includesLoose(normalizedMessage, "paylaş") || includesLoose(normalizedMessage, "paylas")
      ? "miras_paylasimi_genel"
      : "miras_nedir";
  }
  if (
    includesLoose(normalizedMessage, "sadaka nedir") ||
    includesLoose(normalizedMessage, "sadaka kime verilir") ||
    includesLoose(normalizedMessage, "sadaka")
  ) {
    return includesLoose(normalizedMessage, "kime verilir") ? "sadaka_kime_verilir" : "sadaka_nedir";
  }
  if (
    includesLoose(normalizedMessage, "mirac kandili") ||
    includesLoose(normalizedMessage, "miraç kandili") ||
    includesLoose(normalizedMessage, "isra ve mirac") ||
    includesLoose(normalizedMessage, "isra mirac gecesi") ||
    includesLoose(normalizedMessage, "miraç") ||
    includesLoose(normalizedMessage, "mirac")
  ) {
    return "mirac_kandili_nedir";
  }
  if (includesLoose(normalizedMessage, "kandil geceleri nedir") || includesLoose(normalizedMessage, "kandil geceleri")) {
    return "kandil_geceleri_nedir";
  }
  if (includesLoose(normalizedMessage, "gece ibadetleri") || includesLoose(normalizedMessage, "gece ibadetleri nelerdir")) {
    return "gece_ibadetleri";
  }
  if (
    includesLoose(normalizedMessage, "vesvese şeytandan mı") ||
    includesLoose(normalizedMessage, "vesvese seytandan mi") ||
    includesLoose(normalizedMessage, "aklıma kötü düşünceler geliyor") ||
    includesLoose(normalizedMessage, "sürekli şüpheye düşüyorum")
  ) {
    return "vesvese_seytandan_mi";
  }
  if (
    includesLoose(normalizedMessage, "cin var mı") ||
    includesLoose(normalizedMessage, "cin var mi") ||
    includesLoose(normalizedMessage, "cinler gerçek mi") ||
    includesLoose(normalizedMessage, "cin musallat olur mu") ||
    includesLoose(normalizedMessage, "üstümde cin var mı") ||
    includesLoose(normalizedMessage, "musallat oldugu düşüncesi")
  ) {
    return includesLoose(normalizedMessage, "musallat") ? "cin_musallat_olur_mu" : "cin_var_mi";
  }
  if (
    includesLoose(normalizedMessage, "nazar var mı") ||
    includesLoose(normalizedMessage, "nazar var mi") ||
    includesLoose(normalizedMessage, "göz değmesi olur mu") ||
    includesLoose(normalizedMessage, "nazardan nasıl korunur") ||
    includesLoose(normalizedMessage, "nazardan korunma") ||
    includesLoose(normalizedMessage, "nazar duası")
  ) {
    return includesLoose(normalizedMessage, "korun") || includesLoose(normalizedMessage, "dua")
      ? "nazardan_korunma"
      : "nazar_var_mi";
  }
  if (
    includesLoose(normalizedMessage, "büyü var mı") ||
    includesLoose(normalizedMessage, "buyu var mi") ||
    includesLoose(normalizedMessage, "büyü gerçek mi") ||
    includesLoose(normalizedMessage, "büyüden korunma") ||
    includesLoose(normalizedMessage, "büyüden korunma duası") ||
    includesLoose(normalizedMessage, "buyuden korunma duası")
  ) {
    return includesLoose(normalizedMessage, "korunma") ? "buyuden_korunma" : "buyu_var_mi";
  }
  if (
    includesLoose(normalizedMessage, "korku gelince ne yapmalı") ||
    includesLoose(normalizedMessage, "korku geldiğinde ne yapılır") ||
    includesLoose(normalizedMessage, "aniden korkuyorum")
  ) {
    return "korku_gelince_ne_yapmali";
  }
  if (
    includesLoose(normalizedMessage, "gece korkusu neden olur") ||
    includesLoose(normalizedMessage, "gece neden korkarım") ||
    includesLoose(normalizedMessage, "gece uyanıp korkuyorum")
  ) {
    return "gece_korkusu_neden_olur";
  }
  if (
    includesLoose(normalizedMessage, "kötü rüya görünce ne yapılır") ||
    includesLoose(normalizedMessage, "kotu ruya gorunce ne yapmali") ||
    includesLoose(normalizedMessage, "kabus görünce ne yapılır")
  ) {
    return "kotu_ruya_gorunce_ne_yapmali";
  }
  const genericSupportPrompt =
    includesLoose(normalizedMessage, "çok korkuyorum") ||
    includesLoose(normalizedMessage, "korkuyorum") ||
    includesLoose(normalizedMessage, "endişeliyim") ||
    includesLoose(normalizedMessage, "endise") ||
    includesLoose(normalizedMessage, "yalnızım") ||
    includesLoose(normalizedMessage, "yalnizim") ||
    includesLoose(normalizedMessage, "üzgünüm") ||
    includesLoose(normalizedMessage, "uzgunum") ||
    includesLoose(normalizedMessage, "içim sıkılıyor") ||
    includesLoose(normalizedMessage, "icim sikiliyor");
  if (
    genericSupportPrompt &&
    !includesLoose(normalizedMessage, "vesvese") &&
    !includesLoose(normalizedMessage, "nazar") &&
    !includesLoose(normalizedMessage, "büyü") &&
    !includesLoose(normalizedMessage, "buyu") &&
    !includesLoose(normalizedMessage, "cin") &&
    !includesLoose(normalizedMessage, "korku gelince") &&
    !includesLoose(normalizedMessage, "gece korkusu") &&
    !includesLoose(normalizedMessage, "kötü rüya") &&
    !includesLoose(normalizedMessage, "kotu ruya")
  ) {
    return null;
  }
  // Alkol / içki — explicit check BEFORE the broad günah-mı block so it always wins
  if (
    includesLoose(normalizedMessage, "alkol") ||
    includesLoose(normalizedMessage, "içki")
  ) {
    return "alkol_gunah_mi";
  }

  if (
    includesLoose(normalizedMessage, "müzik dinlemek günah mı") ||
    includesLoose(normalizedMessage, "muzik dinlemek gunah mi") ||
    includesLoose(normalizedMessage, "şarkı dinlemek günah mı") ||
    includesLoose(normalizedMessage, "sigara haram mı") ||
    includesLoose(normalizedMessage, "sigara içmek günah mı") ||
    includesLoose(normalizedMessage, "dövme yaptırmak caiz mi") ||
    includesLoose(normalizedMessage, "dovme yaptirmak caiz mi") ||
    includesLoose(normalizedMessage, "kredi kartı kullanmak caiz mi") ||
    includesLoose(normalizedMessage, "kredi karti kullanmak caiz mi") ||
    includesLoose(normalizedMessage, "banka faizi nedir") ||
    includesLoose(normalizedMessage, "faiz nedir") ||
    includesLoose(normalizedMessage, "yalan yere yemin etmek günah mı") ||
    includesLoose(normalizedMessage, "bahis oynamak haram mı") ||
    includesLoose(normalizedMessage, "bahis kumar haram mı") ||
    includesLoose(normalizedMessage, "şüpheli kazanç ne yapılır") ||
    includesLoose(normalizedMessage, "supheli kazanc ne yapilir") ||
    includesLoose(normalizedMessage, "alışverişte kul hakkı olur mu") ||
    includesLoose(normalizedMessage, "kul hakkı içeren alışveriş") ||
    includesLoose(normalizedMessage, "haram para nasıl temizlenir") ||
    includesLoose(normalizedMessage, "haram para temizleme")
  ) {
    if (includesLoose(normalizedMessage, "kredi kartı") || includesLoose(normalizedMessage, "kredi karti")) {
      return "kredi_karti_kullanmak_caiz_mi";
    }
    if (includesLoose(normalizedMessage, "banka faizi")) {
      return "banka_faizi_nedir";
    }
    if (includesLoose(normalizedMessage, "dövme") || includesLoose(normalizedMessage, "dovme")) {
      return "dovme_yaptirmak_caiz_mi";
    }
    if (includesLoose(normalizedMessage, "sigara")) {
      return "sigara_haram_mi";
    }
    if (includesLoose(normalizedMessage, "müzik") || includesLoose(normalizedMessage, "muzik") || includesLoose(normalizedMessage, "şarkı")) {
      return "muzik_dinlemek_gunah_mi";
    }
    if (includesLoose(normalizedMessage, "yalan yere yemin")) {
      return "yalan_yere_yemin_etmek";
    }
    if (includesLoose(normalizedMessage, "bahis") || includesLoose(normalizedMessage, "kumar")) {
      return "bahis_kumar_haram_mi";
    }
    if (includesLoose(normalizedMessage, "kul hakkı içeren alışveriş") || includesLoose(normalizedMessage, "alışverişte kul hakkı")) {
      return "kul_hakki_iceren_alisveris";
    }
    if (includesLoose(normalizedMessage, "haram para nasıl temizlenir") || includesLoose(normalizedMessage, "haram para temizleme")) {
      return "haram_para_nasil_temizlenir";
    }
    if (includesLoose(normalizedMessage, "şüpheli kazanç") || includesLoose(normalizedMessage, "supheli kazanc")) {
      return "supheli_kazanc_ne_yapilir";
    }
  }

  if (
    includesLoose(normalizedMessage, "yemin kefareti") ||
    includesLoose(normalizedMessage, "yemin bozulursa") ||
    includesLoose(normalizedMessage, "yemin bozulursa ne olur") ||
    includesLoose(normalizedMessage, "yemin bozulursa ne yapilir") ||
    raw.includes("yemin kefareti")
  ) {
    return "yemin_kefareti";
  }
  if (
    includesLoose(normalizedMessage, "yemin nedir") ||
    includesLoose(normalizedMessage, "yemin sayilir") ||
    includesLoose(normalizedMessage, "hangi sozler yemin sayilir") ||
    raw.includes("yemin nedir")
  ) {
    return "yemin_nedir";
  }
  if (
    includesLoose(normalizedMessage, "adak kurbani") ||
    includesLoose(normalizedMessage, "adak kurbanı") ||
    includesLoose(normalizedMessage, "adak kurbani nedir") ||
    includesLoose(normalizedMessage, "adak kurbanı nedir")
  ) {
    return "adak_kurbani";
  }
  if (
    includesLoose(normalizedMessage, "adak nedir") ||
    includesLoose(normalizedMessage, "adak adamak") ||
    includesLoose(normalizedMessage, "adak yerine getiril") ||
    raw.includes("adak nedir")
  ) {
    return "adak_nedir";
  }
  if (includesLoose(normalizedMessage, "kefaret nedir") || includesLoose(normalizedMessage, "kefaret")) {
    return "kefaret_nedir";
  }
  if (
    includesLoose(normalizedMessage, "tovbe nasil edilir") ||
    includesLoose(normalizedMessage, "tövbe nasıl edilir") ||
    includesLoose(normalizedMessage, "tevbe nasil edilir") ||
    includesLoose(normalizedMessage, "tevbe nasıl edilir") ||
    includesLoose(normalizedMessage, "nasıl tövbe etmeliyim") ||
    includesLoose(normalizedMessage, "nasıl tevbe etmeliyim")
  ) {
    return "tovbe_nasil_edilir";
  }
  if (includesLoose(normalizedMessage, "dua nedir") || includesLoose(normalizedMessage, "dua ne demek")) {
    return "dua_nedir";
  }
  if (
    includesLoose(normalizedMessage, "dua nasil edilir") ||
    includesLoose(normalizedMessage, "dua nasıl edilir") ||
    includesLoose(normalizedMessage, "dua nasil yapilir") ||
    includesLoose(normalizedMessage, "dua nasıl yapılır")
  ) {
    return "dua_nasil_edilir";
  }
  if (
    includesLoose(normalizedMessage, "niyet nasil edilir") ||
    includesLoose(normalizedMessage, "niyet nasıl edilir") ||
    includesLoose(normalizedMessage, "nasil niyet edilir") ||
    includesLoose(normalizedMessage, "nasıl niyet edilir")
  ) {
    return "niyet_nasil";
  }
  if (
    includesLoose(normalizedMessage, "helal haram nedir") ||
    includesLoose(normalizedMessage, "helal ve haram") ||
    includesLoose(normalizedMessage, "helal haram")
  ) {
    return "helal_haram_genel";
  }
  if (includesLoose(normalizedMessage, "faiz nedir") || normalizedMessage === normalizeLoose("faiz")) {
    return "faiz_nedir";
  }
  if (
    includesLoose(normalizedMessage, "kul hakki nedir") ||
    includesLoose(normalizedMessage, "kul hakkı nedir") ||
    includesLoose(normalizedMessage, "kul hakki")
  ) {
    return "kul_hakki_nedir";
  }
  if (
    includesLoose(normalizedMessage, "anne baba hakki nedir") ||
    includesLoose(normalizedMessage, "anne baba hakkı nedir") ||
    includesLoose(normalizedMessage, "anne baba hakki")
  ) {
    return "anne_baba_hakki";
  }
  if (
    includesLoose(normalizedMessage, "giybet nedir") ||
    includesLoose(normalizedMessage, "gıybet nedir") ||
    includesLoose(normalizedMessage, "giybet etmek gunah mi") ||
    includesLoose(normalizedMessage, "gıybet etmek günah mı") ||
    includesLoose(normalizedMessage, "arkadan konusmak") ||
    includesLoose(normalizedMessage, "arkadan konuşmak") ||
    includesLoose(normalizedMessage, "birinin arkasindan konusmak") ||
    includesLoose(normalizedMessage, "birinin arkasından konuşmak") ||
    includesLoose(normalizedMessage, "giybet")
  ) {
    return "giybet_nedir";
  }
  if (includesLoose(normalizedMessage, "israf nedir") || includesLoose(normalizedMessage, "israf")) {
    return "israf_nedir";
  }
  if (includesLoose(normalizedMessage, "selamlasma adabi") || includesLoose(normalizedMessage, "selamlaşma adabı")) {
    return "selamlasma_adabi";
  }
  if (
    includesLoose(normalizedMessage, "komsuluk hakki nedir") ||
    includesLoose(normalizedMessage, "komşuluk hakkı nedir") ||
    includesLoose(normalizedMessage, "komsuluk hakki")
  ) {
    return "komsuluk_hakki";
  }
  return null;
}

function recoverTopicFromRawHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    if (!item || typeof item !== "object") continue;
    const text = typeof item.text === "string" ? item.text : typeof item.content === "string" ? item.content : "";
    if (!text) continue;
    const raw = normalizeRawText(text);
    if (!raw) continue;
    if (raw.includes("abdest")) return "abdest";
    if (raw.includes("gusÃ¼l") || raw.includes("gusul")) return "gusul_abdesti";
    if (raw.includes("seferi")) return "seferi_namazi";
    if (raw.includes("oruc") || raw.includes("oruÃ§")) return "oruc";
    if (raw.includes("teravih") || raw.includes("teravi")) return "teravih_namazi";
    if (raw.includes("cuma")) return "cuma_namazi_kac_rekat";
    if (raw.includes("bayram")) return "bayram_namazi_kac_rekat";
    if (raw.includes("cenaze")) return "cenaze_namazi";
    if (raw.includes("vitir")) return "vitir_namazi";
    if (raw.includes("sabah")) return "sabah_namazi";
    if (raw.includes("Ã¶ÄŸle") || raw.includes("ogle")) return "ogle_namazi";
    if (raw.includes("ikindi")) return "ikindi_namazi";
    if (raw.includes("akÅŸam") || raw.includes("aksam")) return "aksam_namazi";
    if (raw.includes("yatsÄ±") || raw.includes("yatsi")) return "yatsi_namazi";
  }
  return null;
}

function normalizeRawText(value) {
  return decodeURIComponentSafe(String(value || ""))
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC");
}

function normalizeLoose(value) {
  return normalize(decodeURIComponentSafe(String(value || "")))
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topicKey(value) {
  return normalizeLoose(value)
    .replace(/[\s_-]+/g, "")
    .trim();
}

module.exports = {
  routeKnowledge,
  loadIlmihalKnowledge,
};
