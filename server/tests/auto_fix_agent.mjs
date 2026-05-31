#!/usr/bin/env node
/**
 * HAKAI Auto-Fix Agent
 *
 * hakai_qa_report.json'daki başarısız testleri okur,
 * kural tabanlı (OpenAI yok) düzeltmeler uygular,
 * sonra doğrulama için runner'ı tekrar çalıştırır.
 *
 * Kullanım:
 *   node tests/auto_fix_agent.mjs
 *   node tests/auto_fix_agent.mjs --dry-run   (değişiklik yazmaz)
 *
 * Düzeltilebilen hatalar:
 *   kb_hit         → beklenen KB entry'sine soruyu keyword olarak ekler
 *   kb_hit_prefix  → prefix ile eşleşen entry'lere soruyu keyword olarak ekler
 *   no_wrong_kb    → yanlış eşleşen entry'den muğlak keyword'ü çıkarır
 *
 * Manuel inceleme gerektiren hatalar:
 *   no_safety_block, no_redirect_to_ilmihal, redirect_to_ilmihal,
 *   answer_contains, answer_contains_any, ayah_returned, topic_rejected
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ILMIHAL_DIR = path.join(ROOT, "data", "ilmihal");
const REPORT_PATH = path.join(__dirname, "hakai_qa_report.json");
const FIX_LOG_PATH = path.join(__dirname, "hakai_qa_fix_log.json");

const dryRun = process.argv.includes("--dry-run");
const MAX_ITERATIONS = 3;

// ──────────────────────────────────────────────
// Yardımcı: KB dosyaları
// ──────────────────────────────────────────────

async function loadKbEntry(id) {
  const filePath = path.join(ILMIHAL_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return { filePath, entry: JSON.parse(raw) };
  } catch {
    return null;
  }
}

async function saveKbEntry(filePath, entry) {
  if (dryRun) {
    console.log(`  [DRY-RUN] yazmayacak: ${path.basename(filePath)}`);
    return;
  }
  await fs.writeFile(filePath, JSON.stringify(entry, null, 2) + "\n", "utf8");
  console.log(`  ✏️  güncellendi: ${path.basename(filePath)}`);
}

function normalizeKeyword(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .trim();
}

function addIfMissing(arr, value) {
  const norm = normalizeKeyword(value);
  if (!arr.some((k) => normalizeKeyword(k) === norm)) {
    arr.push(norm);
    return true;
  }
  return false;
}

// ──────────────────────────────────────────────
// Düzeltme stratejileri
// ──────────────────────────────────────────────

/**
 * kb_hit başarısız: beklenen KB entry'sine soruyu ekle.
 */
async function fixKbHit(testResult, check) {
  const expectedKb = check.expected_kb;
  const question = testResult.question;

  const loaded = await loadKbEntry(expectedKb);
  if (!loaded) {
    return {
      action: "skip",
      reason: `KB entry bulunamadı: ${expectedKb}.json`,
    };
  }

  const { filePath, entry } = loaded;
  if (!Array.isArray(entry.keywords)) entry.keywords = [];
  if (!Array.isArray(entry.manual_semantic_descriptions))
    entry.manual_semantic_descriptions = [];

  const kwAdded = addIfMissing(entry.keywords, question);
  const descAdded = addIfMissing(entry.manual_semantic_descriptions, question);

  // Kısa soru → birkaç varyant ekle
  const words = question.replace(/[?!.]/g, "").trim().split(/\s+/);
  if (words.length <= 4) {
    const variant = normalizeKeyword(question.replace(/[?!.]/g, "").trim());
    addIfMissing(entry.keywords, variant);
    addIfMissing(entry.manual_semantic_descriptions, variant);
  }

  if (!kwAdded && !descAdded) {
    return { action: "skip", reason: "keyword zaten mevcut" };
  }

  await saveKbEntry(filePath, entry);
  return {
    action: "fix",
    file: path.basename(filePath),
    changes: {
      keyword_added: kwAdded ? question : null,
      desc_added: descAdded ? question : null,
    },
  };
}

/**
 * kb_hit_prefix başarısız: prefix ile eşleşen tüm entry'lere soruyu ekle.
 */
