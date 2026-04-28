const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const outputPath = path.join(repoRoot, "assets", "data", "full_quran", "source_tr_diyanet.json");
const statsPath = path.join(__dirname, "output", "diyanet_portal_fetch_stats.json");
const fullQuranSourcePath = path.join(repoRoot, "assets", "data", "full_quran", "source.json");
const BASE_URL = "https://kuran.diyanet.gov.tr/mushaf/kuran-meal-1/";
const DEFAULT_DELAY_MS = Number.parseInt(process.env.DIYANET_PORTAL_DELAY_MS || "175", 10);
const MAX_CONSECUTIVE_SKIP = Number.parseInt(process.env.DIYANET_PORTAL_MAX_SKIP || "8", 10);

async function main() {
  ensureDir(path.dirname(outputPath));
  ensureDir(path.dirname(statsPath));

  const surahList = await loadSurahList();
  if (!surahList.length) {
    const message = "Unable to read surah list from the Diyanet portal landing page.";
    console.log(message);
    writeJson(statsPath, {
      fetched_surah_count: 0,
      fetched_ayah_count: 0,
      unresolved_combined_meal_count: 0,
      skipped_page_count: 0,
      sample_unresolved_ranges: [],
      status: "layout_changed",
      note: "Portal HTML no longer exposed the expected surah list.",
    });
    process.exitCode = 0;
    return;
  }

  const merged = new Map();
  const unresolvedRanges = [];
  const duplicateKeys = new Set();
  const seenPages = new Set();
  let skippedPageCount = 0;
  let fetchedSurahCount = 0;

  for (const surah of surahList) {
    let surahHasData = false;
    let ayah = 1;
    let consecutiveSkips = 0;

    while (ayah <= surah.ayahCount) {
      const url = buildSurahAyahUrl(surah.slug, ayah);
      const page = await fetchPortalPage(url);
      if (!page.ok) {
        skippedPageCount += 1;
        consecutiveSkips += 1;
        if (consecutiveSkips >= MAX_CONSECUTIVE_SKIP) {
          break;
        }
        ayah += 1;
        await delay(DEFAULT_DELAY_MS);
        continue;
      }

      const pageSignature = `${page.pageNo}:${page.surahNumber}`;
      if (seenPages.has(pageSignature)) {
        ayah += Math.max(1, page.maxAyahOnPage || 1);
        await delay(DEFAULT_DELAY_MS);
        continue;
      }
      seenPages.add(pageSignature);

      const records = expandMealAyats(page.mealAyats, page.surahNumber, unresolvedRanges);
      if (!records.length) {
        skippedPageCount += 1;
        consecutiveSkips += 1;
        if (consecutiveSkips >= MAX_CONSECUTIVE_SKIP) {
          break;
        }
        ayah += Math.max(1, page.maxAyahOnPage || 1);
        await delay(DEFAULT_DELAY_MS);
        continue;
      }

      consecutiveSkips = 0;
      surahHasData = true;
      for (const record of records) {
        const key = `${record.surahNumber}:${record.ayahNumber}`;
        if (merged.has(key)) {
          const existing = merged.get(key);
          if (existing.text_tr !== record.text_tr) {
            duplicateKeys.add(key);
            continue;
          }
          continue;
        }
        merged.set(key, record);
      }

      const maxAyahOnPage = Math.max(...records.map((item) => item.ayahNumber));
      ayah = maxAyahOnPage + 1;
      await delay(DEFAULT_DELAY_MS);
    }

    if (surahHasData) {
      fetchedSurahCount += 1;
    }
  }

  const output = Array.from(merged.values()).sort((a, b) => {
    if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
    return a.ayahNumber - b.ayahNumber;
  });

  writeJson(outputPath, output);
  writeJson(statsPath, {
    fetched_surah_count: fetchedSurahCount,
    fetched_ayah_count: output.length,
    unresolved_combined_meal_count: unresolvedRanges.length,
    skipped_page_count: skippedPageCount,
    sample_unresolved_ranges: unresolvedRanges.slice(0, 10),
    duplicate_ayah_count: duplicateKeys.size,
    source_path: outputPath,
  });

  console.log(`Fetched surahs: ${fetchedSurahCount}`);
  console.log(`Fetched ayahs: ${output.length}`);
  console.log(`Unresolved combined meals: ${unresolvedRanges.length}`);
  console.log(`Skipped pages: ${skippedPageCount}`);
  console.log(`Output JSON: ${outputPath}`);
}

