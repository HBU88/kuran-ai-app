"use strict";

/**
 * emotion-router.js
 * Kullanıcının duygusuna göre ilgili ilmihal entry'lerini döndürür.
 * İlmihal dosyaları bellekte cache'lenir — her request'te disk I/O yapılmaz.
 */

const fs   = require("fs");
const path = require("path");
const { detectEmotions } = require("./emotion-detector");

const ILMIHAL_DIR = path.join(__dirname, "../data/ilmihal");

// ── Bellek cache'i ────────────────────────────────────────────────────────────
let _cache = null;

/**
 * Tüm ilmihal dosyalarını okur ve cache'ler.
 * @returns {{ filename: string, data: object }[]}
 */
function getIlmihalEntries() {
  if (_cache) return _cache;

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

  _cache = entries;
  return _cache;
}

/** Cache'i temizler (test/reload için). */
function clearCache() {
  _cache = null;
}

/**
 * Kullanıcı girdisine göre eşleşen ilmihal entry'lerini döndürür.
 * @param {string} userInput
 * @param {{ limit?: number }} options
 * @returns {{
 *   emotions: string[],
 *   matched_entries: object[],
 *   total: number
 * }}
 */
function routeByEmotion(userInput, { limit = 10 } = {}) {
  const emotions = detectEmotions(userInput);
  const entries  = getIlmihalEntries();

  // Eşleşen entry'leri bul
  const matched = entries.filter(({ data }) => {
    const tags = data.emotion_tags;
    if (!Array.isArray(tags)) return emotions.includes("general");
    // "general" emotion → herhangi bir entry döner; spesifik → intersection
    if (emotions.includes("general")) return true;
    return emotions.some(e => tags.includes(e));
  });

  // Alaka puanı: kaç emotion eşleşiyor?
  const scored = matched.map(({ filename, data }) => {
    const tags      = data.emotion_tags || [];
    const overlap   = emotions.filter(e => tags.includes(e)).length;
    const keyFields = [data.title, data.summary].filter(Boolean).join(" ");
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

  // Skora göre sırala, limit uygula, iç alanı kaldır
  const sorted = scored
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...rest }) => rest);

  return {
    emotions,
    matched_entries: sorted,
    total: matched.length,
  };
}

module.exports = { routeByEmotion, getIlmihalEntries, clearCache };
