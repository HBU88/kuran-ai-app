import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildChatResponse } = require("../agent");

async function assertIlmihalGreeting() {
  const response = await buildChatResponse("Merhaba", [], { module: "ilmihal" });
  const decisionMeta = response.decision_meta || {};

  assert.equal(response.intent, "casual_conversation");
  assert.equal(response.response_type, "direct_answer");
  assert.notEqual(decisionMeta.route_mode, "quran_guidance");
  assert.equal(response.redirect_module || null, null);
  assert.equal(decisionMeta.knowledge_hit_id || null, null);
  assert.equal(decisionMeta.selected_ayah_id || null, null);
  assert.match(response.assistant_text || "", /Dinî Bilgiler/);
  assert.doesNotMatch(response.assistant_text || "", /Ayet Rehberi/);
}

async function assertIlmihalKnowledgeQuestion() {
  const response = await buildChatResponse("arkadan konuşmak günah mı", [], { module: "ilmihal" });
  const decisionMeta = response.decision_meta || {};

  assert.equal(decisionMeta.route_mode, "ilmihal_knowledge");
  assert.equal(decisionMeta.knowledge_hit_id, "giybet_nedir");
  assert.equal(response.redirect_module || null, null);
}

async function assertAyahGuidanceQuestion() {
  const response = await buildChatResponse("çok korkuyorum", [], { module: "ayah" });
  const decisionMeta = response.decision_meta || {};

  assert.equal(decisionMeta.route_mode, "quran_guidance");
  assert.ok(decisionMeta.selected_ayah_id, "expected selected ayah for ayah guidance");
  assert.equal(response.redirect_module || null, null);
}

await assertIlmihalGreeting();
await assertIlmihalKnowledgeQuestion();
await assertAyahGuidanceQuestion();

console.log("PASS chat routing regression");
