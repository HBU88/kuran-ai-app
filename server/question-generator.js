#!/usr/bin/env node

/**
 * Random Question Generator
 * Generates daily fresh questions for testing semantic matching
 * Uses OpenAI to create contextually appropriate Turkish variations
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Topic definitions with question patterns
 */
const TOPICS = {
  kurban: {
    label: 'Kurban (Sacrifice)',
    expectedTopic: 'kurban_kime_vaciptir',
    keywords: ['kurban', 'kesme', 'kesmek', 'hayvan', 'bayram'],
    questionPatterns: [
      '{keyword} nedir?',
      '{keyword} ne demek?',
      '{keyword} kimlere vaciptir?',
      '{keyword} kimlere gerekir?',
      '{keyword} nasıl yapılır?',
      'Kim {keyword} kesmeli?',
      '{keyword}ın şartları nedir?',
      '{keyword} ne zaman yapılır?',
    ],
  },
  selam: {
    label: 'Selam (Greeting)',
    expectedTopic: 'selamlasma_adabi',
    keywords: ['selam', 'selamlaşma', 'selamlamak', 'selamı'],
    questionPatterns: [
      '{keyword} nedir?',
      '{keyword} ne demek?',
      '{keyword}ın adabı nedir?',
      '{keyword} vermek nasıl yapılır?',
      '{keyword} almak gerekir mi?',
      '{keyword}laşma nedir?',
      'İslam\'da {keyword} önemli midir?',
      '{keyword}ı dönmek vacip midir?',
    ],
  },
  namaz: {
    label: 'Namaz (Prayer)',
    expectedTopic: 'namaz_kac_rekat',
    keywords: ['namaz', 'salat', 'ibadet', 'rekat'],
    questionPatterns: [
      'Günde kaç {keyword} kılmak gerekir?',
      '{keyword} kaç rekat?',
      '{keyword} nedir?',
      '{keyword} vakitleri nedir?',
      '{keyword} ne zaman kılınır?',
      '{keyword} kılmanın faydaları nedir?',
      '{keyword} kılarken nelere dikkat edilir?',
      '{keyword} boyanlar nelerdir?',
    ],
  },
  abdest: {
    label: 'Abdest (Ablution)',
    expectedTopic: 'abdest_howto',
    keywords: ['abdest', 'wudu', 'temizlenme', 'taharet'],
    questionPatterns: [
      '{keyword} nedir?',
      '{keyword} nasıl alınır?',
      '{keyword}ın şartları nedir?',
      '{keyword} alma adımları nedir?',
      '{keyword}i bozan şeyler nelerdir?',
      '{keyword} alma ne zaman gerekir?',
      '{keyword} almadan {keyword} kılınır mı?',
      '{keyword}siz yapılacak işler nelerdir?',
    ],
  },
  oruc: {
    label: 'Oruç (Fasting)',
    expectedTopic: 'oruc_nedir',
    keywords: ['oruç', 'siyam', 'tutma', 'fast'],
    questionPatterns: [
      '{keyword} nedir?',
      '{keyword} ne demek?',
      '{keyword} ne zaman yapılır?',
      '{keyword} kimlere vaciptir?',
      '{keyword} kesmek ne demektir?',
      '{keyword} tutarken nelere dikkat edilir?',
      '{keyword}ın faydaları nelerdir?',
      '{keyword} boyanlar nelerdir?',
    ],
  },
  zekat: {
    label: 'Zekât (Alms)',
    expectedTopic: 'zekat_nedir',
    keywords: ['zekât', 'zekat', 'maliye', 'vergi'],
    questionPatterns: [
      '{keyword} nedir?',
      '{keyword} ne demek?',
      '{keyword} kimlere farzdır?',
      '{keyword} ne kadar verilir?',
      '{keyword} ne zaman verilir?',
      '{keyword} kimlere verilir?',
      '{keyword} vermemek nasidir?',
      '{keyword}ın şartları nelerdir?',
    ],
  },
  hac: {
    label: 'Hac (Pilgrimage)',
    expectedTopic: 'hac_kimlere_farzdır',
    keywords: ['hac', 'umre', 'ziyaret', 'kutsal'],
    questionPatterns: [
      '{keyword} nedir?',
      '{keyword} ne demek?',
      '{keyword} kimlere farzdır?',
      '{keyword} ne zaman yapılır?',
      '{keyword}ın şartları nederdir?',
      '{keyword} ve umre arasındaki fark nedir?',
      'Kim {keyword} yapmalıdır?',
      '{keyword} yapmak için neler gerekir?',
    ],
  },
  dua: {
    label: 'Dua (Supplication)',
    expectedTopic: 'dua_nedir',
    keywords: ['dua', 'duâ', 'ibadet', 'yakarmak'],
    questionPatterns: [
      '{keyword} nedir?',
      '{keyword} ne demek?',
      '{keyword} nasıl yapılır?',
      '{keyword} ettmenin faydaları nelerdir?',
      '{keyword} ne zaman yapılır?',
      'İstediğimiz şey için {keyword} ettik mi kabul olur mu?',
      '{keyword}ın şartları nedir?',
      '{keyword}a neler sorabiliriz?',
    ],
  },
};

