#!/usr/bin/env node
/**
 * COVERAGE VALIDATOR
 * Validates structure and completeness of all KB entries
 */

const fs = require('fs');
const path = require('path');

const ILMIHAL_DIR = path.join(__dirname, 'data/ilmihal');
const OUTPUT_FILE = path.join(__dirname, 'logs/coverage-report.md');

const REQUIRED_FIELDS = ['id', 'title', 'category', 'summary', 'keywords'];
const CONTENT_FIELDS = ['step_by_step', 'farzlar', 'vacipler', 'sunnetler'];

class CoverageValidator {
  constructor() {
    this.results = {
      total: 0,
      valid: 0,
      invalid: 0,
      issues: []
    };
    this.ids = new Set();
  }

  validate(filename, filepath) {
    const issueList = [];

    // Check if file exists and is readable
    if (!fs.existsSync(filepath)) {
      issueList.push('❌ File does not exist');
      this.results.invalid++;
      this.results.issues.push({
        file: filename,
        issues: issueList
      });
      return false;
    }

    // Check JSON validity
    let entry;
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      entry = JSON.parse(content);
    } catch (e) {
      issueList.push(`❌ Invalid JSON: ${e.message}`);
      this.results.invalid++;
      this.results.issues.push({
        file: filename,
        issues: issueList
      });
      return false;
    }

    // Check required fields
    REQUIRED_FIELDS.forEach(field => {
      if (!entry[field]) {
        issueList.push(`❌ Missing required field: "${field}"`);
      }
    });

    // Check if ID matches filename
    if (entry.id && !filename.includes(entry.id)) {
      issueList.push(`⚠️  ID mismatch: filename "${filename}" vs id "${entry.id}"`);
    }

    // Check for duplicate IDs
    if (this.ids.has(entry.id)) {
      issueList.push(`❌ Duplicate ID: "${entry.id}" already exists`);
    } else if (entry.id) {
      this.ids.add(entry.id);
    }

    // Check keywords array
    if (!Array.isArray(entry.keywords)) {
      issueList.push(`❌ keywords must be an array`);
    } else if (entry.keywords.length === 0) {
      issueList.push(`❌ keywords array is empty`);
    }

    // Check content
    const hasContent = CONTENT_FIELDS.some(field =>
      Array.isArray(entry[field]) && entry[field].length > 0
    );
    if (!hasContent) {
      issueList.push(`⚠️  No content fields present (step_by_step, farzlar, etc.)`);
    }

    // Check manual_semantic_descriptions (optional but if present, should be valid)
    if (Array.isArray(entry.manual_semantic_descriptions) && entry.manual_semantic_descriptions.length > 0) {
      entry.manual_semantic_descriptions.forEach((desc, idx) => {
        if (typeof desc !== 'string' || desc.trim().length < 5) {
          issueList.push(`⚠️  manual_semantic_descriptions[${idx}] too short (${typeof desc === 'string' ? desc.length : 0} chars)`);
        }
      });
    }

    // Check related_questions
    if (!Array.isArray(entry.related_questions)) {
      issueList.push(`⚠️  Missing related_questions array`);
    } else if (entry.related_questions.length === 0) {
      issueList.push(`⚠️  related_questions array is empty`);
    }

    // Check category
    const validCategories = ['worship_practice', 'daily_life', 'family', 'finance', 'ethics', 'general', 'daily_practice', 'religious_knowledge'];
    if (!validCategories.includes(entry.category)) {
      issueList.push(`⚠️  category "${entry.category}" not in standard list`);
    }

    if (issueList.length === 0) {
      this.results.valid++;
      return true;
    } else {
      this.results.invalid++;
      this.results.issues.push({
        file: filename,
        id: entry.id,
        issues: issueList
      });
      return false;
    }
  }

  validateAll() {
    const files = fs.readdirSync(ILMIHAL_DIR).filter(f => f.endsWith('.json'));
    this.results.total = files.length;

    files.forEach(file => {
      const filepath = path.join(ILMIHAL_DIR, file);
      this.validate(file, filepath);
    });
  }

  generateReport() {
    const passRate = ((this.results.valid / this.results.total) * 100).toFixed(1);

    let report = `# KB Coverage Validation Report

**Generated:** ${new Date().toISOString()}

## Summary

| Metric | Count |
|--------|-------|
| Total Entries | ${this.results.total} |
| Valid | ${this.results.valid} ✅ |
| Invalid | ${this.results.invalid} ❌ |
| **Pass Rate** | **${passRate}%** |

`;

    if (this.results.invalid > 0) {
      report += `## Issues Found (${this.results.invalid})\n\n`;

      this.results.issues.forEach((issue, idx) => {
        report += `### ${idx + 1}. \`${issue.file}\``;
        if (issue.id) report += ` (ID: \`${issue.id}\`)`;
        report += `\n\n`;

        issue.issues.forEach(iss => {
          report += `- ${iss}\n`;
        });
        report += '\n';
      });
    } else {
      report += `## ✅ All Entries Valid\n\nNo issues found in any KB entries.\n`;
    }

    report += `\n## Entry Categories\n\n`;
    const categories = {};
    const files = fs.readdirSync(ILMIHAL_DIR).filter(f => f.endsWith('.json'));

    files.forEach(file => {
      const filepath = path.join(ILMIHAL_DIR, file);
      const entry = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      const cat = entry.category || 'uncategorized';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      report += `- **${cat}**: ${count} entries\n`;
    });

    return report;
  }

  save() {
    const logsDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const report = this.generateReport();
    fs.writeFileSync(OUTPUT_FILE, report, 'utf8');

    return report;
  }
}

function main() {
  console.log('🔍 Validating KB coverage...\n');

  const validator = new CoverageValidator();
  validator.validateAll();

  const report = validator.save();
  console.log(report);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`📁 Report saved to: server/logs/coverage-report.md`);
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(validator.results.invalid > 0 ? 1 : 0);
}

main();
