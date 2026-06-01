/**
 * Unit tests for entry_type_schema.
 * Run: node server/tests/entry_type_schema_test.mjs
 */

import { createRequire } from 'module';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
  ENTRY_TYPES, SEMANTIC_DOMAINS,
  validateClassification, checkUpdateAgainstPurpose,
} = require('../agent/entry_type_schema.js');

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (err) { fail++; failures.push({ name, err: err.message }); console.log(`  ❌ ${name}\n     ${err.message}`); }
}
function assertEq(a, b, m) { if (a !== b) throw new Error(`${m||''} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
function assertTrue(v, m) { if (!v) throw new Error(m || 'expected truthy'); }
function assertFalse(v, m) { if (v) throw new Error(m || 'expected falsy'); }

console.log('\n=== entry_type_schema tests ===\n');

console.log('Group: validateClassification — happy paths');
test('empty entry passes (migration is incremental)', () => {
  const r = validateClassification({});
  assertTrue(r.valid, JSON.stringify(r.errors));
});

test('well-formed full entry passes', () => {
  const r = validateClassification({
    entry_type: ENTRY_TYPES.DEFINITION,
    semantic_domain: SEMANTIC_DOMAINS.WORSHIP,
    entry_purpose: {
      primary_objective: 'define X',
      target_queries: ['X nedir'],
      must_include: ['definition'],
      must_NOT_include: ['restrictions'],
      authorized_modifiers: ['clarify'],
      forbidden_modifications: ['delete core'],
    },
    NOT_for_queries: ['Y nedir'],
    conflicting_entries: ['y_nedir'],
  });
  assertTrue(r.valid, JSON.stringify(r.errors));
});

console.log('\nGroup: validateClassification — rejections');
test('bad entry_type is rejected', () => {
  const r = validateClassification({ entry_type: 'made_up_thing' });
  assertFalse(r.valid);
  assertTrue(r.errors[0].includes('entry_type'));
});

test('bad semantic_domain is rejected', () => {
  const r = validateClassification({ semantic_domain: 'nowhere' });
  assertFalse(r.valid);
});

test('non-array NOT_for_queries is rejected', () => {
  const r = validateClassification({ NOT_for_queries: 'oops' });
  assertFalse(r.valid);
});

test('non-array entry_purpose.target_queries rejected', () => {
  const r = validateClassification({
    entry_purpose: { target_queries: 'not an array' },
  });
  assertFalse(r.valid);
});

console.log('\nGroup: checkUpdateAgainstPurpose');
test('no purpose declared → always allowed', () => {
  const r = checkUpdateAgainstPurpose({}, { summary: 'new summary' });
  assertTrue(r.allowed);
});

test('quran_references blocked when not authorized', () => {
  const entry = { entry_purpose: { authorized_modifiers: ['clarify wording'] } };
  const r = checkUpdateAgainstPurpose(entry, { quran_references: ['2:183'] });
  assertFalse(r.allowed);
  assertTrue(r.reason.includes('sacred'));
});

test('quran_references allowed when explicitly authorized', () => {
  const entry = { entry_purpose: { authorized_modifiers: ['add quran references'] } };
  const r = checkUpdateAgainstPurpose(entry, { quran_references: ['2:183'] });
  assertTrue(r.allowed, r.reason);
});

test('forbidden_modifications mentioning a field blocks updates to it', () => {
  const entry = {
    entry_purpose: {
      forbidden_modifications: ['core definition silmek'],
    },
    summary: 'Namaz İslam\'ın beş şartından biridir. Günde beş vakit kılınır.',
  };
  // Replacement that loses the original core
  const r = checkUpdateAgainstPurpose(entry, { summary: 'Tamamen farklı tanım.' });
  assertFalse(r.allowed, 'should refuse replacement that loses core definition');
});

test('summary extension preserving core is allowed', () => {
  const entry = {
    entry_purpose: {
      forbidden_modifications: ['core definition silmek'],
    },
    summary: 'Namaz İslam\'ın beş şartından biridir.',
  };
  const r = checkUpdateAgainstPurpose(entry, {
    summary: 'Namaz İslam\'ın beş şartından biridir. Günde beş vakit kılınması farzdır.',
  });
  assertTrue(r.allowed, r.reason);
});

console.log('\nGroup: migrated KB entries pass validation');
const kbDir = join(__dirname, '..', 'data', 'ilmihal');
const MIGRATED = ['namaz_nedir', 'nifas_nedir', 'hayiz_nedir', 'istihaze_nedir',
                  'oruc_nedir', 'zekat_nedir', 'hz_ibrahim_kimdir'];
for (const id of MIGRATED) {
  test(`${id}.json passes schema validation`, () => {
    const data = JSON.parse(readFileSync(join(kbDir, `${id}.json`), 'utf8'));
    const r = validateClassification(data);
    assertTrue(r.valid, JSON.stringify(r.errors));
    assertTrue(data.entry_type, 'should have entry_type');
    assertTrue(data.semantic_domain, 'should have semantic_domain');
    assertTrue(data.entry_purpose, 'should have entry_purpose');
  });
}

console.log('\nGroup: existing un-migrated entries still validate (no false positives)');
const allFiles = readdirSync(kbDir).filter(f => f.endsWith('.json'));
let scanned = 0, problems = [];
for (const f of allFiles) {
  scanned++;
  const data = JSON.parse(readFileSync(join(kbDir, f), 'utf8'));
  const r = validateClassification(data);
  if (!r.valid) problems.push({ f, errors: r.errors });
}
test(`scanned ${scanned} KB files; zero schema errors`, () => {
  if (problems.length) {
    throw new Error(`${problems.length} entries failed: ${problems.slice(0,3).map(p=>p.f).join(', ')}`);
  }
});

console.log('\n=== Summary ===');
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);
if (fail === 0) { console.log('\n🎉 All entry_type_schema tests passed.\n'); process.exit(0); }
else { console.log('\nFailures:', failures); process.exit(1); }
