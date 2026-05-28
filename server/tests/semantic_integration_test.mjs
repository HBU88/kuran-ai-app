/**
 * Integration test for semantic matching in ilmihal-chat
 * Tests real-world Q&A scenarios
 */

import assert from 'assert/strict';
process.env.HAKAI_OPENAI_PLANNER_ENABLED = 'false';

import { buildChatResponse } from '../agent/index.js';

console.log('===== Semantic Matching Integration Tests =====\n');

const testCases = [
  {
    message: 'kurban kimlere vaciptir',
    expectedTopic: 'kurban_kime_vaciptir',
    minScore: 80,
    description: 'Kurban obligation - exact'
  },
  {
    message: 'kurban kimlere gerekir',
    expectedTopic: 'kurban_kime_vaciptir',
    minScore: 70,
    description: 'Kurban obligation - synonym gerekir'
  },
  {
    message: 'kurban kesmek zorunlu mu',
    expectedTopic: 'kurban_kime_vaciptir',
    minScore: 60,
    description: 'Kurban obligation - paraphrased'
  },
  {
    message: 'Abdest nasıl alınır',
    expectedTopic: 'abdest_howto',
    minScore: 80,
    description: 'Ablution - exact'
  },
  {
    message: 'Abdest alma adımları nedir',
    expectedTopic: 'abdest_howto',
    minScore: 70,
    description: 'Ablution - semantic variation'
  },
  {
    message: 'Selamlaşma nedir',
    expectedTopic: 'selamlasma_adabi',
    minScore: 70,
    description: 'Greeting - direct'
  },
  {
    message: 'Selam vermek nedir',
    expectedTopic: 'selamlasma_adabi',
    minScore: 60,
    description: 'Greeting - giving greetings'
  }
];

(async () => {
  let passCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    try {
      const response = await buildChatResponse(testCase.message, [], { module: 'ilmihal' });
      const meta = response.decision_meta || {};
      const knowledgeId = meta.knowledge_hit_id || meta.matched_knowledge_id;
      const matchScore = Math.round((meta.match_score || 0) * 100);

      const isCorrect = knowledgeId === testCase.expectedTopic;
      const meetsScore = matchScore >= testCase.minScore;
      const passed = isCorrect && meetsScore;

      if (passed) {
        console.log(`✓ PASS: ${testCase.message}`);
        console.log(`  Topic: ${knowledgeId} (score: ${matchScore}%)`);
        console.log(`  ${testCase.description}\n`);
        passCount++;
      } else {
        console.log(`✗ FAIL: ${testCase.message}`);
        console.log(`  Expected: ${testCase.expectedTopic} (min score: ${testCase.minScore}%)`);
        console.log(`  Got: ${knowledgeId} (score: ${matchScore}%)`);
        console.log(`  ${testCase.description}\n`);
        failCount++;
      }
    } catch (error) {
      console.log(`✗ ERROR: ${testCase.message}`);
      console.log(`  Error: ${error.message}\n`);
      failCount++;
    }
  }

  console.log(`===== Results =====`);
  console.log(`Passed: ${passCount}/${testCases.length}`);
  console.log(`Failed: ${failCount}/${testCases.length}`);

  if (failCount > 0) {
    process.exit(1);
  }
})();
