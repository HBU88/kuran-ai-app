import { buildChatResponse } from './agent/index.js';

(async () => {
  const response = await buildChatResponse('Selamlaşma nedir', [], { module: 'ilmihal' });
  console.log('Decision meta:', JSON.stringify(response.decision_meta, null, 2));
})();
