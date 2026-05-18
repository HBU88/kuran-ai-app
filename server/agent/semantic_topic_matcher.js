const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const { normalize } = require("./context_resolver");

const CACHE_DIR = path.join(__dirname, "..", "cache");
const CACHE_PATH = path.join(CACHE_DIR, "ilmihal_topic_embeddings.json");
const EMBEDDING_MODEL = "text-embedding-3-small";

const STOP_WORDS = new Set([
  "ve",
  "veya",
  "ile",
  "bir",
  "bu",
  "şu",
  "suan",
  "şuan",
  "mi",
  "mı",
  "mu",
  "mü",
  "nedir",
  "nelerdir",
  "nasıl",
  "nasil",
  "ne",
  "mi?",
  "midir",
  "mudur",
  "mudur",
  "miymiş",
  "miyim",
  "mıyım",
  "müydü",
  "midir?",
  "mi?",
  "ile",
  "hakkında",
  "hakkinda",
  "için",
  "icin",
  "gibi",
  "daha",
  "çok",
  "cok",
  "biraz",
  "hangi",
  "hangi",
  "şey",
  "sey",
]);

let cachedState = null;
let refreshPromise = null;
const queryEmbeddingCache = new Map();

function matchSemanticTopic(query, entries = []) {
  const normalizedQuery = normalizeSemanticText(query);
  if (!normalizedQuery) return null;

  const profiles = loadSemanticProfiles(entries);
  if (!profiles.length) return null;

  const cachedEmbeddings = profiles.every((profile) => Array.isArray(profile.embedding) && profile.embedding.length > 0);
  const shouldUseEmbeddings = Boolean(process.env.OPENAI_API_KEY) && cachedEmbeddings;
  const localScores = profiles.map((profile) => ({
    profile,
    score: localSemanticScore(normalizedQuery, profile),
  }));

  if (shouldUseEmbeddings) {
    const queryEmbedding = getQueryEmbedding(normalizedQuery);
    if (Array.isArray(queryEmbedding) && queryEmbedding.length > 0) {
      const scored = profiles
        .map((profile, index) => {
          const embeddingScore = clampScore(cosineSimilarity(queryEmbedding, profile.embedding));
          const localScore = Number.isFinite(localScores[index]?.score) ? localScores[index].score : 0;
          return {
            profile,
            score: Math.max(embeddingScore, localScore),
            embeddingScore,
            localScore,
          };
        })
        .sort((a, b) => b.score - a.score);
      return buildSemanticMatch(scored[0] || null);
    }
  }

  const scored = localScores
    .sort((a, b) => b.score - a.score);

  return buildSemanticMatch(scored[0] || null);
}

function buildSemanticMatch(best) {
  if (!best || !best.profile) return null;

  const score = clampScore(best.score);
  if (score < 0.7) return null;

  const confidence = score >= 0.82 ? "high" : "low";

  return {
    topic_id: best.profile.topic_id,
    score,
    confidence,
    matched_by: "semantic",
    semantic_description: best.profile.semantic_description,
  };
}

function loadSemanticProfiles(entries) {
  const signature = buildSignature(entries);
  if (cachedState && cachedState.signature === signature) {
    return cachedState.profiles;
  }

  const cachedFile = readCacheFile();
  const cachedProfilesById = new Map(
    Array.isArray(cachedFile?.profiles)
      ? cachedFile.profiles.map((profile) => [String(profile.topic_id || ""), profile])
      : []
  );

  const profiles = entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const topicId = String(entry.topic || entry.id || "").trim();
      const semanticDescription = normalizeSemanticText(
        entry.semantic_description || buildSemanticDescription(entry)
      );
      const cachedProfile = cachedProfilesById.get(topicId) || null;
      return {
        topic_id: topicId,
        semantic_description: semanticDescription,
        tokens: buildTokenSet(semanticDescription),
        keywords: buildTokenSet(
          [entry.title, ...(Array.isArray(entry.keywords) ? entry.keywords : []), ...(Array.isArray(entry.related_questions) ? entry.related_questions : [])]
            .filter(Boolean)
            .join(" ")
        ),
        embedding: Array.isArray(cachedProfile?.embedding) && cachedProfile.embedding.length ? cachedProfile.embedding : null,
      };
    });

  cachedState = {
    signature,
    profiles,
  };

  writeCacheFileIfNeeded(signature, profiles);
  if (process.env.OPENAI_API_KEY) {
    ensureEmbeddingsWarm(entries, profiles).catch(() => null);
  }

  return profiles;
}

