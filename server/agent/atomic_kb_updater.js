/**
 * ATOMIC KB UPDATER — Guardrail #3
 *
 * Provides all-or-nothing write semantics for KB entries with:
 *   1. Pre-write backup
 *   2. Purpose-contract validation (Guardrail #2)
 *   3. Schema validation
 *   4. Atomic file write (tmpfile + rename)
 *   5. Post-write integrity verification
 *   6. Auto-rollback on any failure
 *
 * Why atomic write matters:
 *   The auto-fix pipeline can otherwise leave a corrupted half-written
 *   JSON on disk if the process is killed mid-write. The rename trick
 *   ensures the file either contains the old or the new content — never
 *   a torn write.
 *
 * Usage:
 *   const updater = new AtomicKBUpdater();
 *   const result = await updater.updateEntry('namaz_nedir', {
 *     keywords: [...existing, 'new keyword'],
 *   });
 *   if (!result.success) console.error(result.reason);
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  validateClassification,
  checkUpdateAgainstPurpose,
} = require('./entry_type_schema');

const DEFAULT_KB_DIR = path.join(__dirname, '..', 'data', 'ilmihal');
const DEFAULT_BACKUP_DIR = path.join(__dirname, '..', 'data', '_kb_backups');

/**
 * Minimum required fields for a KB entry to be considered structurally
 * valid. We intentionally keep this small — the schema validator from
 * Guardrail #2 covers the richer rules.
 */
const REQUIRED_FIELDS = ['id', 'title'];

