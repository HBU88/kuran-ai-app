#!/usr/bin/env node
/**
 * Migration: add entry_type / semantic_domain / entry_purpose / NOT_for_queries
 * to a curated set of high-traffic KB entries.
 *
 * Idempotent: re-running on an already-migrated entry only adds missing
 * fields; it never overwrites existing markers.
 *
 * Backup: each modified file gets a `.bak.<timestamp>` sibling so the
 * change can be reverted manually if needed.
 *
 * Usage:
 *   node server/scripts/migrate_entry_markers.mjs           # apply
 *   node server/scripts/migrate_entry_markers.mjs --dry-run # preview
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = join(__dirname, '..', 'data', 'ilmihal');
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Marker registry: keyed by entry id. Add new entries here as you migrate.
// ---------------------------------------------------------------------------
const MARKERS = {
  namaz_nedir: {
    entry_type: 'definition',
    entry_subtypes: ['worship_definition'],
    semantic_domain: 'worship',
    entry_purpose: {
      primary_objective: 'Namaz ibadetinin tanımını ve İslam\'daki yerini açıklamak',
      target_queries: [
        'namaz nedir',
        'namaz ne demek',
        'namazın tanımı',
        'salat nedir',
      ],
      must_include: [
        'beş vakit farz olduğu',
        'İslam\'ın beş şartından olduğu',
        'temel tanım',
      ],
      must_NOT_include: [
        'namaz kılınamayacak özel durumlar (hayız, nifas vb.) — ayrı entry\'lerde',
        'namazın nasıl kılındığının adım adım anlatımı — namaz_nasil_kilinir entry\'sinde',
      ],
      authorized_modifiers: [
        'tanımı netleştirmek',
        'tarihsel/Kur\'ani referans eklemek',
        'kelime anahtarlarını zenginleştirmek',
      ],
      forbidden_modifications: [
        'core definition\'ı silmek veya değiştirmek',
        'negation pattern eklemek',
        'farziyet ifadesini zayıflatmak',
      ],
    },
    NOT_for_queries: ['hayız', 'nifas', 'istihaze', 'kılınmaz', 'nasıl kılınır'],
    conflicting_entries: ['namaz_nasil_kilinir', 'hayiz_nedir', 'nifas_nedir'],
  },

  nifas_nedir: {
    entry_type: 'condition',
    entry_subtypes: ['physiological_state', 'worship_restriction'],
    semantic_domain: 'physiological_states',
    entry_purpose: {
      primary_objective: 'Lohusalık (nifas) halinin tanımı ve dini hükümlerini açıklamak',
      target_queries: ['nifas nedir', 'lohusalık', 'doğum sonrası dini durum'],
      must_include: ['lohusalık tanımı', 'süre', 'temizlik ve ibadet hükümleri'],
      must_NOT_include: [
        'namazın genel tanımı',
        'orucun genel tanımı',
      ],
      authorized_modifiers: ['açıklığı artırmak', 'kaynak/referans eklemek'],
      forbidden_modifications: [
        'genel namaz/oruç tanımı eklemek',
        'core hüküm beyanını zayıflatmak',
      ],
    },
    NOT_for_queries: ['namaz nedir', 'oruç nedir'],
    conflicting_entries: ['namaz_nedir', 'oruc_nedir', 'hayiz_nedir', 'istihaze_nedir'],
  },

  hayiz_nedir: {
    entry_type: 'condition',
    entry_subtypes: ['physiological_state', 'worship_restriction'],
    semantic_domain: 'physiological_states',
    entry_purpose: {
      primary_objective: 'Hayız (adet) halinin tanımı ve dini hükümlerini açıklamak',
      target_queries: ['hayız nedir', 'adet hali', 'menstrüasyon dini hüküm'],
      must_include: ['tanım', 'süre', 'ibadet ve temizlik hükümleri'],
      must_NOT_include: ['namazın/orucun genel tanımı'],
      authorized_modifiers: ['açıklığı artırmak', 'kaynak eklemek'],
      forbidden_modifications: ['core hükmü zayıflatmak', 'genel ibadet tanımı eklemek'],
    },
    NOT_for_queries: ['namaz nedir', 'oruç nedir'],
    conflicting_entries: ['namaz_nedir', 'oruc_nedir', 'nifas_nedir', 'istihaze_nedir'],
  },

  istihaze_nedir: {
    entry_type: 'condition',
    entry_subtypes: ['physiological_state'],
    semantic_domain: 'physiological_states',
    entry_purpose: {
      primary_objective: 'İstihaze (özür kanı) halinin tanımı ve hayız/nifastan farkını açıklamak',
      target_queries: ['istihaze nedir', 'özür kanı', 'sürekli kanama dini hüküm'],
      must_include: ['tanım', 'hayız/nifastan farkı', 'ibadete engel olmadığı'],
      must_NOT_include: ['genel namaz/oruç tanımı'],
      authorized_modifiers: ['açıklığı artırmak', 'fark/karşılaştırma eklemek'],
      forbidden_modifications: ['core hüküm beyanını zayıflatmak'],
    },
    NOT_for_queries: ['namaz nedir', 'oruç nedir'],
    conflicting_entries: ['hayiz_nedir', 'nifas_nedir'],
  },

  oruc_nedir: {
    entry_type: 'definition',
    entry_subtypes: ['worship_definition'],
    semantic_domain: 'worship',
    entry_purpose: {
      primary_objective: 'Orucun tanımı ve İslam\'daki yerini açıklamak',
      target_queries: ['oruç nedir', 'oruç ne demek', 'siyam nedir'],
      must_include: ['Ramazan orucunun farziyeti', 'imsak-iftar arası tanımı'],
      must_NOT_include: [
        'oruç tutulamayacak durumlar — ayrı entry\'lerde',
        'fidye/kaza ayrıntıları — ayrı entry\'lerde',
      ],
      authorized_modifiers: ['tanımı netleştirmek', 'Kur\'ani referans eklemek'],
      forbidden_modifications: [
        'core definition\'ı silmek',
        'farziyeti zayıflatmak',
        'negation pattern eklemek',
      ],
    },
    NOT_for_queries: ['hayız', 'nifas', 'oruç tutulmaz'],
    conflicting_entries: ['adetliyken_oruc_kazasi', 'oruc_fidyesi', 'oruc_kazasi'],
  },

  zekat_nedir: {
    entry_type: 'definition',
    entry_subtypes: ['worship_definition', 'finance'],
    semantic_domain: 'finance_and_trade',
    entry_purpose: {
      primary_objective: 'Zekatın tanımı, farziyeti ve İslam\'daki yerini açıklamak',
      target_queries: ['zekat nedir', 'zekat ne demek'],
      must_include: ['farz olduğu', 'temel tanım', 'amaç (mal temizleme)'],
      must_NOT_include: [
        'nisap miktarı detayları — zekat_nisap_nedir entry\'sinde',
        'kime verileceği — zekat_kime_verilir entry\'sinde',
      ],
      authorized_modifiers: ['tanımı netleştirmek', 'referans eklemek'],
      forbidden_modifications: ['core definition\'ı değiştirmek', 'farziyeti zayıflatmak'],
    },
    NOT_for_queries: ['kimlere verilir', 'nisap', 'fitre'],
    conflicting_entries: ['zekat_nisap_nedir', 'zekat_kime_verilir', 'fitre_nedir'],
  },

  hz_ibrahim_kimdir: {
    entry_type: 'biography',
    entry_subtypes: ['prophet', 'ulu-l azm', 'father_of_prophets'],
    semantic_domain: 'people_and_prophets',
    entry_purpose: {
      primary_objective: 'Hz. İbrahim peygamberin kim olduğunu, hayatı ve önemini açıklamak',
      target_queries: [
        'Hz. İbrahim kim',
        'Hz. İbrahim kimdir',
        'İbrahim Peygamber',
        'Halilullah',
      ],
      must_include: [
        'peygamberlik kimliği',
        'ulu-l azm peygamberlerden olduğu',
        'Halilullah lakabı',
      ],
      must_NOT_include: [
        'Kurban Bayramı namazının nasıl kılındığı — ayrı entry',
        'Hac ritüellerinin detayı — ayrı entry',
      ],
      authorized_modifiers: ['biyografik detay eklemek', 'referans eklemek'],
      forbidden_modifications: [
        'peygamberlik kimliğini değiştirmek',
        'isim/lakap silmek',
      ],
    },
    NOT_for_queries: [
      'bayram namazı nasıl kılınır',
      'kurban kesimi nasıl yapılır',
      'hac nasıl yapılır',
    ],
    conflicting_entries: ['bayram_namazi_nedir', 'bayram_namazi_nasil_kilinir', 'kurban_nedir'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadEntry(id) {
  const p = join(KB_DIR, `${id}.json`);
  if (!existsSync(p)) return { path: p, exists: false };
  return { path: p, exists: true, data: JSON.parse(readFileSync(p, 'utf8')) };
}

function backupAndWrite(p, data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  copyFileSync(p, `${p}.bak.${ts}`);
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return `${p}.bak.${ts}`;
}

function applyMarkers(entry, markers) {
  // Only add fields that are missing — never overwrite existing values.
  const next = { ...entry };
  let added = 0;
  for (const [k, v] of Object.entries(markers)) {
    if (!(k in next)) {
      next[k] = v;
      added += 1;
    }
  }
  return { next, added };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
console.log(`\n=== Entry-marker migration ${DRY_RUN ? '(dry-run)' : ''} ===\n`);

let migrated = 0, skipped = 0, missing = 0, alreadyDone = 0;

for (const [id, markers] of Object.entries(MARKERS)) {
  const { path: p, exists, data } = loadEntry(id);
  if (!exists) {
    console.log(`  ⚠️  ${id}: file not found — skipped`);
    missing += 1;
    continue;
  }

  const { next, added } = applyMarkers(data, markers);
  if (added === 0) {
    console.log(`  ✓  ${id}: already migrated (no new fields)`);
    alreadyDone += 1;
    continue;
  }

  if (DRY_RUN) {
    console.log(`  →  ${id}: would add ${added} field(s): ${Object.keys(markers).filter(k => !(k in data)).join(', ')}`);
    skipped += 1;
  } else {
    const backup = backupAndWrite(p, next);
    console.log(`  ✅ ${id}: added ${added} field(s)  (backup: ${backup.split('/').pop()})`);
    migrated += 1;
  }
}

console.log('\n=== Summary ===');
console.log(`  Migrated:        ${migrated}`);
console.log(`  Already done:    ${alreadyDone}`);
console.log(`  Would migrate:   ${skipped} (dry-run)`);
console.log(`  Missing files:   ${missing}`);
console.log('');
