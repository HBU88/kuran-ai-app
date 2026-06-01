/**
 * SEMANTIC TOPIC MATCHER - RULE-BASED MATCHING
 *
 * Fixes the routing confusion bug by using deterministic priority-based rules
 * instead of embeddings.
 *
 * Priority Scoring Rules:
 * 1. Exact title match → 0.99
 * 2. Primary keyword match → 0.95
 * 3. Semantic description match → 0.85
 * 4. Fuzzy/TF-IDF match → 0.30-0.70
 * 5. Conflicting keywords → PENALTY (-0.30 or excluded)
 * 6. Threshold: 0.75 (below = KB miss)
 */

const fs = require('fs');
const path = require('path');
const { NegationDetector } = require('./negation_detector');

class SemanticTopicMatcher {
  constructor(kbPath = path.join(__dirname, '../data/ilmihal')) {
    this.kbPath = kbPath;
    this.kb = this.loadKnowledgeBase();
    this.negationDetector = new NegationDetector();
    console.log(`[MATCHER] Loaded ${this.kb.length} KB entries`);
  }

  /**
   * Load all KB entries from directory
   */
  loadKnowledgeBase() {
    const entries = [];

    try {
      const files = fs.readdirSync(this.kbPath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        try {
          const filePath = path.join(this.kbPath, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          entries.push(content);
        } catch (err) {
          console.warn(`[MATCHER] Error loading ${file}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`[MATCHER] Error reading KB directory:`, err.message);
    }

    return entries;
  }

  /**
   * Find best matching KB entry for a query
   * Returns: { entryId, score, matchType, confidence, allCandidates }
   */
  findBestMatch(query) {
    if (!query || query.trim().length === 0) {
      return {
        entryId: null,
        score: 0,
        matchType: 'empty_query',
        confidence: 'none',
        allCandidates: []
      };
    }

    const queryTokens = this.tokenize(query.toLowerCase());
    const candidates = [];

    // Score each KB entry
    for (const entry of this.kb) {
      const match = this.scoreEntry(query, queryTokens, entry);
      if (match.score > 0) {
        candidates.push(match);
      }
    }

    // Sort by score descending, with tiebreaker for base entries
    candidates.sort((a, b) => {
      // First, sort by score
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      // Tiebreaker: count how many query tokens appear in the entry ID
      const aIdLower = (a.entryId || '').toLowerCase();
      const bIdLower = (b.entryId || '').toLowerCase();
      // "okunur" / "okunurmu" are generic verbs — never meaningful for ID matching
      // e.g. "rükuda ne okunur?" should NOT prefer adetliyken_kuran_okunur_mu
      const STOP_TOKENS_TB = new Set(['nedir', 'nelerdir', 'kimdir', 'nasil', 'mi', 'mu', 'var', 'yok',
        'ne', 'bir', 'bu', 'ile', 'okunur', 'okunurmu', 'yapilir', 'edilir', 'olur',
        'hangi', 'nerede', 'zaman', 'kadar', 'sonra', 'once', 'gore',
        'demek', 'anlami', 'anlam']);
      const meaningfulTokens = queryTokens.filter(t => !STOP_TOKENS_TB.has(t) && t.length > 2);

      const aCoverage = meaningfulTokens.filter(t => aIdLower.includes(t)).length;
      const bCoverage = meaningfulTokens.filter(t => bIdLower.includes(t)).length;

      if (bCoverage !== aCoverage) return bCoverage - aCoverage;  // more coverage wins

      // Final tiebreaker: primary token starts the ID
      const primaryToken = queryTokens[0];
      const aStartsWithPrimary = aIdLower.startsWith(primaryToken);
      const bStartsWithPrimary = bIdLower.startsWith(primaryToken);

      if (aStartsWithPrimary && !bStartsWithPrimary) return -1;
      if (!aStartsWithPrimary && bStartsWithPrimary) return 1;

      // Last resort: fewer underscores (simpler entry)
      const aUnderscores = (a.entryId || '').split('_').length;
      const bUnderscores = (b.entryId || '').split('_').length;
      return aUnderscores - bUnderscores;
    });

    // Log debugging info
    if (candidates.length > 0) {
      const bestMatch = candidates[0];

      console.log(`\n[MATCHER] Query: "${query}"`);
      console.log(`  Tokens: [${queryTokens.join(', ')}]`);
      console.log(`  Top 3 candidates:`);

      for (let i = 0; i < Math.min(3, candidates.length); i++) {
        const c = candidates[i];
        console.log(`    ${i + 1}. ${c.entryId} (${c.score.toFixed(2)}) - ${c.matchType}`);
      }

      return {
        entryId: bestMatch.entryId,
        score: bestMatch.score,
        matchType: bestMatch.matchType,
        confidence: this.getConfidence(bestMatch.score),
        allCandidates: candidates.slice(0, 5)
      };
    }

    return {
      entryId: null,
      score: 0,
      matchType: 'no_match',
      confidence: 'none',
      allCandidates: []
    };
  }

  /**
   * Score a single entry against the query
   * Uses priority-based rules with immediate returns for high confidence matches
   */
  scoreEntry(query, queryTokens, entry) {
    const primaryToken = queryTokens[0];
    const entryIdLower = (entry.id || '').toLowerCase();
    const queryLower = query.toLowerCase();

    // =========================================
    // RULE 0: Exact ID match for base definitions
    // =========================================
    // For "X nedir?" queries, prefer "X_nedir" entry
    if (queryLower.endsWith('nedir?') || queryLower.endsWith('nedir')) {
      const expectedBaseId = `${primaryToken}_nedir`;
      if (entryIdLower === expectedBaseId) {
        return {
          entryId: entry.id,
          score: 0.99,
          matchType: 'exact_base_definition'
        };
      }
    }

    // =========================================
    // RULE 0b: ID-based matching for "nasıl" queries
    // =========================================
    // For "X nasıl yapılır/kılınır?" queries, prefer "X_nasil_*" entries
    if ((query.includes('nasil') || query.includes('nasıl')) && queryTokens.includes('nasil')) {
      if (entryIdLower.includes(primaryToken) && entryIdLower.includes('nasil')) {
        return {
          entryId: entry.id,
          score: 0.98,
          matchType: 'nasil_howto_match'
        };
      }
    }

    // =========================================
    // RULE 0c: ID-based matching (for other queries)
    // =========================================
    if (entryIdLower === primaryToken || entryIdLower.startsWith(primaryToken + '_')) {
      return {
        entryId: entry.id,
        score: 0.97,
        matchType: 'id_prefix_match'
      };
    }

    // =========================================
    // RULE 1: Exact title match
    // =========================================
    if (entry.title) {
      const titleLower = entry.title.toLowerCase().replace(/[?!.]/g, '');

      // Full title match
      if (titleLower === query.toLowerCase()) {
        return {
          entryId: entry.id,
          score: 0.99,
          matchType: 'exact_title_full'
        };
      }

      // Primary token in title — use word boundary to avoid substring false positives
      // e.g. "musa" must NOT match "musallat", "ali" must NOT match "alim"
      const titleWordBoundary = new RegExp(`\\b${primaryToken}\\b`);
      if (titleWordBoundary.test(titleLower) && primaryToken !== 'nedir' && primaryToken.length > 2) {
        return {
          entryId: entry.id,
          score: 0.95,
          matchType: 'exact_title_contains'
        };
      }
    }

    // =========================================
    // RULE 2: Keywords array match (specific keywords only)
    // =========================================
    if (entry.keywords && Array.isArray(entry.keywords)) {
      // Generic question/qualifier words — never use as sole match signal
      // "caiz", "haram", "helal", "gunah", "kullanmak" are Islamic predicates,
      // not topic identifiers — e.g. "hologram kullanmak caiz mi" must NOT
      // match "kredi_karti_kullanmak_caiz_mi" just because of shared "caiz".
      const STOP_TOKENS = new Set([
        'nedir', 'nelerdir', 'kimdir', 'nasil', 'mi', 'mu', 'var', 'yok',
        'ne', 'bir', 'bu', 'ile', 'caiz', 'haram', 'helal', 'gunah',
        'kullanmak', 'yapmak', 'etmek', 'olmak', 'vermek',
        // Generic verbs / question words that appear in many entries' keywords
        // and cause false keyword_match wins
        'okunur', 'okunurmu', 'yapilir', 'edilir', 'hangi', 'nerede',
        // "demek" appears in almost every entry's "X ne demek" keyword phrase
        // — it's as generic as "nedir" and must never be the sole match signal
        'demek', 'anlami', 'anlam',
      ]);

      // Check for EXACT keyword match (not substring)
      // Require the matching token to be a meaningful (non-stop) word
      const exactKeywordMatch = entry.keywords.some(kw => {
        const kwLower = kw.toLowerCase();
        return queryTokens.some(qt => {
          if (STOP_TOKENS.has(qt)) return false;  // skip generic tokens
          if (kwLower === qt || kwLower.startsWith(qt + ' ')) return true;
          // Word-boundary substring check — prevents "musa" matching "musallat"
          if (qt.length > 3) return new RegExp(`\\b${qt}\\b`).test(kwLower);
          return false;
        });
      });

      if (exactKeywordMatch) {
        return {
          entryId: entry.id,
          score: 0.95,
          matchType: 'keyword_match'
        };
      }
    }

    // =========================================
    // RULE 3: Semantic descriptions match
    //
    // Why this is strict:
    //   Before tightening, this rule fired on ANY single non-stop token of
    //   length > 2 appearing in ANY semantic description. Result: generic
    //   Islamic vocabulary like "dini" (which appears in almost every
    //   entry's description) caused unrelated queries — e.g. "sosyal
    //   medyada yorum yapmanın dini hükmü?" — to lock onto hayiz_nedir
    //   with score 0.85, bypassing the OpenAI KB-miss fallback entirely.
    //
    // Two changes:
    //   (a) Expanded stop list with common Islamic/generic terms so they
    //       can never be the sole match signal.
    //   (b) Require at least 2 distinct meaningful tokens to be found in
    //       the SAME semantic description. A single shared word is too
    //       weak a signal at the 0.85 score level.
    // =========================================
    if (entry.manual_semantic_descriptions && Array.isArray(entry.manual_semantic_descriptions)) {
      const STOP_TOKENS_R3 = new Set([
        // structural / question words
        'nedir', 'nelerdir', 'kimdir', 'nasil', 'mi', 'mu', 'midir', 'mudur',
        'var', 'yok', 'ne', 'bir', 'bu', 'ile', 'kim', 'kime', 've', 'de', 'da',
        // Islamic predicates / verbs that recur across most entries
        'caiz', 'haram', 'helal', 'gunah', 'farz', 'vacip', 'sunnet', 'mustahap',
        'kullanmak', 'yapmak', 'etmek', 'olmak', 'vermek', 'almak', 'bilmek',
        // generic Islamic/religious nouns that recur across most entries
        'dini', 'din', 'hukum', 'hukmu', 'hukmun', 'kural', 'kurali', 'kurallari',
        'ibadet', 'ibadetler', 'islam', 'islami', 'inanc', 'inanis',
        'musluman', 'muslumanlar', 'kisi', 'kisinin', 'durum', 'durumda', 'durumu',
        'sekil', 'sekilde', 'konu', 'konuda', 'konusu', 'soru', 'sorulan',
      ]);

      const meaningfulQueryTokens = queryTokens.filter(
        qt => qt.length > 2 && !STOP_TOKENS_R3.has(qt)
      );

      // If the user gave us essentially no specific signal, skip Rule 3.
      if (meaningfulQueryTokens.length < 2) {
        // fall through to Rule 4/5
      } else {
        const REQUIRED_MATCHES = 2;
        const matched = entry.manual_semantic_descriptions.some(desc => {
          const descLower = desc.toLowerCase();
          let hits = 0;
          for (const qt of meaningfulQueryTokens) {
            if (descLower.includes(qt)) {
              hits += 1;
              if (hits >= REQUIRED_MATCHES) return true;
            }
          }
          return false;
        });

        if (matched) {
          return {
            entryId: entry.id,
            score: 0.85,
            matchType: 'semantic_description'
          };
        }
      }
    }

    // =========================================
    // RULE 4: Check for CONFLICTING keywords
    // =========================================
    const contentText = this.getEntryContent(entry).toLowerCase();
    if (this.hasConflictingKeywords(primaryToken, contentText)) {
      // This entry explicitly states primary token is NOT applicable
      // Example: "namaz kılınmaz" in nifas entry
      // This should NOT match "namaz nedir?" query
      return {
        entryId: entry.id,
        score: 0,  // EXCLUDE from results
        matchType: 'conflicting_keywords'
      };
    }

    // =========================================
    // RULE 5: Fuzzy/TF-IDF matching
    // =========================================
    const fuzzyScore = this.calculateTFIDF(queryTokens, entry);

    if (fuzzyScore > 0.30) {
      return {
        entryId: entry.id,
        score: fuzzyScore,
        matchType: 'fuzzy_tfidf'
      };
    }

    // No match
    return {
      entryId: entry.id,
      score: 0,
      matchType: 'no_match'
    };
  }

  /**
   * Check if entry has keywords that conflict with search term.
   * Delegates to NegationDetector (Guardrail #1) for sentence-level,
   * weighted negation analysis. Returns true ONLY when the keyword
   * appears EXCLUSIVELY in strong-negation context — partial matches
   * fall through and may still get a (penalised) score from Rule 5.
   */
  hasConflictingKeywords(token, contentText) {
    if (!token || token.length < 2) return false;
    return this.negationDetector.shouldExclude(contentText, token);
  }

  /**
   * Get the soft negation penalty for an entry. Used by callers that want
   * to apply a weighted penalty instead of hard-excluding. Returns a value
   * in [-0.60, 0]. Not currently used by scoreEntry (which hard-excludes),
   * but exposed so future tiers (e.g. fuzzy_tfidf) can blend it in.
   */
  getNegationPenalty(token, contentText) {
    if (!token || token.length < 2) return 0;
    return this.negationDetector.detect(contentText, token).totalPenalty;
  }

  /**
   * Calculate TF-IDF based similarity score
   */
  calculateTFIDF(queryTokens, entry) {
    const entryText = this.getEntryContent(entry).toLowerCase();
    let totalScore = 0;
    const validTokens = queryTokens.filter(t => t.length > 2);

    if (validTokens.length === 0) {
      return 0;
    }

    for (const token of validTokens) {
      const regex = new RegExp(`\\b${token}\\b`, 'gi');
      const matches = entryText.match(regex);
      const frequency = matches ? matches.length : 0;

      if (frequency > 0) {
        totalScore += Math.min(frequency * 0.20, 0.50);
      }
    }

    // Normalize to 0-0.70 range
    return Math.min(totalScore / validTokens.length, 0.70);
  }

  /**
   * Get all searchable content from entry
   */
  getEntryContent(entry) {
    const parts = [
      entry.title || '',
      entry.summary || '',
      (entry.keywords || []).join(' '),
      (entry.manual_semantic_descriptions || []).join(' '),
      (entry.step_by_step || []).join(' '),
      (entry.related_questions || []).join(' ')
    ];

    return parts.join(' ');
  }

  /**
   * Tokenize query into search terms
   */
  tokenize(text) {
    return text
      .split(/[\s\-_.,;:!?()«»"']/g)
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => this.normalizeToken(t));
  }

  /**
   * Normalize Turkish characters for matching
   */
  normalizeToken(token) {
    return token
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/Ç/g, 'C')
      .replace(/Ğ/g, 'G')
      .replace(/İ/g, 'I')
      .replace(/Ö/g, 'O')
      .replace(/Ş/g, 'S')
      .replace(/Ü/g, 'U');
  }

  /**
   * Convert score to confidence level
   */
  getConfidence(score) {
    if (score >= 0.90) return 'very_high';
    if (score >= 0.80) return 'high';
    if (score >= 0.70) return 'medium';
    if (score >= 0.50) return 'low';
    return 'none';
  }

  /**
   * Check if score meets the KB threshold
   */
  meetsThreshold(score, threshold = 0.75) {
    return score >= threshold;
  }
}

/**
 * Module-level singleton — loads the 179 KB files once per process.
 * Prevents re-reading from disk on every matchSemanticTopic() call.
 */
let _matcherInstance = null;
function getMatcherInstance() {
  if (!_matcherInstance) {
    _matcherInstance = new SemanticTopicMatcher(path.join(__dirname, '../data/ilmihal'));
  }
  return _matcherInstance;
}

/**
 * Main export function - maintains backwards compatibility
 */
function matchSemanticTopic(query, entries = []) {
  const matcher = getMatcherInstance();
  const match = matcher.findBestMatch(query);

  if (match.score < 0.75) {
    // Below threshold - treat as no match
    return null;
  }

  // Return in legacy format for compatibility
  return {
    topic_id: match.entryId,
    score: match.score,
    confidence: match.confidence,
    matched_by: 'semantic_rule_based',
    match_reason: `${match.matchType}_score_${Math.round(match.score * 100)}`
  };
}

function buildSemanticDescription(entry) {
  return (entry.summary || entry.answer_tr || entry.title || '');
}

function normalizeSemanticText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u');
}

module.exports = {
  matchSemanticTopic,
  buildSemanticDescription,
  normalizeSemanticText,
  SemanticTopicMatcher  // Export class for direct usage
};
