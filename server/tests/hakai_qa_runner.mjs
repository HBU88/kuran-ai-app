#!/usr/bin/env node
/**
 * HAKAI QA Runner — 50-soru deterministik dini test çalıştırıcı
 *
 * buildChatResponse pipeline'ını direkt çağırır (HTTP yok).
 * Her test için tüm check'leri değerlendirir, JSON rapor üretir.
 *
 * Kullanım:
 *   node tests/hakai_qa_runner.mjs
 *   node tests/hakai_qa_runner.mjs --filter namaz
 *   node tests/hakai_qa_runner.mjs --json          (sadece JSON çıktı)
 *   node tests/hakai_qa_runner.mjs --id namaz_01   (tek test)
 *
 * Çıktı:
 *   tests/hakai_qa_report.json
 *   console: renkli pass/fail özeti
 *
 * Exit kodu:
 *   0 = tüm testler geçti
 *   1 = en az bir test başarısız
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ---- Ortam ayarları ----
process.env.DEBUG_CHAT_ENGINE = "false";
// OpenAI key yoksa fallback'leri sessizce geç — test ortamı
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "test-placeholder-no-real-calls";
}

// ---- Modüller ----
const { buildChatResponse } = require("../agent/index");
const { checkTopicSupport } = require("../agent/topic_guard");

// ---- Sabitler ----
const SAFETY_BLOCK_TEXT =
  "Bu konuda zarar, nefret veya şiddeti destekleyen bir yönlendirme yapamam";
const REDIRECT_ILMIHAL_TEXT =
  "Bu soru ilmihal rehberi bölümüne daha uygundur";
const REPORT_PATH = path.join(__dirname, "hakai_qa_report.json");

// ---- CLI argümanları ----
const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const filterCategory = (() => {
  const i = args.indexOf("--filter");
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
})();
const filterId = (() => {
  const i = args.indexOf("--id");
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
})();

// ---- Suite yükle ----
const suiteRaw = await fs.readFile(
  path.join(__dirname, "hakai_qa_suite.json"),
  "utf8"
);
const suite = JSON.parse(suiteRaw);

// ---- Yardımcı fonksiyonlar ----
function normalizeForCheck(text) {
  return String(text || "").toLocaleLowerCase("tr-TR");
}

function getKbHitId(response) {
  return (
    response?.decision_meta?.knowledge_hit_id ||
    response?.decision_meta?.matched_knowledge_id ||
    null
  );
}

/**
 * Tek bir check'i değerlendirir.
 * @returns {{ pass: boolean, detail: string }}
 */
function evalCheck(check, response, topicGuardResult) {
  const dm = response?.decision_meta || {};
  const assistantText = response?.assistant_text || "";

  switch (check.type) {
    // ---- Konu kısıtlama ----
    case "topic_rejected": {
      const pass = topicGuardResult != null && !topicGuardResult.supported;
      return {
        pass,
        detail: `topic_guard → supported=${topicGuardResult?.supported}, reason=${topicGuardResult?.reason}`,
      };
    }

    // ---- KB isabeti (tam ID) ----
    case "kb_hit": {
      const hitId = getKbHitId(response);
      const pass = hitId === check.expected_kb;
      return {
        pass,
        detail: `knowledge_hit_id="${hitId}" (beklenen: "${check.expected_kb}")`,
      };
    }

    // ---- KB isabeti (prefix) ----
    case "kb_hit_prefix": {
      const hitId = getKbHitId(response) || "";
      const pass = hitId.startsWith(check.prefix);
      return {
        pass,
        detail: `knowledge_hit_id="${hitId}" (beklenen prefix: "${check.prefix}")`,
      };
    }

    // ---- Güvenlik filtresi tetiklenmemiş olmalı ----
    case "no_safety_block": {
      const pass = !assistantText.includes(SAFETY_BLOCK_TEXT);
      return {
        pass,
        detail: pass
          ? "güvenlik filtresi yok ✓"
          : `güvenlik filtresi tetiklendi: "${assistantText.slice(0, 100)}"`,
      };
    }

    // ---- Ayet modülünden ilmihale yönlendirilmemiş olmalı ----
    case "no_redirect_to_ilmihal": {
      const redirectModule = response?.redirect_module;
      const textHasRedirect = assistantText.includes(REDIRECT_ILMIHAL_TEXT);
      const pass = redirectModule !== "ilmihal" && !textHasRedirect;
      return {
        pass,
        detail: `redirect_module="${redirectModule}", metinde yönlendirme=${textHasRedirect}`,
      };
    }

    // ---- Ayet modülünden ilmihale yönlendirilmiş olmalı ----
    case "redirect_to_ilmihal": {
      const redirectModule = response?.redirect_module;
      const textHasRedirect = assistantText.includes(REDIRECT_ILMIHAL_TEXT);
      const pass = redirectModule === "ilmihal" || textHasRedirect;
      return {
        pass,
        detail: `redirect_module="${redirectModule}", metinde yönlendirme=${textHasRedirect}`,
      };
    }

    // ---- Cevap belirli metni içermeli ----
    case "answer_contains": {
      const norm = normalizeForCheck(assistantText);
      const needle = normalizeForCheck(check.text);
      const pass = norm.includes(needle);
      return {
        pass,
        detail: `aranan: "${check.text}" | cevap: "${assistantText.slice(0, 120)}"`,
      };
    }

    // ---- Cevap listeden birini içermeli ----
    case "answer_contains_any": {
      const norm = normalizeForCheck(assistantText);
      const matched = check.texts.find((t) =>
        norm.includes(normalizeForCheck(t))
      );
      return {
        pass: !!matched,
        detail: matched
          ? `eşleşen: "${matched}"`
          : `hiçbiri bulunamadı: [${check.texts.join(", ")}] | cevap: "${assistantText.slice(0, 120)}"`,
      };
    }

    // ---- Yanlış KB kullanılmamış olmalı ----
    case "no_wrong_kb": {
      const hitId = getKbHitId(response);
      const pass = hitId !== check.wrong_kb;
      return {
        pass,
        detail: `knowledge_hit_id="${hitId}" (yanlış olmamalı: "${check.wrong_kb}")`,
      };
    }

    // ---- Ayet döndürülmüş olmalı ----
    case "ayah_returned": {
      const pass =
        response?.ayah_used === true || response?.selected_ayah != null;
      return {
        pass,
        detail: `ayah_used=${response?.ayah_used}, selected_ayah=${response?.selected_ayah != null}`,
      };
    }

    default:
      return { pass: false, detail: `bilinmeyen check türü: "${check.type}"` };
  }
}

