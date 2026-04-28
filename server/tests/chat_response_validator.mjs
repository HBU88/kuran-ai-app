const ENDPOINT = "http://localhost:3000/chat";
const RANDOM_DEFAULT = 12;
const UTF8_BAD_TOKENS = ["├", "┼", "▒", "�", "Ã", "â€œ", "â€", "ÔÇ"];
const AYAH_TYPES = new Set(["direct_ayah", "supportive_ayah", "sensitive_support"]);
const TOPIC_RULES = {
  sabir: new Set([2, 3, 94, 103]),
  prophet: new Set([33, 68, 21, 48, 47]),
  hope: new Set([94, 39, 65, 13]),
  repentance: new Set([39, 2]),
};

const fixedTests = [
  { kind: "fixed", group: "sabir", prompt: "sabır ile ilgili ayet", explicitTopic: true },
  { kind: "fixed", group: "prophet", prompt: "muhammed ile ilgili ayet", explicitTopic: true },
  { kind: "fixed", group: "hope", prompt: "motive edici ayet", explicitTopic: true },
  { kind: "fixed", group: "hope", prompt: "umut veren ayet", explicitTopic: true },
  { kind: "fixed", group: "fear", prompt: "korku ile ilgili ayet", explicitTopic: true },
  { kind: "fixed", group: "casual", prompt: "nasılsın", explicitTopic: false },
  { kind: "fixed", group: "casual", prompt: "merhaba", explicitTopic: false },
  { kind: "fixed", group: "fear", prompt: "çok korkuyorum", explicitTopic: false, expectedSurahSet: [3, 9, 65] },
  { kind: "fixed", group: "fear", prompt: "içim daralıyor", explicitTopic: false },
  { kind: "fixed", group: "fear", prompt: "gelecek için endişeliyim", explicitTopic: false, expectedSurahSet: [28, 94, 13] },
  { kind: "fixed", group: "loneliness", prompt: "çok yalnız hissediyorum", explicitTopic: false },
  { kind: "fixed", group: "loneliness", prompt: "kimsem yok gibi hissediyorum", explicitTopic: false },
  { kind: "fixed", group: "repentance", prompt: "günah işledim", explicitTopic: false, expectedSurahSet: [39, 2] },
  { kind: "fixed", group: "repentance", prompt: "Allah beni affeder mi", explicitTopic: false, expectedSurahSet: [39, 2] },
  { kind: "fixed", group: "repentance", prompt: "çok pişmanım", explicitTopic: false, expectedSurahSet: [39, 2] },
  { kind: "fixed", group: "sabir", prompt: "sabır hakkında Kur'an'dan bir şey söyle", explicitTopic: true },
  { kind: "fixed", group: "prophet", prompt: "peygamberimizle ilgili ayet göster", explicitTopic: true },
  { kind: "fixed", group: "fear", prompt: "maddi sıkıntı yaşıyorum", explicitTopic: false, expectedSurahSet: [11, 65, 51] },
  { kind: "fixed", group: "fear", prompt: "haksızlığa uğradım", explicitTopic: false, expectedSurahSet: [4, 5, 16, 42] },
  { kind: "fixed", group: "prayer", prompt: "akşam namazı kaç rekat?", expectedRakats: 5 },
  { kind: "fixed", group: "prayer", prompt: "sabah namazı kaç rekat?", expectedRakats: 4 },
  { kind: "fixed", group: "prayer", prompt: "öğle namazı kaç rekat?", expectedRakats: 10 },
  { kind: "fixed", group: "prayer", prompt: "ikindi namazı kaç rekat?", expectedRakats: 8 },
  { kind: "fixed", group: "prayer", prompt: "yatsı namazı kaç rekat?", expectedRakats: 13 },
  { kind: "fixed", group: "prayer", prompt: "vitir kaç rekat?", expectedRakats: 3 },
  { kind: "fixed", group: "prayer", prompt: "teravi namazi kac rekat", expectedContains: "teravih" },
  { kind: "fixed", group: "prayer", prompt: "teravih namazı kaç rekât?", expectedContains: "teravih" },
  { kind: "fixed", group: "prayer", prompt: "ramazanda teravi namazi kac rekat", expectedContains: "teravih" },
  { kind: "fixed", group: "prayer", prompt: "cuma namazi", expectedContains: "cuma" },
  { kind: "fixed", group: "prayer", prompt: "cuma namazı kaç rekat?", expectedContains: "cuma" },
  { kind: "fixed", group: "prayer", prompt: "bayram namazı kaç rekat?", expectedContains: "bayram" },
  { kind: "fixed", group: "prayer", prompt: "cenaze namazı nasıl kılınır", expectedContains: "cenaze" },
  { kind: "fixed", group: "knowledge", prompt: "abdest nasıl alınır", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "gusül abdesti nasıl alınır", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "seferi namaz kaç rekât", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "vitir namazı vacip mi", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "bayram namazı nasıl kılınır", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "abdestin farzları nelerdir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "abdesti bozan şeyler nelerdir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "orucu bozan şeyler", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "oruç kimlere farzdır", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "oruç kimlere farz değildir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "sahur şart mı", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "zekât oranı nedir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "zekât kimlere verilir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "dua nasıl edilir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "tövbe nasıl edilir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "namaz vakitleri nelerdir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "Hz Muhammed nasıl biriydi", mustBeDirectAnswer: true },
  { kind: "context", group: "knowledge", prompt: "abdest nasıl alınır", followUp: "nasıl alınır?", expectedContains: "abdest" },
  { kind: "context", group: "knowledge", prompt: "vitir namazı vacip mi", followUp: "vacip mi?", expectedContains: "vitir", followUpExpectedContains: "vitir" },
  { kind: "context", group: "prayer", prompt: "cuma namazı", followUp: "kaç rekat?", expectedContains: "cuma" },
  { kind: "context", group: "prayer", prompt: "cuma namazı", followUp: "teravi namazı kaç rekat", expectedContains: "cuma", followUpExpectedContains: "teravih" },
  { kind: "context", group: "prayer", prompt: "teravi namazı kaç rekat", followUp: "kaç rekat?", expectedContains: "teravih", followUpExpectedContains: "teravih" },
  { kind: "context", group: "fear", prompt: "gelecek için endişeliyim", followUp: "haksızlığa uğradım", followUpExpectedSurahSet: [4, 5, 16, 42], followUpNotSameAsFirst: true },
  { kind: "context", group: "fear", prompt: "gelecek için endişeliyim", followUp: "maddi sıkıntı yaşıyorum", followUpExpectedSurahSet: [11, 65, 51], followUpNotSameAsFirst: true },
];

