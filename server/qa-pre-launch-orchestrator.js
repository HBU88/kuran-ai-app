#!/usr/bin/env node
/**
 * PRE-LAUNCH QA ORCHESTRATOR
 * Runs all QA checks and generates comprehensive report
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOG_DIR = path.join(__dirname, 'logs');

function ensureLogsDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function runCommand(cmd, description) {
  console.log(`\n▶️  ${description}`);
  console.log('   Running: ' + cmd + '\n');

  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname) });
    return true;
  } catch (error) {
    console.error(`\n❌ ${description} failed`);
    return false;
  }
}

function generateFinalReport() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📋 GENERATING PRE-LAUNCH REPORT');
  console.log('═══════════════════════════════════════════════════════\n');

  const reports = {};
  let allPassed = true;

  // Load collision detector results
  const collisionsFile = path.join(LOG_DIR, 'semantic-collisions.json');
  if (fs.existsSync(collisionsFile)) {
    try {
      reports.collisions = JSON.parse(fs.readFileSync(collisionsFile, 'utf8'));
      const criticalCount = reports.collisions.filter(c => c.severity === 'CRITICAL').length;
      console.log(`✅ Semantic Collision Report: ${criticalCount} critical issues\n`);
      if (criticalCount > 0) allPassed = false;
    } catch (e) {
      console.log(`⚠️  Could not load collision report: ${e.message}\n`);
    }
  }

  // Load coverage validation results
  const coverageFile = path.join(LOG_DIR, 'coverage-report.md');
  if (fs.existsSync(coverageFile)) {
    try {
      const content = fs.readFileSync(coverageFile, 'utf8');
      const passRateMatch = content.match(/Pass Rate.*?\*\*(\d+\.\d+)%\*\*/);
      const passRate = passRateMatch ? parseFloat(passRateMatch[1]) : 0;
      reports.coverage_pass_rate = passRate;
      console.log(`✅ Coverage Validation Report: ${passRate}% pass rate\n`);
      if (passRate < 90) allPassed = false;
    } catch (e) {
      console.log(`⚠️  Could not load coverage report: ${e.message}\n`);
    }
  }

  // Load QA test results
  const qaTestFile = path.join(LOG_DIR, 'qa-test-results.json');
  if (fs.existsSync(qaTestFile)) {
    try {
      reports.qa_tests = JSON.parse(fs.readFileSync(qaTestFile, 'utf8'));
      const summary = reports.qa_tests.summary;
      console.log(`✅ QA Test Suite: ${summary.total_tests} tests, ${summary.pass_rate}% pass rate\n`);
      if (summary.pass_rate < 85) allPassed = false;
    } catch (e) {
      console.log(`⚠️  Could not load QA test report: ${e.message}\n`);
    }
  }

  // Generate final summary
  const finalReport = {
    timestamp: new Date().toISOString(),
    overall_status: allPassed ? '✅ READY FOR LAUNCH' : '❌ ISSUES FOUND',
    checks_performed: {
      semantic_collisions: !!reports.collisions,
      coverage_validation: !!reports.coverage_pass_rate,
      qa_tests: !!reports.qa_tests
    },
    results: reports
  };

  const reportPath = path.join(LOG_DIR, 'pre-launch-final-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2), 'utf8');

  // Create markdown summary
  let markdownReport = `# 📋 HAKAI KB PRE-LAUNCH QUALITY ASSURANCE REPORT

**Report Generated:** ${new Date().toISOString()}

## Overall Status: ${finalReport.overall_status}

---

## ✅ Checks Performed

| Check | Status | Details |
|-------|--------|---------|
| Semantic Collision Detection | ${reports.collisions ? '✅' : '❌'} | Keyword overlap analysis |
| Coverage Validation | ${reports.coverage_pass_rate ? '✅' : '❌'} | Entry structure validation |
| QA Test Suite | ${reports.qa_tests ? '✅' : '❌'} | 500+ question testing |

---

## 📊 Detailed Results

`;

  if (reports.collisions) {
    const critical = reports.collisions.filter(c => c.severity === 'CRITICAL');
    const warnings = reports.collisions.filter(c => c.severity === 'WARNING');

    markdownReport += `### 1. Semantic Collision Detection

**Status:** ${critical.length === 0 ? '✅ PASSED' : '❌ ISSUES FOUND'}

- Critical Collisions: ${critical.length}
- Warning Collisions: ${warnings.length}
- Clean Entries: ${163 - reports.collisions.length}

`;

    if (critical.length > 0) {
      markdownReport += `**Critical Issues (must fix):**\n\n`;
      critical.forEach(c => {
        markdownReport += `- **${c.entry}**: Keywords [${c.problematic_keywords.join(', ')}]\n`;
      });
      markdownReport += '\n';
    }
  }

  if (reports.coverage_pass_rate !== undefined) {
    markdownReport += `### 2. Coverage Validation

**Status:** ${reports.coverage_pass_rate >= 90 ? '✅ PASSED' : '⚠️ WARNING'}

- Pass Rate: **${reports.coverage_pass_rate}%**
- See \`server/logs/coverage-report.md\` for full details

`;
  }

  if (reports.qa_tests) {
    const summary = reports.qa_tests.summary;
    const breakdown = reports.qa_tests.test_breakdown;

    markdownReport += `### 3. QA Test Suite

**Status:** ${summary.pass_rate >= 85 ? '✅ PASSED' : '⚠️ WARNING'}

- Total Tests: ${summary.total_tests}
- Passed: ${summary.passed} ✅
- Failed: ${summary.failed} ❌
- Pass Rate: **${summary.pass_rate}%**

**Test Breakdown:**
\`\`\`
BASIC:       ${breakdown.BASIC}
VARIATIONS:  ${breakdown.VARIATIONS}
COMPARISON:  ${breakdown.COMPARISON}
EDGE_CASE:   ${breakdown.EDGE_CASE}
KB_MISS:     ${breakdown.KB_MISS}
\`\`\`

`;

    if (summary.failed > 0) {
      markdownReport += `**Failed Tests:** See \`server/logs/qa-test-results.json\` for details\n\n`;
    }
  }

  markdownReport += `---

## 🚀 Next Steps

${allPassed ? `
✅ **KB is ready for production launch**

1. Deploy to main branch
2. Monitor /debug/kb-misses endpoint for KB gaps
3. Review and add top missing questions weekly
4. Re-run QA suite before major updates
` : `
❌ **Please address critical issues before launch**

1. Review semantic collisions in \`server/logs/semantic-collisions.json\`
2. Fix coverage issues (see \`server/logs/coverage-report.md\`)
3. Debug failing test cases (see \`server/logs/qa-test-results.json\`)
4. Re-run complete QA suite with: \`npm run qa:pre-launch\`
`}

