/**
 * Turkish NLP Utilities for Religious Q&A
 * Handles Turkish synonyms, verb forms, stemming, and semantic variations
 */

// Turkish synonym mapping for religious terms
const TURKISH_SYNONYMS = {
  // Obligation/Permission verbs
  vaciptir: ['gerekir', 'lazımdır', 'lazimdir', 'farzdır', 'farz', 'zorunludur', 'vacip'],
  caizdir: ['mübahtır', 'mubahtur', 'helaldir', 'helal', 'yapılabilir', 'yapilabilir', 'caiz'],
  gerekir: ['vaciptir', 'lazımdır', 'lazimdir', 'farzdır', 'farz', 'zorunludur'],
  farzdır: ['vaciptir', 'gerekir', 'lazımdır', 'lazimdir', 'zorunludur'],

  // Question words
  nedir: ['ne demek', 'ne anlama', 'anlama gelir', 'ne anlami', 'tanımlama'],
  'ne demek': ['nedir', 'ne anlama', 'ne anlami'],
  nasıl: ['ne şekilde', 'ne sekilde', 'hangi yolla', 'kaç aşama', 'prosedür'],
  'nasil': ['ne sekilde', 'hangi yolla', 'kac asama'],

  // Subject variations (who/which)
  kimlere: ['kime', 'kimler', 'hangi kişiler', 'hangi insanlar', 'kimler için'],
  kime: ['kimlere', 'kimler', 'hangi kişi'],
  kimler: ['kimlere', 'kime', 'hangi kişiler', 'hangi insanlar'],

  // Topic synonyms
  kurban: ['adak', 'kesim', 'kurbanlık', 'kurban kesme'],
  adak: ['kurban', 'adak kurbanı', 'manevi kurban'],
  selam: ['selamlaşma', 'selam verme', 'selamı dönmek', 'selamı vermek'],
  selamlaşma: ['selam', 'selam verme', 'selam vermek'],

  // Ablution/Cleansing
  abdest: ['wudu', 'gusül', 'gusul', 'teyemmüm', 'teyemmum'],
  wudu: ['abdest', 'taharat', 'taharah'],
  gusül: ['gusul', 'büyük abdest', 'buyuk abdest'],
  teyemmüm: ['teyemmum', 'toprakla taharat'],

  // Prayer
  namaz: ['salat', 'ibadet', 'farz namaz', 'sünnet namaz', 'sunnet namaz'],
  'namaz vakti': ['namaz saati', 'ezan vakti', 'vakit', 'salat vakti'],
  oruç: ['oruc', 'siyam', 'fasting', 'oruç tutma'],

  // Obligation types
  farz: ['farzdır', 'vaciptir', 'gerekir', 'lazım'],
  sünnet: ['sunnet', 'mustahab', 'müstahab'],
  mekruh: ['makruh', 'hoş görülmez', 'hoş gorulmez'],
  haram: ['haramdır', 'yasak', 'helalı olmaz', 'helali olmaz'],
  helal: ['helaldir', 'caiz', 'caizdir', 'mübahtır', 'mubahtur'],
};

// Turkish verb lemmatization mapping
const VERB_LEMMAS = {
  // -mak/-mek verbs
  'kesmek': 'kes',
  'kesme': 'kes',
  'keserken': 'kes',
  'kestik': 'kes',
  'kesilir': 'kes',
  'kesilmek': 'kes',

  'vermek': 'ver',
  'verme': 'ver',
  'verirken': 'ver',
  'verilir': 'ver',
  'verilebilir': 'ver',

  'almak': 'al',
  'alınır': 'al',
  'alış': 'al',

  'kılmak': 'kıl',
  'kılınır': 'kıl',
  'kılmak': 'kıl',

  'etmek': 'et',
  'edilir': 'et',
  'yapılır': 'et',
  'yapılmak': 'et',
};

// Noun lemmatization (removing suffixes)
const NOUN_LEMMAS = {
  'kimlere': 'kim',
  'kime': 'kim',
  'kimler': 'kim',
  'kimlerdir': 'kim',
  'kimlerin': 'kim',

  'kimlere': 'kim',
  'nedir': 'nedi',
  'nelerdir': 'neleri',
  'neyi': 'ne',
  'neden': 'nede',

  'hakkında': 'hakkı',
  'hakkinda': 'hakki',
  'için': 'icin',

  'selamlaşma': 'selam',
  'selamlaşmak': 'selam',
  'selamı': 'selam',
};

/**
 * Expand a word to include its synonyms
 * @param {string} word - Word to expand
 * @returns {Set<string>} Set of synonyms including the original word
 */
function getSynonyms(word) {
  const normalized = String(word || '').toLowerCase().trim();
  const synonymSet = new Set([normalized]);

  // Check direct synonyms
  if (TURKISH_SYNONYMS[normalized]) {
    TURKISH_SYNONYMS[normalized].forEach(s => synonymSet.add(s.toLowerCase()));
  }

  // Check if this word is a synonym of another word
  for (const [key, values] of Object.entries(TURKISH_SYNONYMS)) {
    if (values.map(v => v.toLowerCase()).includes(normalized)) {
      synonymSet.add(key.toLowerCase());
      values.forEach(v => synonymSet.add(v.toLowerCase()));
    }
  }

  return synonymSet;
}

