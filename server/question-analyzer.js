#!/usr/bin/env node

/**
 * Question Analyzer
 * Analyzes test results to identify patterns and improvement opportunities
 * Focuses on understanding which questions have low confidence scores
 */

const fs = require('fs');
const path = require('path');

const TEST_RESULTS_DIR = path.join(__dirname, 'test_results');

/**
 * Get latest test report
 */
function getLatestReport() {
  if (!fs.existsSync(TEST_RESULTS_DIR)) {
    throw new Error(`Test results directory not found: ${TEST_RESULTS_DIR}`);
  }

  const files = fs
    .readdirSync(TEST_RESULTS_DIR)
    .filter((f) => f.startsWith('test_results_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error('No test results found');
  }

  return path.join(TEST_RESULTS_DIR, files[0]);
}

/**
 * Analyze results
 */
function analyzeResults(report) {
  const analysis = {
    timestamp: report.timestamp,
    date: report.timestamp.split('T')[0],
    summary: {
      totalTests: report.summary.totalTests,
      successfulResponses: report.summary.successfulResponses,
      failedResponses: report.summary.failedResponses,
      avgMatchScore: parseFloat(report.summary.avgMatchScore),
      avgResponseTime: parseInt(report.summary.avgResponseTime),
      criticalIssues: report.criticalIssues.length,
    },
    topics: {},
    lowConfidenceQuestions: [],
    highPerformingTopics: [],
    lowPerformingTopics: [],
    slowResponsesQuestions: [],
    recommendations: [],
  };

  // Analyze each topic
  for (const [topicName, topicResult] of Object.entries(report.topics)) {
    const stats = topicResult.stats;
    const accuracy = (stats.correctTopic / stats.totalTests) * 100;

    analysis.topics[topicName] = {
      label: topicResult.name,
      accuracy: accuracy.toFixed(1),
      avgScore: parseFloat(stats.avgMatchScore),
      avgResponseTime: parseInt(stats.avgResponseTime),
      highConfidence: stats.highConfidence,
      mediumConfidence: stats.mediumConfidence,
      lowConfidence: stats.lowConfidence,
    };

    // Track high/low performing topics
    if (accuracy >= 80) {
      analysis.highPerformingTopics.push({
        topic: topicResult.name,
        accuracy: accuracy.toFixed(1),
      });
    } else if (accuracy < 70) {
      analysis.lowPerformingTopics.push({
        topic: topicResult.name,
        accuracy: accuracy.toFixed(1),
        avgScore: parseFloat(stats.avgMatchScore),
      });
    }
  }

  // Identify low confidence questions
  const lowConfidenceThreshold = 70;
  for (const result of report.testResults) {
    const score = parseFloat(result.matchScore);
    if (score < lowConfidenceThreshold && score > 0) {
      analysis.lowConfidenceQuestions.push({
        question: result.question,
        topic: result.topicName,
        expectedTopic: result.expectedTopic,
        actualTopic: result.actualTopic,
        score: result.matchScore,
        responseTime: result.responseTime,
        confidence: result.confidence,
      });
    }
  }

  // Identify slow responses
  const slowThreshold = 2000; // 2 seconds
  for (const result of report.testResults) {
    if (result.responseTime > slowThreshold) {
      analysis.slowResponsesQuestions.push({
        question: result.question,
        topic: result.topicName,
        responseTime: result.responseTime,
        score: result.matchScore,
      });
    }
  }

  // Sort by score (lowest first)
  analysis.lowConfidenceQuestions.sort(
    (a, b) => parseFloat(a.score) - parseFloat(b.score)
  );
  analysis.slowResponsesQuestions.sort(
    (a, b) => b.responseTime - a.responseTime
  );

  // Generate recommendations
  if (analysis.lowPerformingTopics.length > 0) {
    analysis.recommendations.push({
      type: 'low_accuracy',
      severity: 'medium',
      description: `Topics with accuracy < 70%: ${analysis.lowPerformingTopics
        .map((t) => `${t.topic} (${t.accuracy}%)`)
        .join(', ')}`,
      action: 'Review semantic descriptions and add synonym mappings',
    });
  }

  if (analysis.lowConfidenceQuestions.length > 5) {
    analysis.recommendations.push({
      type: 'many_low_confidence',
      severity: 'medium',
      description: `${analysis.lowConfidenceQuestions.length} questions have confidence < 70%`,
      action: 'Improve semantic matching for these question patterns',
    });
  }

  if (
    analysis.slowResponsesQuestions.length > 0 &&
    analysis.summary.avgResponseTime > 1000
  ) {
    analysis.recommendations.push({
      type: 'slow_responses',
      severity: 'low',
      description: `Average response time is ${analysis.summary.avgResponseTime}ms`,
      action: 'Monitor backend performance and optimize knowledge base queries',
    });
  }

  if (analysis.summary.criticalIssues > 0) {
    analysis.recommendations.push({
      type: 'critical_issues',
      severity: 'high',
      description: `${analysis.summary.criticalIssues} critical issues detected (timeouts/errors)`,
      action: 'Investigate and fix backend issues immediately',
    });
  }

  return analysis;
}

/**
 * Generate summary report
 */
function generateSummaryReport(analysis) {
  let report = '';

  report += `\n🔍 QUESTION ANALYSIS REPORT\n`;
  report += `📅 Date: ${analysis.date}\n`;
  report += `═══════════════════════════════════════════════════════\n\n`;

  report += `📊 OVERALL METRICS\n`;
  report += `─────────────────────────────────────────────────────\n`;
  report += `  Tests: ${analysis.summary.successfulResponses}/${analysis.summary.totalTests}\n`;
  report += `  Avg Score: ${analysis.summary.avgMatchScore}%\n`;
  report += `  Avg Response: ${analysis.summary.avgResponseTime}ms\n`;
  report += `  Errors: ${analysis.summary.failedResponses}\n`;
  report += `  Critical Issues: ${analysis.summary.criticalIssues}\n\n`;

  report += `✅ HIGH PERFORMING TOPICS (>80% accuracy)\n`;
  report += `─────────────────────────────────────────────────────\n`;
  if (analysis.highPerformingTopics.length > 0) {
    analysis.highPerformingTopics.forEach((topic) => {
      report += `  • ${topic.topic}: ${topic.accuracy}%\n`;
    });
  } else {
    report += `  No topics with >80% accuracy\n`;
  }
  report += `\n`;

  report += `⚠️  LOW PERFORMING TOPICS (<70% accuracy)\n`;
  report += `─────────────────────────────────────────────────────\n`;
  if (analysis.lowPerformingTopics.length > 0) {
    analysis.lowPerformingTopics.forEach((topic) => {
      report += `  • ${topic.topic}: ${topic.accuracy}% (score: ${topic.avgScore}%)\n`;
    });
  } else {
    report += `  All topics performing well\n`;
  }
  report += `\n`;

  report += `📋 LOW CONFIDENCE QUESTIONS (score < 70%)\n`;
  report += `─────────────────────────────────────────────────────\n`;
  if (analysis.lowConfidenceQuestions.length > 0) {
    const topLow = analysis.lowConfidenceQuestions.slice(0, 10);
    topLow.forEach((q) => {
      report += `  • "${q.question}"\n`;
      report += `    Topic: ${q.topic} → Score: ${q.score}%\n`;
    });
    if (analysis.lowConfidenceQuestions.length > 10) {
      report += `  ... and ${analysis.lowConfidenceQuestions.length - 10} more\n`;
    }
  } else {
    report += `  No low confidence questions\n`;
  }
  report += `\n`;

  report += `🐢 SLOW RESPONSES (>2000ms)\n`;
  report += `─────────────────────────────────────────────────────\n`;
  if (analysis.slowResponsesQuestions.length > 0) {
    analysis.slowResponsesQuestions.forEach((q) => {
      report += `  • "${q.question}"\n`;
      report += `    Time: ${q.responseTime}ms | Score: ${q.score}%\n`;
    });
  } else {
    report += `  No slow responses detected\n`;
  }
  report += `\n`;

  report += `💡 RECOMMENDATIONS\n`;
  report += `─────────────────────────────────────────────────────\n`;
  if (analysis.recommendations.length > 0) {
    analysis.recommendations.forEach((rec, i) => {
      const severity =
        rec.severity === 'high'
          ? '🔴'
          : rec.severity === 'medium'
            ? '🟡'
            : '🟢';
      report += `  ${severity} ${i + 1}. ${rec.description}\n`;
      report += `     → ${rec.action}\n\n`;
    });
  } else {
    report += `  No major issues identified\n`;
  }

  report += `═══════════════════════════════════════════════════════\n`;

  return report;
}

/**
 * Main function
 */
async function main() {
  try {
    const reportPath = getLatestReport();
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    console.log(`\n📚 Analyzing test results...`);
    const analysis = analyzeResults(report);

    // Generate summary
    const summaryReport = generateSummaryReport(analysis);
    console.log(summaryReport);

    // Save analysis
    const dateStr = analysis.date;
    const analysisPath = path.join(
      TEST_RESULTS_DIR,
      `analysis_${dateStr}.json`
    );
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
    console.log(`💾 Analysis saved: ${analysisPath}\n`);

    // Also save human-readable report
    const reportPath2 = path.join(
      TEST_RESULTS_DIR,
      `analysis_${dateStr}.txt`
    );
    fs.writeFileSync(reportPath2, summaryReport);
    console.log(`📄 Report saved: ${reportPath2}\n`);

    return analysis;
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
