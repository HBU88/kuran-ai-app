import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const ilmihalDir = path.join(repoRoot, "server", "data", "ilmihal");
const knowledgeIndexPath = path.join(repoRoot, "assets", "data", "knowledge", "ilmihal_knowledge_base.json");
const reportPath = path.join(repoRoot, "server", "reports", "ilmihal_coverage_report.md");

const turkishMap = {
  "\u0131": "i",
  "\u0130": "i",
  "\u015f": "s",
  "\u015e": "s",
  "\u011f": "g",
  "\u011e": "g",
  "\u00fc": "u",
  "\u00dc": "u",
  "\u00f6": "o",
  "\u00d6": "o",
  "\u00e7": "c",
  "\u00c7": "c",
  "\u00e2": "a",
  "\u00c2": "a",
  "\u00ee": "i",
  "\u00ce": "i",
  "\u00fb": "u",
  "\u00db": "u",
  "\u2019": "'",
  "\u02BC": "'",
  "\u2018": "'",
  "\u201d": '"',
  "\u201c": '"',
};

function normalizeText(value) {
  if (value == null) return "";
  let text = String(value).replace(/\uFEFF/g, "").trim().toLocaleLowerCase("tr-TR");
  text = [...text].map((ch) => turkishMap[ch] ?? ch).join("");
  text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  text = text.replace(/[^a-z0-9]+/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function stripExt(filename) {
  return filename.replace(/\.json$/i, "");
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectStrings(value, acc = []) {
  if (value == null) return acc;
  if (typeof value === "string") {
    if (value.trim()) acc.push(value.trim());
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, acc);
    return acc;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, acc);
  }
  return acc;
}

function entryBlob(entry) {
  const strings = unique(collectStrings(entry));
  const normalized = strings.map(normalizeText).filter(Boolean);
  return {
    strings,
    normalized,
    blob: normalized.join(" "),
  };
}

function buildEntryRef(entry, fileName, sourceKind) {
  const id = entry.id || stripExt(fileName);
  const title = entry.title || entry.topic || id;
  const topic = entry.topic || "";
  const keywords = Array.isArray(entry.keywords) ? entry.keywords : [];
  const relatedQuestions = Array.isArray(entry.related_questions) ? entry.related_questions : [];
  const triggers = Array.isArray(entry.triggers) ? entry.triggers : [];
  const strongFields = unique([id, title, topic, ...relatedQuestions, ...triggers]);
  const weakFields = unique([...keywords]);
  const normalizedStrongFields = strongFields.map(normalizeText).filter(Boolean);
  const normalizedWeakFields = weakFields.map(normalizeText).filter(Boolean);
  return {
    sourceKind,
    fileName,
    id,
    title,
    topic,
    keywords,
    relatedQuestions,
    triggers,
    strongFields,
    weakFields,
    strongBlob: normalizedStrongFields.join(" "),
    weakBlob: normalizedWeakFields.join(" "),
    blob: `${normalizedStrongFields.join(" ")} ${normalizedWeakFields.join(" ")}`.trim(),
  };
}

function matchesAlias(blob, alias) {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;
  return blob.includes(normalizedAlias);
}

function findEntryMatches(entryRefs, aliases) {
  const normalizedAliases = aliases.map(normalizeText).filter(Boolean);
  const matches = [];
  for (const entry of entryRefs) {
    const strongHit = normalizedAliases.some((alias) => matchesAlias(entry.strongBlob, alias));
    const weakHit = !strongHit && normalizedAliases.some((alias) => matchesAlias(entry.weakBlob, alias));
    if (strongHit || weakHit) {
      matches.push({
        ...entry,
        matchType: strongHit ? "strong" : "weak",
      });
    }
  }
  return matches;
}

function subtopic(label, aliases) {
  return { label, aliases };
}

const checklist = [
  {
    name: "Temizlik",
    priority: 1,
    subtopics: [
      subtopic("Abdest", ["abdest nasıl alınır", "abdestin farzları", "abdesti bozan şeyler"]),
      subtopic("Gusül", ["gusül abdesti nasıl alınır", "gusül nasıl alınır", "gusül abdesti", "boy abdesti"]),
      subtopic("Teyemmüm", ["teyemmüm nedir", "teyemmüm nasıl alınır", "teyemmümü bozanlar"]),
      subtopic("Mesh", ["mest üzerine mesh", "sargı üzerine mesh", "mesh nasıl yapılır"]),
    ],
  },
  {
    name: "Namaz",
    priority: 1,
    subtopics: [
      subtopic("Namaz nasıl kılınır", ["namaz nasıl kılınır", "namaz nasıl kılınır?", "rekat nasıl kılınır"]),
      subtopic("Namaz farzları", ["namazın farzları", "namaz farzları"]),
      subtopic("Namaz vacipleri", ["namaz vacipleri", "vacipleri"]),
      subtopic("Namazı bozanlar", ["namazı bozan şeyler", "namazı bozanlar"]),
      subtopic("Namaz vakitleri", ["namaz vakitleri", "beş vakit namaz"]),
      subtopic("Sabah namazı", ["sabah namazı", "sabah namazı kaç rekât", "sabah namazı nasıl kılınır"]),
      subtopic("Cuma namazı", ["cuma namazı", "cuma namazı kaç rekât", "cuma namazı kimlere farzdır"]),
      subtopic("Bayram namazı", ["bayram namazı", "bayram namazı kaç rekât", "bayram namazı nasıl kılınır"]),
      subtopic("Vitir namazı", ["vitir namazı", "vitir kaç rekât", "vitir vacip mi"]),
      subtopic("Seferi namaz", ["seferi namaz", "seferi namaz kaç rekât"]),
      subtopic("Cenaze namazı", ["cenaze namazı", "cenaze namazı nasıl kılınır"]),
    ],
  },
  {
    name: "Oruç",
    priority: 1,
    subtopics: [
      subtopic("Oruç nedir", ["oruç nedir", "oruc nedir", "oruç farz mı", "oruç nasıl tutulur"]),
      subtopic("Orucu bozanlar", ["orucu bozan şeyler", "orucu bozanlar"]),
      subtopic("Orucu bozmayanlar", ["orucu bozmayan şeyler", "orucu bozmayanlar"]),
      subtopic("Oruç fidyesi", ["oruç fidyesi", "oruc fidyesi"]),
      subtopic("Oruç kazası", ["oruç kazası", "oruc kazasi"]),
      subtopic("Sahur", ["sahur şart mı", "sahur gerekli mi"]),
    ],
  },
  {
    name: "Zekât",
    priority: 1,
    subtopics: [
      subtopic("Zekât nedir", ["zekât nedir", "zekat nedir"]),
      subtopic("Zekât kime verilir", ["zekât kimlere verilir", "zekat kime verilir"]),
      subtopic("Zekât kime verilmez", ["zekât kimlere verilmez", "zekat kime verilmez"]),
      subtopic("Nisap", ["zekât nisap nedir", "nisap miktarı"]),
    ],
  },
  {
    name: "Fitre",
    priority: 1,
    subtopics: [
      subtopic("Fitre nedir", ["fitre nedir"]),
      subtopic("Fitre kime verilir", ["fitre kime verilir"]),
      subtopic("Fitre ne zaman verilir", ["fitre ne zaman verilir"]),
    ],
  },
  {
    name: "Kurban",
    priority: 1,
    subtopics: [
      subtopic("Kurban nedir", ["kurban nedir"]),
      subtopic("Kurban kimlere vaciptir", ["kurban kimlere vaciptir"]),
      subtopic("Kurban ne zaman kesilir", ["kurban ne zaman kesilir"]),
      subtopic("Kurban eti nasıl paylaşılır", ["kurban eti nasıl paylaşılır"]),
      subtopic("Kurban keserken dikkat", ["kurban keserken nelere dikkat edilir"]),
    ],
  },
  {
    name: "Hac",
    priority: 2,
    subtopics: [
      subtopic("Hac nedir", ["hac nedir"]),
      subtopic("Hac kimlere farzdır", ["hac kimlere farzdır"]),
      subtopic("Haccın farzları", ["haccın farzları"]),
    ],
  },
  {
    name: "Umre",
    priority: 2,
    subtopics: [
      subtopic("Umre nedir", ["umre nedir"]),
      subtopic("Hac ile umre farkı", ["hac ile umre farkı"]),
    ],
  },
  {
    name: "Hayız",
    priority: 1,
    subtopics: [
      subtopic("Hayız nedir", ["hayız nedir", "adet nedir", "regl nedir"]),
      subtopic("Hayız halinde namaz/oruç", ["adetliyken namaz kılınır mı", "adetliyken oruç tutulur mu", "hayız halinde namaz oruç"]),
      subtopic("Adetliyken oruç kazası", ["adetliyken oruç kazası", "tutulamayan oruç kaza edilir mi"]),
      subtopic("Adetliyken Kur'an okunur mu", ["adetliyken kuran okunur mu"]),
    ],
  },
  {
    name: "Nifas",
    priority: 1,
    subtopics: [subtopic("Nifas nedir", ["nifas nedir", "lohusalıkta namaz"])],
  },
  {
    name: "İstihaze",
    priority: 1,
    subtopics: [
      subtopic("İstihaze nedir", ["istihaze nedir"]),
      subtopic("Özür kanı namaz", ["özür kanı namaz", "özür kanı olan kişi namaz kılabilir mi"]),
    ],
  },
  {
    name: "Yemin",
    priority: 2,
    subtopics: [
      subtopic("Yemin nedir", ["yemin nedir"]),
      subtopic("Yemin kefareti", ["yemin kefareti", "yemin bozulursa"]),
    ],
  },
  {
    name: "Adak",
    priority: 2,
    subtopics: [
      subtopic("Adak nedir", ["adak nedir"]),
      subtopic("Adak kurbanı", ["adak kurbanı", "adak kurbani"]),
    ],
  },
  {
    name: "Kefaret",
    priority: 2,
    subtopics: [subtopic("Kefaret nedir", ["kefaret nedir"])],
  },
  {
    name: "Tövbe",
    priority: 2,
    subtopics: [subtopic("Tövbe nasıl edilir", ["tövbe nasıl edilir", "tevbe nasıl edilir"])],
  },
  {
    name: "Dua",
    priority: 2,
    subtopics: [
      subtopic("Dua nedir", ["dua nedir"]),
      subtopic("Dua nasıl edilir", ["dua nasıl edilir"]),
    ],
  },
  {
    name: "Kul hakkı",
    priority: 2,
    subtopics: [subtopic("Kul hakkı nedir", ["kul hakkı nedir"])],
  },
  {
    name: "Gıybet",
    priority: 2,
    subtopics: [subtopic("Gıybet nedir", ["gıybet nedir"])],
  },
  {
    name: "İsraf",
    priority: 2,
    subtopics: [subtopic("İsraf nedir", ["israf nedir"])],
  },
  {
    name: "Faiz",
    priority: 2,
    subtopics: [subtopic("Faiz nedir", ["faiz nedir"])],
  },
  {
    name: "Helal-haram",
    priority: 2,
    subtopics: [subtopic("Helal-haram genel", ["helal haram nedir", "helal ve haram"])],
  },
  {
    name: "Aile / Nikâh basics",
    priority: 3,
    subtopics: [
      subtopic("Nikâh / evlilik", ["nikah", "evlilik", "mehir"]),
      subtopic("Aile sorumlulukları", ["aile", "eş hakları", "nikâh"]),
    ],
  },
  {
    name: "Boşanma basics",
    priority: 3,
    subtopics: [
      subtopic("Boşanma", ["boşanma", "talak", "iddet"]),
      subtopic("İddet", ["iddet"]),
    ],
  },
  {
    name: "Miras basics",
    priority: 3,
    subtopics: [
      subtopic("Miras", ["miras", "feraiz"]),
      subtopic("Paylaşım", ["miras paylaşımı"]),
    ],
  },
  {
    name: "Ticaret / kazanç basics",
    priority: 3,
    subtopics: [
      subtopic("Helal kazanç", ["helal kazanç", "alışveriş", "ticaret"]),
      subtopic("Borç / sözleşme", ["borç", "sözleşme", "faiz"]),
    ],
  },
  {
    name: "Günlük ahlak",
    priority: 2,
    subtopics: [
      subtopic("Anne baba hakkı", ["anne baba hakkı"]),
      subtopic("Selamlaşma adabı", ["selamlaşma adabı"]),
      subtopic("Komşuluk hakkı", ["komşuluk hakkı"]),
      subtopic("Gıybet", ["gıybet nedir"]),
      subtopic("İsraf", ["israf nedir"]),
      subtopic("Kul hakkı", ["kul hakkı nedir"]),
    ],
  },
  {
    name: "Cenaze",
    priority: 2,
    subtopics: [subtopic("Cenaze namazı", ["cenaze namazı"])],
  },
  {
    name: "Sadaka",
    priority: 3,
    subtopics: [subtopic("Sadaka", ["sadaka"])],
  },
  {
    name: "Zikir",
    priority: 3,
    subtopics: [subtopic("Zikir", ["zikir", "tesbih", "istigfar"])],
  },
  {
    name: "Kandil / gece ibadetleri",
    priority: 3,
    subtopics: [subtopic("Kandil / gece ibadetleri", ["kandil", "gece ibadeti", "teheccüd", "miraç", "berat"])],
  },
];

function evaluateChecklist(entries) {
  const evaluated = [];
  for (const group of checklist) {
    const subtopics = group.subtopics.map((topic) => {
      const matches = findEntryMatches(entries, topic.aliases);
      return {
        label: topic.label,
        aliases: topic.aliases,
        matchedEntries: matches.map((m) => ({
          id: m.id,
          title: m.title,
          sourceKind: m.sourceKind,
          fileName: m.fileName,
          matchType: m.matchType,
        })),
      };
    });

    const coveredCount = subtopics.filter((item) => item.matchedEntries.length > 0).length;
    const strongCoveredCount = subtopics.filter((item) =>
      item.matchedEntries.some((match) => match.matchType === "strong")
    ).length;
    const missingSubtopics = subtopics.filter((item) => item.matchedEntries.length === 0);
    const matchedEntries = unique(
      subtopics.flatMap((item) =>
        item.matchedEntries.map((match) => `${match.id} — ${match.title}${match.matchType === "weak" ? " (keyword)" : ""}`)
      )
    );
    let status = "missing";
    if (coveredCount === 0) status = "missing";
    else if (coveredCount >= Math.ceil(subtopics.length * 0.7) && strongCoveredCount > 0) status = "covered";
    else status = "partial";

    evaluated.push({
      ...group,
      status,
      coveredCount,
      strongCoveredCount,
      totalCount: subtopics.length,
      subtopics,
      matchedEntries,
      missingSubtopics: missingSubtopics.map((item) => item.label),
    });
  }

  return evaluated;
}

function formatMarkdownList(items, emptyText = "Yok") {
  if (!items.length) return `- ${emptyText}`;
  return items.map((item) => `- ${item}`).join("\n");
}

function buildCollisionData(entries) {
  const phraseIndex = new Map();

  for (const entry of entries) {
    const phrases = unique([
      entry.id,
      entry.title,
      entry.topic,
      ...entry.keywords,
      ...entry.relatedQuestions,
      ...entry.triggers,
    ]);

    for (const phrase of phrases) {
      const normalized = normalizeText(phrase);
      if (!normalized) continue;
      if (!phraseIndex.has(normalized)) phraseIndex.set(normalized, []);
      phraseIndex.get(normalized).push(entry);
    }
  }

  const exactDuplicates = [];
  for (const [normalized, refs] of phraseIndex.entries()) {
    const uniqueIds = unique(refs.map((ref) => ref.id));
    if (uniqueIds.length > 1) {
      exactDuplicates.push({
        phrase: normalized,
        ids: uniqueIds,
        titles: unique(refs.map((ref) => ref.title)),
      });
    }
  }

  return {
    exactDuplicates,
    overlapRisks: exactDuplicates,
    genericRisks: exactDuplicates,
  };
}

function buildReport({ datasetEntries, knowledgeEntries, evaluatedGroups, collisions }) {
  const covered = evaluatedGroups.filter((g) => g.status === "covered");
  const partial = evaluatedGroups.filter((g) => g.status === "partial");
  const missing = evaluatedGroups.filter((g) => g.status === "missing");
  const weightedCoverage = ((covered.length + partial.length * 0.5) / evaluatedGroups.length) * 100;

  const highPriorityGaps = evaluatedGroups
    .filter((g) => g.status !== "covered")
    .sort((a, b) => a.priority - b.priority || b.coveredCount - a.coveredCount)
    .slice(0, 12);

  const suggestedBatches = highPriorityGaps.map((g) => `- ${g.name} (${g.status})`);

  const collisionLines = [];
  for (const item of collisions.genericRisks.slice(0, 12)) {
    collisionLines.push(`- **${item.phrase}**: ${item.ids.join(" / ")} (${item.titles.join(" ↔ ")})`);
  }
  if (!collisionLines.length) collisionLines.push("- Belirgin bir çakışma bulunmadı.");

  const coveredLines = covered
    .map((g) => `- **${g.name}** (${g.coveredCount}/${g.totalCount}): ${g.matchedEntries.slice(0, 6).join(", ")}`)
    .join("\n");

  const partialLines = partial
    .map((g) => `- **${g.name}** (${g.coveredCount}/${g.totalCount}): eksik -> ${g.missingSubtopics.join(", ")}`)
    .join("\n");

  const missingLines = missing
    .map((g) => `- **${g.name}** (${g.coveredCount}/${g.totalCount})`)
    .join("\n");

  const priorityLines = highPriorityGaps
    .map((g) => `- **${g.name}** (${g.status}, öncelik ${g.priority}): ${g.missingSubtopics.join(", ") || "kısmi eşleşme yok"}`)
    .join("\n");

  const report = `# HAKAI İlmihal Coverage Audit

## Coverage Summary
- Local dataset files scanned: **${datasetEntries.length}**
- Knowledge index entries scanned: **${knowledgeEntries.length}**
- Checklist groups: **${evaluatedGroups.length}**
- Covered: **${covered.length}**
- Partial: **${partial.length}**
- Missing: **${missing.length}**
- Weighted coverage estimate: **${weightedCoverage.toFixed(1)}%**

## Covered Topics
${coveredLines || "- Yok"}

## Partial Topics
${partialLines || "- Yok"}

## Missing Topics
${missingLines || "- Yok"}

## High Priority Gaps
${priorityLines || "- Yok"}

## Suggested Next Dataset Batches
${suggestedBatches.length ? suggestedBatches.join("\n") : "- Ek batch gerekmiyor gibi görünüyor."}

## Potential Routing Collision Risks
${collisionLines.join("\n")}
`;

  return report;
}

function main() {
  const ilmihalFiles = fs
    .readdirSync(ilmihalDir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const datasetEntries = ilmihalFiles.map((fileName) => {
    const filePath = path.join(ilmihalDir, fileName);
    const data = readJson(filePath);
    return buildEntryRef(data, fileName, "dataset");
  });

  const knowledgeIndex = readJson(knowledgeIndexPath);
  const knowledgeEntries = knowledgeIndex.map((entry, index) =>
    buildEntryRef(
      {
        ...entry,
        title: entry.title || entry.topic || entry.id || `knowledge_${index + 1}`,
        keywords: entry.keywords || [],
        related_questions: entry.related_questions || [],
        source_notes: entry.source_notes || (entry.source_note ? [entry.source_note] : []),
        summary: entry.answer_tr || entry.summary || "",
      },
      `knowledge_${index + 1}.json`,
      "knowledge"
    )
  );

  const allEntries = [...datasetEntries, ...knowledgeEntries];
  const evaluatedGroups = evaluateChecklist(allEntries);
  const collisions = buildCollisionData(allEntries);
  const report = buildReport({ datasetEntries, knowledgeEntries, evaluatedGroups, collisions });

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, "utf8");

  const summary = {
    dataset_files: datasetEntries.length,
    knowledge_entries: knowledgeEntries.length,
    groups: evaluatedGroups.length,
    covered: evaluatedGroups.filter((g) => g.status === "covered").length,
    partial: evaluatedGroups.filter((g) => g.status === "partial").length,
    missing: evaluatedGroups.filter((g) => g.status === "missing").length,
    collision_risks: collisions.genericRisks.length,
    report_path: reportPath,
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report written to: ${reportPath}`);
}

main();