/**
 * Get lemma (base form) of a Turkish word
 * @param {string} word - Word to lemmatize
 * @returns {string} Lemmatized form
 */
function lemmatize(word) {
  const normalized = String(word || '').toLowerCase().trim();

  // Check verb lemmas
  if (VERB_LEMMAS[normalized]) {
    return VERB_LEMMAS[normalized];
  }

  // Check noun lemmas
  if (NOUN_LEMMAS[normalized]) {
    return NOUN_LEMMAS[normalized];
  }

  // Simple suffix stripping for common Turkish suffixes
  // -ı/-i/-u/-ü (accusative)
  if (normalized.match(/[ıiuü]$/)) {
    return normalized.slice(0, -1);
  }

  // -lar/-ler (plural)
  if (normalized.endsWith('lar') || normalized.endsWith('ler')) {
    return normalized.slice(0, -3);
  }

  // -dir/-dur/-dır/-dür (copula)
  if (normalized.match(/d[ıiuü]r$/)) {
    return normalized.slice(0, -3);
  }

  return normalized;
}

/**
 * Extract semantic tokens from Turkish text
 * Includes original words, synonyms, and lemmas
 * @param {string} text - Text to tokenize
 * @returns {Set<string>} Set of semantic tokens
 */
function extractSemanticTokens(text) {
  const normalized = String(text || '').toLowerCase().trim();
  const tokens = new Set();

  // Split into words
  const words = normalized
    .split(/\s+/)
    .map(w => w.replace(/[^a-zçğıöşüâîû]/g, ''))
    .filter(w => w.length > 0);

  for (const word of words) {
    // Add original word
    tokens.add(word);

    // Add lemmatized form
    const lemma = lemmatize(word);
    if (lemma !== word) {
      tokens.add(lemma);
    }

    // Add synonyms and their lemmas
    const synonyms = getSynonyms(word);
    for (const synonym of synonyms) {
      tokens.add(synonym);
      const synonymLemma = lemmatize(synonym);
      if (synonymLemma !== synonym) {
        tokens.add(synonymLemma);
      }
    }

    // Add prefix variants for longer words
    if (word.length >= 4) {
      tokens.add(word.slice(0, 4));
      tokens.add(word.slice(0, 5));
    }
  }

  return tokens;
}

/**
 * Calculate semantic similarity between two sets of tokens
 * @param {Set<string>} queryTokens - Query tokens
 * @param {Set<string>} profileTokens - Profile tokens
 * @returns {number} Similarity score 0-1
 */
function calculateSemanticSimilarity(queryTokens, profileTokens) {
  if (queryTokens.size === 0 || profileTokens.size === 0) {
    return 0;
  }

  // Calculate Jaccard similarity
  const intersection = new Set([...queryTokens].filter(t => profileTokens.has(t)));
  const union = new Set([...queryTokens, ...profileTokens]);

  return intersection.size / union.size;
}

/**
 * Check if query matches profile semantically
 * @param {string} query - User question
 * @param {Object} profile - Knowledge entry profile
 * @param {number} threshold - Minimum similarity threshold (default 0.75)
 * @returns {Object|null} Match result or null
 */
function semanticMatch(query, profile, threshold = 0.75) {
  const queryTokens = extractSemanticTokens(query);
  const profileTokens = extractSemanticTokens(profile.semantic_description || '');
  const keywordTokens = extractSemanticTokens((profile.keywords || []).join(' '));

  // Calculate multiple similarity metrics
  const descriptionSimilarity = calculateSemanticSimilarity(queryTokens, profileTokens);
  const keywordSimilarity = calculateSemanticSimilarity(queryTokens, keywordTokens);

  // Weighted combination
  const score = Math.max(
    descriptionSimilarity * 0.7 + keywordSimilarity * 0.3,
    descriptionSimilarity,
    keywordSimilarity
  );

  if (score >= threshold) {
    return {
      score: Math.min(1, score),
      confidence: score >= 0.85 ? 'high' : 'low',
      matched_tokens: new Set([...queryTokens].filter(t => profileTokens.has(t) || keywordTokens.has(t))),
    };
  }

  return null;
}

/**
 * Compare two questions semantically
 * @param {string} q1 - First question
 * @param {string} q2 - Second question
 * @returns {number} Similarity score 0-1
 */
function compareQuestions(q1, q2) {
  const t1 = extractSemanticTokens(q1);
  const t2 = extractSemanticTokens(q2);
  return calculateSemanticSimilarity(t1, t2);
}

module.exports = {
  getSynonyms,
  lemmatize,
  extractSemanticTokens,
  calculateSemanticSimilarity,
  semanticMatch,
  compareQuestions,
  TURKISH_SYNONYMS,
  VERB_LEMMAS,
  NOUN_LEMMAS,
};
