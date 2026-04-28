const fs = require("fs");
const path = require("path");

const workspaceRoot = path.join(__dirname, "..", "..");
const curatedDatasetPath = path.join(workspaceRoot, "assets", "data", "ayahs.json");
const fullDatasetPath = path.join(workspaceRoot, "assets", "data", "full_quran", "source.json");
const diyanetMealPath = path.join(workspaceRoot, "assets", "data", "full_quran", "source_tr_diyanet.json");

let cachedResult = null;

function loadAyahDataset() {
  if (cachedResult) {
    return cachedResult;
  }

  const useFullDataset = process.env.USE_FULL_QURAN_DATASET === "true";
  const useDiyanetMeal = process.env.USE_DIYANET_MEAL === "true";
  const curated = readDataset(curatedDatasetPath);

  if (!useFullDataset) {
    cachedResult = buildDatasetResult(curated.data, curatedDatasetPath, false, null);
    return cachedResult;
  }

  const fullDataset = readDataset(fullDatasetPath);
  if (fullDataset.ok && Array.isArray(fullDataset.data) && fullDataset.data.length > 0) {
    let selectedAyahs = fullDataset.data;
    let selectedSourcePath = fullDatasetPath;
    let fallbackReason = null;

    if (useDiyanetMeal) {
      const diyanetMeal = readDataset(diyanetMealPath);
      if (diyanetMeal.ok && Array.isArray(diyanetMeal.data) && diyanetMeal.data.length > 0) {
        selectedAyahs = overlayTurkishMeal(selectedAyahs, diyanetMeal.data);
        selectedSourcePath = diyanetMealPath;
      } else if (!diyanetMeal.ok) {
        fallbackReason = diyanetMeal.error || "diyanet meal missing or invalid";
      }
    }

    cachedResult = buildDatasetResult(selectedAyahs, selectedSourcePath, true, fallbackReason);
    return cachedResult;
  }

  cachedResult = buildDatasetResult(
    curated.data,
    curatedDatasetPath,
    false,
    fullDataset.error || "full dataset missing or invalid"
  );
  return cachedResult;
}

function getAyahDatasetInfo() {
  return { ...loadAyahDataset() };
}

function buildDatasetResult(records, sourcePath, usedFullDataset, fallbackReason) {
  const normalizedAyahs = Array.isArray(records) ? records.map(normalizeRuntimeAyah).filter(Boolean) : [];
  return {
    ayahs: normalizedAyahs,
    sourcePath,
    count: normalizedAyahs.length,
    usedFullDataset,
    fallbackReason,
    sampleKeys: normalizedAyahs.length > 0 ? Object.keys(normalizedAyahs[0]) : [],
    sampleShape: normalizedAyahs.length > 0 ? buildSampleShape(normalizedAyahs[0]) : null,
  };
}

function overlayTurkishMeal(baseRecords, mealRecords) {
  const mealMap = new Map();
  for (const record of Array.isArray(mealRecords) ? mealRecords : []) {
    if (!record || typeof record !== "object") {
      continue;
    }
    const surahNumber = toNumber(firstDefined(record.surahNumber, record.suraNumber, record.chapterNumber));
    const ayahNumber = toNumber(firstDefined(record.ayahNumber, record.ayah, record.verseNumber, record.aya));
    const text_tr = firstString(record.text_tr, record.translation, record.turkish, record.tr, record.text);
    if (!surahNumber || !ayahNumber || !text_tr) {
      continue;
    }
    mealMap.set(`${surahNumber}:${ayahNumber}`, text_tr);
  }

  return Array.isArray(baseRecords)
    ? baseRecords.map((record) => {
        if (!record || typeof record !== "object") {
          return record;
        }
        const key = `${record.surahNumber}:${record.ayahNumber}`;
        if (!mealMap.has(key)) {
          return record;
        }
        return {
          ...record,
          text_tr: mealMap.get(key),
        };
      })
    : [];
}

function normalizeRuntimeAyah(record, index = 0) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const surah = firstString(
    record.surah,
    record.surahName,
    record.surah_name,
    record.name,
    record.translation,
    record.transliteration
  );
  const surahNumber = toNumber(
    firstDefined(
      record.surahNumber,
      record.suraNumber,
      record.chapterNumber,
      record.surah_number,
      record.chapter_number
    )
  );
  const ayahNumber = toNumber(
    firstDefined(record.ayahNumber, record.ayah, record.verseNumber, record.verse, record.aya)
  );
  const ayah = ayahNumber;
  const text_ar = firstString(record.text_ar, record.arabic, record.text);
  const surahNameTr = firstString(record.surahNameTr, record.surah_name_tr, record.surah_tr, record.tr_surah, toTurkishSurahName(surahNumber));
  const text_tr = firstString(record.text_tr, record.translation, record.turkish, record.tr, record.text);
  const id = toNumber(record.id) || deriveStableId(surahNumber, ayahNumber, index);

  if (!surah || !surahNumber || !ayahNumber) {
    return null;
  }

  return {
    ...record,
    id,
    surah,
    surahNumber,
    ayah,
    ayahNumber,
    text_ar,
    text_tr,
    surahNameTr,
  };
}

