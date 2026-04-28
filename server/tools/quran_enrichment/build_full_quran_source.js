const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const sourceArPath = path.join(repoRoot, 'assets', 'data', 'full_quran', 'source_ar.json');
const sourceTrDiyanetPath = path.join(repoRoot, 'assets', 'data', 'full_quran', 'source_tr_diyanet.json');
const sourceTrPath = path.join(repoRoot, 'assets', 'data', 'full_quran', 'source_tr.json');
const outputPath = path.join(repoRoot, 'assets', 'data', 'full_quran', 'source.json');
const statsPath = path.join(__dirname, 'output', 'full_quran_source_stats.json');

const NESTED_KEYS = ['verses', 'ayahs', 'aya', 'items'];
const TOP_LEVEL_ARRAY_KEYS = ['data', 'surahs', 'chapters', 'quran', 'items'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveTurkishSourcePath() {
  if (fs.existsSync(sourceTrDiyanetPath)) {
    return sourceTrDiyanetPath;
  }

  return sourceTrPath;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function asArray(root) {
  if (Array.isArray(root)) {
    return root;
  }

  if (!root || typeof root !== 'object') {
    return [];
  }

  for (const key of TOP_LEVEL_ARRAY_KEYS) {
    if (Array.isArray(root[key])) {
      return root[key];
    }
  }

  const arrayValues = Object.values(root).filter(Array.isArray);
  if (arrayValues.length === 1) {
    return arrayValues[0];
  }

  return [];
}

function detectSchemaType(collection) {
  if (!Array.isArray(collection) || collection.length === 0) {
    return 'unknown';
  }

  const hasNestedRecords = collection.some((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }

    return NESTED_KEYS.some((key) => Array.isArray(item[key]));
  });

  return hasNestedRecords ? 'surah-level' : 'ayah-level';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSurahName(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function getRecordText(record, side) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  if (side === 'ar') {
    return pickFirstDefined(
      record.text_ar,
      record.arabic,
      record.text,
      record.translation,
      record.tr
    );
  }

  return pickFirstDefined(
    record.text_tr,
    record.translation,
    record.turkish,
    record.tr,
    record.text
  );
}

function getSurahNameFromMeta(record, side) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  if (side === 'tr') {
    return normalizeSurahName(
      pickFirstDefined(record.translation, record.surahName, record.name, record.transliteration, record.surah)
    );
  }

  return normalizeSurahName(
    pickFirstDefined(record.surahName, record.name, record.transliteration, record.translation, record.surah)
  );
}

function getNestedRecords(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  for (const key of NESTED_KEYS) {
    if (Array.isArray(entry[key])) {
      return entry[key];
    }
  }

  const arrayValues = Object.entries(entry)
    .filter(([, value]) => Array.isArray(value))
    .map(([, value]) => value);

  if (arrayValues.length === 1) {
    return arrayValues[0];
  }

  return null;
}

function flattenSource(source, side) {
  const root = asArray(source);
  const schemaType = detectSchemaType(root);
  const flattened = [];
  const duplicates = [];
  const seen = new Set();

  for (const entry of root) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const surahNumber = toNumber(
      pickFirstDefined(entry.surahNumber, entry.suraNumber, entry.chapterNumber, entry.id)
    );
    const surahName = getSurahNameFromMeta(entry, side);
    const nested = getNestedRecords(entry);

    if (Array.isArray(nested)) {
      for (const verse of nested) {
        if (!verse || typeof verse !== 'object') {
          continue;
        }

        const ayahNumber = toNumber(
          pickFirstDefined(verse.ayahNumber, verse.ayah, verse.aya, verse.verseNumber, verse.id)
        );
        if (!surahNumber || !ayahNumber) {
          continue;
        }

        const key = `${surahNumber}:${ayahNumber}`;
        if (seen.has(key)) {
          duplicates.push(key);
          continue;
        }
        seen.add(key);

        const record = {
          surahName,
          surahNumber,
          ayahNumber
        };

        const verseText = getRecordText(verse, side);
        if (side === 'ar') {
          record.text_ar = verseText;
        } else {
          record.text_tr = verseText;
        }

        flattened.push(record);
      }
      continue;
    }

    const ayahNumber = toNumber(
      pickFirstDefined(entry.ayahNumber, entry.ayah, entry.aya, entry.verseNumber, entry.id)
    );
    if (!surahNumber || !ayahNumber) {
      continue;
    }

    const key = `${surahNumber}:${ayahNumber}`;
    if (seen.has(key)) {
      duplicates.push(key);
      continue;
    }
    seen.add(key);

    const record = {
      surahName,
      surahNumber,
      ayahNumber
    };

    const verseText = getRecordText(entry, side);
    if (side === 'ar') {
      record.text_ar = verseText;
    } else {
      record.text_tr = verseText;
    }

    flattened.push(record);
  }

  return {
    schemaType,
    flattened,
    duplicates
  };
}

