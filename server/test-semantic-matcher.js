#!/usr/bin/env node

/**
 * Test script for new rule-based semantic matcher
 * Verifies the fix for "namaz nedir?" routing bug
 */

const { SemanticTopicMatcher } = require('./agent/semantic_topic_matcher');

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 SEMANTIC MATCHER TEST SUITE');
console.log('═══════════════════════════════════════════════════════════\n');

const matcher = new SemanticTopicMatcher(require('path').join(__dirname, 'data/ilmihal'));

const testCases = [
  {
    query: 'namaz nedir?',
    expectedTopic: 'namaz_nedir',
    minScore: 0.95,
    description: 'Basic query: What is prayer?'
  },
  {
    query: 'namaz nasıl kılınır?',
    expectedTopic: 'namaz_nasil_kilinir',
    minScore: 0.85,
    description: 'How to perform prayer'
  },
  {
    query: 'oruç nedir?',
    expectedTopic: 'oruc_nedir',
    minScore: 0.95,
    description: 'What is fasting?'
  },
  {
    query: 'zekat nedir?',
    expectedTopic: 'zekat_nedir',
    minScore: 0.95,
    description: 'What is zakat?'
  },
  {
    query: 'hayız nedir?',
    expectedTopic: 'hayiz_nedir',
    minScore: 0.95,
    description: 'What is menstruation (period)?'
  },
  {
    query: 'nifas nedir?',
    expectedTopic: 'nifas_nedir',
    minScore: 0.95,
    description: 'What is postpartum bleeding?'
  },
  {
    query: 'nikah nedir?',
    expectedTopic: 'nikah_nedir',
    minScore: 0.95,
    description: 'What is marriage?'
  }
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  console.log(`\n📝 Test: ${test.description}`);
  console.log(`   Query: "${test.query}"`);

  const result = matcher.findBestMatch(test.query);

  console.log(`   Expected: ${test.expectedTopic} (score ≥ ${test.minScore})`);
  console.log(`   Actual: ${result.entryId} (score: ${result.score.toFixed(2)})`);

  const isPass = result.entryId === test.expectedTopic && result.score >= test.minScore;

  if (isPass) {
    console.log(`   ✅ PASS`);
    passed++;
  } else {
    console.log(`   ❌ FAIL`);
    if (result.entryId !== test.expectedTopic) {
      console.log(`      - Wrong topic: got ${result.entryId}`);
    }
    if (result.score < test.minScore) {
      console.log(`      - Score too low: ${result.score.toFixed(2)} < ${test.minScore}`);
    }
    failed++;
  }
}

// KB-miss tests: queries unlikely to be in KB MUST return NULL so the
// OpenAI fallback gets invoked. Pre-fix, Rule 3 used to match these
// to whichever entry happened to contain a generic Islamic word.
console.log(`\n📝 KB-miss path: queries with no specific KB entry MUST return null`);
const kbMissQueries = [
  'sosyal medyada yorum yapmanın dini hükmü nedir?',
  'yapay zekanın dini hükmü nedir?',
];
for (const q of kbMissQueries) {
  const r = matcher.findBestMatch(q);
  if (r.entryId === null || r.score < 0.75) {
    console.log(`   ✅ "${q}" → KB-miss (score ${r.score.toFixed(2)})`);
    passed++;
  } else {
    console.log(`   ❌ "${q}" matched ${r.entryId} (${r.score.toFixed(2)}) — should have been KB-miss!`);
    failed++;
  }
}

// Critical test: verify "namaz nedir?" does NOT route to "nifas"
console.log(`\n📝 Critical Test: Verify "namaz nedir?" does NOT route to "nifas"`);
const criticalResult = matcher.findBestMatch('namaz nedir?');
const namaz_candidates = criticalResult.allCandidates.filter(c => c.entryId.includes('namaz'));
const nifas_candidates = criticalResult.allCandidates.filter(c => c.entryId.includes('nifas'));

console.log(`   Best match: ${criticalResult.entryId}`);
if (namaz_candidates.length > 0) {
  console.log(`   Top namaz match: ${namaz_candidates[0].entryId} (${namaz_candidates[0].score.toFixed(2)})`);
}
if (nifas_candidates.length > 0) {
  console.log(`   Top nifas match: ${nifas_candidates[0].entryId} (${nifas_candidates[0].score.toFixed(2)})`);
}

if (criticalResult.entryId === 'namaz_nedir' &&
    (nifas_candidates.length === 0 || nifas_candidates[0].score < 0.75)) {
  console.log(`   ✅ PASS - "namaz nedir?" correctly routes to namaz_nedir, not nifas`);
  passed++;
} else {
  console.log(`   ❌ FAIL - Routing conflict not resolved`);
  failed++;
}

// Summary
console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`📊 RESULTS`);
console.log(`═══════════════════════════════════════════════════════════`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log(`\n🎉 ALL TESTS PASSED!`);
  process.exit(0);
} else {
  console.log(`\n⚠️  Some tests failed`);
  process.exit(1);
}
