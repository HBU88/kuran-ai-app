import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..", "..");
const PROJECT_ROOT = path.resolve(SERVER_ROOT, "..");
const ILMIHAL_DATA_DIR = path.join(SERVER_ROOT, "data", "ilmihal");
const KNOWLEDGE_INDEX_PATH = path.join(PROJECT_ROOT, "assets", "data", "knowledge", "ilmihal_knowledge_base.json");

const TURKISH = "\\u0041-\\u005a\\u0061-\\u007a\\u00c7\\u011e\\u0130\\u00d6\\u015e\\u00dc\\u00e7\\u011f\\u0131\\u00f6\\u015f\\u00fc";
const corruptionPatterns = [
  new RegExp(`[${TURKISH}]\\?[${TURKISH}]`),
  new RegExp(`[${TURKISH}][10][${TURKISH}]`),
  new RegExp(`\\b[10][${TURKISH}]`),
  /\u00c3/,
  /\u00c4/,
  /\u00c5/,
  /\u00d4\u00c7/,
  /\ufffd/,
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function collectStrings(value, bucket = []) {
  if (typeof value === "string") {
    bucket.push(value);
    return bucket;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, bucket);
    return bucket;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, bucket);
  }
  return bucket;
}

function normalizeAlias(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC");
}

function hasCorruption(text) {
  if (typeof text !== "string" || !text) return false;
  return corruptionPatterns.some((pattern) => pattern.test(text));
}

function main() {
  const issues = [];
  const index = readJson(KNOWLEDGE_INDEX_PATH);
  const sourceFiles = fs.existsSync(ILMIHAL_DATA_DIR)
    ? fs.readdirSync(ILMIHAL_DATA_DIR).filter((name) => name.endsWith(".json"))
    : [];

  const indexedById = new Map();
  const indexedByResponseFile = new Map();
  const aliasOwner = new Map();
  const duplicateAliases = [];
  const registryMismatches = [];

  for (const entry of Array.isArray(index) ? index : []) {
    if (!entry || typeof entry !== "object") continue;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (id) indexedById.set(normalizeAlias(id), entry);

    const responseFile = typeof entry.response_file === "string" ? entry.response_file.trim() : "";
    if (!responseFile) {
      issues.push(`missing response_file for id=${entry.id || "<unknown>"}`);
    } else {
      indexedByResponseFile.set(normalizeAlias(path.basename(responseFile)), entry);
      const absoluteResponseFile = path.isAbsolute(responseFile)
        ? responseFile
        : path.join(PROJECT_ROOT, responseFile);
      if (!fs.existsSync(absoluteResponseFile)) {
        issues.push(`missing response_file target for id=${entry.id || "<unknown>"} -> ${responseFile}`);
      }
    }

    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
    for (const alias of aliases) {
      const normalized = normalizeAlias(alias);
      if (!normalized) continue;
      if (aliasOwner.has(normalized) && aliasOwner.get(normalized) !== entry.id) {
        duplicateAliases.push(`alias "${alias}" used by ${aliasOwner.get(normalized)} and ${entry.id}`);
      } else {
        aliasOwner.set(normalized, entry.id);
      }
    }
  }

  for (const fileName of sourceFiles) {
    const filePath = path.join(ILMIHAL_DATA_DIR, fileName);
    const parsed = readJson(filePath);
    const strings = collectStrings(parsed);
    const corrupted = strings.filter(hasCorruption);
    if (corrupted.length) {
      issues.push(`corrupted text in ${path.join("server", "data", "ilmihal", fileName)}: ${corrupted.slice(0, 3).join(" | ")}`);
    }

    const normalizedId = normalizeAlias(parsed?.id || "");
    if (!normalizedId) {
      registryMismatches.push(`missing id in ${fileName}`);
      continue;
    }
    if (!indexedById.has(normalizedId) && !indexedByResponseFile.has(normalizeAlias(fileName))) {
      registryMismatches.push(`unregistered topic file ${fileName}`);
    }
  }

  for (const entry of Array.isArray(index) ? index : []) {
    const responseFile = typeof entry.response_file === "string" ? entry.response_file.trim() : "";
    if (!responseFile) continue;
    const absoluteResponseFile = path.isAbsolute(responseFile)
      ? responseFile
      : path.join(PROJECT_ROOT, responseFile);
    if (!fs.existsSync(absoluteResponseFile)) continue;
    const parsed = readJson(absoluteResponseFile);
    if (normalizeAlias(parsed?.id || "") !== normalizeAlias(entry.id || "")) {
      registryMismatches.push(`topic registry mismatch: index id=${entry.id} response_file=${responseFile} file_id=${parsed?.id || "<missing>"}`);
    }
  }

  const failures = [...issues, ...duplicateAliases, ...registryMismatches];
  if (failures.length) {
    console.error("ILMIHAL VALIDATION FAILED");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("ILMIHAL VALIDATION OK");
  console.log(`Source files: ${sourceFiles.length}`);
  console.log(`Index entries: ${Array.isArray(index) ? index.length : 0}`);
  console.log("No corruption, duplicate aliases, response_file gaps, or registry mismatches detected.");
}

main();
