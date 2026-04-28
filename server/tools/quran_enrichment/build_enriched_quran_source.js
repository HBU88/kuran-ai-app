const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const sourcePath = path.join(repoRoot, "assets", "data", "full_quran", "source_tr_diyanet.json");
const externalTagsPath = path.join(
  repoRoot,
  "assets",
  "data",
  "full_quran",
  "enrichment",
  "ayah_tags_external.json"
);
const outputPath = path.join(repoRoot, "assets", "data", "full_quran", "source_enriched.json");
const statsPath = path.join(__dirname, "output", "enriched_quran_stats.json");

const CURATED_OVERRIDES = {
  loneliness_support: [
    { surahNumber: 2, ayahNumber: 186 },
    { surahNumber: 50, ayahNumber: 16 },
    { surahNumber: 57, ayahNumber: 4 },
    { surahNumber: 13, ayahNumber: 28 },
  ],
  repentance_support: [
    { surahNumber: 39, ayahNumber: 53 },
    { surahNumber: 2, ayahNumber: 37 },
  ],
  patience_support: [
    { surahNumber: 2, ayahNumber: 153 },
    { surahNumber: 2, ayahNumber: 250 },
    { surahNumber: 3, ayahNumber: 200 },
    { surahNumber: 103, ayahNumber: 3 },
  ],
  prophet_character: [
    { surahNumber: 33, ayahNumber: 21 },
    { surahNumber: 68, ayahNumber: 4 },
    { surahNumber: 21, ayahNumber: 107 },
    { surahNumber: 48, ayahNumber: 29 },
  ],
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.ayahs)) return value.ayahs;
  if (Array.isArray(value.records)) return value.records;
  return Object.values(value).find(Array.isArray) || [];
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function keyFor(ayah) {
  return `${toNumber(ayah?.surahNumber)}:${toNumber(ayah?.ayahNumber)}`;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function scalarToArray(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => scalarToArray(item));
  }
  const text = String(value).trim();
  return text ? [text] : [];
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => splitList(item));
  }
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    return value
      .split(/[|,;]/g)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function normalizeFields(entry) {
  const category = scalarToArray(pickFirstDefined(entry.category, entry.theme_category, entry.classification));
  const theme = scalarToArray(pickFirstDefined(entry.theme, entry.primary_theme, entry.topic, entry.use_case));
  const emotion = scalarToArray(pickFirstDefined(entry.emotion, entry.emotion_tag, entry.sentiment));
  const context = scalarToArray(pickFirstDefined(entry.context, entry.context_tag, entry.context_tags));
  const tags = splitList(pickFirstDefined(entry.tags, entry.tag, entry.labels));
  const emotionTags = splitList(pickFirstDefined(entry.emotion_tags, entry.emotionTags, entry.emotions));
  const contextTags = splitList(pickFirstDefined(entry.context_tags, entry.contextTags, entry.contexts));
  const useCases = splitList(pickFirstDefined(entry.use_cases, entry.useCases, entry.use_case));

  return {
    category,
    theme,
    emotion,
    context,
    tags,
    emotion_tags: emotionTags,
    context_tags: contextTags,
    use_cases: useCases,
  };
}

function resolveRecordKey(entry) {
  const surahNumber = toNumber(
    pickFirstDefined(
      entry.surahNumber,
      entry.surah_number,
      entry.surah,
      entry.surahId,
      entry.chapterNumber
    )
  );
  const ayahNumber = toNumber(
    pickFirstDefined(
      entry.ayahNumber,
      entry.ayah_number,
      entry.ayah,
      entry.verse,
      entry.verseNumber,
      entry.verse_number
    )
  );

  if (surahNumber && ayahNumber) {
    return `${surahNumber}:${ayahNumber}`;
  }

  const verseKey = pickFirstDefined(entry.verse_key, entry.verseKey, entry.reference, entry.ref);
  if (typeof verseKey === "string") {
    const match = verseKey.match(/(\d+)\s*:\s*(\d+)/);
    if (match) {
      return `${Number(match[1])}:${Number(match[2])}`;
    }
  }

  return null;
}

function normalizeEntry(entry) {
  const normalized = normalizeFields(entry);
  return {
    ...entry,
    tags: normalized.tags,
    emotion_tags: normalized.emotion_tags,
    context_tags: normalized.context_tags,
    use_cases: normalized.use_cases,
    category: normalized.category,
    theme: normalized.theme,
    emotion: normalized.emotion,
    context: normalized.context,
    sources: Array.isArray(entry.sources)
      ? entry.sources
          .map((item) => (item && typeof item === "object" ? item : { value: item }))
          .filter(Boolean)
      : arrayOrEmpty(entry.sources),
  };
}

function mergeUniqueArrays(...arrays) {
  const seen = new Set();
  const merged = [];
  for (const arr of arrays) {
    for (const value of arrayOrEmpty(arr)) {
      const text = typeof value === "string" ? value.trim() : String(value || "").trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      merged.push(text);
    }
  }
  return merged;
}

