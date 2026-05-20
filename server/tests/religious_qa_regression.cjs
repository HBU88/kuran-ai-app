const assert = require('assert/strict');
process.env.HAKAI_OPENAI_PLANNER_ENABLED = 'false';
const { buildChatResponse } = require('../agent');

const cases = [
  {
    message: 'Kurban kimlere vaciptir?',
    expectedId: 'kurban_kime_vaciptir',
    required: ['Hanefî', 'Müslüman', 'akıllı', 'ergen', 'nisap', 'mukim'],
    forbidden: ['Bayram namazı'],
  },
  {
    message: 'Kurban nasıl kesilir?',
    expectedId: 'kurban_keserken_nelere_dikkat_edilir',
    required: ['Kurban kesiminde', 'eziyet', 'ehil', 'besmele'],
    forbidden: ['Bayram namazı', 'Kurban Bayramı günlerinde Allah rızası için kesilen ibadettir'],
  },
  {
    message: 'Bayram namazı nasıl kılınır?',
    expectedId: 'bayram_namazi_nasil_kilinir',
    required: ['Bayram namazı', 'iki rekât'],
    forbidden: ['kurban kesiminde'],
  },
  {
    message: 'Abdest nasıl alınır?',
    expectedId: 'abdest_howto',
    required: ['Abdest'],
    forbidden: ['Bayram namazı'],
  },
  {
    message: 'Abdesti bozan şeyler nelerdir?',
    expectedId: 'abdest_bozanlar',
    required: ['Abdesti bozan', 'bayılma'],
    forbidden: ['Bayram namazı', 'Abdest, namaz ve bazı ibadetler için alınan temizliktir'],
  },
  // --- Alkol / içki: must match dedicated entry, never leak to namaz topics ---
  {
    message: 'Alkol günah mı?',
    expectedId: 'alkol_gunah_mi',
    required: ['haram', 'Maide'],
    forbidden: ['Bayram namazı', 'Kurban', 'iki rekât', 'abdest'],
  },
  {
    message: 'İçki içmek haram mı?',
    expectedId: 'alkol_gunah_mi',
    required: ['haram'],
    forbidden: ['Bayram namazı', 'kurban kesiminde', 'abdest'],
  },
  {
    message: 'Alkol haram mı?',
    expectedId: 'alkol_gunah_mi',
    required: ['haram'],
    forbidden: ['Bayram namazı', 'iki rekât'],
  },
  // --- Cross-contamination guard: kurban must never match bayram namaz ---
  {
    message: 'Kurban kimlere vaciptir?',
    expectedId: 'kurban_kime_vaciptir',
    required: ['Hanefî'],
    forbidden: ['Bayram namazı', 'iki rekât'],
  },
  // --- Low-confidence unknown question must return clarification, not random content ---
  {
    message: 'Hologram kullanmak caiz mi?',
    expectedId: null,           // null means clarification expected
    required: [],
    forbidden: ['Bayram namazı', 'iki rekât', 'kurban kesiminde', 'abdest'],
    expectClarification: true,
  },
];

function normalize(value) {
  return String(value || '').toLocaleLowerCase('tr-TR');
}

(async () => {
  let passed = 0;
  let failed = 0;

  for (const test of cases) {
    const response = await buildChatResponse(test.message, [], { module: 'ilmihal' });
    const text = response.assistant_text || '';
    const meta = response.decision_meta || {};

    try {
      if (test.expectClarification) {
        // Clarification expected: knowledge_hit_id must be null, route_mode must be ilmihal_clarification
        assert.equal(meta.knowledge_hit_id, null,
          `[clarification] ${test.message}: expected knowledge_hit_id=null, got ${meta.knowledge_hit_id}`);
        assert.equal(meta.route_mode, 'ilmihal_clarification',
          `[clarification] ${test.message}: expected route_mode=ilmihal_clarification, got ${meta.route_mode}`);
      } else {
        assert.equal(meta.knowledge_hit_id, test.expectedId,
          `${test.message}: expected knowledge_hit_id=${test.expectedId}, got ${meta.knowledge_hit_id}`);
        assert.notEqual(meta.route_mode, 'quran_guidance',
          `${test.message}: should not route to quran_guidance`);
        assert.equal(response.selected_ayah, null,
          `${test.message}: selected_ayah should be null`);
        assert.ok(Object.prototype.hasOwnProperty.call(meta, 'matched_knowledge_id'),
          `${test.message} missing matched_knowledge_id`);
        assert.ok(Object.prototype.hasOwnProperty.call(meta, 'matched_title'),
          `${test.message} missing matched_title`);
        assert.ok(Object.prototype.hasOwnProperty.call(meta, 'match_reason'),
          `${test.message} missing match_reason`);
        assert.ok(Object.prototype.hasOwnProperty.call(meta, 'match_score'),
          `${test.message} missing match_score`);
        assert.ok(Object.prototype.hasOwnProperty.call(meta, 'rejected_candidates'),
          `${test.message} missing rejected_candidates`);
      }

      for (const token of test.required) {
        assert.ok(normalize(text).includes(normalize(token)),
          `${test.message}: missing required token "${token}" in: ${text.slice(0, 200)}`);
      }
      for (const token of test.forbidden) {
        assert.ok(!normalize(text).includes(normalize(token)),
          `${test.message}: forbidden token "${token}" found in: ${text.slice(0, 200)}`);
      }

      console.log(`PASS religious QA: "${test.message}" -> ${meta.knowledge_hit_id || 'clarification'}`);
      passed += 1;
    } catch (err) {
      console.error(`FAIL religious QA: "${test.message}"`);
      console.error(' ', err.message);
      failed += 1;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
