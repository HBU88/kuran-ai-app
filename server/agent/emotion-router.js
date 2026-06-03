"use strict";

/**
 * emotion-router.js
 * Kullanıcının duygusuna göre:
 *   1. İlmihal KB entry'lerini döndürür (bellekte cache'li)
 *   2. Havuz'dan eşleşen Kuran ayetlerini döndürür (bellekte cache'li)
 */

const fs   = require("fs");
const path = require("path");
const { detectEmotions } = require("./emotion-detector");

const ILMIHAL_DIR  = path.join(__dirname, "../data/ilmihal");
const HAVUZ_PATH   = path.join(__dirname, "../data/ayet-rehberi/havuz.json");

// ── Bellek cache'leri ─────────────────────────────────────────────────────────
let _ilmihalCache = null;
let _havuzCache   = null;

/**
 * Tüm ilmihal dosyalarını okur ve cache'ler.
 * @returns {{ filename: string, data: object }[]}
 */
function getIlmihalEntries() {
  if (_ilmihalCache) return _ilmihalCache;

  const files   = fs.readdirSync(ILMIHAL_DIR).filter(f => f.endsWith(".json"));
  const entries = [];

  for (const filename of files) {
    const filepath = path.join(ILMIHAL_DIR, filename);
    try {
      const raw  = fs.readFileSync(filepath, "utf8");
      const data = JSON.parse(raw);
      entries.push({ filename, data });
    } catch {
      // Bozuk JSON varsa atla
    }
  }

  _ilmihalCache = entries;
  return _ilmihalCache;
}

/**
 * havuz.json'ı okur ve cache'ler.
 * @returns {{ metadata: object, kategoriler: object } | null}
 */
function getHavuz() {
  if (_havuzCache) return _havuzCache;

  try {
    const raw   = fs.readFileSync(HAVUZ_PATH, "utf8");
    _havuzCache = JSON.parse(raw);
  } catch {
    _havuzCache = null;
  }

  return _havuzCache;
}

/** Cache'leri temizler (test/reload için). */
function clearCache() {
  _ilmihalCache = null;
  _havuzCache   = null;
}

// ── Havuz ayet arama ──────────────────────────────────────────────────────────

// Emotion kategorisi → havuz'daki kategori id eşlemesi
const EMOTION_TO_HAVUZ_CATEGORY = {
  sadness:     "sadness",
  anxiety:     "anxiety",
  anger:       "anger",
  guilt:       "guilt",
  loneliness:  "loneliness",
  longing:     "longing",
  hope:        "hope",
  patience:    "patience",
  forgiveness: "forgiveness",
  gratitude:   "gratitude",
  fear:        "fear",
  justice:     "justice",
  guidance:    "guidance",
  peace:       "peace",
  confidence:  "confidence",
  // genel fallback kategorileri
  general:     "guidance",
};

/**
 * Tespit edilen duygulara göre havuzdan ayet listesi döndürür.
 * @param {string[]} emotions  - detectEmotions() çıktısı
 * @param {number}   limit     - her kategori için max ayet sayısı
 * @returns {object[]}
 */
function getAyetlerFromHavuz(emotions, limit = 5) {
  const havuz = getHavuz();
  if (!havuz || !havuz.kategoriler) return [];

  const seen   = new Set();
  const result = [];

  const targetCategories = emotions.length === 1 && emotions[0] === "general"
    ? ["guidance", "hope", "peace"]
    : emotions.map(e => EMOTION_TO_HAVUZ_CATEGORY[e]).filter(Boolean);

  // Tekil listede sırasıyla her kategoriyi al; tekrar eden id'leri atla
  for (const catKey of targetCategories) {
    const cat = havuz.kategoriler[catKey];
    if (!cat || !Array.isArray(cat.ayetler)) continue;

    let count = 0;
    for (const ayet of cat.ayetler) {
      if (count >= limit) break;
      const dedupeKey = ayet.id || `${ayet.sure}_${ayet.ayet}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      result.push({ ...ayet, _kategori: catKey });
      count++;
    }
  }

  return result;
}

// ── Ana router fonksiyonu ─────────────────────────────────────────────────────

/**
 * Kullanıcı girdisine göre eşleşen ilmihal + havuz ayetlerini döndürür.
 *
 * @param {string} userInput
 * @param {{ ilmihalLimit?: number, ayetLimit?: number }} options
 * @returns {{
 *   emotions:        string[],
 *   ilmihal_entries: object[],
 *   ayetler:         object[],
 *   toplam: { ilmihal: number, ayetler: number }
 * }}
 */
function routeByEmotion(userInput, { ilmihalLimit = 8, ayetLimit = 5 } = {}) {
  const emotions = detectEmotions(userInput);
  const entries  = getIlmihalEntries();

  // ── İlmihal eşleşmesi ─────────────────────────────────────────────────────
  const matched = entries.filter(({ data }) => {
    const tags = data.emotion_tags;
    if (!Array.isArray(tags)) return emotions.includes("general");
    if (emotions.includes("general")) return true;
    return emotions.some(e => tags.includes(e));
  });

  const scored = matched.map(({ filename, data }) => {
    const tags    = data.emotion_tags || [];
    const overlap = emotions.filter(e => tags.includes(e)).length;
    return {
      filename,
      id:           data.id           || filename.replace(".json", ""),
      baslik:       data.title        || "",
      summary:      data.summary      || "",
      category:     data.category     || "",
      category_type:data.category_type|| "genel",
      emotion_tags: tags,
      keywords:     data.keywords     || [],
      step_by_step: data.step_by_step || [],
      _score:       overlap,
    };
  });

  const ilmihalSorted = scored
    .sort((a, b) => b._score - a._score)
    .slice(0, ilmihalLimit)
    .map(({ _score, ...rest }) => rest);

  // ── Havuz ayetleri ────────────────────────────────────────────────────────
  const ayetler = getAyetlerFromHavuz(emotions, ayetLimit);

  return {
    emotions,
    ilmihal_entries: ilmihalSorted,
    ayetler,
    toplam: {
      ilmihal: matched.length,
      ayetler: ayetler.length,
    },
  };
}

module.exports = {
  routeByEmotion,
  getIlmihalEntries,
  getAyetlerFromHavuz,
  getHavuz,
  clearCache,
};
