import {
  extractSemanticTokens,
  calculateSemanticSimilarity,
  compareQuestions,
} from './agent/turkish_nlp_utils.js';

const query = 'Selamlaşma nedir';
const profile_description = 'selam vermek ve almak günlük nezaketin ve islami kardeşliğin güzel bir parçasıdır selamlaşma adabı selamlasma adabi selamlaşma adabı selamlasma adabi selamlaşma adabı nedir';
const profile_keywords = 'selamlaşma adabı selamlasma adabi';

const queryTokens = extractSemanticTokens(query);
const profileTokens = extractSemanticTokens(profile_description);
const keywordTokens = extractSemanticTokens(profile_keywords);

console.log('Query:', query);
console.log('Query tokens:', Array.from(queryTokens).slice(0, 15));
console.log('\nProfile description tokens:', Array.from(profileTokens).slice(0, 15));
console.log('Keyword tokens:', Array.from(keywordTokens));

const semanticSimilarity = calculateSemanticSimilarity(queryTokens, profileTokens);
const keywordSimilarity = calculateSemanticSimilarity(queryTokens, keywordTokens);

console.log('\nSemantic similarity:', semanticSimilarity);
console.log('Keyword similarity:', keywordSimilarity);

const score = semanticSimilarity * 0.65 + keywordSimilarity * 0.25;
console.log('Combined score:', score);
