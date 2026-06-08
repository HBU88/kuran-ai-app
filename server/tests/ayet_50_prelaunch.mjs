/**
 * ayet_50_prelaunch.mjs
 * HAKAI — Ayet Rehberi 50-Soru Pre-Launch Testi
 *
 * Endpoint: POST https://hakai-backend.onrender.com/ayah-chat
 * Rapor:    server/tests/ayet_50_report.json
 *
 * Çalıştır:
 *   node server/tests/ayet_50_prelaunch.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://hakai-backend.onrender.com";
const ENDPOINT = `${BASE_URL}/ayah-chat`;
const REPORT_PATH = path.join(__dirname, "ayet_50_report.json");
const REQUEST_DELAY_MS = 500; // throttle — Render free tier

// ── Yanıt süresi uyarı eşiği ────────────────────────────────────────────────
const WARN_THRESHOLD_MS = 8000;

// ── 50 Test Sorusu ───────────────────────────────────────────────────────────
// acceptSurahs: en az biri eşleşirse PASS
// acceptKeywords: assistant_text içinde en az biri geçerse bağlam uyumlu
// criticalNoInşirah: true → İnşirah (sure 94) dönmesi FAIL
const TEST_CASES = [
  // ── KATEGORİ A — Tek Duygu (15 soru) ──────────────────────────────────────
  {
    id: 1, category: "A", label: "üzüntü",
    message: "üzüntü hakkında ayet",
    acceptSurahs: [2, 39, 94, 13],
    acceptKeywords: ["üzüntü", "sabır", "hüzün", "keder", "teselli", "Bakara", "Zümer", "İnşirah", "Ra'd"],
  },
  {
    id: 2, category: "A", label: "korku",
    message: "korku için ayet",
    acceptSurahs: [3, 65, 39, 9],
    acceptKeywords: ["korku", "güven", "sığın", "tevekkül", "Allah", "Âl-i İmrân", "Talâk", "Zümer"],
  },
  {
    id: 3, category: "A", label: "umut",
    message: "umut hakkında ayet",
    acceptSurahs: [39, 15, 12],
    acceptKeywords: ["umut", "rahmet", "ümit", "umutsuzluk", "Zümer", "Hicr", "Yusuf"],
  },
  {
    id: 4, category: "A", label: "sabır",
    message: "sabır konusunda ayet",
    acceptSurahs: [2, 39, 3, 16],
    acceptKeywords: ["sabır", "sabreden", "Bakara", "Zümer", "Âl-i İmrân"],
  },
  {
    id: 5, category: "A", label: "şükür",
    message: "şükür hakkında ayet",
    acceptSurahs: [14, 31, 55],
    acceptKeywords: ["şükür", "şükret", "nimet", "nankörlük", "İbrahim", "Lokmân", "Rahmân"],
  },
  {
    id: 6, category: "A", label: "pişmanlık",
    message: "pişmanlık için ayet",
    acceptSurahs: [39, 4, 11, 66],
    acceptKeywords: ["tövbe", "pişman", "bağışla", "af", "günahlar", "Zümer", "Nisâ", "Hûd"],
  },
  {
    id: 7, category: "A", label: "yalnızlık",
    message: "yalnızlık hissediyorum ayet ver",
    acceptSurahs: [2, 50, 57, 93, 94, 13],
    acceptKeywords: ["yalnız", "beraberlik", "Allah", "yakın", "Bakara", "Kaf", "Hadid", "Duha"],
  },
  {
    id: 8, category: "A", label: "öfke",
    message: "öfke için ayet",
    acceptSurahs: [3, 7, 42],
    acceptKeywords: ["öfke", "öfkeni", "affet", "yut", "Âl-i İmrân", "A'râf"],
  },
  {
    id: 9, category: "A", label: "tevekkül",
    message: "tevekkül hakkında ayet",
    acceptSurahs: [65, 3, 5, 9, 58],
    acceptKeywords: ["tevekkül", "güven", "dayan", "Talâk", "Âl-i İmrân", "Mâide"],
  },
  {
    id: 10, category: "A", label: "sevinç",
    message: "sevinç ve mutluluk için ayet",
    acceptSurahs: [10, 13, 3, 39],
    acceptKeywords: ["sevinç", "mutlu", "mümin", "ferah", "Yûnus", "Ra'd"],
  },
  {
    id: 11, category: "A", label: "endişe",
    message: "endişe için ayet",
    acceptSurahs: [13, 2, 65, 3],
    acceptKeywords: ["endişe", "kaygı", "huzur", "korku", "Ra'd", "Bakara", "Talâk"],
  },
  {
    id: 12, category: "A", label: "karamsarlık",
    message: "karamsarlık için ayet",
    acceptSurahs: [39, 15, 12, 94],
    acceptKeywords: ["ümitsizlik", "karamsarlık", "umutsuz", "rahmet", "Zümer", "Hicr"],
  },
  {
    id: 13, category: "A", label: "huzur",
    message: "huzur için ayet",
    acceptSurahs: [13, 89, 94, 2],
    acceptKeywords: ["huzur", "kalp", "zikir", "itminan", "Ra'd", "Fecr"],
  },
  {
    id: 14, category: "A", label: "keder",
    message: "keder için ayet",
    acceptSurahs: [93, 94, 2, 12],
    acceptKeywords: ["keder", "hüzün", "teselli", "üzülme", "Duha", "İnşirah", "Bakara"],
  },
  {
    id: 15, category: "A", label: "minnet",
    message: "minnet ve şükran için ayet",
    acceptSurahs: [14, 31, 55, 2],
    acceptKeywords: ["şükür", "nimet", "minnet", "şükran", "İbrahim", "Rahmân"],
  },

  // ── KATEGORİ B — Hayat Durumu (15 soru) ──────────────────────────────────
  {
    id: 16, category: "B", label: "iş kaybı",
    message: "işimi kaybettim ne yapmalıyım",
    acceptSurahs: [65, 2, 94, 11],
    acceptKeywords: ["sabır", "tevekkül", "rızık", "Allah", "Talâk", "Bakara"],
  },
  {
    id: 17, category: "B", label: "hastalık",
    message: "hastalandım bana ayet ver",
    acceptSurahs: [26, 21, 2, 17],
    acceptKeywords: ["şifa", "hastalık", "sabır", "dua", "Şuarâ", "Enbiyâ"],
  },
  {
    id: 18, category: "B", label: "ölüm",
    message: "annem vefat etti teselli edecek ayet",
    acceptSurahs: [2, 3, 89, 94],
    acceptKeywords: ["ölüm", "sabır", "rahmet", "inna lillah", "Bakara", "vefat", "teselli"],
  },
  {
    id: 19, category: "B", label: "maddi sıkıntı",
    message: "maddi sıkıntıdayım ayet",
    acceptSurahs: [65, 2, 11, 94],
    acceptKeywords: ["rızık", "bolluk", "sabır", "tevekkül", "Talâk", "Bakara"],
  },
  {
    id: 20, category: "B", label: "sınav korkusu",
    message: "sınav korkusu için ayet",
    acceptSurahs: [3, 65, 2, 9],
    acceptKeywords: ["korku", "güven", "Allah", "tevekkül", "başar", "Âl-i İmrân", "Talâk"],
  },
  {
    id: 21, category: "B", label: "evlilik",
    message: "evlenmek istiyorum ayet",
    acceptSurahs: [30, 4, 7, 16],
    acceptKeywords: ["evlilik", "eş", "nikah", "aile", "Rûm", "Nisâ"],
  },
  {
    id: 22, category: "B", label: "aile kavgası",
    message: "aile kavgası yaşıyorum",
    acceptSurahs: [4, 30, 49, 2],
    acceptKeywords: ["sabır", "af", "aile", "barış", "Nisâ", "Rûm", "Hucurât"],
  },
  {
    id: 23, category: "B", label: "yurt dışı yalnızlık",
    message: "yurt dışında yalnız hissediyorum",
    acceptSurahs: [2, 50, 57, 94, 13],
    acceptKeywords: ["yalnız", "Allah", "yakın", "beraberlik", "Bakara", "Kaf"],
  },
  {
    id: 24, category: "B", label: "iş adalet",
    message: "iş hayatında adalet için ayet",
    acceptSurahs: [4, 5, 16, 83],
    acceptKeywords: ["adalet", "hak", "haksızlık", "Nisâ", "Mâide"],
  },
  {
    id: 25, category: "B", label: "çocuklar için dua",
    message: "çocuklarım için dua",
    acceptSurahs: [14, 46, 25, 3],
    acceptKeywords: ["çocuk", "evlat", "dua", "aile", "İbrahim", "Ahkaf", "Furkan"],
  },
  {
    id: 26, category: "B", label: "borç",
    message: "borçluyum sıkıntıdayım",
    acceptSurahs: [2, 65, 94, 11],
    acceptKeywords: ["borç", "sabır", "rızık", "kolaylık", "Bakara", "Talâk"],
  },
  {
    id: 27, category: "B", label: "ihanet",
    message: "arkadaşım beni ihane etti",
    acceptSurahs: [5, 3, 64, 49],
    acceptKeywords: ["af", "sabır", "güven", "ihanet", "Mâide", "Âl-i İmrân"],
  },
  {
    id: 28, category: "B", label: "hasta sevilen",
    message: "sevdiğim biri hastalandı",
    acceptSurahs: [26, 21, 2, 3],
    acceptKeywords: ["şifa", "dua", "sabır", "rahmet", "Şuarâ", "Enbiyâ"],
  },
  {
    id: 29, category: "B", label: "işsizlik motivasyon",
    message: "işsizim motivasyon ayet",
    acceptSurahs: [65, 2, 39, 94],
    acceptKeywords: ["ümit", "rızık", "tevekkül", "sabır", "Allah", "Talâk", "Bakara"],
  },
  {
    id: 30, category: "B", label: "yeni başlangıç",
    message: "yeni bir başlangıç için ayet",
    acceptSurahs: [94, 43, 15, 2, 39],
    acceptKeywords: ["umut", "kolaylık", "yeni", "başlangıç", "İnşirah", "Bakara"],
  },

  // ── KATEGORİ C — Kombinasyon Duygular (10 soru) ──────────────────────────
  {
    id: 31, category: "C", label: "üzgün+korku",
    message: "hem üzgün hem de korkuyorum",
    acceptSurahs: [2, 39, 3, 65, 13],
    acceptKeywords: ["sabır", "güven", "Allah", "korku", "üzüntü"],
  },
  {
    id: 32, category: "C", label: "sabır+şükür",
    message: "sabır ve şükür hakkında ayet",
    acceptSurahs: [2, 14, 39, 31],
    acceptKeywords: ["sabır", "şükür", "nimet", "Bakara", "İbrahim"],
  },
  {
    id: 33, category: "C", label: "umut+tevekkül",
    message: "umut ve tevekkül için ayet",
    acceptSurahs: [65, 3, 39, 15],
    acceptKeywords: ["umut", "tevekkül", "güven", "Allah", "Talâk", "Zümer"],
  },
  {
    id: 34, category: "C", label: "pişmanlık+af",
    message: "pişmanlık ve af için ayet",
    acceptSurahs: [39, 4, 11, 66, 3],
    acceptKeywords: ["tövbe", "af", "bağışla", "pişman", "Zümer", "Nisâ"],
  },
  {
    id: 35, category: "C", label: "yalnız+karamsarlık",
    message: "hem yalnız hem de karamsarım",
    acceptSurahs: [2, 39, 50, 57, 15, 94],
    acceptKeywords: ["yalnız", "ümit", "rahmet", "Allah", "yakın"],
  },
  {
    id: 36, category: "C", label: "korku+endişe",
    message: "korku ve endişeyle başa çıkmak için",
    acceptSurahs: [3, 65, 9, 13, 2],
    acceptKeywords: ["korku", "huzur", "tevekkül", "Allah", "güven"],
    criticalNoInşirah: true,
  },
  {
    id: 37, category: "C", label: "tövbe+umut",
    message: "günahlarım için tövbe ve umut",
    acceptSurahs: [39, 4, 66, 11],
    acceptKeywords: ["tövbe", "rahmet", "umut", "af", "Zümer"],
  },
  {
    id: 38, category: "C", label: "sabır+güç",
    message: "zor zamanda sabır ve güç için",
    acceptSurahs: [2, 3, 39, 94],
    acceptKeywords: ["sabır", "güç", "güçlük", "kolaylık", "Bakara"],
  },
  {
    id: 39, category: "C", label: "şükür+sevinç",
    message: "hem mutlu hem de minnetarım",
    acceptSurahs: [14, 10, 31, 55],
    acceptKeywords: ["şükür", "sevinç", "mutlu", "nimet", "İbrahim", "Yûnus"],
  },
  {
    id: 40, category: "C", label: "acı+ümit",
    message: "acı ve ümit bir arada",
    acceptSurahs: [2, 39, 94, 15, 12],
    acceptKeywords: ["sabır", "umut", "ümit", "rahmet", "kolaylık"],
  },

  // ── KATEGORİ D — Dini Tema (5 soru) ──────────────────────────────────────
  {
    id: 41, category: "D", label: "Allah'ın rahmeti",
    message: "Allah'ın rahmeti hakkında ayet",
    acceptSurahs: [39, 6, 7, 40, 2],
    acceptKeywords: ["rahmet", "mağfiret", "bağışla", "Allah", "Zümer"],
  },
  {
    id: 42, category: "D", label: "tövbe+bağışlanma",
    message: "tövbe ve bağışlanma için ayet",
    acceptSurahs: [39, 4, 66, 11, 3],
    acceptKeywords: ["tövbe", "bağışla", "af", "günahlar", "Zümer", "Nisâ"],
  },
  {
    id: 43, category: "D", label: "dua",
    message: "dua etmenin faydaları",
    acceptSurahs: [2, 40, 27, 1],
    acceptKeywords: ["dua", "istemek", "Allah", "cevap", "Bakara", "Mü'min"],
  },
  {
    id: 44, category: "D", label: "kul hakkı",
    message: "kul hakkı ve adalet",
    acceptSurahs: [4, 5, 83, 2, 11],
    acceptKeywords: ["adalet", "hak", "kul", "haksızlık", "Nisâ", "Mâide", "Mutaffifîn"],
  },
  {
    id: 45, category: "D", label: "ölüm+ahiret",
    message: "ölüm ve ahiret hakkında",
    acceptSurahs: [3, 4, 39, 99, 89, 2],
    acceptKeywords: ["ölüm", "ahiret", "hesap", "kıyamet", "sonra"],
  },

  // ── KATEGORİ E — Belirsiz / Edge Case (5 soru) ───────────────────────────
  {
    id: 46, category: "E", label: "genel ayet isteği",
    message: "bana bir ayet ver",
    // Herhangi geçerli ayet kabul edilir — ama İnşirah 94 override bug'ı olmamalı
    acceptSurahs: [], // herhangi bir sure kabul
    acceptKeywords: [], // herhangi bir metin kabul
    criticalNoInşirah: true, // İnşirah 94:5-6 → bug ❌
  },
  {
    id: 47, category: "E", label: "güzel ayet",
    message: "güzel bir ayet",
    acceptSurahs: [], // herhangi bir sure kabul
    acceptKeywords: [],
  },
  {
    id: 48, category: "E", label: "huzur veren ayet",
    message: "huzur veren ayet",
    acceptSurahs: [13, 89, 2, 94, 55],
    acceptKeywords: ["huzur", "kalp", "zikir", "itminan", "Ra'd", "Fecr"],
  },
  {
    id: 49, category: "E", label: "zor zamanlarda",
    message: "zor zamanlarda okunacak ayet",
    acceptSurahs: [2, 94, 39, 3],
    acceptKeywords: ["güçlük", "kolaylık", "sabır", "zor", "Bakara", "İnşirah"],
  },
  {
    id: 50, category: "E", label: "ilham verici",
    message: "ilham verici bir ayet",
    acceptSurahs: [], // herhangi bir sure kabul
    acceptKeywords: [],
  },
];

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractSurahNumber(selected_ayah) {
  if (!selected_ayah) return null;
  if (typeof selected_ayah.surahNumber === "number") return selected_ayah.surahNumber;
  if (typeof selected_ayah.surah_number === "number") return selected_ayah.surah_number;
  return null;
}

function extractAyahRef(selected_ayah) {
  if (!selected_ayah) return "—";
  const name = selected_ayah.surahNameTr || selected_ayah.surah_name_tr || selected_ayah.surahName || "?";
  const sn = selected_ayah.surahNumber || selected_ayah.surah_number || "?";
  const an = selected_ayah.ayahNumber || selected_ayah.ayah_number || "?";
  return `${name} ${sn}:${an}`;
}

function detectSource(data) {
  // Yanıtta source alanı yoksa assistant_text içeriğinden tahmin et
  if (data.source) return data.source;
  if (data.decision_meta) {
    if (data.decision_meta.planner_source) return data.decision_meta.planner_source;
    if (data.decision_meta.route_mode) return data.decision_meta.route_mode;
  }
  if (data.selected_ayah) return "ayah_ranker";
  return "unknown";
}

function evaluate(tc, data, statusCode, durationMs) {
  // FAIL koşulları
  if (statusCode !== 200) {
    return { status: "FAIL", reason: `HTTP ${statusCode}` };
  }
  if (!data || !data.assistant_text) {
    return { status: "FAIL", reason: "Boş veya null yanıt" };
  }

  const surahNumber = extractSurahNumber(data.selected_ayah);
  const ayahRef = extractAyahRef(data.selected_ayah);

  // Kritik: İnşirah 94 bug kontrolü
  if (tc.criticalNoInşirah && surahNumber === 94) {
    return {
      status: "FAIL",
      reason: `İnşirah 94 bug'ı aktif — genel fallback ayet olarak İnşirah dönüyor: ${ayahRef}`,
    };
  }

  // Herhangi ayet döndüyse ve kısıtlama yoksa PASS (edge case kategorisi)
  const hasNoSurahConstraint = !tc.acceptSurahs || tc.acceptSurahs.length === 0;
  const hasNoKeywordConstraint = !tc.acceptKeywords || tc.acceptKeywords.length === 0;

  if (hasNoSurahConstraint && hasNoKeywordConstraint) {
    if (!data.selected_ayah) {
      return { status: "WARN", reason: "Ayet referansı yok ama metin var" };
    }
    // Yanıt süresi uyarısı
    if (durationMs > WARN_THRESHOLD_MS) {
      return { status: "WARN", reason: `Yanıt süresi yavaş: ${durationMs}ms` };
    }
    return { status: "PASS", reason: null };
  }

  // Sure eşleşmesi
  const surahMatch =
    surahNumber !== null &&
    tc.acceptSurahs.length > 0 &&
    tc.acceptSurahs.includes(surahNumber);

  // Keyword eşleşmesi (assistant_text'te)
  const text = (data.assistant_text || "").toLowerCase();
  const keywordMatch =
    tc.acceptKeywords.length === 0 ||
    tc.acceptKeywords.some((kw) => text.includes(kw.toLowerCase()));

  if (!data.selected_ayah) {
    if (keywordMatch) {
      return { status: "WARN", reason: "Ayet referansı yok ama metin konuya uygun" };
    }
    return { status: "FAIL", reason: "Ayet yok + konu uyumsuz" };
  }

  if (surahMatch || keywordMatch) {
    if (durationMs > WARN_THRESHOLD_MS) {
      return { status: "WARN", reason: `Ayet doğru ama yanıt yavaş: ${durationMs}ms` };
    }
    return { status: "PASS", reason: null };
  }

  // Bağlam zayıf
  return {
    status: "WARN",
    reason: `Ayet döndü (${ayahRef}) ama bağlam zayıf — beklenen sureler: [${tc.acceptSurahs.join(",")}], beklenen kelimeler: [${tc.acceptKeywords.slice(0, 4).join(",")}...]`,
  };
}

// ── Ana test döngüsü ─────────────────────────────────────────────────────────

async function runTest(tc) {
  const start = Date.now();
  let statusCode = 0;
  let data = null;
  let error = null;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": "test-device-50q-prelaunch",
      },
      body: JSON.stringify({
        message: tc.message,
        history: [],
      }),
    });
    statusCode = res.status;
    data = await res.json();
  } catch (err) {
    error = err.message || String(err);
  }

  const durationMs = Date.now() - start;

  if (error) {
    return {
      id: tc.id,
      category: tc.category,
      label: tc.label,
      message: tc.message,
      status: "FAIL",
      reason: `Ağ hatası: ${error}`,
      statusCode,
      durationMs,
      ayahRef: "—",
      source: "error",
      assistantTextPreview: null,
    };
  }

  const evaluation = evaluate(tc, data, statusCode, durationMs);
  const ayahRef = data ? extractAyahRef(data.selected_ayah) : "—";
  const source = data ? detectSource(data) : "error";
  const assistantTextPreview = data?.assistant_text
    ? data.assistant_text.slice(0, 120)
    : null;

  return {
    id: tc.id,
    category: tc.category,
    label: tc.label,
    message: tc.message,
    status: evaluation.status,
    reason: evaluation.reason,
    statusCode,
    durationMs,
    ayahRef,
    source,
    assistantTextPreview,
    surahNumber: data ? extractSurahNumber(data.selected_ayah) : null,
  };
}

// ── Backend health check ─────────────────────────────────────────────────────

async function healthCheck() {
  try {
    const res = await fetch(`${BASE_URL}/health`, { method: "GET" });
    const data = await res.json();
    if (res.ok && data.ok) {
      console.log(`✓ Backend sağlıklı — engine_version: ${data.engine_version || "?"}\n`);
      return true;
    }
    console.error(`✗ Backend sağlık kontrolü başarısız: ${JSON.stringify(data)}\n`);
    return false;
  } catch (err) {
    console.error(`✗ Backend'e ulaşılamıyor: ${err.message}\n`);
    return false;
  }
}

// ── Başlangıç ────────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════════");
console.log(" HAKAI — Ayet Rehberi 50-Soru Pre-Launch Testi");
console.log(`   Endpoint: ${ENDPOINT}`);
console.log(`   Tarih   : ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════════════════════════\n");

const healthy = await healthCheck();
if (!healthy) {
  console.log("⚠️  Backend yanıt vermiyor. Test Render cold-start beklenerek devam edecek...\n");
  await sleep(5000);
}

const results = [];
let passCount = 0;
let warnCount = 0;
let failCount = 0;

for (const tc of TEST_CASES) {
  process.stdout.write(`[${String(tc.id).padStart(2, "0")}/50] ${tc.category}:${tc.label.padEnd(20)} → `);
  const result = await runTest(tc);
  results.push(result);

  if (result.status === "PASS") { passCount++; process.stdout.write(`✅ PASS  ${result.ayahRef} (${result.durationMs}ms)\n`); }
  else if (result.status === "WARN") { warnCount++; process.stdout.write(`⚠️  WARN  ${result.ayahRef} — ${result.reason}\n`); }
  else { failCount++; process.stdout.write(`❌ FAIL  ${result.reason}\n`); }

  await sleep(REQUEST_DELAY_MS);
}

// ── Kategori istatistikleri ──────────────────────────────────────────────────
const catStats = {};
for (const r of results) {
  if (!catStats[r.category]) catStats[r.category] = { PASS: 0, WARN: 0, FAIL: 0 };
  catStats[r.category][r.status]++;
}

// ── Ortalama yanıt süresi ────────────────────────────────────────────────────
const avgDuration = Math.round(results.reduce((s, r) => s + r.durationMs, 0) / results.length);
const maxDuration = Math.max(...results.map((r) => r.durationMs));

// ── Özet rapor ───────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════════");
console.log(" ÖZET");
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  ✅ PASS : ${passCount}/50`);
console.log(`  ⚠️  WARN : ${warnCount}/50`);
console.log(`  ❌ FAIL : ${failCount}/50`);
console.log(`  ⏱  Ort. yanıt : ${avgDuration}ms  |  Maks: ${maxDuration}ms\n`);

console.log("── Kategori dağılımı ────────────────────────────────────────");
const catLabels = {
  A: "Tek Duygu   (15)",
  B: "Hayat Durumu(15)",
  C: "Kombinasyon (10)",
  D: "Dini Tema    (5)",
  E: "Edge Case    (5)",
};
for (const [cat, stat] of Object.entries(catStats)) {
  const total_cat = stat.PASS + stat.WARN + stat.FAIL;
  console.log(
    `  [${cat}] ${catLabels[cat] || cat.padEnd(16)}: ✅${stat.PASS} ⚠️ ${stat.WARN} ❌${stat.FAIL}  / ${total_cat}`
  );
}

// ── App Store Eşiği ───────────────────────────────────────────────────────────
console.log("\n── App Store Eşik Değerlendirmesi ───────────────────────────");
const thresholdPass = passCount >= 44;
const thresholdFail = failCount <= 3;
const thresholdSpeed = avgDuration <= 6000;
const catEPassCount = (catStats["E"] || {}).PASS || 0;
const thresholdEdge = catEPassCount >= 3;
const instirahBug = results.find(
  (r) => r.id === 46 && r.status === "FAIL" && r.reason && r.reason.includes("İnşirah")
);
const thresholdInstirah = !instirahBug;

console.log(`  PASS ≥ 44/50       : ${thresholdPass ? "✅" : "❌"} (${passCount}/50)`);
console.log(`  FAIL ≤ 3           : ${thresholdFail ? "✅" : "❌"} (${failCount})`);
console.log(`  Ort. hız ≤ 6s      : ${thresholdSpeed ? "✅" : "❌"} (${avgDuration}ms)`);
console.log(`  Edge Case ≥ 3/5    : ${thresholdEdge ? "✅" : "❌"} (${catEPassCount}/5)`);
console.log(`  İnşirah bug yok    : ${thresholdInstirah ? "✅" : "❌"}`);

const allThresholds = thresholdPass && thresholdFail && thresholdSpeed && thresholdEdge && thresholdInstirah;
console.log(`\n  GENEL DURUM: ${allThresholds ? "✅ APP STORE HAZİR" : "❌ EŞİK SAĞLANAMADI — GÖZDEn GEÇİR"}`);

// ── FAIL listesi ─────────────────────────────────────────────────────────────
const failures = results.filter((r) => r.status === "FAIL");
if (failures.length > 0) {
  console.log("\n── Başarısız sorular (öncelik sırası) ──────────────────────");
  for (const r of failures) {
    console.log(`  ❌ #${r.id} [${r.category}:${r.label}]`);
    console.log(`       Soru   : ${r.message}`);
    console.log(`       Neden  : ${r.reason}`);
    if (r.assistantTextPreview) {
      console.log(`       Yanıt  : ${r.assistantTextPreview}...`);
    }
    console.log();
  }
}

// ── WARN listesi ─────────────────────────────────────────────────────────────
const warnings = results.filter((r) => r.status === "WARN");
if (warnings.length > 0) {
  console.log("── Uyarılar (WARN) ──────────────────────────────────────────");
  for (const r of warnings) {
    console.log(`  ⚠️  #${r.id} [${r.category}:${r.label}] — ${r.reason}`);
  }
}

// ── JSON Rapor ────────────────────────────────────────────────────────────────
const report = {
  meta: {
    generated_at: new Date().toISOString(),
    endpoint: ENDPOINT,
    total: 50,
    pass: passCount,
    warn: warnCount,
    fail: failCount,
    avg_duration_ms: avgDuration,
    max_duration_ms: maxDuration,
    appstore_threshold: {
      pass_rate: thresholdPass,
      fail_count: thresholdFail,
      speed: thresholdSpeed,
      edge_case: thresholdEdge,
      instirah_bug_free: thresholdInstirah,
      overall: allThresholds,
    },
    category_stats: catStats,
  },
  results,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
console.log(`\n📄 Rapor kaydedildi: ${REPORT_PATH}`);
console.log("═══════════════════════════════════════════════════════════════\n");

if (!allThresholds) {
  process.exit(1);
}
