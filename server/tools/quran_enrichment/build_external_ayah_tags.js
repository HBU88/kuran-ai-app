const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const outputDir = path.join(__dirname, "output");
const discoveryReportPath = path.join(outputDir, "external_source_discovery_report.json");
const buildStatsPath = path.join(outputDir, "external_dataset_build_stats.json");
const externalTagsOutputPath = path.join(
  repoRoot,
  "assets",
  "data",
  "full_quran",
  "enrichment",
  "ayah_tags_external.json"
);

const SOURCES = [
  {
    source_name: "Quranpedia topics API",
    source_url: "https://api.quranpedia.net/v1/topics",
    license: null,
    available_format: "REST JSON",
    verse_level_references: true,
    reference_format: "surah:ayah string in ayahs field",
    useful_fields: ["name", "parent_id", "ayahs"],
    merge_safety: "safe",
    reason:
      "Direct verse-linked topics are exposed via ayahs strings, so this can be normalized safely to surahNumber:ayahNumber.",
    importer: "quranpedia_topics",
  },
  {
    source_name: "Quran Analysis (karimouda/qurananalysis)",
    source_url: "https://github.com/karimouda/qurananalysis",
    license: "GPL-3.0",
    available_format: "GitHub repository with ontology/data files and website resources",
    verse_level_references: true,
    reference_format: "Concept pages expose verse lists; repo also references ontology resources",
    useful_fields: ["ontology concepts", "verse list", "concept relations", "topic index"],
    merge_safety: "partial",
    reason:
      "The project contains a Quran ontology and verse-list references, but the public repo does not expose a clean machine-readable verse-topic export to import safely without a dedicated parser.",
    importer: null,
  },
  {
    source_name: "Quran Foundation Content API",
    source_url: "https://api-docs.quran.com/docs/content_apis_versioned/",
    license: "Not clearly stated in docs",
    available_format: "REST JSON / SDK",
    verse_level_references: true,
    reference_format: "verseKey chapter:verse for verse endpoints",
    useful_fields: ["verseKey", "translations", "tafsirs", "word metadata"],
    merge_safety: "unsafe",
    reason:
      "The docs provide verse-level content APIs, but no safe semantic topic mapping endpoint was identified in the candidate scope.",
    importer: null,
  },
  {
    source_name: "Quranic Arabic Corpus ontology",
    source_url: "https://corpus.quran.com/concept.jsp?id=quran",
    license: "GNU Public License",
    available_format: "HTML concept pages / ontology concept index",
    verse_level_references: true,
    reference_format: "Verse List links and concept pages with chapter:verse references",
    useful_fields: ["concept names", "verse list", "concept map", "ontology relations"],
    merge_safety: "partial",
    reason:
      "Concept pages include verse references, but they are HTML/ontology pages rather than a stable thematic JSON export. Safe import would require a dedicated parser and curation step.",
    importer: null,
  },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function normalizeVerseKey(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(\d+)\s*:\s*(\d+)/);
  return match ? `${Number(match[1])}:${Number(match[2])}` : null;
}

function splitAyahList(value) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => normalizeVerseKey(item.trim()))
    .filter(Boolean);
}