function mergeSources(arRecords, trRecords) {
  const mergedMap = new Map();
  const missingAr = [];
  const missingTr = [];
  const duplicateKeys = new Set();

  for (const record of arRecords) {
    const key = `${record.surahNumber}:${record.ayahNumber}`;
    if (mergedMap.has(key)) {
      duplicateKeys.add(key);
    }
    const existing = mergedMap.get(key) || {
      surahName: record.surahName || null,
      surahNumber: record.surahNumber,
      ayahNumber: record.ayahNumber
    };
    existing.surahName = existing.surahName || record.surahName || null;
    existing.text_ar = record.text_ar ?? existing.text_ar ?? null;
    mergedMap.set(key, existing);
  }

  for (const record of trRecords) {
    const key = `${record.surahNumber}:${record.ayahNumber}`;
    if (mergedMap.has(key) && mergedMap.get(key).text_tr !== undefined) {
      duplicateKeys.add(key);
    }

    const existing = mergedMap.get(key) || {
      surahName: record.surahName || null,
      surahNumber: record.surahNumber,
      ayahNumber: record.ayahNumber
    };
    existing.surahName = record.surahName || existing.surahName || null;
    existing.text_tr = record.text_tr ?? existing.text_tr ?? null;
    mergedMap.set(key, existing);
  }

  const keys = Array.from(mergedMap.keys()).sort((a, b) => {
    const [aSurah, aAyah] = a.split(':').map(Number);
    const [bSurah, bAyah] = b.split(':').map(Number);
    return aSurah - bSurah || aAyah - bAyah;
  });

  const merged = [];
  for (const key of keys) {
    const item = mergedMap.get(key);
    if (!item.text_ar) {
      missingAr.push(key);
    }
    if (!item.text_tr) {
      missingTr.push(key);
    }

    merged.push({
      id: merged.length + 1,
      surahName: item.surahName || null,
      surahNumber: item.surahNumber,
      ayahNumber: item.ayahNumber,
      text_ar: item.text_ar || null,
      text_tr: item.text_tr || null
    });
  }

  return {
    merged,
    missingAr,
    missingTr,
    duplicateKeys: Array.from(duplicateKeys)
  };
}

function main() {
  const resolvedSourceTrPath = resolveTurkishSourcePath();

  if (!fs.existsSync(sourceArPath) || !fs.existsSync(resolvedSourceTrPath)) {
    console.log('Missing source files.');
    console.log(`Expected: ${sourceArPath}`);
    console.log(`Expected: ${sourceTrDiyanetPath}`);
    console.log(`Fallback: ${sourceTrPath}`);
    console.log('Create surah-level or ayah-level JSON exports before running this builder.');
    process.exitCode = 0;
    return;
  }

  const sourceAr = readJson(sourceArPath);
  const sourceTr = readJson(resolvedSourceTrPath);

  const arInfo = flattenSource(sourceAr, 'ar');
  const trInfo = flattenSource(sourceTr, 'tr');
  const mergeInfo = mergeSources(arInfo.flattened, trInfo.flattened);

  writeJson(outputPath, mergeInfo.merged);
  writeJson(statsPath, {
    detected_ar_schema_type: arInfo.schemaType,
    detected_tr_schema_type: trInfo.schemaType,
    total_ar_records: asArray(sourceAr).length,
    total_tr_records: asArray(sourceTr).length,
    flattened_ar_records: arInfo.flattened.length,
    flattened_tr_records: trInfo.flattened.length,
    merged_records: mergeInfo.merged.length,
    missing_ar_count: mergeInfo.missingAr.length,
    missing_tr_count: mergeInfo.missingTr.length,
    duplicate_key_count: mergeInfo.duplicateKeys.length,
    sample_missing_keys: mergeInfo.missingAr.slice(0, 10),
    sample_duplicate_keys: mergeInfo.duplicateKeys.slice(0, 10)
  });

  const sample = mergeInfo.merged.find(
    (record) => record.surahNumber === 5 && record.ayahNumber === 3
  );

  console.log(`detected_ar_schema_type=${arInfo.schemaType}`);
  console.log(`detected_tr_schema_type=${trInfo.schemaType}`);
  console.log(`turkish_source=${resolvedSourceTrPath}`);
  console.log(`flattened_ar_records=${arInfo.flattened.length}`);
  console.log(`flattened_tr_records=${trInfo.flattened.length}`);
  console.log(`merged_records=${mergeInfo.merged.length}`);
  if (sample) {
    console.log(`sample_5_3=${sample.surahName} ${sample.surahNumber}:${sample.ayahNumber}`);
  }
}

main();
