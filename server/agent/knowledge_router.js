const fs = require("fs");
const path = require("path");
const { normalize, decodeURIComponentSafe, canonicalTopic } = require("./context_resolver");

const ILMIHAL_PATH = path.join(__dirname, "..", "..", "assets", "data", "knowledge", "ilmihal_knowledge_base.json");

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

function routeKnowledge(message, analysis = {}, plannerPlan = null, history = []) {
  const normalizedMessage = normalizeLoose(message);
  const normalizedHistory = buildHistoryContext(history);
  const topicHint = normalizeLoose(
    canonicalTopic(plannerPlan?.knowledge_topic || analysis.context_topic || analysis.primary_theme || "")
  );
  const entries = loadIlmihalKnowledge();

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
  for (const rule of hardMatches) {
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

  const isIncompleteFollowup = isFollowupPrompt(normalizedMessage);
  const recoveredHistoryTopic = isIncompleteFollowup ? recoverTopicFromRawHistory(history) : null;
  if (recoveredHistoryTopic) {
    const recoveredEntry = entries.find((entry) => topicKey(entry.topic || "") === topicKey(recoveredHistoryTopic));
    if (recoveredEntry) {
      return {
        id: recoveredEntry.id || null,
        file: "ilmihal_knowledge_base.json",
        type: recoveredEntry.type || "worship_practice",
        topic: recoveredEntry.topic || null,
        answer_text: recoveredEntry.answer_tr || "",
        source_note: recoveredEntry.source_note || "Diyanet-based curated internal knowledge.",
        requires_ayah: recoveredEntry.requires_ayah === true,
        route_mode: "ilmihal_knowledge",
        knowledge_hit_id: recoveredEntry.id || null,
      };
    }
  }
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
    const topicScore = topicHint && entryTopic && topicHint === entryTopic ? 3 : 0;
    const totalScore = exactTriggerScore + contextScore + (exactTriggerScore > 0 || contextScore > 0 ? topicScore : 0);

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
    "kaç rekat",
    "kac rekat",
    "farzı kaç",
    "farzi kac",
    "sünneti var mı",
    "sunneti var mi",
    "nasıl kılınır",
    "nasil kilinir",
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

function recoverTopicFromRawHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    if (!item || typeof item.text !== "string") continue;
    const raw = normalizeRawText(item.text);
    if (!raw) continue;
    if (raw.includes("teravih") || raw.includes("teravi")) return "teravih_namazi";
    if (raw.includes("cuma")) return "cuma_namazi";
    if (raw.includes("bayram")) return "bayram_namazi";
    if (raw.includes("cenaze")) return "cenaze_namazi";
    if (raw.includes("vitir")) return "vitir_namazi";
    if (raw.includes("sabah")) return "sabah_namazi";
    if (raw.includes("öğle") || raw.includes("ogle")) return "ogle_namazi";
    if (raw.includes("ikindi")) return "ikindi_namazi";
    if (raw.includes("akşam") || raw.includes("aksam")) return "aksam_namazi";
    if (raw.includes("yatsı") || raw.includes("yatsi")) return "yatsi_namazi";
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
