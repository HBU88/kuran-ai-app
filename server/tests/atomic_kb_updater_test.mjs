/**
 * Unit tests for AtomicKBUpdater (Guardrail #3).
 *
 * Uses a temporary KB sandbox so we never touch real data.
 * Run: node server/tests/atomic_kb_updater_test.mjs
 */

import { createRequire } from 'module';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const require = createRequire(import.meta.url);
const { AtomicKBUpdater } = require('../agent/atomic_kb_updater.js');

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (err) { fail++; failures.push({ name, err: err.message }); console.log(`  ❌ ${name}\n     ${err.message}`); }
}
function assertEq(a,b,m){ if(a!==b) throw new Error(`${m||''} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
function assertTrue(v,m){ if(!v) throw new Error(m||'expected truthy'); }
function assertFalse(v,m){ if(v) throw new Error(m||'expected falsy'); }

// ---- sandbox -------------------------------------------------------------
const sandbox = mkdtempSync(join(tmpdir(), 'hakai-akb-'));
const kbDir = join(sandbox, 'kb');
const backupDir = join(sandbox, 'backups');
import { mkdirSync } from 'fs';
mkdirSync(kbDir, { recursive: true });

function seed(id, data) {
  writeFileSync(join(kbDir, `${id}.json`), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function readDisk(id) {
  return JSON.parse(readFileSync(join(kbDir, `${id}.json`), 'utf8'));
}

const updater = new AtomicKBUpdater({ kbDir, backupDir });

console.log('\n=== AtomicKBUpdater tests ===\n');

console.log('Group: happy path');
test('updateEntry merges fields and persists to disk', async () => {
  seed('plain_entry', { id: 'plain_entry', title: 'Plain', keywords: ['a'] });
  const r = await updater.updateEntry('plain_entry', { summary: 'new', keywords: ['a', 'b'] });
  assertTrue(r.success, r.reason);
  assertEq(r.stage, 'done');
  const on_disk = readDisk('plain_entry');
  assertEq(on_disk.summary, 'new');
  assertEq(on_disk.keywords.length, 2);
  assertTrue(existsSync(r.backupPath), 'backup should exist');
});

test('untouched fields are preserved', async () => {
  seed('preserve', { id: 'preserve', title: 'T', category: 'x', custom: 42 });
  const r = await updater.updateEntry('preserve', { summary: 's' });
  assertTrue(r.success);
  const d = readDisk('preserve');
  assertEq(d.custom, 42);
  assertEq(d.category, 'x');
});

console.log('\nGroup: rejections');
test('missing entry returns load-stage failure', async () => {
  const r = await updater.updateEntry('does_not_exist', { a: 1 });
  assertFalse(r.success);
  assertEq(r.stage, 'load');
});

test('rejects invalid id', async () => {
  const r = await updater.updateEntry('', { a: 1 });
  assertFalse(r.success);
});

test('rejects when updates would break required field', async () => {
  seed('require_test', { id: 'require_test', title: 'T' });
  const r = await updater.updateEntry('require_test', { title: '' });
  assertFalse(r.success);
  assertEq(r.stage, 'validate');
  // Original on disk must be intact
  const d = readDisk('require_test');
  assertEq(d.title, 'T');
});

test('rejects when classification becomes invalid', async () => {
  seed('cls_test', { id: 'cls_test', title: 'T' });
  const r = await updater.updateEntry('cls_test', { entry_type: 'made_up_type' });
  assertFalse(r.success);
  assertEq(r.stage, 'validate');
  const d = readDisk('cls_test');
  assertFalse('entry_type' in d, 'bad write should not have happened');
});

console.log('\nGroup: purpose-contract enforcement');
test('respects entry_purpose forbidden_modifications on summary', async () => {
  seed('protected', {
    id: 'protected',
    title: 'Protected',
    summary: 'Original core definition that must be preserved verbatim.',
    entry_purpose: {
      forbidden_modifications: ['core definition silmek'],
    },
  });
  const r = await updater.updateEntry('protected', { summary: 'Completely different.' });
  assertFalse(r.success);
  assertEq(r.stage, 'purpose');
  const d = readDisk('protected');
  assertTrue(d.summary.includes('Original core'), 'file untouched');
});

test('extending summary while preserving core is allowed', async () => {
  seed('extend', {
    id: 'extend',
    title: 'E',
    summary: 'Namaz İslam\'ın beş şartından biridir.',
    entry_purpose: { forbidden_modifications: ['core definition silmek'] },
  });
  const r = await updater.updateEntry('extend', {
    summary: 'Namaz İslam\'ın beş şartından biridir. Günde beş vakit kılınır.',
  });
  assertTrue(r.success, r.reason);
});

test('sacred-content field blocked when not authorized', async () => {
  seed('sacred', {
    id: 'sacred',
    title: 'S',
    entry_purpose: { authorized_modifiers: ['clarify wording'] },
  });
  const r = await updater.updateEntry('sacred', { quran_references: ['2:183'] });
  assertFalse(r.success);
  assertEq(r.stage, 'purpose');
});

console.log('\nGroup: rollback');
test('rollback restores previous content', async () => {
  seed('rollback_test', { id: 'rollback_test', title: 'V1', tag: 'one' });
  const r = await updater.updateEntry('rollback_test', { tag: 'two' });
  assertTrue(r.success);
  assertEq(readDisk('rollback_test').tag, 'two');

  const back = updater.rollback('rollback_test', r.backupPath);
  assertTrue(back.success, back.reason);
  assertEq(readDisk('rollback_test').tag, 'one');
});

test('rollback returns error for missing backup', () => {
  const r = updater.rollback('anything', '/tmp/does/not/exist.json');
  assertFalse(r.success);
});

console.log('\nGroup: KB-wide integrity verification');
test('verifyAll returns ok for clean sandbox', () => {
  // Reset sandbox to known-clean state
  seed('vall1', { id: 'vall1', title: 'A' });
  seed('vall2', { id: 'vall2', title: 'B' });
  const r = updater.verifyAll();
  assertTrue(r.ok, JSON.stringify(r.errors));
  assertTrue(r.scanned >= 2);
});

test('verifyAll catches a corrupted file', () => {
  writeFileSync(join(kbDir, 'broken.json'), '{ not valid json', 'utf8');
  const r = updater.verifyAll();
  assertFalse(r.ok);
  assertTrue(r.errors.some(e => e.file === 'broken.json'));
  // Cleanup so subsequent runs aren't polluted
  rmSync(join(kbDir, 'broken.json'));
});

// ---- cleanup -------------------------------------------------------------
process.on('exit', () => {
  try { rmSync(sandbox, { recursive: true, force: true }); } catch {}
});

console.log('\n=== Summary ===');
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);
if (fail === 0) { console.log('\n🎉 All atomic_kb_updater tests passed.\n'); process.exit(0); }
else { console.log('\nFailures:', failures); process.exit(1); }
