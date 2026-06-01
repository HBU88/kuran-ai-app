/**
 * NEGATION DETECTOR — Guardrail #1
 *
 * Sentence-level, weighted negation detection for Turkish Islamic content.
 *
 * Problem this solves:
 *   The semantic matcher historically scored "nifas_nedir" highly for the query
 *   "namaz nedir?" because nifas_nedir contains the sentence "Bu dönemde namaz
 *   kılınmaz." A simple keyword match treats "namaz" as a topical signal — but
 *   in context the sentence is a *prohibition*, not a definition.
 *
 * Approach:
 *   - Split content into sentences.
 *   - For each sentence containing the target keyword, look for negation/
 *     restriction patterns within the SAME sentence window.
 *   - Return weighted penalties (-0.25 to -0.45) instead of a binary flag.
 *   - The matcher uses these to either soft-penalise or hard-exclude.
 *
 * Backward compatibility:
 *   The legacy boolean check in semantic_topic_matcher.hasConflictingKeywords()
 *   remains as a fast path. This module supplements it with richer context.
 *
 * Patterns are intentionally Turkish-first. Diacritic-folded variants
 * (kilinmaz, yapilamaz) are matched too so the input doesn't need to be
 * normalised before passing in.
 */

'use strict';

const NEGATION_PATTERNS = [
  // Strong prohibition: "X kılınmaz", "X tutulmaz" — the strongest signal that
  // the keyword is *forbidden* in the context the entry describes
  { match: /\bk[ıi]l[ıi]nmaz\b/i,       weight: -0.40, type: 'prohibition' },
  { match: /\btutulmaz\b/i,             weight: -0.40, type: 'prohibition' },
  { match: /\byap[ıi]lamaz\b/i,         weight: -0.40, type: 'prohibition' },
  { match: /\byap[ıi]lmaz\b/i,          weight: -0.35, type: 'prohibition' },

  // Negation of permissibility: "caiz değildir", "yasaktır"
  { match: /\bcaiz de[ğg]ildir\b/i,     weight: -0.45, type: 'impermissible' },
  { match: /\byasakt[ıi]r\b/i,          weight: -0.30, type: 'impermissible' },
  { match: /\bharam(?:d[ıi]r)?\b/i,     weight: -0.30, type: 'impermissible' },

  // Soft negation: "olmaz", "yoktur"
  { match: /\bolmaz\b/i,                weight: -0.30, type: 'negation' },
  { match: /\byoktur\b/i,               weight: -0.25, type: 'negation' },
  { match: /\bde[ğg]ildir\b/i,          weight: -0.25, type: 'negation' },

  // Contextual restriction: "dışında", "haricinde" — sentence frames the
  // keyword as something that applies outside the described context
  { match: /\bd[ıi][şs][ıi]nda\b/i,     weight: -0.35, type: 'contextual' },
  { match: /\bharicinde\b/i,            weight: -0.35, type: 'contextual' },
  { match: /\bd[öo]neminde de[ğg]il/i,  weight: -0.45, type: 'contextual' },

  // Restriction frames: "engel olur", "engeli"
  { match: /\bengel(?:i| olur)?\b/i,    weight: -0.30, type: 'restriction' },
];

const SENTENCE_SPLIT_RE = /[.!?…]+\s+|[.!?…]+$/;

/**
 * Split text into sentences while keeping things simple — Turkish has the
 * same sentence terminators as English for our purposes.
 */
function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];
  return text.split(SENTENCE_SPLIT_RE).map(s => s.trim()).filter(Boolean);
}

/**
 * Build a word-boundary regex for the keyword that survives Turkish chars.
 *
 * JS's \b is ASCII-only — for "oruç" the trailing ç isn't a word char so
 * \boruç\b fails to match. We use Unicode property classes instead:
 * the keyword must be flanked by either start/end of string or a
 * non-letter, non-digit character.
 */
function keywordRegex(keyword) {
  const escaped = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, 'iu');
}

class NegationDetector {
  /**
   * Inspect every sentence in `text` that contains `keyword` and report all
   * negation/restriction patterns that co-occur.
   *
   * @returns {{
   *   hasNegation: boolean,
   *   totalPenalty: number,    // sum of weights, clamped to -0.60
   *   strongestPattern: { type, weight, pattern } | null,
   *   matches: Array<{ sentence, type, weight, pattern }>,
   *   positiveSentenceCount: number  // sentences with keyword but no negation
   * }}
   */
  detect(text, keyword) {
    const empty = {
      hasNegation: false,
      totalPenalty: 0,
      strongestPattern: null,
      matches: [],
      positiveSentenceCount: 0,
    };

    if (!text || !keyword || keyword.length < 2) return empty;

    const kwRe = keywordRegex(keyword);
    const sentences = splitSentences(text);
    const matches = [];
    let positiveSentenceCount = 0;
    let totalPenalty = 0;
    let strongestPattern = null;

    for (const sentence of sentences) {
      if (!kwRe.test(sentence)) continue;

      let sentenceHadNegation = false;
      for (const pattern of NEGATION_PATTERNS) {
        if (pattern.match.test(sentence)) {
          matches.push({
            sentence,
            type: pattern.type,
            weight: pattern.weight,
            pattern: pattern.match.source,
          });
          totalPenalty += pattern.weight;
          if (!strongestPattern || pattern.weight < strongestPattern.weight) {
            strongestPattern = pattern;
          }
          sentenceHadNegation = true;
        }
      }

      if (!sentenceHadNegation) positiveSentenceCount += 1;
    }

    // Clamp: a single entry shouldn't be punished more than -0.60 in total —
    // beyond that we let the hard-exclude path in the matcher take over.
    if (totalPenalty < -0.60) totalPenalty = -0.60;

    return {
      hasNegation: matches.length > 0,
      totalPenalty,
      strongestPattern,
      matches,
      positiveSentenceCount,
    };
  }

  /**
   * Convenience: should we hard-exclude this entry for the given keyword?
   *
   * Hard-exclude when:
   *   - Strongest pattern is a prohibition/impermissible (weight ≤ -0.40), AND
   *   - The keyword appears ONLY in negation context (no positive sentences).
   *
   * If the keyword also appears in a positive/neutral sentence elsewhere,
   * we soft-penalise instead — the entry might still be a valid match for
   * other queries.
   */
  shouldExclude(text, keyword) {
    const result = this.detect(text, keyword);
    if (!result.hasNegation) return false;
    const strong = result.strongestPattern;
    if (!strong) return false;
    return strong.weight <= -0.40 && result.positiveSentenceCount === 0;
  }
}

module.exports = { NegationDetector, NEGATION_PATTERNS };
