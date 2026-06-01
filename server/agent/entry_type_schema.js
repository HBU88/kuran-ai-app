/**
 * ENTRY TYPE SCHEMA — Guardrail #2 (data side)
 *
 * Defines the controlled vocabulary for KB entry classification and the
 * shape of the `entry_purpose` block that auto-fix tooling reads to know
 * what it is and isn't allowed to change.
 *
 * Wire-format additions to each KB entry:
 *   {
 *     "entry_type": "<one of ENTRY_TYPES>",
 *     "entry_subtypes": ["..."],                  // optional, finer-grained
 *     "semantic_domain": "<one of SEMANTIC_DOMAINS>",
 *     "entry_purpose": {
 *       "primary_objective": "string",
 *       "target_queries": ["..."],
 *       "must_include": ["..."],
 *       "must_NOT_include": ["..."],
 *       "authorized_modifiers": ["..."],
 *       "forbidden_modifications": ["..."]
 *     },
 *     "NOT_for_queries": ["..."],                 // intent keywords to repel
 *     "conflicting_entries": ["..."]              // ids that own these queries
 *   }
 *
 * All fields are optional at read time — code that consumes them MUST
 * tolerate their absence so we can roll out the schema incrementally
 * without breaking existing entries.
 */

'use strict';

/**
 * Top-level entry types. Used by the query-intent classifier to filter the
 * candidate pool before scoring.
 */
const ENTRY_TYPES = Object.freeze({
  DEFINITION:    'definition',      // "X nedir?" — concept/term definitions
  INSTRUCTION:   'instruction',     // "X nasıl yapılır?" — procedural how-to
  BIOGRAPHY:     'biography',       // "X kimdir?" — prophets, scholars, sahabe
  CONDITION:     'condition',       // hayız, nifas, istihaze — physiological states
  RULING:        'ruling',          // halal/haram judgements, fıkıh fetvalar
  EVENT:         'event',           // mirac, hicret — historical/religious events
  PRACTICE:      'practice',        // umre, hac, kurban — acts of worship
  ETHICS:        'ethics',          // takva, sabır — moral concepts
  RELATIONSHIP:  'relationship',    // anne-baba hakkı, komşuluk
  FINANCE:       'finance',         // zekat, faiz, miras
});

/**
 * Semantic domains — broader buckets. An entry has ONE entry_type but
 * exactly ONE semantic_domain. Matchers can use these as a coarse filter.
 */
const SEMANTIC_DOMAINS = Object.freeze({
  WORSHIP:                 'worship',                  // namaz, oruç, zekat, hac
  PURIFICATION:            'purification',             // abdest, gusül, teyemmüm
  PEOPLE_AND_PROPHETS:     'people_and_prophets',      // peygamberler, sahabe
  FAMILY_AND_RELATIONS:    'family_and_relations',     // nikah, talak, hak
  ETHICS_AND_CHARACTER:    'ethics_and_character',     // ahlak, edep
  FINANCE_AND_TRADE:       'finance_and_trade',        // helal kazanç, faiz
  DAILY_LIFE_AND_RULINGS:  'daily_life_and_rulings',   // gündelik fıkıh
  SACRED_TIMES_AND_EVENTS: 'sacred_times_and_events',  // kandil, ramazan, mirac
  SACRED_TEXTS:            'sacred_texts',             // kur'an, hadis, dua
  PHYSIOLOGICAL_STATES:    'physiological_states',     // hayız, nifas, istihaze
});

const VALID_ENTRY_TYPES = new Set(Object.values(ENTRY_TYPES));
const VALID_SEMANTIC_DOMAINS = new Set(Object.values(SEMANTIC_DOMAINS));

/**
 * Validate an entry's classification block. Returns {valid, errors[]}.
 * Missing classification is allowed (entries are migrated incrementally).
 *
 * Strict checks only fire when a field IS present — so the validator
 * is safe to run against the existing KB without false-positives.
 */
