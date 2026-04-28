const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const outputPath = path.join(repoRoot, "assets", "data", "full_quran", "enrichment", "ayah_tags_ontology.json");
const statsPath = path.join(__dirname, "output", "quranic_corpus_ontology_build_stats.json");

const ALLOWLIST = [
  "allah",
  "islam",
  "quran",
  "mercy",
  "forgiveness",
  "repentance",
  "patience",
  "prayer",
  "guidance",
  "faith",
  "belief",
  "disbelief",
  "hypocrites",
  "prophets",
  "muhammad",
  "moses",
  "jesus",
  "abraham",
  "afterlife",
  "paradise",
  "hell",
  "justice",
  "charity",
  "fasting",
];

const BASE_URL = "https://corpus.quran.com";
const SEARCH_URL = (concept) => `${BASE_URL}/search.jsp?q=${encodeURIComponent(`con:${concept}`)}`;
const CONCEPT_URL = (concept) => `${BASE_URL}/concept.jsp?id=${encodeURIComponent(concept)}`;
const REQUEST_DELAY_MS = 350;

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractConceptLabel(html, fallback) {
  const titleMatch = html.match(/<h2[^>]*>(.*?)<\/h2>/i);
  if (titleMatch) {
    return cleanText(titleMatch[1]).replace(/\(.*/, "").trim() || fallback;
  }
  const nameMatch = html.match(/<td class="name">([^<]+)<\/td>/i);
  if (nameMatch) {
    return cleanText(nameMatch[1]) || fallback;
  }
  return fallback;
}

function extractVerseRefs(html) {
  const refs = new Set();
  const regex = /\b(\d+):(\d+):(\d+)\b/g;
  let match;
  while ((match = regex.exec(html))) {
    refs.add(`${Number(match[1])}:${Number(match[2])}`);
  }
  return [...refs];
}

function mergeRecord(map, verseKey, conceptLabel, conceptId, sourceUrl) {
  const [surahNumber, ayahNumber] = verseKey.split(":").map(Number);
  if (!map.has(verseKey)) {
    map.set(verseKey, {
      surahNumber,
      ayahNumber,
      theme: [],
      emotion: [],
      category: ["ontology"],
      context: [],
      tags: [],
      use_cases: [],
      sources: [],
    });
  }

  const item = map.get(verseKey);
  if (!item.tags.includes(conceptLabel)) {
    item.tags.push(conceptLabel);
  }
  if (!item.use_cases.includes(conceptLabel)) {
    item.use_cases.push(conceptLabel);
  }

  const sourceSignature = JSON.stringify({ concept: conceptLabel, concept_id: conceptId, url: sourceUrl });
  const existing = new Set(item.sources.map((source) => JSON.stringify(source)));
  if (!existing.has(sourceSignature)) {
    item.sources.push({
      name: "Quranic Arabic Corpus Ontology",
      concept: conceptLabel,
      concept_id: conceptId,
      url: sourceUrl,
    });
  }
}

async function inspectConcept(conceptId) {
  const searchUrl = SEARCH_URL(conceptId);
  const conceptUrl = CONCEPT_URL(conceptId);
  const warnings = [];
  let conceptHtml = "";
  let searchHtml = "";
  try {
    conceptHtml = await fetchText(conceptUrl);
  } catch (error) {
    warnings.push(`concept fetch failed for ${conceptId}: ${error.message}`);
  }
  try {
    searchHtml = await fetchText(searchUrl);
  } catch (error) {
    warnings.push(`search fetch failed for ${conceptId}: ${error.message}`);
  }

  const label = conceptHtml ? extractConceptLabel(conceptHtml, conceptId) : conceptId;
  const verseRefs = searchHtml ? extractVerseRefs(searchHtml) : [];
  return {
    conceptId,
    label,
    searchUrl,
    conceptUrl,
    verseRefs,
    warnings,
  };
}

async function main() {
  const allWarnings = [];
  const skippedConcepts = [];
  const fetchedConcepts = [];
  const recordsByVerse = new Map();
  const conceptCounts = [];

  for (const conceptId of ALLOWLIST) {
    try {
      const result = await inspectConcept(conceptId);
      if (!result.verseRefs.length) {
        skippedConcepts.push(conceptId);
        allWarnings.push(`No verse references found for ${conceptId}`);
      } else {
        fetchedConcepts.push(conceptId);
        conceptCounts.push({ concept: result.label, concept_id: conceptId, verse_count: result.verseRefs.length });
        for (const verseKey of result.verseRefs) {
          mergeRecord(recordsByVerse, verseKey, result.label, conceptId, result.searchUrl);
        }
      }
      if (result.warnings.length) {
        allWarnings.push(...result.warnings);
      }
    } catch (error) {
      skippedConcepts.push(conceptId);
      allWarnings.push(`Failed to inspect ${conceptId}: ${error.message}`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const records = [...recordsByVerse.values()].sort((a, b) => a.surahNumber - b.surahNumber || a.ayahNumber - b.ayahNumber);
  writeJson(outputPath, records);

  const topConceptsByVerseCount = conceptCounts
    .sort((a, b) => b.verse_count - a.verse_count || a.concept.localeCompare(b.concept, "tr"))
    .slice(0, 10);

  const stats = {
    allowlisted_concepts_count: ALLOWLIST.length,
    fetched_concepts_count: fetchedConcepts.length,
    skipped_concepts: skippedConcepts,
    total_records: records.length,
    verse_level_matches: records.length,
    coverage_percentage_against_6236: Number(((records.length / 6236) * 100).toFixed(2)),
    top_concepts_by_verse_count: topConceptsByVerseCount,
    warnings: allWarnings,
  };

  writeJson(statsPath, stats);
  console.log(`Wrote ontology tags to ${outputPath}`);
  console.log(`Wrote build stats to ${statsPath}`);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