/**
 * Tek bir test vakasını çalıştırır.
 * @returns {{ id, status, checks, durationMs, response_meta }}
 */
async function runTest(testCase) {
  const { id, category, question, module: mod, checks } = testCase;
  const startMs = Date.now();

  let response = null;
  let topicGuardResult = null;
  let error = null;

  try {
    // 1) Topic guard — üretim sunucusundaki sırayla
    topicGuardResult = checkTopicSupport(question);

    // 2) Topic_rejected bekliyorsak buildChatResponse çağırmıyoruz
    //    (üretimle aynı davranış)
    const expectsTopicReject = checks.some((c) => c.type === "topic_rejected");
    if (!expectsTopicReject || topicGuardResult.supported) {
      response = await buildChatResponse(question, [], { module: mod });
    }
  } catch (err) {
    error = err.message || String(err);
  }

  const durationMs = Date.now() - startMs;

  // 3) Her check'i değerlendir
  const checkResults = checks.map((check) => {
    if (error) {
      return {
        type: check.type,
        pass: false,
        detail: `hata: ${error}`,
      };
    }
    const { pass, detail } = evalCheck(check, response, topicGuardResult);
    return { type: check.type, pass, detail };
  });

  const allPass = checkResults.every((c) => c.pass);
  const status = error ? "error" : allPass ? "pass" : "fail";

  return {
    id,
    category,
    question,
    module: mod,
    status,
    durationMs,
    checks: checkResults,
    response_meta: response
      ? {
          route_mode: response.decision_meta?.route_mode || null,
          knowledge_hit_id: getKbHitId(response),
          redirect_module: response.redirect_module || null,
          ayah_used: response.ayah_used || false,
          answer_preview: (response.assistant_text || "").slice(0, 200),
          openai_called: response.decision_meta?.openai_called || false,
        }
      : null,
    topic_guard: topicGuardResult,
    ...(error ? { error } : {}),
  };
}

// ---- Ana çalıştırma ----
const allTests = suite.tests.filter((t) => {
  if (filterId) return t.id === filterId;
  if (filterCategory) return t.category === filterCategory;
  return true;
});

if (!jsonOnly) {
  console.log(
    `\n🕌 HAKAI QA Runner — ${allTests.length} test çalıştırılıyor...\n`
  );
}

const results = [];
for (const testCase of allTests) {
  const result = await runTest(testCase);
  results.push(result);

  if (!jsonOnly) {
    const icon =
      result.status === "pass" ? "✅" : result.status === "error" ? "💥" : "❌";
    const failedChecks = result.checks
      .filter((c) => !c.pass)
      .map((c) => `  ↳ [${c.type}] ${c.detail}`)
      .join("\n");
    console.log(
      `${icon} ${result.id.padEnd(18)} ${result.question.slice(0, 50)}${
        result.question.length > 50 ? "…" : ""
      } (${result.durationMs}ms)`
    );
    if (failedChecks) console.log(failedChecks);
  }
}

// ---- Özet ----
const total = results.length;
const passed = results.filter((r) => r.status === "pass").length;
const failed = results.filter((r) => r.status === "fail").length;
const errors = results.filter((r) => r.status === "error").length;

const report = {
  generated_at: new Date().toISOString(),
  suite_version: suite.version,
  total,
  passed,
  failed,
  errors,
  pass_rate:
    total > 0 ? `${Math.round((passed / total) * 100)}%` : "0%",
  filter: filterCategory || filterId || null,
  results,
};

// Raporu yaz
await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `\n${"─".repeat(60)}`
  );
  console.log(
    `Sonuç: ${passed}/${total} geçti  •  ${failed} başarısız  •  ${errors} hata`
  );
  console.log(`Başarı oranı: ${report.pass_rate}`);
  console.log(`Rapor: ${REPORT_PATH}\n`);

  if (failed > 0 || errors > 0) {
    console.log("Başarısız testler:");
    results
      .filter((r) => r.status !== "pass")
      .forEach((r) => {
        console.log(`  ✗ ${r.id} — ${r.question}`);
        r.checks
          .filter((c) => !c.pass)
          .forEach((c) => console.log(`    [${c.type}] ${c.detail}`));
      });
    console.log();
  }
}

process.exit(failed > 0 || errors > 0 ? 1 : 0);
