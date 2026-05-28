/**
 * KB Miss Logger
 * Logs questions that didn't match the Knowledge Base so they can be
 * added as new entries later.
 *
 * Output: server/logs/kb-misses.json
 * Daily review → decide which to add to KB
 */

const fs   = require('fs');
const path = require('path');

const LOGS_DIR      = path.join(__dirname, 'logs');
const KB_MISS_FILE  = path.join(LOGS_DIR, 'kb-misses.json');

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Load existing misses, append new one, save.
 */
function logKBMiss({ question, kbScore = 0, responseSource = 'openai_fallback', timestamp }) {
  ensureLogsDir();

  let misses = [];
  try {
    if (fs.existsSync(KB_MISS_FILE)) {
      misses = JSON.parse(fs.readFileSync(KB_MISS_FILE, 'utf8'));
      if (!Array.isArray(misses)) misses = [];
    }
  } catch (_) {
    misses = [];
  }

  // Avoid duplicate identical questions on the same day
  const today = (timestamp || new Date().toISOString()).slice(0, 10);
  const alreadyLogged = misses.some(m => m.question === question && m.date === today);
  if (alreadyLogged) return;

  misses.push({
    question,
    kbScore,
    responseSource,
    timestamp: timestamp || new Date().toISOString(),
    date: today,
    addedToKB: false,        // set to true once the entry is created
    addedToKBDate: null,
  });

  try {
    fs.writeFileSync(KB_MISS_FILE, JSON.stringify(misses, null, 2), 'utf8');
  } catch (error) {
    console.error('[kb-miss] Failed to write miss log:', error.message);
  }
}

/**
 * Get miss stats for a period
 */
function getMissStats(days = 7) {
  ensureLogsDir();
  if (!fs.existsSync(KB_MISS_FILE)) return { total: 0, pending: 0, top: [] };

  const misses = JSON.parse(fs.readFileSync(KB_MISS_FILE, 'utf8') || '[]');
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const recent = misses.filter(m => m.date >= cutoff);
  const pending = recent.filter(m => !m.addedToKB);

  // Count frequency
  const freq = {};
  pending.forEach(m => { freq[m.question] = (freq[m.question] || 0) + 1; });
  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([question, count]) => ({ question, count }));

  return { total: recent.length, pending: pending.length, top };
}

module.exports = { logKBMiss, getMissStats, KB_MISS_FILE };