const randomPromptPools = {
  sabir: [
    "sabır konusunda bir ayet var mı",
    "sabretmekle ilgili ayet öner",
    "zor zamanlarda sabır ayeti isterim",
    "sabır hakkında Kur'an'dan bir şey söyle",
  ],
  prophet: [
    "Hz Muhammed hakkında ayet var mı",
    "peygamberimizle ilgili ayet göster",
    "Resulullah ile ilgili bir ayet paylaş",
    "Muhammed peygamber hakkında Kur'an'da ne geçiyor",
  ],
  hope: [
    "bana umut veren bir ayet söyler misin",
    "motive edici bir ayet paylaş",
    "moralim bozuk bana ayet öner",
    "içimi güçlendirecek bir ayet var mı",
  ],
  fear: [
    "çok korkuyorum",
    "başıma kötü bir şey gelecek diye korkuyorum",
    "gelecek kaygım arttı",
    "içim sıkılıyor ve endişeliyim",
  ],
  loneliness: [
    "çok yalnız hissediyorum",
    "kimsem yok gibi hissediyorum",
    "yalnızlıkla ilgili ayet var mı",
    "Allah bana yakın mı",
  ],
  repentance: [
    "Allah beni affeder mi",
    "günah işledim",
    "tövbe etmek istiyorum",
    "pişmanım bana umut veren bir ayet söyler misin",
  ],
  casual: [
    "nasılsın",
    "merhaba",
    "selam",
    "bugün konuşabilir miyiz",
  ],
};

