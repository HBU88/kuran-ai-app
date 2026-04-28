const fs = require("fs");
const path = require("path");

const outputPath = path.join(__dirname, "output", "quranic_corpus_ontology_discovery_report.json");
const baseUrl = "https://corpus.quran.com";
const ontologyUrl = `${baseUrl}/ontology.jsp`;
const conceptUrl = (id) => `${baseUrl}/concept.jsp?id=${encodeURIComponent(id)}`;
const verseListUrl = (id) => `${baseUrl}/search.jsp?q=${encodeURIComponent(`con:${id}`)}`;

const PILOT_CONCEPT_IDS = ["quran", "allah", "muhammad", "islam", "arabic"];

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
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

function extractConceptLinks(html) {
  const links = [];
  const seen = new Set();
  const regex = /href="\/concept\.jsp\?id=([^"#&?]+)"/g;
  let match;
  while ((match = regex.exec(html))) {
    const id = decodeURIComponent(match[1]);
    if (seen.has(id)) continue;
    seen.add(id);
    links.push(id);
  }
  return links;
}

function extractTerms(html) {
  const terms = new Set();
  if (/gnu public license/i.test(html)) terms.add("GNU public license");
  if (/terms of use/i.test(html)) terms.add("terms of use");
  if (/open source project/i.test(html)) terms.add("open source project");
  return [...terms];
}

function extractVerseRefs(html) {
  const refs = [];
  const seen = new Set();
  const regex = /\((\d+):(\d+):(\d+)\)/g;
  let match;
  while ((match = regex.exec(html))) {
    const ref = `${Number(match[1])}:${Number(match[2])}`;
    if (seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
  }
  return refs;
}

function extractConceptMeta(html) {
  const title = (html.match(/<h2[^>]*>(.*?)<\/h2>/i) || [null, null])[1];
  const category = (html.match(/<td class="property">Category<\/td><td><a[^>]*>(.*?)<\/a><\/td>/i) || [null, null])[1];
  const verseCountMatch = html.match(/Verse List[^<]*\((\d+) occurances?\)/i);
  const verseCount = verseCountMatch ? Number(verseCountMatch[1]) : null;
  return { title: title || null, category: category || null, verseCount };
}

async function inspectConcept(id) {
  const conceptHtml = await fetchText(conceptUrl(id));
  const verseListHtml = await fetchText(verseListUrl(id));
  const meta = extractConceptMeta(conceptHtml);
  const verseRefs = extractVerseRefs(verseListHtml);

  return {
    id,
    title: meta.title,
    category: meta.category,
    verseCountClaimed: meta.verseCount,
    verseRefs,
    sampleVerseRefs: verseRefs.slice(0, 10),
    conceptUrl: conceptUrl(id),
    verseListUrl: verseListUrl(id),
  };
}

async function main() {
  const report = {
    source_name: "Quranic Arabic Corpus ontology",
    source_url: ontologyUrl,
    license_or_terms_found: [],
    concept_links_found_count: 0,
    sampled_concepts: [],
    verse_references_found_count: 0,
    sample_verse_references: [],
    parser_feasibility: "unsafe",
    recommended_next_step: "",
    warnings: [],
  };

  try {
    const ontologyHtml = await fetchText(ontologyUrl);
    report.license_or_terms_found = extractTerms(ontologyHtml);
    const conceptLinks = extractConceptLinks(ontologyHtml);
    report.concept_links_found_count = conceptLinks.length;

    const pilotIds = PILOT_CONCEPT_IDS.filter((id) => conceptLinks.includes(id));
    const sampledConcepts = [];
    const allRefs = [];

    for (const id of pilotIds.slice(0, 5)) {
      try {
        const concept = await inspectConcept(id);
        sampledConcepts.push({
          id: concept.id,
          title: concept.title,
          category: concept.category,
          verseCountClaimed: concept.verseCountClaimed,
          sampleVerseRefs: concept.sampleVerseRefs,
          conceptUrl: concept.conceptUrl,
          verseListUrl: concept.verseListUrl,
        });
        allRefs.push(...concept.verseRefs);
      } catch (error) {
        sampledConcepts.push({
          id,
          error: error.message,
        });
        report.warnings.push(`Pilot concept ${id} could not be inspected: ${error.message}`);
      }
    }

    const uniqueRefs = [...new Set(allRefs)];
    report.sampled_concepts = sampledConcepts;
    report.verse_references_found_count = uniqueRefs.length;
    report.sample_verse_references = uniqueRefs.slice(0, 20);
    report.parser_feasibility = uniqueRefs.length > 0 ? "partial" : "unsafe";
    report.recommended_next_step = uniqueRefs.length
      ? "A conservative parser is feasible for pilot concepts. Build an offline extractor that walks only vetted concept ids and normalizes verse-list search results."
      : "No stable verse-list references were extracted from the pilot. Keep this source discovery-only until the HTML parser is made more robust.";
    if (!pilotIds.length) {
      report.warnings.push("No pilot concept ids were found in the ontology index extract.");
    }
  } catch (error) {
    report.warnings.push(`Ontology discovery failed: ${error.message}`);
    report.recommended_next_step = "Treat Quranic Arabic Corpus as discovery-only until the site structure is verified manually.";
  }

  writeJson(outputPath, report);
  console.log(`Discovery report written to ${outputPath}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
