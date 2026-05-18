import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..", "..");
const CASES_PATH = path.join(SERVER_ROOT, "tests", "ilmihal_regression_cases.json");
const ENDPOINT = "http://localhost:3000/chat";
const DEBUG_ENDPOINT = "http://localhost:3000/debug/resolve";
const HEALTH_ENDPOINT = "http://localhost:3000/health";
const BACKEND_STDOUT_LOG = path.join(SERVER_ROOT, "..", "test_artifacts", "logs", "ilmihal_regression.backend.stdout.log");
const BACKEND_STDERR_LOG = path.join(SERVER_ROOT, "..", "test_artifacts", "logs", "ilmihal_regression.backend.stderr.log");

function parseArgs(argv) {
  const tags = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--tag" && typeof argv[i + 1] === "string") {
      tags.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (value.startsWith("--tag=")) {
      tags.push(value.slice("--tag=".length));
    }
  }
  return tags
    .flatMap((tag) => String(tag || "").split(","))
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function readCases() {
  const raw = fs.readFileSync(CASES_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Regression case file must contain a JSON array.");
  }
  return parsed;
}

function normalizeForMatch(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
}

function matchesTags(caseItem, tags) {
  if (!tags.length) return true;
  const caseTags = Array.isArray(caseItem.tags) ? caseItem.tags.map((tag) => String(tag || "").trim()) : [];
  return tags.some((tag) => caseTags.includes(tag));
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON response from ${url}: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${payload?.error || text}`);
  }
  return payload;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function testBackendHealthy() {
  try {
    const response = await fetch(HEALTH_ENDPOINT);
    return response.ok;
  } catch {
    return false;
  }
}

async function startBackendIfNeeded() {
  if (await testBackendHealthy()) {
    return null;
  }

  ensureDir(BACKEND_STDOUT_LOG);
  ensureDir(BACKEND_STDERR_LOG);

  const child = spawn(process.execPath, ["index.js"], {
    cwd: SERVER_ROOT,
    stdio: ["ignore", fs.openSync(BACKEND_STDOUT_LOG, "a"), fs.openSync(BACKEND_STDERR_LOG, "a")],
    windowsHide: true,
    detached: true,
  });
  child.unref();

  for (let i = 0; i < 60; i += 1) {
    if (await testBackendHealthy()) {
      return child;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Backend did not become healthy in time.");
}

async function postChat(query) {
  return postJson(ENDPOINT, { message: query, history: [] });
}

async function postDebugResolve(query) {
  const response = await fetch(`${DEBUG_ENDPOINT}?module=ilmihal&q=${encodeURIComponent(query)}`);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON response from debug endpoint: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from debug endpoint: ${payload?.error || text}`);
  }
  return payload;
}

async function runCase(testCase) {
  const chatPayload = await postChat(testCase.query);
  const assistantText = normalizeForMatch(chatPayload?.assistant_text || "");
  if (!assistantText) {
    return { passed: false, reason: "assistant_text missing" };
  }

  const expectedTextContains = Array.isArray(testCase.expected_text_contains)
    ? testCase.expected_text_contains
    : [];
  for (const expected of expectedTextContains) {
    const normalizedExpected = normalizeForMatch(expected);
    if (!assistantText.includes(normalizedExpected)) {
      return { passed: false, reason: `assistant_text missing ${normalizedExpected}` };
    }
  }

  const chatKnowledgeHitId = chatPayload?.decision_meta?.knowledge_hit_id || null;
  let debugKnowledgeHitId = null;
  try {
    const debugPayload = await postDebugResolve(testCase.query);
    debugKnowledgeHitId = debugPayload?.knowledge_hit_id || null;
  } catch (error) {
    if (!chatKnowledgeHitId) {
      return {
        passed: false,
        reason: `knowledge_hit_id unavailable (${error.message})`,
      };
    }
  }

  const resolvedKnowledgeHitId = chatKnowledgeHitId || debugKnowledgeHitId;
  if (!resolvedKnowledgeHitId) {
    return { passed: false, reason: "knowledge_hit_id missing" };
  }
  if (resolvedKnowledgeHitId !== testCase.expected_knowledge_hit_id) {
    return {
      passed: false,
      reason: `knowledge_hit_id=${resolvedKnowledgeHitId}`,
    };
  }
  if (chatKnowledgeHitId && debugKnowledgeHitId && chatKnowledgeHitId !== debugKnowledgeHitId) {
    return {
      passed: false,
      reason: `knowledge_hit_id mismatch chat=${chatKnowledgeHitId} debug=${debugKnowledgeHitId}`,
    };
  }

  return { passed: true, knowledgeHitId: resolvedKnowledgeHitId };
}

async function main() {
  await startBackendIfNeeded();
  const tags = parseArgs(process.argv.slice(2));
  const cases = readCases();
  const selectedCases = cases.filter((caseItem) => matchesTags(caseItem, tags));

  if (tags.length > 0 && selectedCases.length === 0) {
    console.error(`FAIL: no ilmihal regression cases matched tag(s): ${tags.join(", ")}`);
    process.exit(1);
  }

  console.log(`Regression cases loaded: ${cases.length}`);
  console.log(`Selected cases: ${selectedCases.length}${tags.length ? ` (tags: ${tags.join(", ")})` : ""}`);

  const failures = [];
  for (const testCase of selectedCases) {
    try {
      const result = await runCase(testCase);
      if (!result.passed) {
        failures.push({ id: testCase.id, reason: result.reason });
        console.log(`FAIL [${testCase.id}] ${testCase.query} -> ${result.reason}`);
        continue;
      }
      console.log(`PASS [${testCase.id}] ${testCase.query} -> ${result.knowledgeHitId}`);
    } catch (error) {
      failures.push({ id: testCase.id, reason: error.message });
      console.log(`FAIL [${testCase.id}] ${testCase.query} -> ${error.message}`);
    }
  }

  console.log("");
  console.log(`TOTAL: ${selectedCases.length}`);
  console.log(`PASS: ${selectedCases.length - failures.length}`);
  console.log(`FAIL: ${failures.length}`);

  if (failures.length > 0) {
    process.exit(1);
  }
}

await main();