function makeSourceRecord({ verseKey, topicName, sourceName, sourceUrl, parentId, topicId }) {
  const [surahNumber, ayahNumber] = verseKey.split(":").map(Number);
  return {
    surahNumber,
    ayahNumber,
    theme: [],
    emotion: [],
    category: [],
    context: [],
    tags: [topicName],
    use_cases: [topicName],
    sources: [
      {
        source: sourceName,
        source_url: sourceUrl,
        reference: verseKey,
        topic_name: topicName,
        topic_id: topicId ?? null,
        parent_id: parentId,
      },
    ],
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function buildQuranpediaTopics() {
  const source = await fetchJson("https://api.quranpedia.net/v1/topics");
  const topics = Array.isArray(source) ? source : [];
  const byId = new Map(topics.filter(Boolean).map((topic) => [topic.id, topic]));

  const records = [];
  for (const topic of topics) {
    const ayahKeys = splitAyahList(topic.ayahs);
    for (const verseKey of ayahKeys) {
      records.push(
        makeSourceRecord({
          verseKey,
          topicName: String(topic.name || "").trim(),
          sourceName: "Quranpedia topics API",
          sourceUrl: "https://api.quranpedia.net/v1/topics",
          parentId: topic.parent_id ?? null,
          topicId: topic.id ?? null,
        })
      );
    }
  }

  return {
    records,
    byId,
    totalTopics: topics.length,
  };
}

async function main() {
  const discoveryReport = SOURCES.map(({ importer, ...rest }) => ({
    ...rest,
    source_status: importer ? "usable" : "discovery-only",
  }));

  let quranpediaResult = null;
  const usedSources = [];
  const skippedSources = [];
  const tagsBySource = {};
  let inferredEmotionCount = 0;
  let verseLevelMatches = 0;
  let externalDatasetTotalRecords = 0;
  let coveragePercentage = 0;
  let matchedRecords = [];

  try {
    quranpediaResult = await buildQuranpediaTopics();
    const seen = new Map();
    for (const record of quranpediaResult.records) {
      const sourceMeta = Array.isArray(record.sources) ? record.sources[0] || {} : {};
      const verseKey = `${record.surahNumber}:${record.ayahNumber}`;
      if (!seen.has(verseKey)) {
        seen.set(verseKey, {
          surahNumber: record.surahNumber,
          ayahNumber: record.ayahNumber,
          theme: [],
          emotion: [],
          category: [],
          context: [],
          tags: [],
          use_cases: [],
          sources: [],
        });
      }
      const existing = seen.get(verseKey);
      existing.tags = Array.from(new Set([...(existing.tags || []), ...(record.tags || [])]));
      existing.use_cases = Array.from(new Set([...(existing.use_cases || []), ...(record.use_cases || [])]));
      existing.sources = Array.from(
        new Set(
          [...(existing.sources || []), ...(record.sources || [])].map((item) =>
            JSON.stringify({
              source: item.source || "",
              source_url: item.source_url || "",
              reference: item.reference || "",
              topic_name: item.topic_name || "",
              topic_id: item.topic_id ?? null,
              parent_id: item.parent_id ?? null,
            })
          )
        )
      ).map((item) => JSON.parse(item));
    }
    matchedRecords = Array.from(seen.values());
    verseLevelMatches = matchedRecords.length;
    externalDatasetTotalRecords = quranpediaResult.totalTopics;
    tagsBySource["Quranpedia topics API"] = verseLevelMatches;
    usedSources.push("Quranpedia topics API");
    skippedSources.push(
      "Quran Analysis (partial, no safe machine-readable topic export in repo)",
      "Quran Foundation Content API (no safe semantic topic mapping endpoint identified)",
      "Quranic Arabic Corpus ontology (HTML concept pages, parser required)"
    );
    coveragePercentage = Number(((verseLevelMatches / 6236) * 100).toFixed(2));
  } catch (error) {
    skippedSources.push(
      "Quranpedia topics API (fetch failed)",
      "Quran Analysis (partial, no safe machine-readable topic export in repo)",
      "Quran Foundation Content API (no safe semantic topic mapping endpoint identified)",
      "Quranic Arabic Corpus ontology (HTML concept pages, parser required)"
    );
    matchedRecords = [];
    externalDatasetTotalRecords = 0;
    coveragePercentage = 0;
  }

  const stats = {
    total_records: matchedRecords.length,
    sources_used: usedSources,
    sources_skipped: skippedSources,
    verse_level_matches: verseLevelMatches,
    coverage_percentage: coveragePercentage,
    tags_by_source: tagsBySource,
    inferred_emotion_count: inferredEmotionCount,
    external_dataset_total_records: externalDatasetTotalRecords,
  };

  writeJson(discoveryReportPath, discoveryReport);
  writeJson(buildStatsPath, stats);
  writeJson(externalTagsOutputPath, matchedRecords);

  console.log(`Discovery report written to ${discoveryReportPath}`);
  console.log(`External tag dataset written to ${externalTagsOutputPath}`);
  console.log(`Build stats written to ${buildStatsPath}`);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