/**
 * Call OpenAI API to generate variations
 */
async function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    if (!OPENAI_API_KEY) {
      reject(new Error('OPENAI_API_KEY not set'));
    }

    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 800,
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`OpenAI error: ${response.error.message}`));
          } else {
            resolve(response.choices[0].message.content);
          }
        } catch (e) {
          reject(new Error(`Failed to parse OpenAI response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Generate pattern-based questions
 */
function generatePatterBasedQuestions(topic, config) {
  const questions = [];

  // Generate variations by combining keywords and patterns
  for (const keyword of config.keywords) {
    for (const pattern of config.questionPatterns) {
      const question = pattern.replace('{keyword}', keyword).trim();
      questions.push(question);
    }
  }

  // Shuffle and select random subset
  return shuffle(questions).slice(0, 12);
}

/**
 * Generate creative questions using OpenAI
 */
async function generateOpenAIQuestions(topicName, config) {
  const prompt = `Generate 8 different Turkish Islamic questions about "${config.label}".

Requirements:
1. Each question must be unique and phrased differently
2. All questions should relate to the same Islamic concept
3. Use natural Turkish question patterns:
   - "X nedir?" (What is X?)
   - "X ne demek?" (What does X mean?)
   - "X nasıl yapılır?" (How is X done?)
   - "Kimler X yapmalı?" (Who should do X?)
   - "X'ın şartları nedir?" (What are X's conditions?)
4. Include both formal and informal variations
5. Use synonyms and related terms
6. Be creative but stay on topic

Keywords to use: ${config.keywords.join(', ')}

Respond as a JSON array of exactly 8 questions in Turkish:
["question1", "question2", "question3", "question4", "question5", "question6", "question7", "question8"]`;

  try {
    const response = await callOpenAI(prompt);
    // Extract JSON array from response
    const match = response.match(/\[[\s\S]*\]/);
    if (!match) {
      console.warn(`  ⚠️  Could not parse OpenAI response, using pattern-based fallback`);
      return null;
    }
    const questions = JSON.parse(match[0]);
    if (Array.isArray(questions) && questions.length > 0) {
      return questions.slice(0, 8);
    }
  } catch (error) {
    console.warn(`  ⚠️  OpenAI generation failed: ${error.message}`);
  }

  return null;
}

/**
 * Shuffle array
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate all questions for the day
 */
async function generateAllQuestions() {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split('T')[0];
  const outputPath = path.join(
    __dirname,
    `generated_questions_${dateStr}.json`
  );

  // Skip if already generated today
  if (fs.existsSync(outputPath)) {
    console.log(`📄 Questions already generated for ${dateStr}`);
    return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  }

  console.log(`\n🎲 Generating Random Questions for Daily Testing`);
  console.log(`📅 Date: ${dateStr}`);
  console.log(`🔑 OpenAI API: ${OPENAI_API_KEY ? '✅ Available' : '❌ Missing'}\n`);

  const generatedData = {
    timestamp,
    date: dateStr,
    topics: {},
    totalQuestions: 0,
  };

  // Generate questions for each topic
  for (const [topicName, config] of Object.entries(TOPICS)) {
    console.log(`📝 Generating questions for ${config.label}...`);

    let questions = [];

    // Try OpenAI generation first
    if (OPENAI_API_KEY) {
      const openaiQuestions = await generateOpenAIQuestions(topicName, config);
      if (openaiQuestions) {
        questions = openaiQuestions;
        console.log(`   ✅ Generated ${questions.length} questions with OpenAI`);
      }
    }

    // Fall back to pattern-based if needed
    if (questions.length === 0) {
      questions = generatePatterBasedQuestions(topicName, config);
      console.log(`   ✅ Generated ${questions.length} questions with patterns`);
    }

    generatedData.topics[topicName] = {
      label: config.label,
      expectedTopic: config.expectedTopic,
      count: questions.length,
      questions: questions,
    };

    generatedData.totalQuestions += questions.length;
  }

  // Save to file
  fs.writeFileSync(outputPath, JSON.stringify(generatedData, null, 2));
  console.log(
    `\n💾 Saved ${generatedData.totalQuestions} questions to ${outputPath}\n`
  );

  return generatedData;
}

// Export for use in other modules
module.exports = { generateAllQuestions, TOPICS };

// Run if called directly
if (require.main === module) {
  generateAllQuestions().catch((error) => {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  });
}
