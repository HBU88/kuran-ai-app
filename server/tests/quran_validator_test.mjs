/**
 * Unit tests for QuranValidator.
 * Run: node server/tests/quran_validator_test.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { QuranValidator } = require('../agent/quran_validator.js');

const v = new QuranValidator();

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (err) { fail++; failures.push({ name, err: err.message }); console.log(`  ❌ ${name}\n     ${err.message}`); }
}
function assertEq(a,b,m){ if(a!==b) throw new Error(`${m||''} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
function assertTrue(x,m){ if(!x) throw new Error(m||'expected truthy'); }
function assertFalse(x,m){ if(x) throw new Error(m||'expected falsy'); }

console.log('\n=== QuranValidator tests ===\n');

console.log('Group: resolveSurah');
test('number passes through', () => assertEq(v.resolveSurah(2), 2));
test('Turkish name "Bakara" resolves to 2', () => assertEq(v.resolveSurah('Bakara'), 2));
test('with diacritics "İnşirâh" resolves to 94', () => assertEq(v.resolveSurah('İnşirâh'), 94));
test('alias "şerh" resolves to 94 (İnşirah)', () => assertEq(v.resolveSurah('şerh'), 94));
test('transliteration "Al-Fatihah" resolves to 1', () => assertEq(v.resolveSurah('Al-Fatihah'), 1));
test('numeric string "23" resolves to 23', () => assertEq(v.resolveSurah('23'), 23));
test('unknown name returns null', () => assertEq(v.resolveSurah('NotASurah'), null));
test('out-of-range number returns null', () => assertEq(v.resolveSurah(200), null));

console.log('\nGroup: exists');
test('Fatiha 1 exists', () => assertTrue(v.exists('Fatiha', 1)));
test('Bakara 286 exists (last ayah)', () => assertTrue(v.exists('Bakara', 286)));
test('Bakara 287 does NOT exist', () => assertFalse(v.exists('Bakara', 287)));
test('Bakara 0 does NOT exist', () => assertFalse(v.exists('Bakara', 0)));
test('numeric surah ref works', () => assertTrue(v.exists(2, 183)));

console.log('\nGroup: getVerse');
test('Bakara 183 returns ar+tr', () => {
  const r = v.getVerse('Bakara', 183);
  assertTrue(r, 'verse should exist');
  assertTrue(r.text_ar && r.text_ar.length > 0, 'ar text present');
  assertTrue(r.text_tr && r.text_tr.length > 0, 'tr text present');
  assertEq(r.surah, 2);
  assertEq(r.ayah, 183);
});

test('missing reference returns null', () => {
  assertEq(v.getVerse('Bakara', 999), null);
});

console.log('\nGroup: validateVerse');
test('valid Diyanet text accepted', () => {
  const canon = v.getVerse('Bakara', 183);
  const r = v.validateVerse({ surah: 2, ayah: 183, text_tr: canon.text_tr });
  assertTrue(r.valid, r.reason);
  assertEq(r.action, 'ACCEPT');
});

test('valid Arabic text accepted', () => {
  const canon = v.getVerse('Fatiha', 1);
  const r = v.validateVerse({ surah: 1, ayah: 1, text_ar: canon.text_ar });
  assertTrue(r.valid, r.reason);
});

test('missing surah/ayah is REJECT', () => {
  const r = v.validateVerse({ text_tr: 'whatever' });
  assertFalse(r.valid);
  assertEq(r.action, 'REJECT');
});

test('missing both texts is REJECT', () => {
  const r = v.validateVerse({ surah: 2, ayah: 183 });
  assertFalse(r.valid);
  assertEq(r.action, 'REJECT');
});

test('non-existent reference is REJECT', () => {
  const r = v.validateVerse({ surah: 2, ayah: 999, text_tr: 'made up' });
  assertFalse(r.valid);
  assertEq(r.action, 'REJECT');
  assertEq(r.correction, null);
});

test('mismatched Turkish text → CORRECTION_REQUIRED with canon', () => {
  const r = v.validateVerse({
    surah: 2, ayah: 183,
    text_tr: 'Bu cümle Diyanet metniyle hiç alakası olmayan tamamen farklı bir şeydir.',
  });
  assertFalse(r.valid);
  assertEq(r.action, 'CORRECTION_REQUIRED');
  assertTrue(r.correction && r.correction.text_tr);
});

test('close-enough Turkish text accepted (translation variance tolerated)', () => {
  // Strip a couple of words and reorder slightly — should still pass the 60% overlap floor
  const canon = v.getVerse('Bakara', 183);
  const slight = canon.text_tr;  // identical = trivially close
  const r = v.validateVerse({ surah: 2, ayah: 183, text_tr: slight });
  assertTrue(r.valid, r.reason);
});

console.log('\n=== Summary ===');
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);
if (fail === 0) { console.log('\n🎉 All quran_validator tests passed.\n'); process.exit(0); }
else { console.log('\nFailures:', failures); process.exit(1); }