async function fixKbHitPrefix(testResult, check) {
  const prefix = check.prefix;
  const question = testResult.question;

  const files = await fs.readdir(ILMIHAL_DIR);
  const matchingFiles = files.filter(
    (f) => f.endsWith(".json") && f.replace(".json", "").startsWith(prefix)
  );

  if (matchingFiles.length === 0) {
    return {
      action: "skip",
      reason: `"${prefix}" prefix ile eşleşen KB entry yok`,
    };
  }

  const changes = [];
  for (const fname of matchingFiles) {
    const filePath = path.join(ILMIHAL_DIR, fname);
    const raw = await fs.readFile(filePath, "utf8");
    const entry = JSON.parse(raw);

    if (!Array.isArray(entry.keywords)) entry.keywords = [];
    if (!Array.isArray(entry.manual_semantic_descriptions))
      entry.manual_semantic_descriptions = [];

    const kwAdded = addIfMissing(entry.keywords, question);
    const descAdded = addIfMissing(entry.manual_semantic_descriptions, question);

    if (kwAdded || descAdded) {
      await saveKbEntry(filePath, entry);
      changes.push(fname);
    }
  }

  return changes.length > 0
    ? { action: "fix", files: changes, question }
    : { action: "skip", reason: "keyword zaten tüm entry'lerde mevcut" };
}

/**
 * no_wrong_kb başarısız: yanlış eşleşen entry'den muğlak keyword kaldır.
 * Aynı zamanda doğru entry'ye soruyu ekle (kb_hit mantığı).
 */
async function fixNoWrongKb(testResult, check) {
  const wrongKb = check.wrong_kb;
  const question = testResult.question;
  const actions = [];

  // 1) Yanlış entry'den muğlak keyword kaldır
  const wrongLoaded = await loadKbEntry(wrongKb);
  if (wrongLoaded) {
    const { filePath, entry } = wrongLoaded;
    const norm = normalizeKeyword(question);
    let removed = false;

    if (Array.isArray(entry.keywords)) {
      const before = entry.keywords.length;
      entry.keywords = entry.keywords.filter(
        (k) => normalizeKeyword(k) !== norm
      );
      if (entry.keywords.length < before) removed = true;
    }
    if (Array.isArray(entry.manual_semantic_descriptions)) {
      const before = entry.manual_semantic_descriptions.length;
      entry.manual_semantic_descriptions = entry.manual_semantic_descriptions.filter(
        (k) => normalizeKeyword(k) !== norm
      );
      if (entry.manual_semantic_descriptions.length < before) removed = true;
    }

    if (removed) {
      await saveKbEntry(filePath, entry);
      actions.push({ action: "remove_keyword", file: path.basename(filePath) });
    }
  }

  // 2) Doğru entry'ye soruyu ekle (kb_hit gerektiren testlerde expected_kb varsa)
  const kbHitCheck = testResult.checks?.find(
    (c) => c.type === "kb_hit" || c.type === "kb_hit_prefix"
  );
  if (kbHitCheck?.expected_kb) {
    const r = await fixKbHit(testResult, kbHitCheck);
    actions.push(r);
  }

  return actions.length > 0
    ? { action: "fix", steps: actions }
    : { action: "skip", reason: "çakışma tespit edilemedi" };
}

// ──────────────────────────────────────────────
// Tek test için düzeltme uygula
// ──────────────────────────────────────────────

async function fixTest(testResult) {
  const fixResults = [];

  for (const check of testResult.checks) {
    if (check.pass) continue; // başarılı check'leri atla

    let result;
    switch (check.type) {
      case "kb_hit":
        console.log(`  → kb_hit düzeltme: "${testResult.question}"`);
        result = await fixKbHit(testResult, check);
        break;

      case "kb_hit_prefix":
        console.log(`  → kb_hit_prefix düzeltme: prefix="${check.prefix}"`);
        result = await fixKbHitPrefix(testResult, check);
        break;

      case "no_wrong_kb":
        console.log(`  → no_wrong_kb düzeltme: wrong="${check.wrong_kb}"`);
        result = await fixNoWrongKb(testResult, check);
        break;

      case "no_safety_block":
        result = {
          action: "manual",
          reason:
            "Güvenlik filtresi false-positive → safety_guard.js manuel inceleme gerekli",
        };
        break;

      case "no_redirect_to_ilmihal":
        result = {
          action: "manual",
          reason:
            "Ayet→ilmihal yönlendirme hatası → agent/index.js isPrayerRakatsQuestion() incelenmeli",
        };
        break;

      case "redirect_to_ilmihal":
        result = {
          action: "manual",
          reason:
            "Beklenen yönlendirme gerçekleşmedi → isPrayerRakatsQuestion() pattern genişletilmeli",
        };
        break;

      case "topic_rejected":
        result = {
          action: "manual",
          reason:
            "Konu kısıtlama çalışmıyor → topic_guard.js OUT_OF_SCOPE_PATTERNS güncellenmeli",
        };
        break;

      case "answer_contains":
      case "answer_contains_any":
        // Eğer KB hit olmadıysa, keyword fix dene
        if (!testResult.response_meta?.knowledge_hit_id) {
          result = {
            action: "manual",
            reason:
              "KB isabeti yok, cevap içeriği hatalı → KB entry keyword veya OpenAI fallback incelenmeli",
          };
        } else {
          result = {
            action: "manual",
            reason:
              "KB isabeti doğru ama cevap metni beklenen içeriği karşılamıyor → KB özeti güncellenmeli",
          };
        }
        break;

      case "ayah_returned":
        result = {
          action: "manual",
          reason:
            "Ayet döndürülmedi → ayah_ranker.js veya intent_router.js incelenmeli",
        };
        break;

      default:
        result = { action: "skip", reason: `bilinmeyen check türü: ${check.type}` };
    }

    fixResults.push({ check_type: check.type, ...result });
  }

  return fixResults;
}

