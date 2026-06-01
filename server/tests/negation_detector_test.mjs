/**
 * Unit tests for NegationDetector (Guardrail #1).
 * Run: node server/tests/negation_detector_test.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { NegationDetector } = require('../agent/negation_detector.js');

const detector = new NegationDetector();
let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}\n     ${err.message}`);
  }
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertion failed'} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertTrue(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }
function assertFalse(v, msg) { if (v) throw new Error(msg || 'expected falsy'); }

console.log('\n=== NegationDetector unit tests ===\n');

console.log('Group: prohibition detection');
test('detects "namaz kılınmaz" as prohibition', () => {
  const r = detector.detect('Bu dönemde namaz kılınmaz.', 'namaz');
  assertTrue(r.hasNegation, 'should flag negation');
  assertEq(r.strongestPattern.type, 'prohibition');
  assertTrue(r.totalPenalty <= -0.40, `penalty too weak: ${r.totalPenalty}`);
});

test('detects "oruç tutulmaz" as prohibition', () => {
  const r = detector.detect('Hayız döneminde oruç tutulmaz.', 'oruç');
  assertTrue(r.hasNegation);
  assertEq(r.strongestPattern.type, 'prohibition');
});

test('detects diacritic-free "kilinmaz"', () => {
  const r = detector.detect('Bu dönemde namaz kilinmaz.', 'namaz');
  assertTrue(r.hasNegation, 'should match without ı diacritic');
});

console.log('\nGroup: impermissibility');
test('"caiz değildir" is strong impermissible', () => {
  const r = detector.detect('Bu eylem caiz değildir.', 'eylem');
  assertEq(r.strongestPattern.type, 'impermissible');
  assertTrue(r.totalPenalty <= -0.45);
});

test('"haramdır" matched as impermissible', () => {
  const r = detector.detect('Faiz haramdır.', 'faiz');
  assertEq(r.strongestPattern.type, 'impermissible');
});

console.log('\nGroup: positive context preservation');
test('positive sentence about keyword does NOT trigger negation', () => {
  const r = detector.detect('Namaz İslam\'ın beş şartından biridir.', 'namaz');
  assertFalse(r.hasNegation, 'pure definition should not negate');
  assertEq(r.positiveSentenceCount, 1);
});

test('mixed content: counts positive AND negative sentences separately', () => {
  const text = 'Namaz İslam\'ın beş şartından biridir. Hayız döneminde namaz kılınmaz.';
  const r = detector.detect(text, 'namaz');
  assertTrue(r.hasNegation, 'should detect the negation');
  assertEq(r.positiveSentenceCount, 1, 'should also count the positive sentence');
});

console.log('\nGroup: shouldExclude semantics');
test('excludes when keyword is ONLY in strong-negation context', () => {
  const text = 'Bu dönemde namaz kılınmaz. Oruç tutulmaz.';
  assertTrue(detector.shouldExclude(text, 'namaz'), 'should hard-exclude');
});

test('does NOT exclude when there is a positive sentence too', () => {
  const text = 'Namaz İslam\'ın beş şartındandır. Bu dönemde namaz kılınmaz.';
  assertFalse(detector.shouldExclude(text, 'namaz'),
    'positive context should keep entry in pool');
});

test('does NOT exclude on weak negation alone (e.g. "olmaz" without prohibition)', () => {
  const text = 'Bu konuda fark olmaz.';
  // keyword "konuda" appears in soft-negation only — weight -0.30, NOT ≤ -0.40
  assertFalse(detector.shouldExclude(text, 'konuda'),
    'soft negation alone should not hard-exclude');
});

test('returns false for empty/short inputs', () => {
  assertFalse(detector.shouldExclude('', 'namaz'));
  assertFalse(detector.shouldExclude('namaz kılınmaz', ''));
  assertFalse(detector.shouldExclude('namaz kılınmaz', 'a'));
});

console.log('\nGroup: penalty clamping');
test('totalPenalty clamped at -0.60 even with multiple negations', () => {
  const text = 'Namaz kılınmaz. Namaz yapılmaz. Namaz haram. Namaz yasaktır.';
  const r = detector.detect(text, 'namaz');
  assertEq(r.totalPenalty, -0.60, 'clamp floor should be -0.60');
});

console.log('\n=== Summary ===');
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);
if (fail === 0) {
  console.log('\n🎉 All negation_detector tests passed.\n');
  process.exit(0);
} else {
  console.log('\n❌ Failures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  process.exit(1);
}
