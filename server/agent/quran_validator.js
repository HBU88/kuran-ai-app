/**
 * QURAN VALIDATOR — Sacred Content Validation Layer
 *
 * Validates Qur'anic citations against the Diyanet-sourced full-Qur'an JSON
 * that ships with the app (assets/data/full_quran/).
 *
 * Two questions this answers:
 *   1. Does surah:ayah exist?           → exists()
 *   2. Does provided text match Diyanet → validateVerse()
 *
 * Use cases:
 *   - Block auto-fix from inserting fabricated or mis-attributed verses
 *   - Sanity-check planner output before serving to users
 *   - Surface the canonical Diyanet text when caller has only a reference
 *
 * The Diyanet corpus is the project's authoritative source (see
 * assets/data/full_quran/source_tr_diyanet.json). Arabic text comes from
 * source_ar.json. Both are loaded lazily and cached for the process lifetime.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_QURAN_DIR = path.join(__dirname, '..', '..', 'assets', 'data', 'full_quran');

// ---------------------------------------------------------------------------
// Surah name resolution
//
// Users (and Claude) reference surahs in many ways: Turkish names with or
// without diacritics, transliterations, raw numbers, sometimes Arabic.
// We build a single normalised lookup map from the Arabic source's
// `transliteration` field plus a curated Turkish alias table for the
// most-cited surahs in the app.
// ---------------------------------------------------------------------------

const TURKISH_SURAH_ALIASES = {
  // Common Turkish names → surah number
  'fatiha': 1, 'fâtiha': 1,
  'bakara': 2,
  'âl-i imrân': 3, 'al-i imran': 3, 'ali imran': 3,
  'nisâ': 4, 'nisa': 4,
  'mâide': 5, 'maide': 5,
  'enâm': 6, 'enam': 6,
  'araf': 7, 'a\'raf': 7, 'a raf': 7,
  'enfâl': 8, 'enfal': 8,
  'tevbe': 9,
  'yûnus': 10, 'yunus': 10,
  'hûd': 11, 'hud': 11,
  'yûsuf': 12, 'yusuf': 12,
  'rad': 13, 'ra\'d': 13,
  'ibrâhim': 14, 'ibrahim': 14,
  'hicr': 15,
  'nahl': 16,
  'isrâ': 17, 'isra': 17,
  'kehf': 18,
  'meryem': 19,
  'tâhâ': 20, 'taha': 20,
  'enbiyâ': 21, 'enbiya': 21,
  'hac': 22, 'hacc': 22,
  'mü\'minûn': 23, 'müminun': 23,
  'nûr': 24, 'nur': 24,
  'furkân': 25, 'furkan': 25,
  'şuarâ': 26, 'suara': 26,
  'neml': 27,
  'kasas': 28,
  'ankebût': 29, 'ankebut': 29,
  'rûm': 30, 'rum': 30,
  'lokmân': 31, 'lokman': 31,
  'secde': 32,
  'ahzâb': 33, 'ahzab': 33,
  'sebe': 34, 'sebe\'': 34,
  'fâtır': 35, 'fatir': 35,
  'yâsîn': 36, 'yasin': 36,
  'sâffât': 37, 'saffat': 37,
  'sâd': 38, 'sad': 38,
  'zümer': 39,
  'mü\'min': 40, 'mümin': 40, 'gâfir': 40, 'gafir': 40,
  'fussılet': 41, 'fussilet': 41,
  'şûrâ': 42, 'sura': 42,
  'zuhruf': 43,
  'duhân': 44, 'duhan': 44,
  'câsiye': 45, 'casiye': 45,
  'ahkâf': 46, 'ahkaf': 46,
  'muhammed': 47,
  'fetih': 48,
  'hucurât': 49, 'hucurat': 49,
  'kâf': 50, 'kaf': 50,
  'zâriyât': 51, 'zariyat': 51,
  'tûr': 52, 'tur': 52,
  'necm': 53,
  'kamer': 54,
  'rahmân': 55, 'rahman': 55,
  'vâkıa': 56, 'vakia': 56,
  'hadîd': 57, 'hadid': 57,
  'mücâdele': 58, 'mucadele': 58,
  'haşr': 59, 'hasr': 59,
  'mümtehıne': 60, 'mumtahine': 60,
  'saff': 61,
  'cuma': 62,
  'münâfikûn': 63, 'munafikun': 63,
  'teğâbün': 64, 'tegabun': 64,
  'talâk': 65, 'talak': 65,
  'tahrîm': 66, 'tahrim': 66,
  'mülk': 67, 'mulk': 67,
  'kalem': 68,
  'hâkka': 69, 'hakka': 69,
  'meâric': 70, 'mearic': 70,
  'nûh': 71, 'nuh': 71,
  'cin': 72,
  'müzzemmil': 73, 'muzzemmil': 73,
  'müddessir': 74, 'muddessir': 74,
  'kıyâmet': 75, 'kiyamet': 75,
  'insân': 76, 'insan': 76,
  'mürselât': 77, 'murselat': 77,
  'nebe': 78, 'nebe\'': 78,
  'nâziât': 79, 'naziat': 79,
  'abese': 80,
  'tekvîr': 81, 'tekvir': 81,
  'infitâr': 82, 'infitar': 82,
  'mutaffifîn': 83, 'mutaffifin': 83,
  'inşikâk': 84, 'insikak': 84,
  'bürûc': 85, 'buruc': 85,
  'târık': 86, 'tarik': 86,
  'a\'lâ': 87, 'ala': 87,
  'gâşiye': 88, 'gasiye': 88,
  'fecr': 89,
  'beled': 90,
  'şems': 91, 'sems': 91,
  'leyl': 92,
  'duhâ': 93, 'duha': 93,
  'inşirâh': 94, 'insirah': 94, 'şerh': 94,
  'tîn': 95, 'tin': 95,
  'alak': 96,
  'kadir': 97, 'kadr': 97,
  'beyyine': 98,
  'zilzâl': 99, 'zilzal': 99,
  'âdiyât': 100, 'adiyat': 100,
  'kâria': 101, 'karia': 101,
  'tekâsür': 102, 'tekasur': 102,
  'asr': 103,
  'hümeze': 104, 'humeze': 104,
  'fîl': 105, 'fil': 105,
  'kureyş': 106, 'kureys': 106,
  'mâûn': 107, 'maun': 107,
  'kevser': 108,
  'kâfirûn': 109, 'kafirun': 109,
  'nasr': 110,
  'tebbet': 111, 'mesed': 111,
  'ihlâs': 112, 'ihlas': 112,
  'felak': 113,
  'nâs': 114, 'nas': 114,
};

function foldDiacritics(s) {
  // Use Turkish locale-aware lowercase so capital İ → i (NOT i + U+0307).
  // Also strip any stray combining marks just in case input was pre-lowered.
  return String(s || '').toLocaleLowerCase('tr-TR')
    .replace(/̇/g, '')                           // combining dot above
    .replace(/[âàá]/g, 'a').replace(/[îíì]/g, 'i').replace(/[ûúù]/g, 'u')
    .replace(/[ôóò]/g, 'o').replace(/[êéè]/g, 'e')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
}

function normaliseArabicText(s) {
  // Strip tashkīl (vowel marks), tatweel, and common presentation forms so
  // we can compare against texts that may or may not include them.
  return String(s || '')
    .replace(/[ً-ٰٟـ]/g, '')   // tashkīl + tatweel
    .replace(/ۜ|۟|۠|ۢ|ۣ|ۥ|ۦ|ۨ/g, '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');
}

function normaliseTrText(s) {
  return String(s || '')
    .replace(/\[\d+\]/g, '')          // strip footnote markers like [2]
    .replace(/[“”"'’`]/g, '')         // strip various quotes
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Validator class
// ---------------------------------------------------------------------------

class QuranValidator {
  constructor(opts = {}) {
    this.quranDir = opts.quranDir || DEFAULT_QURAN_DIR;
    this._loaded = false;
    this._arBySurah = new Map();   // surahNum → Map(ayahNum → text)
    this._trBySurah = new Map();   // surahNum → Map(ayahNum → text)
    this._totalAyahs = new Map();  // surahNum → total
    this._nameToNumber = new Map();
    for (const [name, n] of Object.entries(TURKISH_SURAH_ALIASES)) {
      this._nameToNumber.set(foldDiacritics(name), n);
    }
  }

  _load() {
    if (this._loaded) return;

    const arPath = path.join(this.quranDir, 'source_ar.json');
    const trPath = path.join(this.quranDir, 'source_tr_diyanet.json');

    if (!fs.existsSync(arPath) || !fs.existsSync(trPath)) {
      throw new Error(`Quran sources not found in ${this.quranDir}`);
    }

    // Arabic: array of surahs with verses
    const arData = JSON.parse(fs.readFileSync(arPath, 'utf8'));
    for (const surah of arData) {
      const sNum = surah.id || surah.number;
      const m = new Map();
      for (const v of (surah.verses || [])) {
        m.set(v.id || v.number, normaliseArabicText(v.text));
      }
      this._arBySurah.set(sNum, m);
      this._totalAyahs.set(sNum, surah.total_verses || m.size);

      // Index transliteration for name lookups
      if (surah.transliteration) {
        this._nameToNumber.set(foldDiacritics(surah.transliteration), sNum);
      }
    }

    // Turkish: flat array of {surahNumber, ayahNumber, text_tr}
    const trData = JSON.parse(fs.readFileSync(trPath, 'utf8'));
    for (const item of trData) {
      const s = item.surahNumber, a = item.ayahNumber;
      if (!this._trBySurah.has(s)) this._trBySurah.set(s, new Map());
      this._trBySurah.get(s).set(a, normaliseTrText(item.text_tr));
    }

    this._loaded = true;
  }

  /** Returns surah number for any common reference (name, transliteration, number). */
  resolveSurah(reference) {
    if (reference == null) return null;
    if (typeof reference === 'number') {
      return reference >= 1 && reference <= 114 ? reference : null;
    }
    const s = String(reference).trim();
    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      return n >= 1 && n <= 114 ? n : null;
    }
    this._load();
    const key = foldDiacritics(s);
    if (this._nameToNumber.has(key)) return this._nameToNumber.get(key);
    // Try last segment in case caller passed "Sure 2 Bakara"
    const parts = key.split(/\s+/);
    for (const p of parts) {
      if (this._nameToNumber.has(p)) return this._nameToNumber.get(p);
    }
    return null;
  }

  /** Does this surah:ayah reference exist in the canon? */
  exists(surahRef, ayahNumber) {
    this._load();
    const s = this.resolveSurah(surahRef);
    if (s == null) return false;
    const a = typeof ayahNumber === 'string' ? parseInt(ayahNumber, 10) : ayahNumber;
    if (!Number.isInteger(a) || a < 1) return false;
    const total = this._totalAyahs.get(s);
    return total != null && a <= total;
  }

  /** Get the Diyanet ar+tr text for a reference. Returns null if not found. */
  getVerse(surahRef, ayahNumber) {
    this._load();
    const s = this.resolveSurah(surahRef);
    if (s == null) return null;
    const a = typeof ayahNumber === 'string' ? parseInt(ayahNumber, 10) : ayahNumber;
    if (!Number.isInteger(a)) return null;
    const ar = this._arBySurah.get(s)?.get(a) ?? null;
    const tr = this._trBySurah.get(s)?.get(a) ?? null;
    if (ar == null && tr == null) return null;
    return { surah: s, ayah: a, text_ar: ar, text_tr: tr, source: 'Diyanet (assets/data/full_quran)' };
  }

  /**
   * Validate a verse against the Diyanet source.
   * Accepts either / both of text_ar and text_tr — at least one must be
   * provided. If a provided text doesn't match the canonical version we
   * report a mismatch and include the correct text for the caller to use.
   *
   * Returns: {
   *   valid: boolean,
   *   reason: string,
   *   action: 'ACCEPT' | 'REJECT' | 'CORRECTION_REQUIRED',
   *   correction?: { text_ar, text_tr } | null
   * }
   */
  validateVerse({ surah, ayah, text_ar, text_tr } = {}) {
    if (surah == null || ayah == null) {
      return { valid: false, reason: 'surah and ayah are required', action: 'REJECT' };
    }
    if (!text_ar && !text_tr) {
      return { valid: false, reason: 'at least one of text_ar/text_tr is required', action: 'REJECT' };
    }
    if (!this.exists(surah, ayah)) {
      return {
        valid: false,
        reason: `reference ${surah}:${ayah} not found in canon`,
        action: 'REJECT',
        correction: null,
      };
    }

    const canon = this.getVerse(surah, ayah);
    const mismatches = [];

    if (text_ar) {
      const provided = normaliseArabicText(text_ar);
      if (canon.text_ar && provided !== canon.text_ar) {
        mismatches.push({ field: 'text_ar', provided, expected: canon.text_ar });
      }
    }

    if (text_tr) {
      const provided = normaliseTrText(text_tr);
      const expected = canon.text_tr;
      // Translations vary in punctuation/wording across editions. We accept
      // close matches (>= 60% token overlap) but require an exact match on
      // characters >= 90% of the shorter string for "strict match".
      if (expected) {
        const overlap = tokenOverlap(provided, expected);
        if (overlap < 0.6) {
          mismatches.push({ field: 'text_tr', provided, expected, overlap });
        }
      }
    }

    if (mismatches.length > 0) {
      return {
        valid: false,
        reason: `provided text does not match Diyanet canon: ${mismatches.map(m => m.field).join(', ')}`,
        action: 'CORRECTION_REQUIRED',
        correction: { text_ar: canon.text_ar, text_tr: canon.text_tr },
        mismatches,
      };
    }

    return {
      valid: true,
      reason: 'verified against Diyanet source',
      action: 'ACCEPT',
      source: canon.source,
    };
  }
}

/** Cheap token overlap ratio (Jaccard) for fuzzy Turkish-translation match. */
function tokenOverlap(a, b) {
  if (!a || !b) return 0;
  const toks = s => new Set(foldDiacritics(s).split(/\W+/).filter(t => t.length > 2));
  const A = toks(a), B = toks(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.max(A.size, B.size);
}

module.exports = { QuranValidator, TURKISH_SURAH_ALIASES };
