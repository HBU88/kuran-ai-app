#!/usr/bin/env node
/**
 * Namaz Sure & Dua KB Test Suite
 * Tests for: subhaneke, salli-barik, namaz tesbihleri,
 * namazda okunan sureler, cuma/bayram namazında okunanlar
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { SemanticTopicMatcher } = require('../agent/semantic_topic_matcher');
const matcher = new SemanticTopicMatcher(path.join(__dirname, '../data/ilmihal'));

const THRESHOLD = 0.75;

const tests = [
  // ── Sübhaneke ─────────────────────────────────────────────────────────────
  {
    query: 'sübhaneke nedir?',
    expectedId: 'subhaneke_nedir',
    minScore: 0.95,
    desc: 'Sübhaneke nedir? (exact_base_definition)'
  },
  {
    query: 'subhaneke duası nedir?',
    expectedId: 'subhaneke_nedir',
    minScore: 0.90,
    desc: 'Sübhaneke duası (ASCII normalize)'
  },
  {
    query: 'namaza başlarken hangi dua okunur?',
    expectedId: 'namaza_baslangic_duasi',
    minScore: 0.90,
    desc: 'Namaza başlarken dua → namaza_baslangic_duasi (id_prefix)'
  },
  {
    query: 'iftitah tekbirinden sonra ne okunur?',
    expectedId: 'subhaneke_nedir',   // sübhaneke is THE correct answer; namaza_baslangic_duasi is also valid
    minScore: 0.75,
    desc: 'İftitah sonrası okunacak dua → subhaneke_nedir (fewer underscores tiebreaker)'
  },

  // ── Salli-Barik ───────────────────────────────────────────────────────────
  {
    query: 'salli barik nedir?',
    expectedId: 'salli_barik_nedir',
    minScore: 0.95,
    desc: 'Salli-Barik nedir? (id_prefix_match)'
  },
  {
    query: 'allahümme salli duası nedir?',
    expectedId: 'allahumme_salli_nedir',
    minScore: 0.90,
    desc: 'Allahümme salli → allahumme_salli_nedir (id_prefix 0.97)'
  },
  {
    query: 'namazda salavat nedir?',
    expectedId: 'namazda_salavat_nedir',
    minScore: 0.90,
    desc: 'Namazda salavat → namazda_salavat_nedir (id_prefix wins tiebreaker)'
  },
  {
    query: 'allahümme salli okunuşu nedir?',
    expectedId: 'allahumme_salli_nedir',
    minScore: 0.90,
    desc: 'Allahümme salli okunuşu'
  },

  // ── Namaz Tesbihleri ──────────────────────────────────────────────────────
  {
    query: 'rükuda ne okunur?',
    expectedId: 'namaz_tesbihleri',
    minScore: 0.75,
    desc: 'Rükûda ne okunur? (tiebreaker fix: okunur artık stop token)'
  },
  {
    query: 'secdede ne okunur?',
    expectedId: 'namaz_tesbihleri',
    minScore: 0.75,
    desc: 'Secdede ne okunur? (tiebreaker fix)'
  },
  {
    query: 'namaz tesbihleri nelerdir?',
    expectedId: 'namaz_tesbihleri',
    minScore: 0.90,
    desc: 'Namaz tesbihleri genel (id_prefix_match)'
  },
  {
    query: 'sübhane rabbiyel azim ne demek?',
    expectedId: 'namaz_tesbihleri',
    minScore: 0.75,
    desc: 'Sübhane rabbiyel azim → namaz_tesbihleri (demek now stop token)'
  },
  {
    query: 'rüku tesbihi nedir?',
    expectedId: 'namaz_tesbihleri',
    minScore: 0.75,
    desc: 'Rüku tesbihi'
  },

  // ── Namazda Okunan Sureler ────────────────────────────────────────────────
  {
    query: 'namazda hangi sureler okunur?',
    expectedId: 'namazda_okunan_sureler',
    minScore: 0.95,
    desc: 'Namazda hangi sureler okunur? (id_prefix)'
  },
  {
    query: 'zammi sure nedir?',
    expectedId: 'namazda_okunan_sureler',
    minScore: 0.90,
    desc: 'Zammı sure nedir? (keyword)'
  },
  {
    query: 'akşam namazında hangi sure okunur?',
    expectedId: 'aksam_namazi',
    minScore: 0.90,
    desc: 'Akşam namazında sure seçimi → aksam_namazi (id_prefix 0.97)'
  },

  // ── Sabah Namazı ─────────────────────────────────────────────────────────
  {
    query: 'sabah namazı nasıl kılınır?',
    expectedId: 'sabah_namazi',
    minScore: 0.95,
    desc: 'Sabah namazı nasıl kılınır (nasil_howto)'
  },
  {
    query: 'sabah namazında hangi sure okunur?',
    expectedId: 'sabah_namazi',
    minScore: 0.75,
    desc: 'Sabah namazında sure seçimi → sabah_namazi (id_prefix)'
  },

  // ── Cuma Namazında Sureler ────────────────────────────────────────────────
  {
    query: 'cuma namazında hangi sure okunur?',
    expectedId: 'cuma_namazinda_okunan_sureler',
    minScore: 0.95,
    desc: 'Cuma namazında hangi sure okunur? (id_prefix wins tiebreaker)'
  },
  {
    query: 'cuma namazında ala suresi mi okunur?',
    expectedId: 'cuma_namazinda_okunan_sureler',
    minScore: 0.75,
    desc: 'Cuma namazında A\'la suresi sorgusu'
  },
  {
    query: 'cuma namazında gaşiye suresi okunur mu?',
    expectedId: 'cuma_namazinda_okunan_sureler',
    minScore: 0.75,
    desc: 'Cuma namazında Gaşiye sorgusu'
  },

  // ── Bayram Namazında Sureler ──────────────────────────────────────────────
  {
    query: 'bayram namazında hangi sure okunur?',
    expectedId: 'bayram_namazinda_okunanlar',
    minScore: 0.95,
    desc: 'Bayram namazında hangi sure okunur? (id_prefix wins tiebreaker)'
  },
  {
    query: 'bayram namazı ilave tekbirleri nelerdir?',
    expectedId: 'bayram_namazi_ilave_tekbirleri',
    minScore: 0.90,
    desc: 'Bayram ilave tekbirler → dedicated entry (id_prefix best coverage)'
  },
  {
    query: 'bayram namazında tekbirler nasıl alınır?',
    expectedId: 'bayram_namazi_nasil_kilinir',  // "nasıl" triggers nasil_howto at 0.98 — correct answer
    minScore: 0.90,
    desc: 'Bayram tekbirleri nasıl alınır → bayram_namazi_nasil_kilinir (nasil_howto 0.98)'
  },
  {
    query: 'zevaid tekbirler nedir?',
    expectedId: 'bayram_namazi_ilave_tekbirleri',
    minScore: 0.90,
    desc: 'Zevaid tekbirler nedir → ilave tekbirler entry'
  },

  // ── Bayram Namazı Nasıl Kılınır ───────────────────────────────────────────
  {
    query: 'bayram namazı nasıl kılınır?',
    expectedId: 'bayram_namazi_nasil_kilinir',
    minScore: 0.95,
    desc: 'Bayram namazı nasıl kılınır? (nasil_howto)'
  },

  // ── Cuma Namazı Nedir ─────────────────────────────────────────────────────
  {
    query: 'cuma namazı nedir?',
    expectedId: 'cuma_namazi_nedir',
    minScore: 0.95,
    desc: 'Cuma namazı nedir? (exact_base_definition)'
  },

  // ── KB-miss güvenlik: yanlış içerikli cevap döndürülmemeli ───────────────
  // Not: These broad queries may route to the nearest Islamic topic entry
  // which is acceptable; we only verify they DON'T return wrong content
  // (e.g. "rükuda ne okunur" must NOT return adetliyken_kuran_okunur_mu)
  {
    query: 'rükuda ne okunur?',
    notExpectedId: 'adetliyken_kuran_okunur_mu',
    desc: 'Rükûda ne okunur — MUST NOT route to adetliyken (critical)'
  },
  {
    query: 'secdede ne okunur?',
    notExpectedId: 'adetliyken_kuran_okunur_mu',
    desc: 'Secdede ne okunur — MUST NOT route to adetliyken (critical)'
  },
];

// ────────────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 NAMAZ SURE & DUA KB TEST SUITE');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = matcher.findBestMatch(t.query);
  let isPass;
  let failReason = '';

  if (t.notExpectedId !== undefined) {
    // Negative test: must NOT route to this entry
    isPass = result.entryId !== t.notExpectedId;
    if (!isPass) failReason = `Should NOT have routed to ${t.notExpectedId}`;
  } else if (t.expectedId === null) {
    // KB-miss test
    isPass = result.entryId === null || result.score < THRESHOLD;
    if (!isPass) failReason = `Should be KB-miss; got ${result.entryId} (${result.score.toFixed(2)})`;
  } else {
    isPass = result.entryId === t.expectedId && result.score >= t.minScore;
    if (result.entryId !== t.expectedId) failReason = `Wrong entry: ${result.entryId}`;
    else if (result.score < t.minScore) failReason = `Score too low: ${result.score.toFixed(2)} < ${t.minScore}`;
  }

  const icon = isPass ? '✅' : '❌';
  console.log(`${icon} ${t.desc}`);
  console.log(`   Q: "${t.query}"`);

  if (t.notExpectedId !== undefined) {
    console.log(`   NOT expected: ${t.notExpectedId} | Got: ${result.entryId ?? 'null'} (score: ${result.score.toFixed(2)})`);
  } else if (t.expectedId !== null) {
    console.log(`   Expected: ${t.expectedId} (≥${t.minScore}) | Got: ${result.entryId ?? 'null'} (score: ${result.score.toFixed(2)})`);
  }

  if (!isPass) {
    console.log(`   ⚠️  FAIL: ${failReason}`);
    failed++;
  } else {
    passed++;
  }
  console.log();
}

console.log('═══════════════════════════════════════════════════════════');
console.log('📊 RESULTS');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 ALL TESTS PASSED!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed — check keyword/semantic_description coverage.');
  process.exit(1);
}