async function main() {
  const randomCount = readRandomCount();
  const rng = buildRandomSource(process.env.CHAT_TEST_SEED);
  const randomTests = buildRandomTests(randomCount, rng);

  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Fixed tests: ${fixedTests.length}`);
  console.log(`Random tests: ${randomTests.length}`);
  console.log("Selected random prompts:");
  for (const test of randomTests) {
    console.log(`- [${test.group}] ${test.prompt}`);
  }

  await assertEndpointReachable();
  await runModuleEndpointSmokeTests();
  if (isDebugChatEngineEnabled()) {
    await runDebugResolveSmokeTest();
  }

  const fixedResults = [];
  for (const test of fixedTests) {
    fixedResults.push(await runTest(test));
  }

  const randomResults = [];
  for (const test of randomTests) {
    randomResults.push(await runTest(test));
  }

  const allResults = [...fixedResults, ...randomResults];
  const failed = allResults.filter((result) => !result.passed);

  console.log("");
  console.log(`TOTAL TESTS: ${allResults.length}`);
  console.log(`FIXED PASSED: ${fixedResults.filter((result) => result.passed).length}/${fixedResults.length}`);
  console.log(`RANDOM PASSED: ${randomResults.filter((result) => result.passed).length}/${randomResults.length}`);
  console.log(`FAILED: ${failed.length}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

function readRandomCount() {
  const parsed = Number.parseInt(process.env.CHAT_RANDOM_TEST_COUNT || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : RANDOM_DEFAULT;
}

function buildRandomSource(seedValue) {
  if (!seedValue) return Math.random;
  let state = hashSeed(seedValue) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input) {
  let hash = 1779033703 ^ String(input).length;
  for (const char of String(input)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

function buildRandomTests(targetCount, rng) {
  const groupNames = Object.keys(randomPromptPools);
  const minPerGroup = targetCount >= groupNames.length * 2 ? 2 : 1;
  const maxPerGroup = 3;
  const selected = [];
  const selectedByGroup = new Map(groupNames.map((group) => [group, []]));

  for (const group of groupNames) {
    const picks = pickUnique(randomPromptPools[group], Math.min(minPerGroup, randomPromptPools[group].length), rng);
    selectedByGroup.set(group, picks.slice());
    for (const prompt of picks) {
      selected.push({ kind: "random", group, prompt, explicitTopic: group !== "casual" && group !== "fear" && group !== "loneliness" && group !== "repentance" });
    }
  }

  while (selected.length < targetCount) {
    const eligibleGroups = groupNames.filter((group) => {
      const used = selectedByGroup.get(group) || [];
      return used.length < Math.min(maxPerGroup, randomPromptPools[group].length);
    });
    if (eligibleGroups.length === 0) break;

    const group = pickOne(eligibleGroups, rng);
    const used = new Set(selectedByGroup.get(group) || []);
    const remaining = randomPromptPools[group].filter((prompt) => !used.has(prompt));
    if (remaining.length === 0) continue;
    const prompt = pickOne(remaining, rng);
    selectedByGroup.get(group).push(prompt);
    selected.push({ kind: "random", group, prompt, explicitTopic: group !== "casual" && group !== "fear" && group !== "loneliness" && group !== "repentance" });
  }

  return selected.slice(0, targetCount);
}

function pickUnique(values, count, rng) {
  const pool = values.slice();
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function pickOne(values, rng) {
  return values[Math.floor(rng() * values.length)];
}

async function assertEndpointReachable() {
  try {
    const response = await fetch("http://localhost:3000/health");
    if (!response.ok) throw new Error(`/health returned ${response.status}`);
  } catch (error) {
    console.error(`FAIL [setup] backend unavailable -> ${error.message}`);
    process.exit(1);
  }
}

async function runDebugResolveSmokeTest() {
  const cases = [
    {
      q: "çok yalnız hissediyorum",
      expectedCluster: "yalnızlık",
      expectedRankerSource: "override",
      expectedPlannerSource: "local_fast_path",
      maxIntentPlannerMs: 20,
      maxAyahRankerMs: 100,
    },
    {
      q: "içim daralıyor",
      expectedCluster: "kaygı",
      expectedRankerSource: "override",
      expectedPlannerSource: "local_fast_path",
      maxIntentPlannerMs: 20,
      maxAyahRankerMs: 100,
    },
    {
      q: "haksızlığa uğradım",
      expectedCluster: "adalet",
      expectedRankerSource: "override",
      expectedPlannerSource: "local_fast_path",
      maxIntentPlannerMs: 20,
    },
    {
      q: "maddi sıkıntı yaşıyorum",
      expectedCluster: "rızık",
      expectedRankerSource: "override",
      expectedPlannerSource: "local_fast_path",
      maxIntentPlannerMs: 20,
    },
    {
      q: "abdest nasıl alınır",
      expectedPlannerSource: "local_fast_path",
      expectedKnowledgeHit: true,
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      maxIntentPlannerMs: 20,
    },
    {
      q: "merhaba",
      expectedPlannerSource: "local_fast_path",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      maxIntentPlannerMs: 20,
    },
  ];

  for (const test of cases) {
    const payload = await postDebugResolve(test.q);
    const failures = [];
    if (test.expectedCluster && payload?.matched_override_cluster !== test.expectedCluster) {
      failures.push(`matched_override_cluster=${payload?.matched_override_cluster}`);
    }
    if (test.expectedRankerSource && payload?.ranker_source !== test.expectedRankerSource) {
      failures.push(`ranker_source=${payload?.ranker_source}`);
    }
    if (test.expectedPlannerSource && payload?.planner_source !== test.expectedPlannerSource) {
      failures.push(`planner_source=${payload?.planner_source}`);
    }
    if (typeof test.expectedResponseType === "string" && payload?.response_type !== test.expectedResponseType) {
      failures.push(`response_type=${payload?.response_type}`);
    }
    if (test.expectedKnowledgeHit === true && !payload?.knowledge_hit_id) {
      failures.push("knowledge_hit_id missing");
    }
    if (Object.prototype.hasOwnProperty.call(test, "expectedSelectedAyah")) {
      const selectedAyahId = payload?.selected_ayah_id ?? null;
      if (selectedAyahId !== test.expectedSelectedAyah) {
        failures.push(`selected_ayah_id=${selectedAyahId}`);
      }
    } else if (!payload?.selected_ayah_id) {
      failures.push("selected_ayah_id missing");
    }
    if (typeof test.maxIntentPlannerMs === "number") {
      const plannerMs = Number(payload?.timing_ms?.intent_planner_ms || 0);
      if (plannerMs > test.maxIntentPlannerMs) {
        failures.push(`intent_planner_ms=${plannerMs}`);
      }
    }
    if (typeof test.maxAyahRankerMs === "number") {
      const rankerMs = Number(payload?.timing_ms?.ayah_ranker_ms || 0);
      if (rankerMs > test.maxAyahRankerMs) {
        failures.push(`ayah_ranker_ms=${rankerMs}`);
      }
    }
    if (failures.length > 0) {
      console.error(`FAIL [debug] ${test.q} -> ${failures.join("; ")}`);
      process.exit(1);
    }
    console.log(`PASS [debug] ${test.q} -> ${payload.planner_source}:${payload.matched_override_cluster || payload.route_mode}:${payload.selected_ayah_id ?? "null"}`);
  }
}

async function runModuleEndpointSmokeTests() {
  const ayahTests = [
    {
      path: "/ayah-chat",
      prompt: "çok korkuyorum",
      expectedModule: "ayah",
      expectedRouteMode: "quran_guidance",
      expectedRankerSource: "override",
      expectSelectedAyah: true,
      expectedSurahSet: [3, 9, 65],
      maxAyahRankerMs: 100,
    },
    {
      path: "/ayah-chat",
      prompt: "haksızlığa uğradım",
      expectedModule: "ayah",
      expectedRouteMode: "quran_guidance",
      expectedRankerSource: "override",
      expectSelectedAyah: true,
      expectedSurahSet: [4, 5, 16, 42],
      maxAyahRankerMs: 100,
    },
    {
      path: "/ayah-chat",
      prompt: "abdest nasıl alınır",
      expectedModule: "ayah",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectAssistantContains: "HAKAI",
      maxAyahRankerMs: 20,
    },
    {
      path: "/ilmihal-chat",
      prompt: "abdest nasıl alınır",
      expectedModule: "ilmihal",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectAssistantContains: "abdest",
      expectedKnowledgeHit: true,
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "namaz kaç rekat",
      expectedModule: "ilmihal",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectAssistantContains: "rekat",
      expectedKnowledgeHit: true,
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "çok korkuyorum",
      expectedModule: "ilmihal",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
        expectAssistantContains: "HAKAI",
      maxAyahRankerMs: 0,
    },
  ];

  for (const test of ayahTests) {
    const payload = await postModuleChat(test.path, test.prompt);
    const failures = [];
    if ((payload?.decision_meta?.module || null) !== test.expectedModule) {
      failures.push(`decision_meta.module=${payload?.decision_meta?.module}`);
    }
    if (test.expectedRouteMode && payload?.decision_meta?.route_mode !== test.expectedRouteMode) {
      failures.push(`route_mode=${payload?.decision_meta?.route_mode}`);
    }
    if (test.expectedRankerSource && payload?.decision_meta?.ranker_source !== test.expectedRankerSource) {
      failures.push(`ranker_source=${payload?.decision_meta?.ranker_source}`);
    }
    if (typeof test.expectedResponseType === "string" && payload?.response_type !== test.expectedResponseType) {
      failures.push(`response_type=${payload?.response_type}`);
    }
    if (test.expectedKnowledgeHit === true && !payload?.decision_meta?.knowledge_hit_id) {
      failures.push("knowledge_hit_id missing");
    }
    if (Object.prototype.hasOwnProperty.call(test, "expectedSelectedAyah")) {
      const selectedAyahId = payload?.selected_ayah?.id ?? null;
      if (selectedAyahId !== test.expectedSelectedAyah) {
        failures.push(`selected_ayah_id=${selectedAyahId}`);
      }
    } else if (test.expectSelectedAyah && !payload?.selected_ayah) {
      failures.push("selected_ayah missing");
    }
    if (typeof test.maxAyahRankerMs === "number") {
      const rankerMs = Number(payload?.decision_meta?.timing_ms?.ayah_ranker_ms || 0);
      if (rankerMs > test.maxAyahRankerMs) {
        failures.push(`ayah_ranker_ms=${rankerMs}`);
      }
    }
    if (typeof test.expectAssistantContains === "string") {
      const expected = normalizeForMatch(test.expectAssistantContains);
      if (!normalizeForMatch(payload?.assistant_text || "").includes(expected)) {
        failures.push(`assistant_text missing ${expected}`);
      }
    }
    if (failures.length > 0) {
      console.error(`FAIL [module] ${test.path} ${test.prompt} -> ${failures.join("; ")}`);
      process.exit(1);
    }
    console.log(`PASS [module] ${test.path} ${test.prompt} -> ${payload?.decision_meta?.module}:${payload?.response_type}:${payload?.selected_ayah?.id ?? "null"}`);
  }
}

async function runTest(test) {
  try {
    if (test.kind === "context") return await runContextTest(test);

    const payload = await postChat(test.prompt);
    const failures = validatePayload(test, payload);
    if (failures.length > 0) return failResult(test, failures.join("; "), payload);

    console.log(`PASS [${test.kind}] ${test.prompt} -> ${formatAyahLabel(payload)}`);
    return { ...test, passed: true, payload };
  } catch (error) {
    return failResult(test, error.message);
  }
}

function validatePayload(test, payload) {
  const failures = [];
  const requiredStringFields = ["assistant_text", "response_type", "primary_theme", "emotion"];
  for (const field of requiredStringFields) {
    if (typeof payload?.[field] !== "string" || payload[field].trim().length === 0) {
      failures.push(`missing ${field}`);
    }
  }
  if (typeof payload?.ayah_used !== "boolean") failures.push("missing ayah_used");
  if (!(payload?.selected_ayah === null || (payload?.selected_ayah && typeof payload.selected_ayah === "object"))) {
    failures.push("selected_ayah must be object or null");
  }

  if (typeof payload?.assistant_text === "string") {
    for (const token of UTF8_BAD_TOKENS) {
      if (payload.assistant_text.includes(token)) {
        failures.push(`assistant_text contains mojibake token ${JSON.stringify(token)}`);
        break;
      }
    }
  }

  if (AYAH_TYPES.has(payload?.response_type)) {
    if (!payload.selected_ayah) {
      failures.push(`selected_ayah is null for ${payload.response_type}`);
    } else if (!assistantTextIncludesAyah(payload.assistant_text, payload.selected_ayah)) {
      failures.push("assistant_text does not include selected ayah reference/text");
    }
  }

  if (payload?.response_type === "direct_answer" && payload?.selected_ayah !== null) {
    failures.push("direct_answer returned selected_ayah");
  }


  if (test.group === "casual") {
    if (payload?.ayah_used !== false) failures.push(`unexpected ayah_used=${payload?.ayah_used}`);
    if (payload?.selected_ayah !== null) failures.push("casual flow returned selected_ayah");
  }

  if (test.group === "prayer") {
    if (payload?.response_type !== "direct_answer") failures.push(`prayer question returned response_type=${payload?.response_type}`);
    if (payload?.ayah_used !== false) failures.push(`prayer question unexpectedly used ayah_used=${payload?.ayah_used}`);
    if (payload?.selected_ayah !== null) failures.push("prayer question returned selected_ayah");
    if (typeof test.expectedRakats === "number" && !String(payload?.assistant_text || "").includes(String(test.expectedRakats))) {
      failures.push(`prayer answer missing expected rakat count ${test.expectedRakats}`);
    }
    if (typeof test.expectedContains === "string") {
      const expectedText = normalizeForMatch(test.expectedContains);
      if (!normalizeForMatch(payload?.assistant_text || "").includes(expectedText)) {
        failures.push(`prayer answer missing expected text ${expectedText}`);
      }
    }
  }

  if (test.group === "knowledge") {
    if (payload?.response_type !== "direct_answer") failures.push(`knowledge question returned response_type=${payload?.response_type}`);
    if (payload?.ayah_used !== false) failures.push(`knowledge question unexpectedly used ayah_used=${payload?.ayah_used}`);
    if (payload?.selected_ayah !== null) failures.push("knowledge question returned selected_ayah");
    if (test.mustBeDirectAnswer && typeof payload?.assistant_text !== "string") failures.push("knowledge question missing assistant_text");
  }

  const alignmentRule = TOPIC_RULES[test.group];
  if (alignmentRule && test.explicitTopic) {
    const surahNumber = payload?.selected_ayah?.surahNumber;
    if (!payload?.selected_ayah) failures.push("explicit topic request returned null selected_ayah");
    else if (!alignmentRule.has(Number(surahNumber))) failures.push(`surahNumber ${surahNumber} not in allowed set ${Array.from(alignmentRule).join(",")}`);
  }

  if (Array.isArray(test.expectedSurahSet) && test.expectedSurahSet.length > 0) {
    const surahNumber = Number(payload?.selected_ayah?.surahNumber);
    if (!payload?.selected_ayah) {
      failures.push("expected selected_ayah for ranked override prompt");
    } else if (!test.expectedSurahSet.includes(surahNumber)) {
      failures.push(`surahNumber ${surahNumber} not in expected set ${test.expectedSurahSet.join(",")}`);
    }
  }

  return failures;
}

async function runContextTest(test) {
  const first = await postChat(test.prompt);
  const firstFailures = validatePayload({ ...test, kind: "fixed" }, first);
  if (firstFailures.length > 0) return failResult(test, `context setup failed: ${firstFailures.join("; ")}`, first);

  const second = await postChat(test.followUp, [
    {
      role: "user",
      text: test.prompt,
      context_topic: first.context_topic || null,
      primary_theme: first.primary_theme || null,
      emotion: first.emotion || null,
      secondary_themes: Array.isArray(first.secondary_themes) ? first.secondary_themes : [],
      response_type: first.response_type || null,
      selected_ayah_id: first?.selected_ayah?.id || first?.selected_ayah_id || null,
    },
    {
      role: "assistant",
      text: first.assistant_text || "",
      context_topic: first.context_topic || null,
      primary_theme: first.primary_theme || null,
      emotion: first.emotion || null,
      secondary_themes: Array.isArray(first.secondary_themes) ? first.secondary_themes : [],
      response_type: first.response_type || null,
      selected_ayah_id: first?.selected_ayah?.id || first?.selected_ayah_id || null,
    },
  ]);
  const followUpTest = { ...test, kind: "fixed", prompt: `${test.prompt} -> ${test.followUp}`, expectedContains: test.followUpExpectedContains || test.expectedContains };
  const failures = validatePayload(followUpTest, second);
  const expectedFollowUp = normalizeForMatch(test.followUpExpectedContains || test.expectedContains || "");
  if (expectedFollowUp && !normalizeForMatch(second?.assistant_text || "").includes(expectedFollowUp)) {
    failures.push(`context follow-up did not match expected topic ${expectedFollowUp}`);
  }
  if (Array.isArray(test.followUpExpectedSurahSet) && test.followUpExpectedSurahSet.length > 0) {
    const secondSurah = Number(second?.selected_ayah?.surahNumber);
    if (!second?.selected_ayah) {
      failures.push("context follow-up returned null selected_ayah");
    } else if (!test.followUpExpectedSurahSet.includes(secondSurah)) {
      failures.push(`context follow-up surahNumber ${secondSurah} not in expected set ${test.followUpExpectedSurahSet.join(",")}`);
    }
  }
  if (test.followUpNotSameAsFirst && first?.selected_ayah && second?.selected_ayah) {
    const firstKey = `${first.selected_ayah.surahNumber}:${first.selected_ayah.ayahNumber || first.selected_ayah.ayah}`;
    const secondKey = `${second.selected_ayah.surahNumber}:${second.selected_ayah.ayahNumber || second.selected_ayah.ayah}`;
    if (firstKey === secondKey) {
      failures.push("context follow-up reused the previous ayah");
    }
  }
  if (failures.length > 0) return failResult(test, failures.join("; "), second);

  console.log(`PASS [${test.kind}] ${test.prompt} -> ${formatAyahLabel(second)}`);
  return { ...test, passed: true, payload: second };
}

async function postChat(message, history = []) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ message, history }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON response: ${error.message}`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload?.error || text}`);
  return payload;
}

async function postModuleChat(path, message, history = []) {
  const response = await fetch(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ message, history }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid module JSON response: ${error.message}`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload?.error || text}`);
  return payload;
}

async function postDebugResolve(q) {
  const response = await fetch(`http://localhost:3000/debug/resolve?q=${encodeURIComponent(q)}`);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid debug JSON response: ${error.message}`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload?.error || text}`);
  return payload;
}