function mergeUniqueObjects(...arrays) {
  const seen = new Set();
  const merged = [];
  for (const arr of arrays) {
    for (const value of arrayOrEmpty(arr)) {
      if (!value || typeof value !== "object") continue;
      const key = JSON.stringify(value);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(value);
    }
  }
  return merged;
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const source = readJson(sourcePath);
  const sourceRecords = asArray(source).map((item) => ({
    ...item,
    surahNumber: toNumber(item.surahNumber),
    ayahNumber: toNumber(item.ayahNumber),
    tags: arrayOrEmpty(item.tags),
    emotion_tags: arrayOrEmpty(item.emotion_tags),
    context_tags: arrayOrEmpty(item.context_tags),
    use_cases: arrayOrEmpty(item.use_cases),
    category: scalarToArray(item.category),
    theme: scalarToArray(item.theme),
    emotion: scalarToArray(item.emotion),
    context: scalarToArray(item.context),
    sources: arrayOrEmpty(item.sources),
  }));

  const externalExists = fs.existsSync(externalTagsPath);
  const externalEntries = externalExists ? asArray(readJson(externalTagsPath)) : [];
  const externalDetectedFields = new Set();
  const externalByKey = new Map(
    externalEntries
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const key = resolveRecordKey(item);
        const normalized = normalizeEntry(item);
        for (const field of ["theme", "emotion", "category", "context", "tags", "emotion_tags", "context_tags", "use_cases"]) {
          if (Object.prototype.hasOwnProperty.call(item, field)) {
            externalDetectedFields.add(field);
          }
        }
        return [key, normalized];
      })
      .filter(([key]) => Boolean(key))
  );

  const overrideTagMap = new Map();
  for (const [useCase, refs] of Object.entries(CURATED_OVERRIDES)) {
    for (const ref of refs) {
      overrideTagMap.set(`${ref.surahNumber}:${ref.ayahNumber}`, useCase);
    }
  }

  let externallyTaggedCount = 0;
  let overrideTaggedCount = 0;
  let missingExternalTagsCount = 0;

  const enriched = sourceRecords.map((ayah) => {
    const key = keyFor(ayah);
    const external = externalByKey.get(key) || null;
    const hasExternal = Boolean(external);
    if (hasExternal) {
      externallyTaggedCount += 1;
    } else {
      missingExternalTagsCount += 1;
    }

    const overrideUseCase = overrideTagMap.get(key) || null;
    if (overrideUseCase) {
      overrideTaggedCount += 1;
    }

    const mergedTags = mergeUniqueArrays(
      ayah.tags,
      external?.tags,
      external?.theme ? [external.theme] : [],
      overrideUseCase ? [overrideUseCase] : []
    );
    const mergedEmotionTags = mergeUniqueArrays(
      ayah.emotion_tags,
      external?.emotion_tags,
      external?.emotion ? [external.emotion] : []
    );
    const mergedContextTags = mergeUniqueArrays(
      ayah.context_tags,
      external?.context_tags,
      external?.context ? [external.context] : []
    );
    const mergedUseCases = mergeUniqueArrays(
      ayah.use_cases,
      external?.use_cases,
      overrideUseCase ? [overrideUseCase] : []
    );

    return {
      ...ayah,
      tags: mergedTags,
      emotion_tags: mergedEmotionTags,
      context_tags: mergedContextTags,
      use_cases: mergedUseCases,
      category: mergeUniqueArrays(ayah.category, external?.category),
      theme: mergeUniqueArrays(ayah.theme, external?.theme),
      emotion: mergeUniqueArrays(ayah.emotion, external?.emotion),
      context: mergeUniqueArrays(ayah.context, external?.context),
      sources: mergeUniqueObjects(
        ayah.sources,
        external?.sources,
        external
          ? [
              {
                source: "external",
                reference: key,
              },
            ]
          : []
      ),
    };
  });

  const sampleMatchedRecords = enriched
    .filter((ayah) => ayah.tags.length || ayah.emotion_tags.length || ayah.context_tags.length || ayah.use_cases.length)
    .slice(0, 5)
    .map((ayah) => ({
      reference: `${ayah.surahNumber}:${ayah.ayahNumber}`,
      tags: ayah.tags.slice(0, 5),
      emotion_tags: ayah.emotion_tags.slice(0, 5),
      context_tags: ayah.context_tags.slice(0, 5),
      use_cases: ayah.use_cases.slice(0, 5),
    }));
  const sampleMissingRecords = enriched
    .filter((ayah) => ayah.tags.length === 0 && ayah.emotion_tags.length === 0 && ayah.context_tags.length === 0 && ayah.use_cases.length === 0)
    .slice(0, 5)
    .map((ayah) => `${ayah.surahNumber}:${ayah.ayahNumber}`);

  const stats = {
    total_ayahs: enriched.length,
    externally_tagged_count: externallyTaggedCount,
    override_tagged_count: overrideTaggedCount,
    missing_external_tags_count: missingExternalTagsCount,
    matched_percentage: enriched.length ? Number(((externallyTaggedCount / enriched.length) * 100).toFixed(2)) : 0,
    sample_matched_records: sampleMatchedRecords,
    sample_missing_records: sampleMissingRecords,
    external_dataset_detected_fields: [...externalDetectedFields].sort(),
    external_dataset_total_records: externalEntries.length,
    unmatched_external_records_count: Math.max(0, externalEntries.length - externallyTaggedCount),
  };

  writeJson(outputPath, enriched);
  writeJson(statsPath, stats);

  console.log(`Wrote enriched Quran source to ${outputPath}`);
  console.log(`Wrote enrichment stats to ${statsPath}`);
  console.log(JSON.stringify(stats, null, 2));
}

main();
