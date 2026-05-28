import { calculateSemanticSimilarity, extractSemanticTokens } from './agent/turkish_nlp_utils.js';

const query = 'Selamlaşma nedir';
const manual = "Selamlaşma nedir selamlasma ne demek selam adabi selam vermek selam vermek adabi selam almak selam nedir selam ne demek";

const queryTokens = extractSemanticTokens(query);
const profileTokens = extractSemanticTokens(manual);

const similarity = calculateSemanticSimilarity(queryTokens, profileTokens);

console.log('Query tokens:', queryTokens.size);
console.log('Profile tokens:', profileTokens.size);
console.log('Intersection count:', Array.from(queryTokens).filter(t => profileTokens.has(t)).length);
console.log('Similarity:', similarity);