async function loadSurahList() {
  const landingUrl = buildSurahAyahUrl("fatiha-suresi-1", 1);
  const html = await fetchText(landingUrl);
  if (!html) {
    return [];
  }

  const surahListMatch = html.match(/var\s+MSureList\s*=\s*(\[[\s\S]*?\]);/);
  if (!surahListMatch) {
    return [];
  }

  const parsed = JSON.parse(surahListMatch[1]);
  const fromFullSource = loadSurahMap();

  return parsed
    .map((item) => {
      const surahNumber = Number(item.SureId);
      const surahName = String(item.SureNameTurkish || "").trim();
      const ayahCount = Number(item.AyetCount);
      const slug = slugifySurahName(surahName, surahNumber);
      const mappedName = fromFullSource.get(normalizeKey(surahName)) || surahName;
      return {
        surahNumber,
        surahName: mappedName,
        ayahCount,
        slug,
      };
    })
    .filter((item) => Number.isInteger(item.surahNumber) && Number.isInteger(item.ayahCount) && item.slug);
}

function loadSurahMap() {
  if (!fs.existsSync(fullQuranSourcePath)) {
    return new Map();
  }
  try {
    const data = JSON.parse(fs.readFileSync(fullQuranSourcePath, "utf8"));
    const map = new Map();
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const key = normalizeKey(item.surahName || item.surah || "");
      if (key && !map.has(key)) {
        map.set(key, item.surahName || item.surah || "");
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function fetchPortalPage(url) {
  const html = await fetchText(url);
  if (!html) {
    return { ok: false };
  }

  try {
    const pageData = extractCurrentPageData(html);
    if (!pageData) {
      return { ok: false };
    }

    const mealAyats = Array.isArray(pageData.mealAyats) ? pageData.mealAyats : [];
    const surahNumber = detectSurahNumber(pageData, html);
    const pageNo = Number(pageData.pageNo || pageData.murl?.pageNo || pageData.pageNo || 0);
    const maxAyahOnPage = mealAyats.reduce((max, item) => {
      const range = parseAyetNumber(item?.AyetNumber);
      return Math.max(max, range.end);
    }, 0);

    return {
      ok: true,
      pageNo,
      surahNumber,
      maxAyahOnPage,
      mealAyats,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function extractCurrentPageData(html) {
  const pageMatch = html.match(/var\s+MPageDmList\s*=\s*(\[[\s\S]*?\]);/);
  const murlMatch = html.match(/var\s+Murl\s*=\s*(\{[\s\S]*?\});/);
  if (!pageMatch || !murlMatch) {
    return null;
  }

  const pageList = JSON.parse(pageMatch[1]);
  const murl = JSON.parse(murlMatch[1]);
  const firstPage = pageList[0] || {};
  return {
    ...firstPage,
    murl,
    pageNo: firstPage.PageNo || murl.pageNo || null,
    mealAyats: firstPage.MealAyats || [],
    surahTitle:
      firstPage.MealSureLabel ||
      (firstPage.QuranSureLabel ? stripHtml(String(firstPage.QuranSureLabel)) : "") ||
      "",
  };
}

function expandMealAyats(mealAyats, surahNumber, unresolvedRanges) {
  if (!Array.isArray(mealAyats) || !mealAyats.length) {
    return [];
  }

  const singlesByAyah = new Map();
  const ranges = [];
  for (const item of mealAyats) {
    const range = parseAyetNumber(item?.AyetNumber);
    const text = cleanText(item?.AyetText);
    if (!range || !text) continue;
    if (range.start === range.end) {
      singlesByAyah.set(range.start, text);
    } else {
      ranges.push({ range, text });
    }
  }

  const output = [];
  const emitted = new Set();

  for (const [ayahNumber, text] of singlesByAyah.entries()) {
    output.push({ surahNumber, ayahNumber, text_tr: text });
    emitted.add(ayahNumber);
  }

  for (const item of ranges) {
    const { start, end } = item.range;
    const singletonTexts = [];
    for (let ayahNumber = start; ayahNumber <= end; ayahNumber += 1) {
      if (singlesByAyah.has(ayahNumber)) {
        singletonTexts.push(singlesByAyah.get(ayahNumber));
      }
    }

    const canExpand = singletonTexts.length > 0 && singletonTexts.every((text) => text === item.text);
    if (!canExpand) {
      unresolvedRanges.push(`${surahNumber}:${start}-${end}`);
      continue;
    }

    for (let ayahNumber = start; ayahNumber <= end; ayahNumber += 1) {
      if (emitted.has(ayahNumber)) {
        continue;
      }
      output.push({ surahNumber, ayahNumber, text_tr: item.text });
      emitted.add(ayahNumber);
    }
  }

  return output.sort((a, b) => a.ayahNumber - b.ayahNumber);
}

function parseAyetNumber(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const cleaned = value.replace(/\s+/g, "");
  const match = cleaned.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2] || match[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
    return null;
  }
  return { start, end };
}

function detectSurahNumber(pageData, html) {
  if (Number.isInteger(pageData?.murl?.sureNo)) {
    return pageData.murl.sureNo;
  }
  const title = cleanText(pageData?.surahTitle || "");
  const map = loadSurahMap();
  const normalized = normalizeKey(title);
  for (const [key, value] of map.entries()) {
    if (key === normalized) {
      const source = readFullSource();
      const found = source.find((item) => normalizeKey(item.surahName || item.surah || "") === key);
      if (found && Number.isInteger(found.surahNumber)) {
        return found.surahNumber;
      }
    }
  }

  const htmlTitle = html.match(/<title>([^<]+)<\/title>/i);
  if (htmlTitle) {
    const normalizedTitle = normalizeKey(stripHtml(htmlTitle[1]));
    for (const item of readFullSource()) {
      if (normalizeKey(item.surahName || item.surah || "") === normalizedTitle) {
        return item.surahNumber;
      }
    }
  }
  return null;
}

function readFullSource() {
  if (!fs.existsSync(fullQuranSourcePath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(fullQuranSourcePath, "utf8"));
  } catch {
    return [];
  }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Codex Quran Import Bot/1.0)",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    return null;
  }
  return await res.text();
}

function buildSurahAyahUrl(slug, ayahNumber) {
  return `${BASE_URL}${slug}/ayet-${ayahNumber}/diyanet-isleri-baskanligi-meali-1`;
}

function slugifySurahName(value, surahNumber) {
  const ascii = transliterateTurkish(String(value || ""));
  const slug = ascii
    .toLowerCase()
    .replace(/['’`´]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return null;
  return `${slug}-suresi-${surahNumber}`;
}

function transliterateTurkish(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/â/g, "a")
    .replace(/Â/g, "A")
    .replace(/î/g, "i")
    .replace(/Î/g, "I")
    .replace(/û/g, "u")
    .replace(/Û/g, "U");
}

function normalizeKey(value) {
  return transliterateTurkish(String(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function cleanText(value) {
  return stripHtml(value)
    .replace(/\s+/g, " ")
    .trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms || 0)));
}

main().catch((error) => {
  console.error("Diyanet portal fetch failed:", error.message);
  writeJson(statsPath, {
    fetched_surah_count: 0,
    fetched_ayah_count: 0,
    unresolved_combined_meal_count: 0,
    skipped_page_count: 0,
    sample_unresolved_ranges: [],
    status: "failed",
    error: error.message,
  });
  process.exitCode = 1;
});