class AtomicKBUpdater {
  constructor(opts = {}) {
    this.kbDir = opts.kbDir || DEFAULT_KB_DIR;
    this.backupDir = opts.backupDir || DEFAULT_BACKUP_DIR;
    this.skipBackup = opts.skipBackup === true; // tests can opt-out
    if (!this.skipBackup && !fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // ---- Filesystem primitives ---------------------------------------------

  _entryPath(id) {
    return path.join(this.kbDir, `${id}.json`);
  }

  _backupPath(id, label = 'pre-write') {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const rnd = crypto.randomBytes(3).toString('hex');
    return path.join(this.backupDir, `${id}.${label}.${ts}.${rnd}.json`);
  }

  _readEntry(id) {
    const p = this._entryPath(id);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  /**
   * Atomic write: serialize → tmpfile → rename. POSIX guarantees the
   * rename is atomic when src+dst are on the same filesystem.
   */
  _atomicWrite(targetPath, data) {
    const serialised = JSON.stringify(data, null, 2) + '\n';
    const tmp = `${targetPath}.tmp.${crypto.randomBytes(4).toString('hex')}`;
    fs.writeFileSync(tmp, serialised, 'utf8');
    fs.renameSync(tmp, targetPath);
  }

  _backup(id) {
    if (this.skipBackup) return null;
    const src = this._entryPath(id);
    if (!fs.existsSync(src)) return null;
    const dst = this._backupPath(id);
    fs.copyFileSync(src, dst);
    return dst;
  }

  _restore(id, backupPath) {
    if (!backupPath || !fs.existsSync(backupPath)) return false;
    const dst = this._entryPath(id);
    fs.copyFileSync(backupPath, dst);
    return true;
  }

  // ---- Validation --------------------------------------------------------

  _hasRequiredFields(entry) {
    const missing = REQUIRED_FIELDS.filter(f => !entry || entry[f] === undefined || entry[f] === null || entry[f] === '');
    return { ok: missing.length === 0, missing };
  }

  /**
   * Verify file on disk is parseable and structurally valid. Used after
   * the write to make sure nothing was corrupted.
   */
  _verifyOnDisk(id) {
    try {
      const data = this._readEntry(id);
      if (!data) return { ok: false, reason: 'file disappeared after write' };
      const reqs = this._hasRequiredFields(data);
      if (!reqs.ok) return { ok: false, reason: `missing required fields: ${reqs.missing.join(', ')}` };
      const cls = validateClassification(data);
      if (!cls.valid) return { ok: false, reason: `classification invalid: ${cls.errors.join('; ')}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: `JSON parse failed: ${err.message}` };
    }
  }

  // ---- Public API --------------------------------------------------------

  /**
   * Update an entry by shallow-merging `updates` into the current contents.
   *
   * Pipeline:
   *   1. Load current entry (must exist).
   *   2. Check proposed updates against entry_purpose (Guardrail #2).
   *   3. Take backup.
   *   4. Build merged entry; validate classification on the merged result.
   *   5. Atomic write.
   *   6. Re-read from disk and verify integrity.
   *   7. If anything fails after backup → restore.
   *
   * Returns:
   *   {
   *     success: boolean,
   *     reason: string,
   *     stage: 'load' | 'purpose' | 'validate' | 'write' | 'verify',
   *     entryId, backupPath
   *   }
   */
  async updateEntry(id, updates) {
    if (!id || typeof id !== 'string') {
      return { success: false, reason: 'id must be a non-empty string', stage: 'load' };
    }
    if (!updates || typeof updates !== 'object') {
      return { success: false, reason: 'updates must be an object', stage: 'load' };
    }

    // Stage 1: Load current
    const current = this._readEntry(id);
    if (!current) {
      return { success: false, reason: `entry "${id}" not found`, stage: 'load', entryId: id };
    }

    // Stage 2: Purpose-contract check
    const purposeCheck = checkUpdateAgainstPurpose(current, updates);
    if (!purposeCheck.allowed) {
      return {
        success: false,
        reason: `entry_purpose violation: ${purposeCheck.reason}`,
        stage: 'purpose',
        entryId: id,
      };
    }

    // Stage 3: Backup BEFORE we touch anything
    const backupPath = this._backup(id);

    // Stage 4: Build merged entry and pre-validate
    const merged = { ...current, ...updates };
    const reqs = this._hasRequiredFields(merged);
    if (!reqs.ok) {
      // No write happened — backup is safety net for future, current file untouched
      return {
        success: false,
        reason: `merged entry missing required fields: ${reqs.missing.join(', ')}`,
        stage: 'validate',
        entryId: id,
        backupPath,
      };
    }
    const cls = validateClassification(merged);
    if (!cls.valid) {
      return {
        success: false,
        reason: `merged entry fails schema: ${cls.errors.join('; ')}`,
        stage: 'validate',
        entryId: id,
        backupPath,
      };
    }

    // Stage 5: Atomic write
    try {
      this._atomicWrite(this._entryPath(id), merged);
    } catch (err) {
      // Write failed — restore (defensive; atomic write either succeeds or leaves original)
      this._restore(id, backupPath);
      return {
        success: false,
        reason: `write failed: ${err.message}; rolled back`,
        stage: 'write',
        entryId: id,
        backupPath,
      };
    }

    // Stage 6: Post-write verification
    const verify = this._verifyOnDisk(id);
    if (!verify.ok) {
      this._restore(id, backupPath);
      return {
        success: false,
        reason: `post-write verification failed: ${verify.reason}; rolled back`,
        stage: 'verify',
        entryId: id,
        backupPath,
      };
    }

    return {
      success: true,
      reason: 'atomic update completed and verified',
      stage: 'done',
      entryId: id,
      backupPath,
    };
  }

  /**
   * Restore an entry from a specific backup file.
   * Useful when deploy detects a regression and wants to roll back manually.
   */
  rollback(id, backupPath) {
    if (!this._restore(id, backupPath)) {
      return { success: false, reason: 'backup not found or unreadable' };
    }
    const verify = this._verifyOnDisk(id);
    return { success: verify.ok, reason: verify.ok ? 'rolled back' : `rollback file invalid: ${verify.reason}` };
  }

  /**
   * Verify KB-wide integrity: every file is parseable + passes schema.
   * Returns a summary suitable for deployment gates.
   */
  verifyAll() {
    const files = fs.readdirSync(this.kbDir).filter(f => f.endsWith('.json'));
    const errors = [];
    for (const f of files) {
      const p = path.join(this.kbDir, f);
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        const reqs = this._hasRequiredFields(data);
        if (!reqs.ok) errors.push({ file: f, error: `missing: ${reqs.missing.join(', ')}` });
        const cls = validateClassification(data);
        if (!cls.valid) errors.push({ file: f, error: cls.errors.join('; ') });
      } catch (err) {
        errors.push({ file: f, error: `JSON parse: ${err.message}` });
      }
    }
    return { ok: errors.length === 0, scanned: files.length, errors };
  }
}

module.exports = { AtomicKBUpdater };