---

## 📁 Generated Reports

- \`server/logs/semantic-collisions.json\` - Detailed collision analysis
- \`server/logs/coverage-report.md\` - Entry validation report
- \`server/logs/qa-test-results.json\` - Test execution results
- \`server/logs/pre-launch-final-report.json\` - This summary (JSON format)

---

**Generated with HAKAI QA System**
`;

  const markdownPath = path.join(LOG_DIR, 'PRE-LAUNCH-REPORT.md');
  fs.writeFileSync(markdownPath, markdownReport, 'utf8');

  return { finalReport, allPassed };
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║      HAKAI KB PRE-LAUNCH QUALITY ASSURANCE SYSTEM    ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  ensureLogsDir();

  let allSucceeded = true;

  // Run semantic collision detector
  if (!runCommand('node semantic-collision-detector.js', 'Running Semantic Collision Detector')) {
    allSucceeded = false;
  }

  // Run coverage validator
  if (!runCommand('node coverage-validator.js', 'Running Coverage Validator')) {
    allSucceeded = false;
  }

  // Run QA test suite
  if (!runCommand('node qa-test-suite-generator.js', 'Running QA Test Suite')) {
    allSucceeded = false;
  }

  // Generate final report
  const { finalReport, allPassed } = generateFinalReport();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🎯 FINAL ASSESSMENT');
  console.log('═══════════════════════════════════════════════════════\n');

  if (allPassed) {
    console.log('✅ PRE-LAUNCH QA PASSED\n');
    console.log('The HAKAI KB is ready for production launch.');
  } else {
    console.log('⚠️  PRE-LAUNCH QA HAS ISSUES\n');
    console.log('Please review the reports and address critical issues before launching.');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📋 REPORTS GENERATED');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📁 server/logs/PRE-LAUNCH-REPORT.md          (Summary)');
  console.log('📁 server/logs/semantic-collisions.json     (Detailed)');
  console.log('📁 server/logs/coverage-report.md            (Detailed)');
  console.log('📁 server/logs/qa-test-results.json          (Detailed)');
  console.log('📁 server/logs/pre-launch-final-report.json  (JSON)');
  console.log('\n═══════════════════════════════════════════════════════\n');

  process.exit(allSucceeded && allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
