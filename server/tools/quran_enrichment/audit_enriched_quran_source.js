const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const externalPath = path.join(repoRoot, "assets", "data", "full_quran", "enrichment", "ayah_tags_external.json");
const enrichedPath = path.join(repoRoot, "assets", "data", "full_quran", "source_enriched.json");
const auditReportPath = path.join(__dirname, "output", "enriched_quran_audit_report.json");
const auditSamplesPath = path.join(__dirname, "output", "enriched_quran_audit_samples.json");

const REQUIRED_FIELDS = ["surahNumber", "ayahNumber", "theme", "emotion", "category", "context", "tags", "use_cases"];
const MANUAL_OVERRIDES = {
  loneliness_support: [
    "2:186",
    "50:16",
    "57:4",
    "13:28",
  ],
  repentance_support: [
    "39:53",
    "2:37",
  ],
  patience_support: [
    "2:153",
    "2:250",
    "3:200",
    "103:3",
  ],
  prophet_character: [
    "33:21",
    "68:4",
    "21:107",
    "48:29",
  ],
};

const SAMPLE_TOPICS = [
  "loneliness",
  "repentance",
  "patience",
  "prophet",
  "prayer",
  "fear",
  "mercy",
  "guidance",
  "afterlife",
  "justice",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function keyFor(item) {
  return `${Number(item?.surahNumber)}:${Number(item?.ayahNumber)}`;
}

function isArray(value) {
  return Array.isArray(value);
}

function topTags(records, limit = 50) {
  const counts = new Map();
  for (const record of records) {
    for (const tag of record.tags || []) {
      const key = String(tag).trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

function detectDuplicateTags(tags) {
  const normalized = tags.map((tag) => String(tag).trim());
  const duplicates = [];
  const seen = new Map();
  for (const tag of normalized) {
    const key = tag.toLocaleLowerCase("tr-TR");
    if (!seen.has(key)) {
      seen.set(key, tag);
      continue;
    }
    if (seen.get(key) !== tag) {
      duplicates.push({ first: seen.get(key), duplicate: tag });
    }
  }
  return duplicates;
}

function suspiciousGenericTags(tags) {
  const generic = new Set([
    "general",
    "misc",
    "other",
    "topic",
    "verse",
    "quran",
    "islam",
    "religion",
    "faith",
    "emotion",
    "tag",
    "use_case",
    "support",
  ]);
  return tags.filter((tag) => generic.has(String(tag).trim().toLowerCase()));
}

function strangeCharacters(tags) {
  return tags.filter((tag) => /[^\p{Script=Latin}\p{Script=Arabic}\p{N}\s.,;:'"()\-_/&\[\]]/u.test(String(tag)));
}

function casingInconsistencies(tags) {
  const groups = new Map();
  for (const tag of tags) {
    const key = String(tag).trim().toLocaleLowerCase("tr-TR");
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(String(tag).trim());
  }
  return [...groups.entries()]
    .filter(([, variants]) => variants.size > 1)
    .map(([key, variants]) => ({ normalized: key, variants: [...variants] }));
}

function inferThemeBucket(item) {
  const blob = [
    item.theme,
    item.emotion,
    item.category,
    item.context,
    ...(item.tags || []),
    ...(item.use_cases || []),
  ]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  for (const topic of SAMPLE_TOPICS) {
    if (blob.includes(topic)) return topic;
  }
  return null;
}

function main() {
  const external = fs.existsSync(externalPath) ? readJson(externalPath) : [];
  const enriched = fs.existsSync(enrichedPath) ? readJson(enrichedPath) : [];

  const externalByKey = new Map((external || []).map((item) => [keyFor(item), item]));
  const enrichedByKey = new Map((enriched || []).map((item) => [keyFor(item), item]));

  const schemaIssues = [];
  for (const [index, item] of enriched.entries()) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in item)) {
        schemaIssues.push({ index, reference: keyFor(item), missing_field: field });
      } else if (["theme", "emotion", "category", "context", "tags", "use_cases"].includes(field) && !isArray(item[field])) {
        schemaIssues.push({ index, reference: keyFor(item), field, issue: "not_array" });
      }
    }
  }

  const coverageBySurah = {};
  for (const item of enriched) {
    const surah = String(Number(item.surahNumber));
    coverageBySurah[surah] = (coverageBySurah[surah] || 0) + 1;
  }

  const emptyFieldStats = {};
  for (const field of ["theme", "emotion", "category", "context", "tags", "use_cases"]) {
    emptyFieldStats[field] = enriched.filter((item) => !Array.isArray(item[field]) || item[field].length === 0).length;
  }

  const allTags = enriched.flatMap((item) => item.tags || []);
  const auditTags = {
    top_50_tags: topTags(enriched, 50),
    duplicate_tags: detectDuplicateTags(allTags),
    suspicious_generic_tags: suspiciousGenericTags(allTags),
    strange_characters: strangeCharacters(allTags),
    casing_inconsistencies: casingInconsistencies(allTags),
  };

  const overrideValidation = {};
  for (const [group, refs] of Object.entries(MANUAL_OVERRIDES)) {
    overrideValidation[group] = refs.map((ref) => {
      const enrichedItem = enrichedByKey.get(ref) || null;
      const tags = enrichedItem?.use_cases || [];
      return {
        reference: ref,
        present: Boolean(enrichedItem),
        has_override_tag: tags.includes(group),
        use_cases: tags,
      };
    });
  }

  const sampleReview = {};
  for (const topic of SAMPLE_TOPICS) {
    sampleReview[topic] = enriched
      .filter((item) => inferThemeBucket(item) === topic)
      .slice(0, 5)
      .map((item) => ({
        reference: keyFor(item),
        tags: item.tags,
        use_cases: item.use_cases,
        theme: item.theme,
        emotion: item.emotion,
        category: item.category,
        context: item.context,
      }));
  }

  const report = {
    file_counts: {
      external_records: external.length,
      enriched_records: enriched.length,
    },
    schema_consistency: {
      required_fields: REQUIRED_FIELDS,
      issue_count: schemaIssues.length,
      issues: schemaIssues.slice(0, 100),
    },
    coverage_by_surah: coverageBySurah,
    empty_field_stats: emptyFieldStats,
    tag_quality: auditTags,
    manual_override_validation: overrideValidation,
    source_alignment: {
      external_vs_enriched_matches: [...externalByKey.keys()].filter((key) => enrichedByKey.has(key)).length,
      external_only_records: [...externalByKey.keys()].filter((key) => !enrichedByKey.has(key)).length,
      enriched_only_records: [...enrichedByKey.keys()].filter((key) => !externalByKey.has(key)).length,
    },
  };

  const samples = {
    sample_review: sampleReview,
    manual_override_validation: overrideValidation,
  };

  writeJson(auditReportPath, report);
  writeJson(auditSamplesPath, samples);

  console.log(`Audit report written to ${auditReportPath}`);
  console.log(`Audit samples written to ${auditSamplesPath}`);
  console.log(JSON.stringify({
    enriched_records: enriched.length,
    external_records: external.length,
    schema_issues: schemaIssues.length,
    top_50_tags: auditTags.top_50_tags.slice(0, 5),
  }, null, 2));
}

main();