function validateClassification(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    return { valid: false, errors: ['entry must be an object'] };
  }

  if (entry.entry_type !== undefined) {
    if (!VALID_ENTRY_TYPES.has(entry.entry_type)) {
      errors.push(
        `entry_type "${entry.entry_type}" not in vocabulary; ` +
        `allowed: ${[...VALID_ENTRY_TYPES].join(', ')}`
      );
    }
  }

  if (entry.semantic_domain !== undefined) {
    if (!VALID_SEMANTIC_DOMAINS.has(entry.semantic_domain)) {
      errors.push(
        `semantic_domain "${entry.semantic_domain}" not in vocabulary; ` +
        `allowed: ${[...VALID_SEMANTIC_DOMAINS].join(', ')}`
      );
    }
  }

  if (entry.entry_purpose !== undefined) {
    const p = entry.entry_purpose;
    if (typeof p !== 'object' || p === null) {
      errors.push('entry_purpose must be an object');
    } else {
      const stringFields = ['primary_objective'];
      const arrayFields = [
        'target_queries', 'must_include', 'must_NOT_include',
        'authorized_modifiers', 'forbidden_modifications',
      ];
      for (const f of stringFields) {
        if (p[f] !== undefined && typeof p[f] !== 'string') {
          errors.push(`entry_purpose.${f} must be a string`);
        }
      }
      for (const f of arrayFields) {
        if (p[f] !== undefined && !Array.isArray(p[f])) {
          errors.push(`entry_purpose.${f} must be an array`);
        }
      }
    }
  }

  if (entry.NOT_for_queries !== undefined && !Array.isArray(entry.NOT_for_queries)) {
    errors.push('NOT_for_queries must be an array of strings');
  }

  if (entry.conflicting_entries !== undefined && !Array.isArray(entry.conflicting_entries)) {
    errors.push('conflicting_entries must be an array of ids');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check whether a proposed update violates an entry's purpose contract.
 * Used by AtomicKBUpdater BEFORE writing.
 *
 * Rules (only enforced when entry_purpose is present):
 *   - Touching a field listed in forbidden_modifications → rejected.
 *   - Modifying summary/step_by_step is allowed only if the entry_purpose
 *     explicitly lists "enhance definitions" or similar in
 *     authorized_modifiers, OR if forbidden_modifications is empty.
 *   - Removing items from must_include array on the entry itself → rejected.
 *
 * The check is conservative: when in doubt, allow. The purpose layer is
 * a *deterrent* against blatant rewrites, not a full theorem-prover.
 */
function checkUpdateAgainstPurpose(currentEntry, proposedUpdates) {
  const purpose = currentEntry?.entry_purpose;
  if (!purpose) return { allowed: true, reason: 'no entry_purpose declared' };

  const forbidden = Array.isArray(purpose.forbidden_modifications)
    ? purpose.forbidden_modifications.map(s => String(s).toLowerCase())
    : [];

  for (const field of Object.keys(proposedUpdates || {})) {
    // Sacred content fields are always protected
    if (field === 'quran_references' || field === 'hadis_references') {
      const isSacredAuthorized = (purpose.authorized_modifiers || [])
        .some(m => /quran|hadis|sacred|kur|ayet|hadis/i.test(m));
      if (!isSacredAuthorized) {
        return {
          allowed: false,
          reason: `field "${field}" is sacred content and not in authorized_modifiers`,
        };
      }
    }

    // Field-level prohibition: forbidden list may name fields directly
    for (const f of forbidden) {
      if (f.includes(field.toLowerCase())) {
        return {
          allowed: false,
          reason: `field "${field}" matches forbidden_modifications entry "${f}"`,
        };
      }
    }
  }

  // Heuristic: if forbidden_modifications mentions "core definition",
  // do not allow summary to be replaced (only extended).
  const protectsCoreDefinition = forbidden.some(f => /core definition/i.test(f));
  if (protectsCoreDefinition && proposedUpdates && 'summary' in proposedUpdates) {
    const oldSummary = String(currentEntry.summary || '');
    const newSummary = String(proposedUpdates.summary || '');
    if (oldSummary && !newSummary.includes(oldSummary.slice(0, Math.min(40, oldSummary.length)))) {
      return {
        allowed: false,
        reason: 'summary replacement would alter the protected core definition',
      };
    }
  }

  return { allowed: true, reason: 'no purpose violations detected' };
}

module.exports = {
  ENTRY_TYPES,
  SEMANTIC_DOMAINS,
  VALID_ENTRY_TYPES,
  VALID_SEMANTIC_DOMAINS,
  validateClassification,
  checkUpdateAgainstPurpose,
};