function isDebugChatEngineEnabled() {
  return String(process.env.DEBUG_CHAT_ENGINE || "").trim().toLowerCase() === "true";
}

function assistantTextIncludesAyah(assistantText, ayah) {
  const text = normalizeForMatch(assistantText);
  const ayahText = normalizeForMatch(ayah?.text_tr || "");
  const ayahSnippet = ayahText.slice(0, 32);
  const reference = `${ayah?.surahNumber}:${ayah?.ayahNumber || ayah?.ayah}`;
  return Boolean((ayahSnippet && text.includes(ayahSnippet)) || (reference && text.includes(reference)));
}

function normalizeForMatch(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
}

function formatAyahLabel(payload) {
  if (!payload?.selected_ayah) return payload?.response_type || "no_response_type";
  const assistantText = String(payload.assistant_text || "");
  const referenceMatch = assistantText.match(/([\p{L}'` -]+ \d+:\d+)/u);
  if (referenceMatch) return referenceMatch[1].trim();
  return `${payload.selected_ayah.surahNumber}:${payload.selected_ayah.ayahNumber || payload.selected_ayah.ayah}`;
}

function failResult(test, reason, payload = null) {
  console.log(`FAIL [${test.kind}] ${test.prompt} -> ${reason}`);
  return { ...test, passed: false, reason, payload };
}

await main();

