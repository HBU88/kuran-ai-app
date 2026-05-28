#!/usr/bin/env node

/**
 * Auto-Fix System (COST-OPTIMIZED)
 *
 * OPTIMIZATION STRATEGY:
 * - Only call API on CRITICAL issues (timeout/crash/error)
 * - Use pattern matching for low scores (NO API CALLS)
 * - Smart thresholds prevent unnecessary analysis
 * - Batch critical issues into single API call
 * - Target: <$0.50/month cost
 *
 * SCORE THRESHOLDS:
 * - 0.75-1.00: ✅ Good performance (no action)
 * - 0.60-0.74: ⚠️  Pattern-based suggestions only (no API)
 * - <0.60:     🚨 Critical - deserves API analysis
 *
 * CRITICAL ISSUES (Always use API):
 * - Timeouts (>10000ms)
 * - Crashes/Errors
 * - Invalid responses
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const TEST_RESULTS_DIR = path.join(__dirname, 'test_results');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Call OpenAI API (gpt-4o-mini - cheapest option)
 * Batches multiple issues into single call to reduce API calls
 */
function callOpenAIAPI(prompt) {
  return new Promise((resolve, reject) => {
    if (!OPENAI_API_KEY) {
      reject(new Error('OPENAI_API_KEY not set'));
    }

    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
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
            reject(new Error(`API error: ${response.error.message}`));
          } else {
            resolve(response.choices[0].message.content);
          }
        } catch (e) {
          reject(new Error(`Failed to parse API response`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * PATTERN-BASED ANALYSIS (NO API CALL)
 * Low cost, instant results for low-score questions
 */
function generatePatternBasedRecommendations(lowScoreQuestions) {
  if (lowScoreQuestions.length === 0) {
    return null;
  }

  // Group by score range
  const veryLow = lowScoreQuestions.filter(q => parseFloat(q.score) < 0.60);
  const low = lowScoreQuestions.filter(q => parseFloat(q.score) >= 0.60 && parseFloat(q.score) < 0.75);

  let analysis = [];

  if (veryLow.length > 0) {
    analysis.push(`🔴 VERY LOW SCORE (<60%): ${veryLow.length} questions`);
    analysis.push('   Recommendation: Check semantic descriptions and knowledge base coverage');
    analysis.push('   Likely issues: Missing synonyms, incomplete topic descriptions');
    analysis.push(`   Examples: ${veryLow.slice(0, 2).map(q => `"${q.question}"`).join(', ')}`);
    analysis.push('');
  }

  if (low.length > 0) {
    analysis.push(`🟡 LOW SCORE (60-74%): ${low.length} questions`);
    analysis.push('   Recommendation: Monitor for patterns, may improve with tuning');
    analysis.push('   Likely issues: Edge case variations, semantic ambiguity');
    analysis.push(`   Examples: ${low.slice(0, 2).map(q => `"${q.question}"`).join(', ')}`);
    analysis.push('');
  }

  // Generic suggestions based on patterns
  const totalLow = veryLow.length + low.length;
  if (totalLow > 0) {
    analysis.push('💡 GENERAL IMPROVEMENTS:');
    analysis.push('   1. Expand semantic descriptions with more synonyms');
    analysis.push('   2. Add question variations to routing patterns');
    analysis.push('   3. Review knowledge base coverage for low-performing topics');
    analysis.push('   4. Consider Turkish lemmatization improvements');
  }

  return analysis.join('\n');
}

/**
 * CRITICAL ISSUES ANALYSIS (WITH API)
 * Only call API for actual critical failures
 * Batches all issues into single call
 */
async function analyzeCriticalIssues(criticalIssues) {
  if (criticalIssues.length === 0) {
    return null;
  }

  // Batch all issues into one API call
  const issuesSummary = criticalIssues
    .map((issue) => `- ${issue.type}: "${issue.question}" (${issue.responseTime}ms)`)
    .join('\n');

  const prompt = `You are a QA engineer analyzing backend failures for a Turkish Islamic Q&A system.

CRITICAL FAILURES (${criticalIssues.length} total):
${issuesSummary}

Analyze these critical issues:
1. Root cause analysis (code bug vs infrastructure vs timeout)
2. Impact severity (CRITICAL/HIGH/MEDIUM)
3. Immediate action required
4. Prevention for next occurrence

Be concise and actionable.`;

  try {
    return await callOpenAIAPI(prompt);
  } catch (error) {
    return `API analysis failed: ${error.message}. Manual investigation required.`;
  }
}

/**
 * Get latest test report
 */
function getLatestReport() {
  if (!fs.existsSync(TEST_RESULTS_DIR)) {
    throw new Error(`Test results directory not found`);
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
 * Main function (COST-OPTIMIZED)
 *
 * COST BREAKDOWN (monthly estimates):
 * - No critical issues: $0 (no API calls)
 * - 5 critical issues/month: ~$0.15 (single batch API call)
 * - 20 low-score questions: $0 (pattern matching only)
 *
 * Total monthly cost: $0.20-0.50 (vs $1.50+ before optimization)
 */
async function main() {
  try {
    const reportPath = getLatestReport();
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔧 AUTO-FIX ANALYSIS ENGINE (Cost-Optimized)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const recommendations = {
      timestamp: report.timestamp,
      date: report.timestamp.split('T')[0],
      costOptimization: {
        criticalIssuesAnalyzed: false,
        lowScoreAnalysisCost: '$0.00 (pattern-based)',
        apiCallsNeeded: 0,
      },
      criticalIssuesAnalysis: null,
      lowConfidenceAnalysis: null,
    };

    let apiCallsNeeded = 0;

    // ═══════════════════════════════════════════════════════════════
    // 1. CRITICAL ISSUES (Always use API)
    // ═══════════════════════════════════════════════════════════════
    if (report.criticalIssues && report.criticalIssues.length > 0) {
      console.log(`🚨 CRITICAL ISSUES DETECTED (${report.criticalIssues.length})\n`);

      for (const issue of report.criticalIssues) {
        console.log(`   ${issue.type}: "${issue.question}"`);
        if (issue.responseTime) {
          console.log(`   ⏱️  ${issue.responseTime}ms`);
        }
      }
      console.log();

      apiCallsNeeded += 1; // Single batched API call

      if (OPENAI_API_KEY) {
        console.log(`🤖 Running AI analysis (1 batched API call)...\n`);
        try {
          const analysis = await analyzeCriticalIssues(report.criticalIssues);
          recommendations.criticalIssuesAnalysis = analysis;
          recommendations.costOptimization.criticalIssuesAnalyzed = true;
          console.log(analysis);
          console.log();
        } catch (error) {
          console.error(`⚠️  API analysis failed: ${error.message}\n`);
        }
      } else {
        console.log(`ℹ️  OPENAI_API_KEY not set - skipping AI analysis`);
        console.log(`   Manual investigation required for critical issues\n`);
      }
    } else {
      console.log(`✅ No critical issues detected (timeouts/crashes)\n`);
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. LOW-SCORE QUESTIONS (Pattern-based, NO API)
    // ═══════════════════════════════════════════════════════════════
    const lowScoreQuestions = report.testResults.filter(
      (r) => r.status === 'success' && parseFloat(r.matchScore) < 75
    );

    if (lowScoreQuestions.length > 0) {
      console.log(
        `⚠️  ${lowScoreQuestions.length} questions with score <75%\n`
      );

      // Use PATTERN-BASED analysis (no API cost!)
      const patternAnalysis = generatePatternBasedRecommendations(lowScoreQuestions);
      if (patternAnalysis) {
        recommendations.lowConfidenceAnalysis = patternAnalysis;
        console.log(patternAnalysis);
        console.log();
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. COST SUMMARY & RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════════════
    recommendations.costOptimization.apiCallsNeeded = apiCallsNeeded;
    recommendations.costOptimization.estimatedCost = apiCallsNeeded > 0 ? '$0.03' : '$0.00';

    // Save recommendations
    const dateStr = recommendations.date;
    const recoPath = path.join(TEST_RESULTS_DIR, `recommendations_${dateStr}.json`);
    fs.writeFileSync(recoPath, JSON.stringify(recommendations, null, 2));
    console.log(`💾 Recommendations saved: ${recoPath}\n`);

    // Display cost summary
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`💰 COST OPTIMIZATION SUMMARY`);
    console.log(`   API calls this run: ${apiCallsNeeded}`);
    console.log(`   Cost this run: ${recommendations.costOptimization.estimatedCost}`);
    console.log(`   Method: Critical issues batched | Low scores pattern-based`);
    console.log(`   Monthly estimate: <$0.50/month (vs $1.50+ before)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`📋 NEXT STEPS:`);
    if (report.criticalIssues && report.criticalIssues.length > 0) {
      console.log(`   1. 🚨 CRITICAL: Review AI analysis above`);
      console.log(`   2. Debug and fix identified backend issues`);
      console.log(`   3. Re-run test suite to verify fixes`);
    } else if (lowScoreQuestions.length > 0) {
      console.log(`   1. Review pattern-based recommendations above`);
      console.log(`   2. Implement semantic improvements`);
      console.log(`   3. Re-run test suite to measure improvement`);
    } else {
      console.log(`   ✅ All systems healthy - no action required`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
