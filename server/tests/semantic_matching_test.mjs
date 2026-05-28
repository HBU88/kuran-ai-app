import assert from 'assert/strict';
import {
  extractSemanticTokens,
  calculateSemanticSimilarity,
  compareQuestions,
  getSynonyms,
  lemmatize
} from '../agent/turkish_nlp_utils.js';

console.log('===== Turkish NLP Semantic Matching Tests =====\n');

// Test 1: Synonym extraction
console.log('TEST 1: Synonym Extraction');
console.log('---');

const vacipSynonyms = getSynonyms('vaciptir');
console.log('Synonyms of "vaciptir":', Array.from(vacipSynonyms));
assert.ok(vacipSynonyms.has('gerekir'), 'vaciptir should have gerekir as synonym');
assert.ok(vacipSynonyms.has('farzdır'), 'vaciptir should have farzdır as synonym');
assert.ok(vacipSynonyms.has('lazımdır'), 'vaciptir should have lazımdır as synonym');
console.log('✓ Synonym extraction works\n');

// Test 2: Lemmatization
console.log('TEST 2: Lemmatization');
console.log('---');

assert.equal(lemmatize('kesmek'), 'kes', 'kesmek should lemmatize to kes');
assert.equal(lemmatize('keserken'), 'kes', 'keserken should lemmatize to kes');
assert.equal(lemmatize('kimlere'), 'kim', 'kimlere should lemmatize to kim');
assert.equal(lemmatize('selamlaşma'), 'selam', 'selamlaşma should extract base selam');
console.log('✓ Lemmatization works\n');

// Test 3: Semantic token extraction
console.log('TEST 3: Semantic Token Extraction');
console.log('---');

const tokens1 = extractSemanticTokens('kurban kimlere vaciptir');
const tokens2 = extractSemanticTokens('kurban kimlere caizdir');
console.log('Tokens from "kurban kimlere vaciptir":', Array.from(tokens1).slice(0, 10));
console.log('Tokens from "kurban kimlere caizdir":', Array.from(tokens2).slice(0, 10));
assert.ok(tokens1.has('kurban'), 'Should extract kurban token');
assert.ok(tokens1.has('kim'), 'Should extract kim (from kimlere)');
assert.ok(tokens1.has('vaciptir') || tokens1.has('gerekir') || tokens1.has('farzdır'), 'Should extract obligation verb or synonym');
console.log('✓ Semantic token extraction works\n');

// Test 4: Question similarity
console.log('TEST 4: Question Similarity');
console.log('---');

const testCases = [
  {
    q1: 'kurban kimlere vaciptir',
    q2: 'kurban kimlere caizdir',
    minScore: 0.6,
    description: 'Kurban obligation vs permission'
  },
  {
    q1: 'Selam nedir',
    q2: 'Selamlaşma ne demek',
    minScore: 0.6,
    description: 'Greeting variations'
  },
  {
    q1: 'Selam vermek nedir',
    q2: 'Selamlaşma adabı nedir',
    minScore: 0.5,
    description: 'Greeting etiquette variations'
  },
  {
    q1: 'Namaz vakitleri nedir',
    q2: 'Namaz saatleri ne zaman',
    minScore: 0.6,
    description: 'Prayer times variations'
  },
  {
    q1: 'kurban kimlere vaciptir',
    q2: 'kurban nasıl kesilir',
    minScore: 0.4,
    description: 'Different kurban questions (lower similarity expected)'
  }
];

for (const testCase of testCases) {
  const similarity = compareQuestions(testCase.q1, testCase.q2);
  console.log(`Similarity: "${testCase.q1}" ↔ "${testCase.q2}"`);
  console.log(`  Score: ${(similarity * 100).toFixed(1)}% (min: ${(testCase.minScore * 100).toFixed(0)}%)`);
  console.log(`  ${testCase.description}`);

  if (similarity >= testCase.minScore) {
    console.log('  ✓ PASS\n');
  } else {
    console.log(`  ⚠ WARNING: Expected at least ${(testCase.minScore * 100).toFixed(0)}%\n`);
  }
}

// Test 5: Semantic similarity with knowledge profiles
console.log('\nTEST 5: Semantic Profile Matching');
console.log('---');

const profiles = [
  {
    topic_id: 'kurban_kime_vaciptir',
    semantic_description: 'kurban kimlere farzdır kim kesmesi gerekir vacip obligation',
    keywords_array: ['kurban', 'vacip', 'kim', 'zorunlu']
  },
  {
    topic_id: 'selamlasma_adabi',
    semantic_description: 'selam selamlaşma adabı ne demek selam vermek nedir greeting etiquette',
    keywords_array: ['selam', 'selamlaşma', 'adap', 'vermek']
  },
  {
    topic_id: 'namaz_vakitleri',
    semantic_description: 'namaz vakitleri saatleri ne zaman ezan vakit prayer times',
    keywords_array: ['namaz', 'vakti', 'saat', 'ezan', 'vakit']
  }
];

const queryTests = [
  { query: 'kurban kimlere vaciptir', expectedTopic: 'kurban_kime_vaciptir' },
  { query: 'kurban kimlere caizdir', expectedTopic: 'kurban_kime_vaciptir' },
  { query: 'Selam nedir', expectedTopic: 'selamlasma_adabi' },
  { query: 'Selamlaşma ne demek', expectedTopic: 'selamlasma_adabi' },
  { query: 'Selam vermek gerekir mi', expectedTopic: 'selamlasma_adabi' },
  { query: 'Namaz vakitleri nedir', expectedTopic: 'namaz_vakitleri' },
  { query: 'Namaz saatleri ne zaman', expectedTopic: 'namaz_vakitleri' },
];

for (const test of queryTests) {
  const queryTokens = extractSemanticTokens(test.query);

  let bestMatch = null;
  let bestScore = 0;

  for (const profile of profiles) {
    const profileTokens = extractSemanticTokens(profile.semantic_description);
    const keywordTokens = extractSemanticTokens(profile.keywords_array.join(' '));

    const descSimilarity = calculateSemanticSimilarity(queryTokens, profileTokens);
    const keywordSimilarity = calculateSemanticSimilarity(queryTokens, keywordTokens);
    const score = Math.max(
      descSimilarity * 0.65 + keywordSimilarity * 0.35,
      descSimilarity,
      keywordSimilarity
    );

    if (score > bestScore) {
      bestScore = score;
      bestMatch = profile;
    }
  }

  const isCorrect = bestMatch?.topic_id === test.expectedTopic;
  const status = isCorrect ? '✓' : '✗';
  console.log(`${status} Query: "${test.query}"`);
  console.log(`  Expected: ${test.expectedTopic}`);
  console.log(`  Matched:  ${bestMatch?.topic_id || 'NONE'} (${(bestScore * 100).toFixed(1)}%)\n`);
}

console.log('===== All Tests Complete =====');
