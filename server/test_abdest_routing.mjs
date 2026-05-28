import { buildChatResponse } from './agent/index.js';

const response = await buildChatResponse('Abdest alma adımları nedir', [], { module: 'ilmihal' });
console.log('Knowledge hit:', response.decision_meta.knowledge_hit_id);
console.log('Matched title:', response.decision_meta.matched_title);
console.log('Match reason:', response.decision_meta.match_reason);
console.log('Match score:', response.decision_meta.match_score);