function buildSampleShape(record) {
  return {
    id: record.id,
    surah: record.surah,
    surahNumber: record.surahNumber,
    ayah: record.ayah,
    ayahNumber: record.ayahNumber,
    text_ar: record.text_ar,
    text_tr: record.text_tr,
    surahNameTr: record.surahNameTr,
  };
}

function deriveStableId(surahNumber, ayahNumber, index) {
  if (Number.isInteger(surahNumber) && Number.isInteger(ayahNumber)) {
    return surahNumber * 1000 + ayahNumber;
  }
  return index + 1;
}

function readDataset(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: `missing file: ${filePath}` };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(parsed)) {
      return { ok: false, error: `invalid dataset format: ${filePath} must be a JSON array` };
    }
    return { ok: true, data: parsed };
  } catch (error) {
    return { ok: false, error: `failed to load ${filePath}: ${error.message}` };
  }
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function firstString(...values) {
  const value = firstDefined(...values);
  if (value === null) {
    return null;
  }
  const text = String(value).trim();
  return text ? text : null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTurkishSurahName(surahNumber) {
  switch (surahNumber) {
    case 1: return "Fatiha";
    case 2: return "Bakara";
    case 3: return "Âl-i İmrân";
    case 4: return "Nisa";
    case 5: return "Maide";
    case 6: return "Enam";
    case 7: return "Araf";
    case 8: return "Enfal";
    case 9: return "Tevbe";
    case 10: return "Yunus";
    case 11: return "Hud";
    case 12: return "Yusuf";
    case 13: return "Ra'd";
    case 14: return "İbrahim";
    case 15: return "Hicr";
    case 16: return "Nahl";
    case 17: return "İsra";
    case 18: return "Kehf";
    case 19: return "Meryem";
    case 20: return "Taha";
    case 21: return "Enbiya";
    case 22: return "Hac";
    case 23: return "Müminun";
    case 24: return "Nur";
    case 25: return "Furkan";
    case 26: return "Şuara";
    case 27: return "Neml";
    case 28: return "Kasas";
    case 29: return "Ankebut";
    case 30: return "Rum";
    case 31: return "Lokman";
    case 32: return "Secde";
    case 33: return "Ahzab";
    case 34: return "Sebe";
    case 35: return "Fatır";
    case 36: return "Yasin";
    case 37: return "Saffat";
    case 38: return "Sad";
    case 39: return "Zümer";
    case 40: return "Mümin";
    case 41: return "Fussilet";
    case 42: return "Şura";
    case 43: return "Zuhruf";
    case 44: return "Duhan";
    case 45: return "Casiye";
    case 46: return "Ahkaf";
    case 47: return "Muhammed";
    case 48: return "Fetih";
    case 49: return "Hucurat";
    case 50: return "Kaf";
    case 51: return "Zariyat";
    case 52: return "Tur";
    case 53: return "Necm";
    case 54: return "Kamer";
    case 55: return "Rahman";
    case 56: return "Vakia";
    case 57: return "Hadid";
    case 58: return "Mücadele";
    case 59: return "Haşr";
    case 60: return "Mümtehine";
    case 61: return "Saff";
    case 62: return "Cuma";
    case 63: return "Münafikun";
    case 64: return "Teğabün";
    case 65: return "Talak";
    case 66: return "Tahrim";
    case 67: return "Mülk";
    case 68: return "Kalem";
    case 69: return "Hakka";
    case 70: return "Me'aric";
    case 71: return "Nuh";
    case 72: return "Cin";
    case 73: return "Müzzemmil";
    case 74: return "Müddessir";
    case 75: return "Kıyame";
    case 76: return "İnsan";
    case 77: return "Mürselat";
    case 78: return "Nebe";
    case 79: return "Naziat";
    case 80: return "Abese";
    case 81: return "Tekvir";
    case 82: return "İnfitar";
    case 83: return "Mutaffifin";
    case 84: return "İnşikak";
    case 85: return "Buruc";
    case 86: return "Tarık";
    case 87: return "Ala";
    case 88: return "Gaşiye";
    case 89: return "Fecr";
    case 90: return "Beled";
    case 91: return "Şems";
    case 92: return "Leyl";
    case 93: return "Duha";
    case 94: return "İnşirah";
    case 95: return "Tin";
    case 96: return "Alak";
    case 97: return "Kadir";
    case 98: return "Beyyine";
    case 99: return "Zilzal";
    case 100: return "Adiyat";
    case 101: return "Karia";
    case 102: return "Tekasür";
    case 103: return "Asr";
    case 104: return "Hümeze";
    case 105: return "Fil";
    case 106: return "Kureyş";
    case 107: return "Maun";
    case 108: return "Kevser";
    case 109: return "Kafirun";
    case 110: return "Nasr";
    case 111: return "Tebbet";
    case 112: return "İhlas";
    case 113: return "Felak";
    case 114: return "Nas";
    default: return null;
  }
}

module.exports = {
  loadAyahDataset,
  getAyahDatasetInfo,
  curatedDatasetPath,
  fullDatasetPath,
  normalizeRuntimeAyah,
};

