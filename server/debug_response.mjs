import { buildChatResponse } from './agent/index.js';

(async () => {
  const response = await buildChatResponse('kurban kimlere gerekir', [], { module: 'ilmihal' });
  console.log('Full response:', JSON.stringify(response, null, 2));
  console.log('\nDecision meta:', response.decision_meta);
  console.log('Match score:', response.decision_meta?.match_score);
})();
