#!/usr/bin/env node

/**
 * QA Test Suite for Generated Questions
 * Tests semantic matching accuracy with dynamically generated questions
 * Focuses on metrics: response time, match score, error rates
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { generateAllQuestions, TOPICS } = require('./question-generator');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TEST_RESULTS_DIR = path.join(__dirname, 'test_results');

// Ensure directory exists
if (!fs.existsSync(TEST_RESULTS_DIR)) {
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

/**
 * Send HTTP POST request
 */
function sendRequest(endpoint, body, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const url = new URL(BACKEND_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data),
          });
        } catch (e) {
          reject(new Error(`Invalid JSON response`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Test a single question
 */
async function testQuestion(topicName, topicConfig, question) {
  const startTime = Date.now();
  try {
    const response = await sendRequest('/ilmihal-chat', {
      message: question,
      history: [],
    });

    const duration = Date.now() - startTime;
    const meta = response.body.decision_meta || {};
    const matchScore = (meta.match_score || 0) * 100;
    const actualTopic = meta.knowledge_hit_id;

    // Determine confidence level
    let confidence = 'low';
    if (matchScore >= 80) {
      confidence = 'high';
    } else if (matchScore >= 60) {
      confidence = 'medium';
    }

    return {
      question,
      topicName,
      expectedTopic: topicConfig.expectedTopic,
      actualTopic,
      matchScore: matchScore.toFixed(1),
      confidence,
      responseTime: duration,
      status: 'success',
      isCorrectTopic: actualTopic === topicConfig.expectedTopic,
    };
  } catch (error) {
    return {
      question,
      topicName,
      expectedTopic: topicConfig.expectedTopic,
      actualTopic: null,
      matchScore: 0,
      confidence: 'error',
      responseTime: Date.now() - startTime,
      status: 'failed',
      error: error.message,
      isCorrectTopic: false,
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  console.log(`\n🧪 QA Test Suite - Generated Questions`);
  console.log(`📍 Backend: ${BACKEND_URL}`);
  console.log(`⏱️  Started: ${timestamp}\n`);

  // Generate or load questions
  console.log(`📚 Loading generated questions...`);
  let questionData;
  try {
    questionData = await generateAllQuestions();
  } catch (error) {
    console.error(`❌ Failed to generate questions: ${error.message}`);
    process.exit(1);
  }

  const results = {
    timestamp,
    backend_url: BACKEND_URL,
    generated_questions_date: questionData.date,
    totalQuestions: questionData.totalQuestions,
    topics: {},
    summary: {
      totalTests: 0,
      successfulResponses: 0,
      failedResponses: 0,
      correctTopic: 0,
      wrongTopic: 0,
      avgMatchScore: 0,
      avgResponseTime: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      errors: 0,
    },
    criticalIssues: [],
    testResults: [],
  };

  // Test each topic
  for (const [topicName, topicData] of Object.entries(questionData.topics)) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 ${topicData.label} (${topicData.count} questions)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const topicResults = {
      name: topicData.label,
      expectedTopic: topicData.expectedTopic,
      questionCount: topicData.count,
      tests: [],
      stats: {
        totalTests: 0,
        successfulResponses: 0,
        failedResponses: 0,
        correctTopic: 0,
        wrongTopic: 0,
        avgMatchScore: 0,
        avgResponseTime: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
      },
    };

    // Test each question
    for (const question of topicData.questions) {
      process.stdout.write(`  Testing: "${question.substring(0, 40)}...".padEnd(50)`);

      const result = await testQuestion(topicName, topicData, question);
      topicResults.tests.push(result);
      results.testResults.push(result);

      // Update summary
      topicResults.stats.totalTests++;
      results.summary.totalTests++;

      if (result.status === 'success') {
        topicResults.stats.successfulResponses++;
        results.summary.successfulResponses++;
        process.stdout.write(`✅ ${result.matchScore}% (${result.responseTime}ms)\n`);

        // Track topic accuracy
        if (result.isCorrectTopic) {
          topicResults.stats.correctTopic++;
          results.summary.correctTopic++;
        } else {
          topicResults.stats.wrongTopic++;
          results.summary.wrongTopic++;
        }

        // Track confidence
        if (result.confidence === 'high') {
          topicResults.stats.highConfidence++;
          results.summary.highConfidence++;
        } else if (result.confidence === 'medium') {
          topicResults.stats.mediumConfidence++;
          results.summary.mediumConfidence++;
        } else {
          topicResults.stats.lowConfidence++;
          results.summary.lowConfidence++;
        }
      } else {
        topicResults.stats.failedResponses++;
        results.summary.failedResponses++;
        results.summary.errors++;
        process.stdout.write(`❌ ${result.error}\n`);

        // Flag critical issue
        if (result.error.includes('timeout')) {
          results.criticalIssues.push({
            type: 'timeout',
            question: result.question,
            responseTime: result.responseTime,
          });
        }
      }

      // Delay between requests (rate limiting)
      await new Promise((r) => setTimeout(r, 100));
    }

    // Calculate topic stats
    if (topicResults.stats.totalTests > 0) {
      topicResults.stats.avgMatchScore = (
        topicResults.tests.reduce((sum, r) => sum + parseFloat(r.matchScore || 0), 0) /
        topicResults.stats.totalTests
      ).toFixed(1);

      topicResults.stats.avgResponseTime = (
        topicResults.tests.reduce((sum, r) => sum + r.responseTime, 0) /
        topicResults.stats.totalTests
      ).toFixed(0);
    }

    results.topics[topicName] = topicResults;

    const accuracy = (
      (topicResults.stats.correctTopic / topicResults.stats.totalTests) *
      100
    ).toFixed(1);
    console.log(
      `\n  Result: ${topicResults.stats.successfulResponses}/${topicResults.stats.totalTests} responses`
    );
    console.log(
      `  Accuracy: ${accuracy}% (${topicResults.stats.correctTopic} correct)`
    );
    console.log(`  Avg Score: ${topicResults.stats.avgMatchScore}%`);
    console.log(`  Avg Time: ${topicResults.stats.avgResponseTime}ms\n`);
  }

  // Calculate global stats
  if (results.summary.totalTests > 0) {
    results.summary.avgMatchScore = (
      results.testResults.reduce((sum, r) => sum + parseFloat(r.matchScore || 0), 0) /
      results.summary.totalTests
    ).toFixed(1);

    results.summary.avgResponseTime = (
      results.testResults.reduce((sum, r) => sum + r.responseTime, 0) /
      results.summary.totalTests
    ).toFixed(0);
  }

  results.duration_ms = Date.now() - startTime;
  results.summary.duration_sec = (results.duration_ms / 1000).toFixed(2);

  // Print summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 OVERALL RESULTS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📈 Tests: ${results.summary.successfulResponses}/${results.summary.totalTests} successful`);
  console.log(
    `✅ Correct Topic: ${results.summary.correctTopic}/${results.summary.successfulResponses}`
  );
  console.log(`📊 Avg Match Score: ${results.summary.avgMatchScore}%`);
  console.log(`⏱️  Avg Response: ${results.summary.avgResponseTime}ms`);
  console.log(`⚠️  Errors: ${results.summary.errors}`);
  console.log(`⏳ Total Time: ${results.summary.duration_sec}s`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Save results
  const dateStr = timestamp.split('T')[0];
  const reportPath = path.join(
    TEST_RESULTS_DIR,
    `test_results_${dateStr}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📁 Report saved: ${reportPath}\n`);

  // Check for critical issues
  if (results.criticalIssues.length > 0) {
    console.log(`⚠️  CRITICAL ISSUES DETECTED:`);
    results.criticalIssues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.type}: ${issue.question}`);
    });
    console.log();
  }

  return results;
}

// Main execution
async function main() {
  try {
    const results = await runAllTests();
    // Always exit 0 - we're measuring, not enforcing pass/fail
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Test execution failed: ${error.message}`);
    process.exit(1);
  }
}

main();
