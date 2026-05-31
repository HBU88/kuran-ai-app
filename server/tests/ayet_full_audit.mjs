/**
 * ayet_full_audit.mjs
 * Offline 50-soru audit: ayet ranker sistemini test eder.
 * Sunucu gerekmez — rankAyahs + analyzeUserMessageFallback + ayahs.json doğrudan çağrılır.
 *
 * Çalıştır:
 *   node server/tests/ayet_full_audit.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { rankAyahs } = require("../agent/ayah_ranker.js");
const { analyzeUserMessageFallback } = require("../agent/intent_router.js");
const { loadAyahDataset } = require("../utils/load_ayah_dataset.js");

// ── Ayetleri yükle ──────────────────────────────────────────────────────────
const datasetResult = loadAyahDataset();
const allAyahs = datasetResult.ayahs;

if (!allAyahs || allAyahs.length === 0) {
  console.error("HATA: ayahs.json yüklenemedi veya boş.");
  process.exit(1);
}
console.log(`✓ ${allAyahs.length} ayet yüklendi (kaynak: ${datasetResult.sourcePath})\n`);

// ── Test vakası tanımı ───────────────────────────────────────────────────────
// expectedTags: en azından biri top ayet tags[] dizisinde bulunmalı
// expectedSurahNumbers: (opsiyonel) surahNumber eşleşmesi de kabul edilir
const TEST_CASES = [
  // ── KATEGORI 1: Mevcut çalışan temalar (17 vaka) ─────────────────────────
  {
    id: 1,
    category: "Mevcut – sabır",
    message: "Sabır hakkında güzel bir ayet söyler misin?",
    expectedTags: ["sabır", "sebat"],
  },
  {
    id: 2,
    category: "Mevcut – umut",
    message: "Umut verici bir ayet istiyorum, çok bunaldım",
    expectedTags: ["umut", "tevekkül"],
  },
  {
    id: 3,
    category: "Mevcut – tövbe",
    message: "Tövbe ile ilgili bir ayet paylaşır mısın?",
    expectedTags: ["tövbe", "bağışlanma", "istiğfar"],
  },
  {
    id: 4,
    category: "Mevcut – yalnızlık",
    message: "Çok yalnız hissediyorum, bir ayet ver",
    expectedTags: ["yalnızlık"],
    expectedSurahNumbers: [2, 50, 57, 13, 93],
  },
  {
    id: 5,
    category: "Mevcut – şifa",
    message: "Çok hastayım, şifa için bir ayet istiyorum",
    expectedTags: ["şifa", "hastalık", "sabır"],
    expectedSurahNumbers: [26, 17, 10],
  },
  {
    id: 6,
    category: "Mevcut – kaygı",
    message: "Kaygım çok fazla, içim sıkılıyor",
    expectedTags: ["kaygı", "tevekkül", "umut"],
  },
  {
    id: 7,
    category: "Mevcut – korku",
    message: "Çok korkuyorum, bana ayet söyle",
    expectedTags: ["korku", "tevekkül"],
  },
  {
    id: 8,
    category: "Mevcut – tevekkül",
    message: "Tevekkül ile ilgili bir ayet istiyorum",
    expectedTags: ["tevekkül", "umut"],
  },
  {
    id: 9,
    category: "Mevcut – şükür",
    message: "Allah'a şükretmek istiyorum, şükür ayeti var mı?",
    expectedTags: ["şükür", "umut"],
  },
  {
    id: 10,
    category: "Mevcut – adalet",
    message: "Zulme uğradım, adaleti anlatan bir ayet",
    expectedTags: ["adalet", "zulüm"],
  },
  {
    id: 11,
    category: "Mevcut – rızık",
    message: "Rızık için endişeleniyorum, ayet istiyorum",
    expectedTags: ["tevekkül", "umut", "şükür"],
  },
  {
    id: 12,
    category: "Mevcut – ölüm korkusu",
    message: "Ölümden çok korkuyorum, bir ayet söyle",
    expectedTags: ["ölüm", "tevekkül", "korku"],
  },
  {
    id: 13,
    category: "Mevcut – Hz. Muhammed",
    message: "Peygamberimiz Hz. Muhammed hakkında bir ayet var mı?",
    expectedTags: ["güzel ahlak"],
    expectedSurahNumbers: [33, 68, 21, 48, 47],
  },
  {
    id: 14,
    category: "Mevcut – sabır/imtihan",
    message: "İmtihandayım, güç veren bir ayet istiyorum",
    expectedTags: ["sabır", "sebat", "tevekkül"],
  },
  {
    id: 15,
    category: "Mevcut – günah/tövbe",
    message: "Günah işledim, tövbe etmek istiyorum, bir ayet",
    expectedTags: ["tövbe", "bağışlanma", "günahlar"],
  },
  {
    id: 16,
    category: "Mevcut – affetmek",
    message: "Affetmek ile ilgili güzel bir ayet",
    expectedTags: ["affetmek", "sabır", "merhamet"],
  },
  {
    id: 17,
    category: "Mevcut – pişmanlık",
    message: "Pişmanım yaptıklarımdan, bir ayet söyle",
    expectedTags: ["tövbe", "pişmanlık", "bağışlanma"],
  },

  // ── KATEGORI 2: Yeni duygusal temalar (8 vaka) ───────────────────────────
  {
    id: 18,
    category: "Yeni – öfke",
    message: "Çok öfkeliyim, öfkeyle ilgili bir ayet var mı?",
    expectedTags: ["öfke", "affetmek", "irade"],
    expectedSurahNumbers: [3], // Âl-i İmrân 3:134
  },
  {
    id: 19,
    category: "Yeni – hüzün",
    message: "Hüzün içindeyim, hüzünle ilgili bir ayet",
    expectedTags: ["hüzün", "sabır", "umut"],
    expectedSurahNumbers: [12], // Yûsuf 12:86
  },
  {
    id: 20,
    category: "Yeni – sevinç",
    message: "Sevinç ve mutluluk hakkında bir ayet istiyorum",
    expectedTags: ["sevinç", "şükür", "umut"],
    expectedSurahNumbers: [10], // Yûnus 10:58
  },
  {
    id: 21,
    category: "Yeni – haset/kıskançlık",
    message: "Kıskançlık ve haset konusunda bir ayet",
    expectedTags: ["haset", "kötülükler"],
    expectedSurahNumbers: [113], // Felak 113:5
  },
  {
    id: 22,
    category: "Yeni – kibir/gurur",
    message: "Kibir ve gurur ile ilgili bir ayet söyle",
    expectedTags: ["kibir", "kötülükler"],
    expectedSurahNumbers: [31], // Lokmân 31:18
  },
  {
    id: 23,
    category: "Yeni – öfke kontrolü",
    message: "Öfkemi kontrol edemiyorum, bana yardımcı olacak ayet",
    expectedTags: ["öfke", "affetmek", "irade"],
    expectedSurahNumbers: [3],
  },
  {
    id: 24,
    category: "Yeni – sevinç/şükür",
    message: "Sevindim bugün, şükür ve sevinç ayeti",
    expectedTags: ["sevinç", "şükür"],
    expectedSurahNumbers: [10],
  },
  {
    id: 25,
    category: "Yeni – irade/nefs",
    message: "Nefsimi kontrol etmeye çalışıyorum, bir ayet",
    expectedTags: ["irade", "sebat", "tövbe"],
  },

  // ── KATEGORI 3: Ahlaki konular (8 vaka) ──────────────────────────────────
  {
    id: 26,
    category: "Ahlak – haramlar",
    message: "Haramlardan uzak durmak istiyorum, ayet ver",
    expectedTags: ["haramlar", "kötülükler", "günahlar"],
    expectedSurahNumbers: [17, 7], // İsrâ 17:32, A'râf 7:33
  },
  {
    id: 27,
    category: "Ahlak – günahlar",
    message: "Günahlarımdan kurtulmak istiyorum",
    expectedTags: ["günahlar", "tövbe", "bağışlanma"],
  },
  {
    id: 28,
    category: "Ahlak – iyilikler",
    message: "İyilik yapmak istiyorum, teşvik eden bir ayet",
    expectedTags: ["iyilikler", "merhamet", "cömertlik"],
  },
  {
    id: 29,
    category: "Ahlak – kötülükler",
    message: "Kötülükten uzak durmak için ayet istiyorum",
    expectedTags: ["kötülükler", "günahlar", "haramlar"],
  },
  {
    id: 30,
    category: "Ahlak – gıybet",
    message: "Gıybet ile ilgili bir ayet söyler misin?",
    expectedTags: ["gıybet", "kötülükler"],
    expectedSurahNumbers: [49], // Hucurât 49:12
  },
  {
    id: 31,
    category: "Ahlak – emanet",
    message: "Emanete ihanet ile ilgili bir ayet",
    expectedTags: ["emanet", "adalet", "doğruluk"],
    expectedSurahNumbers: [4], // Nisâ 4:58
  },
  {
    id: 32,
    category: "Ahlak – doğruluk",
    message: "Sadakat ve doğruluk hakkında bir ayet istiyorum",
    expectedTags: ["doğruluk", "iyilikler"],
    expectedSurahNumbers: [33, 4], // Ahzâb 33:70, Nisâ 4:58
  },
  {
    id: 33,
    category: "Ahlak – infak/cömertlik",
    message: "Zekat ve sadaka hakkında bir ayet, infak ayeti",
    expectedTags: ["infak", "cömertlik", "iyilikler"],
    expectedSurahNumbers: [2], // Bakara 2:261 veya 2:195
  },

  // ── KATEGORI 4: Ahiret/ölüm konuları (5 vaka) ────────────────────────────
  {
    id: 34,
    category: "Ahiret – genel",
    message: "Ahiret ile ilgili bir ayet istiyorum",
    expectedTags: ["ahiret", "ölüm", "hesap"],
  },
  {
    id: 35,
    category: "Ahiret – ölüm",
    message: "Ölüm ve hayat hakkında bir ayet",
    expectedTags: ["ölüm", "ahiret", "tevekkül"],
  },
  {
    id: 36,
    category: "Ahiret – hesap",
    message: "Hesap günü hakkında bir ayet söyle",
    expectedTags: ["ahiret", "hesap", "günahlar"],
    expectedSurahNumbers: [99], // Zilzâl
  },
  {
    id: 37,
    category: "Ahiret – kıyamet",
    message: "Kıyamet günü ile ilgili bir ayet",
    expectedTags: ["ahiret", "ölüm", "hesap"],
  },
  {
    id: 38,
    category: "Ahiret – ölüm korkusu/tevekkül",
    message: "Öldükten sonra ne olacağını düşünüp korkuyorum",
    expectedTags: ["ölüm", "tevekkül", "ahiret", "korku"],
  },

  // ── KATEGORI 5: Mucizeler — peygamber bazında (12 vaka) ──────────────────
  {
    id: 39,
    category: "Mucize – Hz. Musa (asa)",
    message: "Hz. Musa'nın asası hakkında bir ayet",
    expectedTags: ["mucizeler", "Hz. Musa", "peygamberler"],
    expectedSurahNumbers: [20, 26], // Tâhâ 20:20, Şuarâ 26:63
  },
  {
    id: 40,
    category: "Mucize – Hz. İbrahim (ateş)",
    message: "Hz. İbrahim'in ateşe atılması ve korunması",
    expectedTags: ["mucizeler", "Hz. İbrahim", "peygamberler"],
    expectedSurahNumbers: [21], // Enbiyâ 21:69
  },
  {
    id: 41,
    category: "Mucize – Hz. İsa",
    message: "Hz. İsa'nın mucizeleri hakkında bir ayet",
    expectedTags: ["mucizeler", "Hz. İsa", "peygamberler"],
    expectedSurahNumbers: [3, 19], // Âl-i İmrân 3:49, Meryem 19:30
  },
  {
    id: 42,
    category: "Mucize – Hz. Süleyman",
    message: "Hz. Süleyman'ın mucizelerini anlatan ayet",
    expectedTags: ["mucizeler", "Hz. Süleyman", "peygamberler"],
    expectedSurahNumbers: [21], // Enbiyâ 21:81
  },
  {
    id: 43,
    category: "Mucize – Hz. Davud",
    message: "Hz. Davud ile ilgili bir ayet istiyorum",
    expectedTags: ["mucizeler", "Hz. Davud", "peygamberler"],
    expectedSurahNumbers: [34], // Sebe 34:10
  },
  {
    id: 44,
    category: "Mucize – Hz. Zekeriyya",
    message: "Hz. Zekeriyya ve yaşlılıkta çocuk sahibi olması",
    expectedTags: ["mucizeler", "Hz. Zekeriyya", "peygamberler"],
    expectedSurahNumbers: [19], // Meryem 19:7
  },
  {
    id: 45,
    category: "Mucize – Hz. Meryem",
    message: "Hz. Meryem hakkında bir ayet paylaşır mısın?",
    expectedTags: ["mucizeler", "Hz. Meryem", "peygamberler"],
    expectedSurahNumbers: [3], // Âl-i İmrân 3:37
  },
  {
    id: 46,
    category: "Mucize – İsra ve Mirac",
    message: "İsra ve Mirac hakkında bir ayet",
    expectedTags: ["mucizeler", "İsra ve Mirac", "Hz. Muhammed"],
    expectedSurahNumbers: [17], // İsrâ 17:1
  },
  {
    id: 47,
    category: "Mucize – Kur'an mucizesi",
    message: "Kur'an'ın mucizesi hakkında bir ayet istiyorum",
    expectedTags: ["mucizeler", "Kur'an"],
    expectedSurahNumbers: [17], // İsrâ 17:88
  },
  {
    id: 48,
    category: "Mucize – yaratılış/evren",
    message: "Evrenin yaratılışı hakkında bir ayet",
    expectedTags: ["mucizeler", "yaratılış", "tefekkür"],
    expectedSurahNumbers: [21, 3, 95], // Enbiyâ 21:30, Âl-i İmrân 3:190, Tîn 95:4
  },
  {
    id: 49,
    category: "Mucize – denizin yarılması",
    message: "Hz. Musa denizi yarması mucizesi",
    expectedTags: ["mucizeler", "Hz. Musa", "peygamberler"],
    expectedSurahNumbers: [26], // Şuarâ 26:63
  },
  {
    id: 50,
    category: "Mucize – ayın ikiye bölünmesi",
    message: "Ayın ikiye bölünmesi mucizesi",
    expectedTags: ["mucizeler", "Hz. Muhammed"],
    expectedSurahNumbers: [54], // Kamer 54:1
  },
];

// ── Test çalıştırıcı ─────────────────────────────────────────────────────────
function runTestCase(tc) {
  const analysis = analyzeUserMessageFallback(tc.message, []);
  const results = rankAyahs(analysis, allAyahs, {
    current_message: tc.message,
    explicit_ayah_request: true,
  });

  const topAyah = results[0];

  if (!topAyah) {
    return {
      pass: false,
      reason: "Sonuç boş — ranker hiç ayet döndürmedi",
      topAyah: null,
      analysis,
    };
  }

  const topTags = Array.isArray(topAyah.tags) ? topAyah.tags : [];
  const tagMatch = tc.expectedTags.some((t) => topTags.includes(t));
  const surahMatch =
    Array.isArray(tc.expectedSurahNumbers) &&
    tc.expectedSurahNumbers.includes(topAyah.surahNumber);

  const pass = tagMatch || surahMatch;
  const reason = pass
    ? null
    : `Beklenen etiket [${tc.expectedTags.join(", ")}]${tc.expectedSurahNumbers ? ` veya sure [${tc.expectedSurahNumbers.join(", ")}]` : ""} — dönen: ${topAyah.surah} ${topAyah.surahNumber}:${topAyah.ayahNumber} tags=[${topTags.join(", ")}]`;

  return { pass, reason, topAyah, analysis };
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
const results = [];
const categoryStats = {};

for (const tc of TEST_CASES) {
  const result = runTestCase(tc);
  results.push({ tc, ...result });

  const catKey = tc.category.split(" – ")[0].trim();
  if (!categoryStats[catKey]) categoryStats[catKey] = { pass: 0, fail: 0 };
  if (result.pass) categoryStats[catKey].pass++;
  else categoryStats[catKey].fail++;
}

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
const total = results.length;

// ── Rapor ────────────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════════════");
console.log(" HAKAI – Ayet Rehberi Tam Audit (50 Soru)");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("── Vaka bazında sonuçlar ────────────────────────────────────\n");
for (const r of results) {
  const icon = r.pass ? "✅" : "❌";
  const ayahRef = r.topAyah
    ? `${r.topAyah.surah} ${r.topAyah.surahNumber}:${r.topAyah.ayahNumber} (skor: ${r.topAyah.final_score ?? "?"})`
    : "—";
  console.log(`${icon} #${String(r.tc.id).padStart(2, "0")} [${r.tc.category}]`);
  console.log(`     Soru  : ${r.tc.message}`);
  console.log(`     Dönen : ${ayahRef}`);
  if (!r.pass) {
    console.log(`     NEDEN : ${r.reason}`);
  }
  console.log();
}

console.log("── Kategori özeti ───────────────────────────────────────────\n");
for (const [cat, stat] of Object.entries(categoryStats)) {
  const total_cat = stat.pass + stat.fail;
  const bar = "█".repeat(stat.pass) + "░".repeat(stat.fail);
  console.log(
    `  ${cat.padEnd(12)} ${bar}  ${stat.pass}/${total_cat}`
  );
}

console.log();
console.log("── Başarısız vakalar (öncelik sırası) ──────────────────────\n");
const failures = results.filter((r) => !r.pass);
if (failures.length === 0) {
  console.log("  Tüm vakalar geçti! 🎉");
} else {
  for (const r of failures) {
    const topTags = r.topAyah ? (r.topAyah.tags || []).join(", ") : "—";
    const topSurah = r.topAyah
      ? `${r.topAyah.surah} ${r.topAyah.surahNumber}:${r.topAyah.ayahNumber}`
      : "—";
    console.log(`  #${r.tc.id} ${r.tc.category}`);
    console.log(`       Beklenen etiket  : ${r.tc.expectedTags.join(", ")}`);
    if (r.tc.expectedSurahNumbers) {
      console.log(`       Kabul sure no   : ${r.tc.expectedSurahNumbers.join(", ")}`);
    }
    console.log(`       Dönen sure/ayet : ${topSurah}`);
    console.log(`       Dönen etiketler : ${topTags}`);
    const pTheme = r.analysis?.primary_theme || "—";
    const sThemes = (r.analysis?.secondary_themes || []).join(", ") || "—";
    console.log(`       Analiz temalar  : ${pTheme} / [${sThemes}]`);
    console.log();
  }
}

console.log("═══════════════════════════════════════════════════════════════");
const pct = Math.round((passed / total) * 100);
console.log(
  ` SONUÇ: ${passed}/${total} GEÇTI (${pct}%)  |  ${failed} BAŞARISIZ`
);
console.log("═══════════════════════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