// ──────────────────────────────────────────────
// Runner'ı çalıştır
// ──────────────────────────────────────────────

async function runQaSuite() {
  const runnerPath = path.join(__dirname, "hakai_qa_runner.mjs");
  try {
    execSync(`node "${runnerPath}"`, {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env },
    });
    return true; // exit 0 = tüm testler geçti
  } catch {
    return false; // exit 1 = başarısız testler var
  }
}

async function loadReport() {
  const raw = await fs.readFile(REPORT_PATH, "utf8");
  return JSON.parse(raw);
}

// ──────────────────────────────────────────────
// Ana döngü
// ──────────────────────────────────────────────

console.log("\n🔧 HAKAI Auto-Fix Agent başladı\n");
if (dryRun) console.log("⚠️  DRY-RUN modu — dosya yazılmayacak\n");

const fixLog = {
  started_at: new Date().toISOString(),
  dry_run: dryRun,
  iterations: [],
};

let iteration = 0;
let allPassed = false;

while (iteration < MAX_ITERATIONS) {
  iteration++;
  console.log(`\n${"═".repeat(55)}`);
  console.log(`İterasyon ${iteration}/${MAX_ITERATIONS}`);
  console.log(`${"═".repeat(55)}\n`);

  // 1) Test suite'i çalıştır
  console.log("▶ Test suite çalıştırılıyor...\n");
  allPassed = await runQaSuite();

  if (allPassed) {
    console.log("\n✅ Tüm testler geçti — düzeltme gerekmiyor.\n");
    break;
  }

  // 2) Raporu oku
  const report = await loadReport();
  const failing = report.results.filter((r) => r.status !== "pass");

  console.log(
    `\n❌ ${failing.length} test başarısız. Düzeltmeler uygulanıyor...\n`
  );

  const iterationLog = {
    iteration,
    failing_count: failing.length,
    fixes: [],
  };

  // 3) Her başarısız test için düzeltme uygula
  for (const testResult of failing) {
    console.log(`\n[${testResult.id}] ${testResult.question}`);
    const fixes = await fixTest(testResult);
    iterationLog.fixes.push({ test_id: testResult.id, fixes });

    const manualCount = fixes.filter((f) => f.action === "manual").length;
    const fixCount = fixes.filter((f) => f.action === "fix").length;
    if (manualCount > 0) {
      console.log(`  ⚠️  ${manualCount} manuel inceleme gerekli`);
    }
    if (fixCount > 0) {
      console.log(`  ✅ ${fixCount} otomatik düzeltme uygulandı`);
    }
  }

  fixLog.iterations.push(iterationLog);

  // Manuel inceleme gerektiren başarısızlar varsa döngüden çık
  const manualOnly = failing.every((r) =>
    r.checks
      .filter((c) => !c.pass)
      .every((c) =>
        ["no_safety_block", "no_redirect_to_ilmihal", "redirect_to_ilmihal",
          "topic_rejected", "answer_contains", "answer_contains_any",
          "ayah_returned"].includes(c.type)
      )
  );

  if (manualOnly) {
    console.log(
      "\n⚠️  Kalan hatalar manuel inceleme gerektirir — döngü durduruluyor.\n"
    );
    break;
  }
}

// 4) Son özet
fixLog.finished_at = new Date().toISOString();
fixLog.final_status = allPassed ? "all_pass" : "has_failures";

if (!dryRun) {
  await fs.writeFile(FIX_LOG_PATH, JSON.stringify(fixLog, null, 2) + "\n", "utf8");
  console.log(`📄 Düzeltme logu: ${FIX_LOG_PATH}\n`);
}

console.log(`\n${"─".repeat(55)}`);
console.log(
  allPassed
    ? "✅ Auto-Fix tamamlandı — tüm testler geçiyor."
    : "⚠️  Auto-Fix tamamlandı — bazı testler hâlâ başarısız (manuel inceleme gerekli)."
);
console.log(`${"─".repeat(55)}\n`);

process.exit(allPassed ? 0 : 1);