function ensureEmbeddingsWarm(entries, profiles) {
  if (refreshPromise) return refreshPromise;
  if (!process.env.OPENAI_API_KEY) return Promise.resolve(false);

  const needsRefresh = profiles.some((profile) => !Array.isArray(profile.embedding) || profile.embedding.length === 0);
  if (!needsRefresh) return Promise.resolve(true);

  refreshPromise = (async () => {
    const embeddings = await computeEmbeddingsForDescriptions(
      profiles.map((profile) => ({
        topic_id: profile.topic_id,
        semantic_description: profile.semantic_description,
      }))
    );

    if (!embeddings) return false;

    const merged = profiles.map((profile) => ({
      ...profile,
      embedding: embeddings[profile.topic_id] || profile.embedding || null,
    }));

    cachedState = {
      signature: buildSignature(entries),
      profiles: merged,
    };
    writeCacheFile(cachedState.signature, merged);
    return true;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function computeEmbeddingsForDescriptions(items) {
  if (!Array.isArray(items) || items.length === 0) return Promise.resolve(null);
  try {
    const payload = JSON.stringify({
      model: EMBEDDING_MODEL,
      apiKey: process.env.OPENAI_API_KEY,
      items,
    });
    const script = `
      const fs = require("fs");
      const OpenAI = require("openai");
      const input = JSON.parse(fs.readFileSync(0, "utf8"));
      (async () => {
        const client = new OpenAI({ apiKey: input.apiKey });
        const result = await client.embeddings.create({
          model: input.model,
          input: input.items.map((item) => item.semantic_description),
        });
        const out = {};
        result.data.forEach((item, index) => {
          out[input.items[index].topic_id] = item.embedding;
        });
        process.stdout.write(JSON.stringify(out));
      })().catch((error) => {
        console.error(error && error.stack ? error.stack : error);
        process.exit(1);
      });
    `;
    const stdout = execFileSync(process.execPath, ["-e", script], {
      input: payload,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
    return Promise.resolve(JSON.parse(stdout));
  } catch (error) {
    return Promise.resolve(null);
  }
}

function getQueryEmbedding(normalizedQuery) {
  if (queryEmbeddingCache.has(normalizedQuery)) {
    return queryEmbeddingCache.get(normalizedQuery);
  }

  try {
    const payload = JSON.stringify({
      model: EMBEDDING_MODEL,
      apiKey: process.env.OPENAI_API_KEY,
      query: normalizedQuery,
    });
    const script = `
      const fs = require("fs");
      const OpenAI = require("openai");
      const input = JSON.parse(fs.readFileSync(0, "utf8"));
      (async () => {
        const client = new OpenAI({ apiKey: input.apiKey });
        const result = await client.embeddings.create({
          model: input.model,
          input: input.query,
        });
        process.stdout.write(JSON.stringify(result.data[0].embedding));
      })().catch((error) => {
        console.error(error && error.stack ? error.stack : error);
        process.exit(1);
      });
    `;
    const stdout = execFileSync(process.execPath, ["-e", script], {
      input: payload,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const embedding = JSON.parse(stdout);
    queryEmbeddingCache.set(normalizedQuery, embedding);
    return embedding;
  } catch (error) {
    return null;
  }
}

function localSemanticScore(normalizedQuery, profile) {
  const queryTokens = buildTokenSet(normalizedQuery);
  const profileTokens = profile.tokens || new Set();
  const keywordTokens = profile.keywords || new Set();
  if (queryTokens.size === 0) return 0;

  let matched = 0;
  for (const token of queryTokens) {
    if (hasSemanticTokenMatch(token, profileTokens) || hasSemanticTokenMatch(token, keywordTokens)) {
      matched += 1;
    }
  }

  const tokenCoverage = matched / queryTokens.size;
  const keywordCoverage = keywordTokens.size > 0 ? intersectCount(queryTokens, keywordTokens) / Math.min(queryTokens.size, keywordTokens.size) : 0;
  const phraseCoverage = profile.semantic_description.includes(normalizedQuery) ? 1 : 0;

  return clampScore(tokenCoverage * 0.7 + keywordCoverage * 0.2 + phraseCoverage * 0.1);
}

function hasSemanticTokenMatch(token, tokenSet) {
  if (!token || !tokenSet || tokenSet.size === 0) return false;
  const candidates = tokenVariants(token);
  for (const candidate of candidates) {
    if (tokenSet.has(candidate)) return true;
  }
  return false;
}

function tokenVariants(token) {
  const variants = new Set();
  const cleaned = String(token || "").trim();
  if (!cleaned) return variants;
  variants.add(cleaned);
  if (cleaned.length >= 4) variants.add(cleaned.slice(0, 4));
  if (cleaned.length >= 5) variants.add(cleaned.slice(0, 5));
  if (cleaned.length >= 6) variants.add(cleaned.slice(0, 6));
  return variants;
}

function intersectCount(a, b) {
  let count = 0;
  for (const item of a) {
    if (b.has(item)) count += 1;
  }
  return count;
}

function buildTokenSet(text) {
  const tokens = normalizeSemanticText(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token))
    .flatMap((token) => Array.from(tokenVariants(token)));
  return new Set(tokens);
}

function buildSemanticDescription(entry) {
  const topic = String(entry.topic || entry.id || "").trim();
  const title = normalizeSemanticText(entry.title || "");
  const summary = normalizeSemanticText(entry.summary || entry.answer_tr || "");
  const keywords = Array.isArray(entry.keywords) ? entry.keywords.join(" ") : "";
  const related = Array.isArray(entry.related_questions) ? entry.related_questions.join(" ") : "";
  const aliases = Array.isArray(entry.aliases) ? entry.aliases.join(" ") : "";
  const manual = MANUAL_SEMANTIC_DESCRIPTIONS[topic] || "";
  return normalizeSemanticText([manual, title, summary, keywords, related, aliases].filter(Boolean).join(" "));
}

function normalizeSemanticText(value) {
  return foldSemanticDiacritics(
    normalize(String(value || ""))
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR")
  );
}

function foldSemanticDiacritics(value) {
  return String(value || "")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[âÂ]/g, "a")
    .replace(/[îÎ]/g, "i")
    .replace(/[ûÛ]/g, "u");
}

function readCacheFile() {
  if (cachedState?.cache) return cachedState.cache;
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    cachedState = cachedState || {};
    cachedState.cache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCacheFileIfNeeded(signature, profiles) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const existing = readCacheFile();
    const normalizedProfiles = profiles.map((profile) => ({
      topic_id: profile.topic_id,
      semantic_description: profile.semantic_description,
      tokens: Array.from(profile.tokens || []),
      keywords: Array.from(profile.keywords || []),
      embedding: Array.isArray(profile.embedding) ? profile.embedding : null,
    }));
    const next = {
      model: EMBEDDING_MODEL,
      signature,
      generated_at: new Date().toISOString(),
      mode: process.env.OPENAI_API_KEY ? "embedding_or_local" : "local",
      profiles: normalizedProfiles,
    };

    if (!existing || existing.signature !== signature) {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
      cachedState = cachedState || {};
      cachedState.cache = next;
    }
  } catch {
    // Cache writes are best-effort only.
  }
}

function writeCacheFile(signature, profiles) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const next = {
      model: EMBEDDING_MODEL,
      signature,
      generated_at: new Date().toISOString(),
      mode: process.env.OPENAI_API_KEY ? "embedding_or_local" : "local",
      profiles: profiles.map((profile) => ({
        topic_id: profile.topic_id,
        semantic_description: profile.semantic_description,
        tokens: Array.from(profile.tokens || []),
        keywords: Array.from(profile.keywords || []),
        embedding: Array.isArray(profile.embedding) ? profile.embedding : null,
      })),
    };
    fs.writeFileSync(CACHE_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
    cachedState = cachedState || {};
    cachedState.cache = next;
  } catch {
    // best effort
  }
}

function buildSignature(entries) {
  const hash = crypto.createHash("sha256");
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    hash.update(String(entry.id || ""));
    hash.update("|");
    hash.update(String(entry.topic || ""));
    hash.update("|");
    hash.update(String(entry.semantic_description || ""));
    hash.update("\n");
  }
  return hash.digest("hex");
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function clampScore(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

const MANUAL_SEMANTIC_DESCRIPTIONS = {
  giybet_nedir:
    "Gıybet nedir? Arkadan konuşmak, bir kişinin hoşlanmayacağı sözü onun arkasından söylemek ve dedikodu yapmak demektir.",
  anne_baba_hakki:
    "Anne baba hakkı nedir? Anneye babaya nasıl davranmalı, saygılı olmak, iyilik yapmak, bakım göstermek ve dua etmekle ilgilidir.",
  israf_nedir:
    "İsraf nedir? Gereksiz harcama yapmak, yemeği, parayı ve zamanı boşuna tüketmek demektir.",
  komsuluk_hakki:
    "Komşuluk hakkı nedir? Komşuya eziyet etmemek, yardım etmek, selamlaşmak ve güzel geçinmekle ilgilidir.",
  faiz_nedir:
    "Faiz nedir? Faizli kredi, borçta artış, banka faizi ve haksız kazançla ilgili bir konudur.",
  adetliyken_kuran_okunur_mu:
    "Adetliyken Kur'an okunur mu? Mushafa dokunma, Kur'an okuma, dua, zikir ve salavat konusunu anlatır.",
  zekat_nisap_nedir:
    "Zekât nisap nedir? Nisap miktarı, zekâtın asgari mal ölçüsü ve altın üzerinden örnek hesapla ilgilidir.",
  nikah_sartlari:
    "Nikâh şartları nelerdir? Nikâhta tarafların rızası, akit, şahitlik ve temel evlilik şartları önemlidir.",
  hac_kimlere_farzdır:
    "Hac kimlere farzdır? Müslüman, akıllı, ergen, hür, maddi ve bedeni gücü olan ve yol güvenliği bulunan kişilere ilişkindir.",
  haccin_farzlari:
    "Haccın farzları nelerdir? İhrama girmek, Arafat vakfesi yapmak ve ziyaret tavafı yapmakla ilgilidir.",
  umre_nedir:
    "Umre nedir? İhram, tavaf, sa‘y ve tıraş olup ihramdan çıkma adımlarını anlatır.",
  abdest_howto:
    "Abdest nasıl alınır? Niyet, besmele, ağza ve buruna su verme, yüzü yıkama, kolları yıkama, mesh ve ayakları yıkama adımlarını anlatır.",
  gusul_howto:
    "Gusül abdesti nasıl alınır? Boy abdesti, ağıza ve buruna su vermek ve tüm bedeni kuru yer kalmayacak şekilde yıkamayı anlatır.",
  teyemmum_nasil_alinir:
    "Teyemmüm nasıl alınır? Niyet edilip temiz toprak cinsinden bir yüzeye vurularak yüz ve kolların mesh edilmesiyle alınır.",
  sahur_nedir:
    "Sahur nedir? Oruç için imsaktan önce yenilen yemeği ve hazırlığı anlatır.",
  iddet_nedir:
    "İddet nedir? Boşanma veya eşin vefatı sonrası bekleme süresiyle ilgili temel bilgidir.",
  helal_kazanc_nedir:
    "Helal kazanç nedir? Helal yoldan gelir elde etmek, rızkı temiz ve meşru şekilde kazanmak demektir.",
  mirac_kandili:
    "Miraç Kandili nedir? Miraç hadisesini hatırlatan manevi gece, dua, tövbe, zikir ve salavatla değerlendirilir.",
  kandil_geceleri_nedir:
    "Kandil geceleri nedir? Manevi yoğunluğu yüksek geceler olarak anılır; geceyi dua, tövbe, zikir ve salavatla değerlendirmek amaçlanır.",
  berat_kandili:
    "Berat Kandili nedir? Manevi olarak arınma, dua, tövbe ve ibadeti yoğunlaştırma gecesidir.",
  regaip_kandili:
    "Regaip Kandili nedir? Manevi bir gece olarak dua, tövbe ve gece ibadetleriyle değerlendirilir.",
  mevlid_kandili:
    "Mevlid Kandili nedir? Peygamberimizin doğumunu hatırlatan, salavat ve dua ile değerlendirilen gecedir.",
};

module.exports = {
  matchSemanticTopic,
  buildSemanticDescription,
  normalizeSemanticText,
};
