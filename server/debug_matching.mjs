import { matchSemanticTopic } from './agent/semantic_topic_matcher.js';
import fs from 'fs';

// Load the knowledge base
const kb = JSON.parse(fs.readFileSync('./assets/data/knowledge/ilmihal_knowledge_base.json', 'utf8'));

const query = 'Selamlaşma nedir';
const match = matchSemanticTopic(query, kb);

console.log('Query:', query);
console.log('Match result:', match);

// Also try the kurban question
const query2 = 'kurban kimlere gerekir';
const match2 = matchSemanticTopic(query2, kb);
console.log('\nQuery:', query2);
console.log('Match result:', match2);
