import fs from 'fs';

const kb = JSON.parse(fs.readFileSync('../assets/data/knowledge/ilmihal_knowledge_base.json', 'utf8'));
const selam = kb.find(e => e.id === 'selamlasma_adabi');

console.log('Entry:', {
  id: selam.id,
  triggers: selam.triggers.slice(0, 3),
  keywords: selam.keywords,
  answer: selam.answer_tr
});
