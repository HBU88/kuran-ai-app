#!/usr/bin/env node
/**
 * SEMANTIC COLLISION DETECTOR
 * Identifies keyword overlaps and routing confusion risks
 */

const fs = require('fs');
const path = require('path');

const ILMIHAL_DIR = path.join(__dirname, 'data/ilmihal');
const OUTPUT_FILE = path.join(__dirname, 'logs/semantic-collisions.json');

// Common Islamic terms + structural question words that legitimately appear in many entries
const LEGITIMATE_OVERLAPS = [
  'ibadet', 'namaz', 'oruç', 'zekat', 'dua', 'abdest',
  'haram', 'halal', 'farz', 'vacip', 'sünnet', 'müstehap',
  'kaza', 'fikh', 'şeriat', 'dini', 'müslüman', 'kadın',
  'erkek', 'günah', 'sevap', 'hadis', 'kuran', 'ayet',
  // Structural question words (legitimate in many titles)
  'nedir', 'nasil', 'yapilir', 'alinir', 'edilir', 'kilinir',
  'nedir', 'midir', 'makna', 'anlami', 'tanimlar',
  'kaideler', 'hukumleri', 'kurallar', 'surecler'
];

function normalizeTerm(term) {
  return term.toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .trim();
}

function extractKeywords(entry) {
  const keywords = new Set();

  // From title (single word tokens, >3 chars)
  if (entry.title) {
    entry.title.split(/\s+/).forEach(word => {
      const cleaned = word.replace(/[?!.,]/g, '').trim();
      if (cleaned.length > 3) keywords.add(normalizeTerm(cleaned));
    });
  }

  // From summary (single tokens, >4 chars)
  if (entry.summary) {
    entry.summary.split(/\s+/).forEach(word => {
      const cleaned = word.replace(/[?!.,;:]/g, '').trim();
      if (cleaned.length > 4 && !LEGITIMATE_OVERLAPS.includes(normalizeTerm(cleaned))) {
        keywords.add(normalizeTerm(cleaned));
      }
    });
  }

  // From keywords array (exact match, >3 chars)
  if (Array.isArray(entry.keywords)) {
    entry.keywords.forEach(kw => {
      const normalized = normalizeTerm(kw);
      if (normalized.length > 3) keywords.add(normalized);
    });
  }

  // From manual_semantic_descriptions
  if (Array.isArray(entry.manual_semantic_descriptions)) {
    entry.manual_semantic_descriptions.forEach(desc => {
      desc.split(/\s+/).forEach(word => {
        const cleaned = word.replace(/[?!.,;:]/g, '').trim();
        if (cleaned.length > 4 && !LEGITIMATE_OVERLAPS.includes(normalizeTerm(cleaned))) {
          keywords.add(normalizeTerm(cleaned));
        }
      });
    });
  }

  return Array.from(keywords);
}

function loadAllEntries() {
  const files = fs.readdirSync(ILMIHAL_DIR).filter(f => f.endsWith('.json'));
  const entries = {};

  files.forEach(file => {
    const filePath = path.join(ILMIHAL_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    entries[content.id] = {
      ...content,
      filename: file,
      keywords_extracted: extractKeywords(content)
    };
  });

  return entries;
}

function detectCollisions(entries) {
  const entryList = Object.values(entries);
  const collisions = [];

  // Real collision detection: look for SPECIFIC topic keywords in OTHER entries' content
  entryList.forEach((entry, idx) => {
    const entryRisks = [];

    // Extract specific keywords from this entry's ID and title
    const idTopics = entry.id.split('_').filter(w => w.length > 3);
    const titleTopics = entry.title
      .replace(/[?]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4 && !LEGITIMATE_OVERLAPS.includes(normalizeTerm(w)))
      .map(normalizeTerm);

    const specificKeywords = new Set([...idTopics, ...titleTopics]);

    // Check all OTHER entries for mentions of these specific keywords
    entryList.forEach((otherEntry, otherIdx) => {
      if (idx === otherIdx) return;

      // Look for specific keywords in other entry's content
      const otherSummary = (otherEntry.summary || '').toLowerCase();
      const otherDescs = (otherEntry.manual_semantic_descriptions || [])
        .join(' ')
        .toLowerCase();
      const otherContent = otherSummary + ' ' + otherDescs;

      const foundKeywords = Array.from(specificKeywords).filter(kw =>
        otherContent.includes(kw)
      );

      if (foundKeywords.length > 0) {
        // This is a real collision: other entry mentions this entry's specific topic
        entryRisks.push({
          entry: otherEntry.id,
          shared_keywords: foundKeywords,
          reason: `"${otherEntry.id}" mentions this entry's topic: ${foundKeywords.join(', ')}`
        });
      }
    });

    if (entryRisks.length > 0) {
      // Only flag if there's meaningful pollution
      const relevantRisks = entryRisks.filter(r => r.shared_keywords.length > 0);
      if (relevantRisks.length > 0) {
        collisions.push({
          entry: entry.id,
          category: entry.category,
          problematic_keywords: Array.from(new Set(
            relevantRisks.flatMap(r => r.shared_keywords)
          )),
          collision_count: relevantRisks.length,
          collisions_with: relevantRisks,
          severity: 'WARNING'
        });
      }
    }
  });

  return collisions.sort((a, b) => b.collision_count - a.collision_count);
}

function ensureLogsDir() {
  const logsDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function main() {
  console.log('🔍 Scanning KB entries for semantic collisions...\n');

  const entries = loadAllEntries();
  console.log(`📚 Loaded ${Object.keys(entries).length} KB entries\n`);

  const collisions = detectCollisions(entries);

  ensureLogsDir();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(collisions, null, 2), 'utf8');

  // Summary report
  const critical = collisions.filter(c => c.severity === 'CRITICAL');
  const warnings = collisions.filter(c => c.severity === 'WARNING');

  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 SEMANTIC COLLISION REPORT');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`🔴 CRITICAL COLLISIONS: ${critical.length}`);
  console.log(`🟡 WARNING COLLISIONS: ${warnings.length}`);
  console.log(`✅ CLEAN ENTRIES: ${Object.keys(entries).length - collisions.length}\n`);

  if (critical.length > 0) {
    console.log('🔴 CRITICAL ISSUES (require fix):\n');
    critical.forEach((c, i) => {
      console.log(`${i + 1}. "${c.entry}"`);
      console.log(`   Keywords: ${c.problematic_keywords.join(', ')}`);
      c.collisions_with.forEach(col => {
        if (col.risk_level === 'HIGH') {
          console.log(`   ⚠️  Collides with "${col.entry}": ${col.reason}`);
        }
      });
      console.log();
    });
  }

  if (warnings.length > 0 && warnings.length <= 10) {
    console.log('🟡 WARNING ISSUES (monitor):\n');
    warnings.slice(0, 5).forEach((w, i) => {
      console.log(`${i + 1}. "${w.entry}"`);
      console.log(`   Keywords: ${w.problematic_keywords.join(', ')}`);
      w.collisions_with.slice(0, 2).forEach(col => {
        console.log(`   → Collides with "${col.entry}"`);
      });
      console.log();
    });
    if (warnings.length > 5) {
      console.log(`   ... and ${warnings.length - 5} more\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`📁 Full report: server/logs/semantic-collisions.json`);
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(critical.length > 0 ? 1 : 0);
}

main();
