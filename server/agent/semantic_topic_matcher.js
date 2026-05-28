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

class SemanticTopicMatcher {
  constructor(kbPath = path.join(__dirname, '../data/ilmihal')) {
    this.kbPath = kbPath;
    this.kb = this.loadKnowledgeBase();
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

      // Tiebreaker: prefer entries where primary token comes first
      const aIdLower = (a.entryId || '').toLowerCase();
      const bIdLower = (b.entryId || '').toLowerCase();
      const primaryToken = queryTokens[0];

      const aStartsWithPrimary = aIdLower.startsWith(primaryToken);
      const bStartsWithPrimary = bIdLower.startsWith(primaryToken);

      if (aStartsWithPrimary && !bStartsWithPrimary) return -1;
      if (!aStartsWithPrimary && bStartsWithPrimary) return 1;

      // Second tiebreaker: fewer underscores (simpler entry)
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

      // Primary token in title (but not generic terms)
      if (titleLower.includes(primaryToken) && primaryToken !== 'nedir' && primaryToken.length > 2) {
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
      // Check for EXACT keyword match (not substring)
      const exactKeywordMatch = entry.keywords.some(kw => {
        const kwLower = kw.toLowerCase();
        return queryTokens.some(qt => {
          // Only match if keyword starts with token or token starts with keyword
          return kwLower === qt || kwLower.startsWith(qt + ' ') || (qt.length > 3 && kwLower.includes(qt));
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
    // =========================================
    if (entry.manual_semantic_descriptions && Array.isArray(entry.manual_semantic_descriptions)) {
      const semanticMatch = entry.manual_semantic_descriptions.some(desc => {
        const descLower = desc.toLowerCase();
        return queryTokens.some(qt => descLower.includes(qt));
      });

      if (semanticMatch) {
        return {
          entryId: entry.id,
          score: 0.85,
          matchType: 'semantic_description'
        };
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
   * Check if entry has keywords that conflict with search term
   * Returns true if entry explicitly says the token is NOT applicable
   */
  hasConflictingKeywords(token, contentText) {
    if (!token || token.length < 2) {
      return false;
    }

    // Patterns that indicate the token is NOT applicable
    const conflictPatterns = [
      `${token} kılınmaz`,       // prayer NOT performed
      `${token} tutulmaz`,        // fast NOT observed
      `${token} yapılamaz`,       // cannot be done
      `${token} yapılmaz`,        // not performed
      `${token} olmaz`,           // NOT allowed
      `${token} caiz değildir`,   // not permissible
      `${token} haram`,           // forbidden
      `${token} yasaktır`,        // prohibited
      `${token} engeli`,          // prevents
      `adet.* ${token}`,          // condition... prayer
      `nifas.* ${token}`,         // postpartum... prayer
      `istihaze.* ${token}`       // abnormal bleeding... prayer
    ];

    for (const pattern of conflictPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(contentText)) {
        return true;
      }
    }

    return false;
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
 * Main export function - maintains backwards compatibility
 */
function matchSemanticTopic(query, entries = []) {
  const matcher = new SemanticTopicMatcher(path.join(__dirname, '../data/ilmihal'));
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
