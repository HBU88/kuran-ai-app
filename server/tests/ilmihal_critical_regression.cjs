// İlmihal modülü — kritik regresyon testleri
//
// Kapsam (kullanıcı bildirimi 2026-06-04):
//   1) "oruç hangi durumlarda bozulur" → yanlışlıkla "oruç fidyesi" dönüyordu.
//   2) Çok turlu bağlam: "namaz kaç rekat" → "yatsı" cevabı bayram namazı veriyordu.
//   3) Önceki sohbetin unutulması / yanlış namaz adına yönlenme.
//
// Çalıştırma: node tests/ilmihal_critical_regression.cjs
const assert = require('assert/strict');
process.env.HAKAI_OPENAI_PLANNER_ENABLED = 'false';
const { buildChatResponse } = require('../agent');
const { normalize } = require('../agent/context_resolver');

// history yardımcıları (Flutter'ın gönderdiği {role, text} biçimi)
const U = (text) => ({ role: 'user', text });
const A = (text) => ({ role: 'assistant', text });
const REKAT_CLARIFY = A('Hangi namazı soruyorsunuz? Sabah, öğle, ikindi, akşam, yatsı veya vitir namazı olabilir.');

const cases = [
  // --- BUG 1: oruç bozulur → orucu_bozanlar (fidye DEĞİL) ---
  // expectedId asıl koruma: daha önce yanlışlıkla 'oruc_fidyesi' dönüyordu.
  // ('fidye' kelimesi orucu_bozanlar metninde meşru biçimde geçebilir.)
  {
    message: 'oruç hangi durumlarda bozulur',
    expectedId: 'orucu_bozanlar',
    required: ['Orucu bozan'],
  },
  {
    message: 'oruç ne ile bozulur',
    expectedId: 'orucu_bozanlar',
  },
  {
    message: 'orucu bozan şeyler nelerdir',
    expectedId: 'orucu_bozanlar',
  },
  {
    message: 'orucu bozmayan şeyler nelerdir',
    expectedId: 'orucu_bozmayanlar',
  },
  {
    message: 'namazı bozan şeyler nelerdir',
    expectedId: 'namazi_bozanlar',
  },
  {
    message: 'abdesti bozan şeyler nelerdir',
    expectedId: 'abdest_bozanlar',
  },

  // --- BUG 3: tek mesajda "X namazı kaç rekat" ---
  {
    message: 'yatsı namazı kaç rekat',
    expectedId: 'yatsi_namazi_kac_rekat',
    required: ['13 rekat'],
    forbidden: ['Bayram'],
  },
  {
    message: 'öğle namazı kaç rekat',
    expectedId: 'ogle_namazi_kac_rekat',
    required: ['10 rekat'],
  },
  {
    message: 'ikindi namazı kaç rekat',
    expectedId: 'ikindi_namazi_kac_rekat',
    required: ['8 rekat'],
  },
  {
    message: 'akşam namazı kaç rekat',
    expectedId: 'aksam_namazi_kac_rekat',
    required: ['5 rekat'],
  },
  {
    message: 'sabah namazı kaç rekat',
    expectedId: 'sabah_namazi_kac_rekat',
    required: ['4 rekat'],
  },
  {
    message: 'vitir namazı kaç rekat',
    expectedId: 'vitir_namazi_kac_rekat',
    required: ['3 rekat'],
  },

  // --- BUG 2/3: çok turlu takip — "namaz kaç rekat" → "<namaz adı>" ---
  {
    message: 'yatsı',
    history: [U('namaz kaç rekat'), REKAT_CLARIFY],
    expectedId: 'yatsi_namazi_kac_rekat',
    required: ['Yatsı', '13 rekat'],
    forbidden: ['Bayram'],
  },
  {
    message: 'öğle',
    history: [U('namaz kaç rekat'), REKAT_CLARIFY],
    expectedId: 'ogle_namazi_kac_rekat',
    required: ['Öğle'],
    forbidden: ['Bayram'],
  },
  {
    message: 'akşam',
    history: [U('namaz kaç rekat'), REKAT_CLARIFY],
    expectedId: 'aksam_namazi_kac_rekat',
    required: ['Akşam'],
  },
  {
    message: 'sabah',
    history: [U('namaz kaç rekat'), REKAT_CLARIFY],
    expectedId: 'sabah_namazi_kac_rekat',
    required: ['Sabah'],
  },
  {
    message: 'cuma',
    history: [U('namaz kaç rekat'), REKAT_CLARIFY],
    expectedId: 'cuma_namazi_kac_rekat',
  },

  // --- Genel "namaz kaç rekat" (isim yok) → tüm rekâtları listeleyen entry ---
  {
    message: 'namaz kaç rekat',
    expectedId: 'namaz_nasil_kilinir',
  },

  // --- Regresyon koruması: "nasıl kılınır" rekât tablosuna kaymamalı ---
  {
    message: 'sabah namazı nasıl kılınır',
    expectedId: 'sabah_namazi',
  },
];

(async () => {
  let passed = 0;
  let failed = 0;

  for (const test of cases) {
    const history = test.history || [];
    const response = await buildChatResponse(test.message, history, { module: 'ilmihal' });
    const text = response.assistant_text || '';
    const meta = response.decision_meta || {};
    const label = test.history ? `"${test.message}" (takip)` : `"${test.message}"`;

    try {
      assert.equal(
        meta.knowledge_hit_id,
        test.expectedId,
        `${label}: beklenen id=${test.expectedId}, gelen=${meta.knowledge_hit_id}`
      );
      assert.notEqual(meta.route_mode, 'quran_guidance', `${label}: quran_guidance'a gitmemeli`);

      for (const token of test.required || []) {
        assert.ok(
          normalize(text).includes(normalize(token)),
          `${label}: gerekli "${token}" yok -> ${text.slice(0, 160)}`
        );
      }
      for (const token of test.forbidden || []) {
        assert.ok(
          !normalize(text).includes(normalize(token)),
          `${label}: yasak "${token}" bulundu -> ${text.slice(0, 160)}`
        );
      }

      console.log(`PASS: ${label} -> ${meta.knowledge_hit_id}`);
      passed += 1;
    } catch (err) {
      console.error(`FAIL: ${label}`);
      console.error('  ', err.message);
      failed += 1;
    }
  }

  console.log(`\nSonuç: ${passed} geçti, ${failed} kaldı (toplam ${cases.length})`);
  if (failed > 0) process.exit(1);
})();
