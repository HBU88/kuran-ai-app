const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "../../..");
const sourceDir = path.join(repoRoot, "assets", "data", "full_quran", "diyanet_source");
const epubPath = path.join(sourceDir, "diyanet_meal.epub");
const outputPath = path.join(repoRoot, "assets", "data", "full_quran", "source_tr_diyanet.json");
const statsPath = path.join(__dirname, "output", "diyanet_epub_parse_stats.json");

const EXPECTED_SURAH_COUNT = 114;
const EXPECTED_AYAH_COUNT = 6236;

function main() {
  ensureDir(path.dirname(outputPath));
  ensureDir(path.dirname(statsPath));

  if (!fs.existsSync(epubPath)) {
    const message = [
      "Diyanet EPUB not found.",
      `Place diyanet_meal.epub in: ${epubPath}`,
      "Expected output: assets/data/full_quran/source_tr_diyanet.json",
      "The script will parse a Diyanet-compatible EPUB export into ayah-level Turkish records.",
    ].join("\n");
    console.log(message);
    writeJson(statsPath, {
      status: "missing_epub",
      total_surahs: 0,
      total_ayahs: 0,
      missing_ayahs: EXPECTED_AYAH_COUNT,
      duplicate_ayahs: 0,
      note: "Place diyanet_meal.epub in assets/data/full_quran/diyanet_source and rerun.",
    });
    process.exitCode = 0;
    return;
  }

  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "diyanet-epub-"));
  try {
    extractEpub(epubPath, extractDir);
    const containerPath = path.join(extractDir, "META-INF", "container.xml");
    const opfPath = resolveOpfPath(extractDir, containerPath);
    const contentFiles = resolveContentFiles(extractDir, opfPath);
    const parsed = parseContentFiles(contentFiles);
    const merged = dedupeAndSort(parsed.records);
    const stats = buildStats(parsed.surahCount, merged, parsed.duplicateKeys);

    writeJson(outputPath, merged);
    writeJson(statsPath, stats);

    console.log(`Parsed EPUB: ${epubPath}`);
    console.log(`Output JSON: ${outputPath}`);
    console.log(`total_surahs=${stats.total_surahs}`);
    console.log(`total_ayahs=${stats.total_ayahs}`);
    console.log(`missing_ayahs=${stats.missing_ayahs}`);
    console.log(`duplicate_ayahs=${stats.duplicate_ayahs}`);
    if (merged.length > 0) {
      const sample = merged.find((item) => item.surahNumber === 5 && item.ayahNumber === 3) || merged[0];
      if (sample) {
        console.log(`sample=${sample.surahNumber}:${sample.ayahNumber} ${sample.text_tr.slice(0, 80)}`);
      }
    }
  } catch (error) {
    console.error("Failed to parse Diyanet EPUB:", error.message);
    writeJson(statsPath, {
      status: "parse_failed",
      total_surahs: 0,
      total_ayahs: 0,
      missing_ayahs: EXPECTED_AYAH_COUNT,
      duplicate_ayahs: 0,
      error: error.message,
    });
    process.exitCode = 1;
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

function extractEpub(inputPath, destination) {
  ensureDir(destination);
  const tempZipPath = path.join(path.dirname(inputPath), `${path.basename(inputPath, path.extname(inputPath))}.tmp.zip`);
  fs.copyFileSync(inputPath, tempZipPath);
  try {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath "${tempZipPath}" -DestinationPath "${destination}" -Force`,
      ],
      { stdio: "pipe" }
    );
  } finally {
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
  }
}

function resolveOpfPath(extractDir, containerPath) {
  if (fs.existsSync(containerPath)) {
    const container = fs.readFileSync(containerPath, "utf8");
    const match = container.match(/full-path="([^"]+)"/i);
    if (match) {
      const candidate = path.join(extractDir, match[1].replace(/\//g, path.sep));
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  const fallback = findFirstMatchingFile(extractDir, (filePath) => filePath.toLowerCase().endsWith(".opf"));
  if (fallback) {
    return fallback;
  }

  throw new Error("Unable to locate OPF package document.");
}

function resolveContentFiles(extractDir, opfPath) {
  const opf = fs.readFileSync(opfPath, "utf8");
  const opfDir = path.dirname(opfPath);
  const manifest = new Map();
  for (const item of opf.matchAll(/<item\b[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*media-type="([^"]+)"/gi)) {
    manifest.set(item[1], {
      href: item[2],
      mediaType: item[3],
    });
  }

  const spineIds = Array.from(opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/gi)).map((match) => match[1]);
  const contentFiles = [];
  for (const idref of spineIds) {
    const item = manifest.get(idref);
    if (!item) continue;
    const resolved = path.resolve(opfDir, item.href.replace(/\//g, path.sep));
    if (fs.existsSync(resolved) && isLikelyContentFile(resolved)) {
      contentFiles.push(resolved);
    }
  }

  if (!contentFiles.length) {
    walkFiles(extractDir).forEach((filePath) => {
      if (isLikelyContentFile(filePath)) {
        contentFiles.push(filePath);
      }
    });
  }

  return [...new Set(contentFiles)];
}

function parseContentFiles(contentFiles) {
  const records = [];
  const duplicateKeys = new Set();
  const recordMap = new Map();
  let surahCount = 0;
  let fallbackSurahNumber = 1;

  for (const filePath of contentFiles) {
    const html = fs.readFileSync(filePath, "utf8");
    const surahInfo = detectSurahInfo(html, filePath, fallbackSurahNumber);
    if (surahInfo.detected) {
      surahCount += 1;
    }
    fallbackSurahNumber = surahInfo.surahNumber + 1;

    const verses = parseVersesFromHtml(html, surahInfo);
    for (const verse of verses) {
      if (!verse.surahNumber || !verse.ayahNumber || !verse.text_tr) {
        continue;
      }
      const key = `${verse.surahNumber}:${verse.ayahNumber}`;
      const existing = recordMap.get(key);
      if (existing) {
        if (normalizeVerseText(existing.text_tr) !== normalizeVerseText(verse.text_tr)) {
          duplicateKeys.add(key);
          if (normalizeVerseText(verse.text_tr).length > normalizeVerseText(existing.text_tr).length) {
            recordMap.set(key, verse);
          }
        }
        continue;
      }
      recordMap.set(key, {
        surahNumber: verse.surahNumber,
        ayahNumber: verse.ayahNumber,
        text_tr: verse.text_tr,
      });
    }
  }

  records.push(...recordMap.values());

  return {
    records,
    duplicateKeys: Array.from(duplicateKeys),
    surahCount: surahCount || estimateSurahCount(records),
  };
}

function detectSurahInfo(html, filePath, fallbackSurahNumber) {
  const text = htmlToPlainText(html);
  const lines = text
    .split(/\n+/)
    .map((line) => cleanWhitespace(line))
    .filter(Boolean);

  const surahCandidates = [
    ...lines.slice(0, 8),
    path.basename(filePath, path.extname(filePath)),
  ];

  for (const candidate of surahCandidates) {
    const match = candidate.match(/^(\d{1,3})\s*[\.\-:)]\s*(.+?)(?:\s+suresi|\s+suresi)?$/i);
    if (match) {
      return {
        detected: true,
        surahNumber: Number(match[1]),
        surahName: cleanWhitespace(match[2]),
      };
    }

    const nameOnly = candidate.match(/^(.+?)\s+suresi$/i);
    if (nameOnly) {
      return {
        detected: true,
        surahNumber: fallbackSurahNumber,
        surahName: cleanWhitespace(nameOnly[1]),
      };
    }
  }

  return {
    detected: false,
    surahNumber: fallbackSurahNumber,
    surahName: null,
  };
}

function parseVersesFromHtml(html, surahInfo) {
  const text = htmlToPlainText(html);
  const lines = text
    .split(/\n+/)
    .map((line) => cleanWhitespace(line))
    .filter(Boolean);

  const verses = [];
  let started = false;
  let pendingAyahRange = null;
  let pendingText = [];

  const flush = () => {
    if (pendingAyahRange !== null && pendingText.length > 0) {
      const text_tr = cleanWhitespace(pendingText.join(" "));
      for (let ayahNumber = pendingAyahRange.start; ayahNumber <= pendingAyahRange.end; ayahNumber += 1) {
        verses.push({
          surahNumber: surahInfo.surahNumber,
          ayahNumber,
          text_tr,
        });
      }
    }
    pendingAyahRange = null;
    pendingText = [];
  };

  for (const line of lines) {
    if (!started) {
      if (isHeadingLine(line, surahInfo.surahName, surahInfo.surahNumber)) {
        started = true;
      }
      continue;
    }

    if (isHeadingLine(line, surahInfo.surahName, surahInfo.surahNumber)) {
      continue;
    }

    const numbered = line.match(/^[\s,.;:()\[\]•·\-]*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*[\.\)\]]?\s*(.+)$/);
    const standaloneNumber = line.match(/^(\d{1,3})$/);

    if (numbered && isPlausibleAyahNumber(Number(numbered[1]))) {
      flush();
      const start = Number(numbered[1]);
      const end = Number(numbered[2] || numbered[1]);
      pendingAyahRange = { start, end };
      pendingText = numbered[3] ? [numbered[3]] : [];
      continue;
    }

    if (standaloneNumber && isPlausibleAyahNumber(Number(standaloneNumber[1]))) {
      flush();
      const ayahNumber = Number(standaloneNumber[1]);
      pendingAyahRange = { start: ayahNumber, end: ayahNumber };
      continue;
    }

    if (pendingAyahRange !== null) {
      pendingText.push(line);
    }
  }

  flush();
  return verses;
}

function htmlToPlainText(html) {
  let text = String(html || "");
  text = text
    .replace(/<hr\b[^>]*class="HorizontalRule-1"[^>]*\/?>[\s\S]*$/i, "\n")
    .replace(/<div\b[^>]*class="_idFootnotes"[^>]*>[\s\S]*$/i, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => cleanWhitespace(line))
    .join("\n");
}

function decodeHtmlEntities(text) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    lsquo: "‘",
    rsquo: "’",
    ldquo: "“",
    rdquo: "”",
    hellip: "…",
  };

  return String(text || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    const lower = String(entity).toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }
    return Object.prototype.hasOwnProperty.call(named, lower) ? named[lower] : _;
  });
}

function isHeadingLine(line, surahName, surahNumber) {
  const normalized = cleanWhitespace(line).toLowerCase();
  if (!normalized) return false;
  if (surahName && normalized.includes(cleanWhitespace(surahName).toLowerCase())) {
    return true;
  }
  return normalized.includes(`suresi`) && normalized.includes(String(surahNumber));
}

function isPlausibleAyahNumber(value) {
  return Number.isInteger(value) && value > 0 && value <= 300;
}

function cleanWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeVerseText(value) {
  return cleanWhitespace(value)
    .replace(/\s*\[(\d+)\]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeAndSort(records) {
  const map = new Map();
  for (const record of records) {
    const key = `${record.surahNumber}:${record.ayahNumber}`;
    if (!map.has(key)) {
      map.set(key, record);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.surahNumber !== b.surahNumber) {
      return a.surahNumber - b.surahNumber;
    }
    return a.ayahNumber - b.ayahNumber;
  });
}

function buildStats(totalSurahsDetected, records, duplicateKeys) {
  const totalAyahs = records.length;
  return {
    total_surahs: totalSurahsDetected || EXPECTED_SURAH_COUNT,
    total_ayahs: totalAyahs,
    missing_ayahs: Math.max(0, EXPECTED_AYAH_COUNT - totalAyahs),
    duplicate_ayahs: duplicateKeys.length,
  };
}

function estimateSurahCount(records) {
  return new Set(records.map((record) => record.surahNumber)).size;
}

function findFirstMatchingFile(rootDir, predicate) {
  for (const filePath of walkFiles(rootDir)) {
    if (predicate(filePath)) {
      return filePath;
    }
  }
  return null;
}

function walkFiles(rootDir) {
  const results = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else {
      results.push(current);
    }
  }
  return results;
}

function isLikelyContentFile(filePath) {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".xhtml") || lower.endsWith(".html") || lower.endsWith(".htm");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

main();
