# HAKAI QA System - Usage Examples

## Quick Start (2 minutes)

Run the complete pre-launch suite:
```bash
cd server
npm run qa:pre-launch
```

View the summary:
```bash
cat logs/PRE-LAUNCH-REPORT.md
```

---

## Individual Validators

### 1. Semantic Collision Detector

**Purpose:** Find keyword overlaps that could confuse routing

**Run:**
```bash
npm run detect:collisions
```

**Console Output:**
```
🔍 Scanning KB entries for semantic collisions...

📚 Loaded 163 KB entries

═══════════════════════════════════════════════════════
📊 SEMANTIC COLLISION REPORT
═══════════════════════════════════════════════════════

🔴 CRITICAL COLLISIONS: 0
🟡 WARNING COLLISIONS: 139
✅ CLEAN ENTRIES: 24

═══════════════════════════════════════════════════════
📁 Full report: server/logs/semantic-collisions.json
═══════════════════════════════════════════════════════
```

**Interpret Results:**

```json
{
  "entry": "nifas_nedir",
  "category": "worship_practice",
  "problematic_keywords": ["namaz", "oruç"],
  "collision_count": 2,
  "collisions_with": [
    {
      "entry": "bayram_namazi_nedir",
      "shared_keywords": ["namaz"],
      "reason": "\"bayram_namazi_nedir\" mentions this entry's topic: namaz"
    },
    {
      "entry": "oruc_nedir",
      "shared_keywords": ["oruç"],
      "reason": "\"oruc_nedir\" mentions this entry's topic: oruc"
    }
  ],
  "severity": "WARNING"
}
```

**What to Do:**
- **CRITICAL (severity: CRITICAL):** Fix immediately before launch
  - Replace problematic keywords with synonyms
  - Example: "namaz kılınmaz" → "ibadet yapılamaz"
- **WARNING (severity: WARNING):** Monitor, fix if causing routing issues
  - These are often expected relationships
  - Only problematic if they interfere with specific queries

**Example Fix (nifas_nedir.json):**

Before:
```json
{
  "summary": "Nifas, doğum sonrası lohusalık kanamasıdır; namaza ve oruca engel olmaz."
}
```

After:
```json
{
  "summary": "Nifas, doğum sonrası lohusalık kanamasıdır; ibadete ve oruca engel olmaz."
}
```

---

### 2. Coverage Validator

**Purpose:** Ensure all entries have required structure and content

**Run:**
```bash
npm run validate:coverage
```

**Console Output:**
```
🔍 Validating KB coverage...

# KB Coverage Validation Report

## Summary

| Metric | Count |
|--------|-------|
| Total Entries | 163 |
| Valid | 159 ✅ |
| Invalid | 4 ❌ |
| **Pass Rate** | **97.5%** |

═══════════════════════════════════════════════════════
📁 Report saved to: server/logs/coverage-report.md
═══════════════════════════════════════════════════════
```

**Interpret Results:**

Issues found (in coverage-report.md):
```
### 1. `abdest.json` (ID: `abdest_howto`)

- ⚠️  ID mismatch: filename "abdest.json" vs id "abdest_howto"

### 2. `gusul.json` (ID: `gusul_howto`)

- ⚠️  ID mismatch: filename "gusul.json" vs id "gusul_howto"
```

**Required Fields Check:**
```
✅ id              - Present in all entries
✅ title           - Present in all entries
✅ category        - Present in all entries (worship_practice, daily_practice, etc.)
✅ summary         - Present in all entries
✅ keywords        - Array present and not empty
✅ related_questions - Present in most entries
✅ content         - step_by_step, farzlar, vacipler, sunnetler, etc.
```

**What to Do:**

- **ID Mismatch:** Rename file to match ID
  ```bash
  # Before
  server/data/ilmihal/abdest.json (contains id: "abdest_howto")
  
  # After
  server/data/ilmihal/abdest_howto.json
  ```

- **Missing Fields:** Add content
  ```bash
  # Open the JSON file and add:
  {
    "step_by_step": [...],        # How to perform
    "keywords": [...],            # Search terms
    "related_questions": [...]    # Related topics
  }
  ```

- **Invalid Category:** Use valid categories
  ```
  Valid: worship_practice, daily_practice, ethics, religious_knowledge, family, finance, general
  ```

---

### 3. QA Test Suite

**Purpose:** Test 443+ question variations against KB entries

**Run:**
```bash
npm run test:qa-suite
```

**Console Output:**
```
═══════════════════════════════════════════════════════
🧪 QA TEST SUITE GENERATOR
═══════════════════════════════════════════════════════

📝 Generating test cases...

   Loading 163 KB entries
   ✅ Generated 326 basic tests
   ✅ Generated 107 variation tests
   ✅ Generated 6 edge case tests
   ✅ Generated 4 KB-miss tests

   📊 Total test cases: 443

▶️  Running tests (simulated mode)...

   ✓ 50/443 tests completed
   ...

═══════════════════════════════════════════════════════
📊 TEST RESULTS
═══════════════════════════════════════════════════════

Total Tests: 443
✅ Passed: 439
❌ Failed: 4
Pass Rate: 99.1%
Status: ✅ PASS
```

**Test Breakdown:**

| Category | Count | Example Questions |
|----------|-------|-------------------|
| BASIC | 326 | "namaz nedir?", "oruç nedir?" |
| VARIATIONS | 105 | "namaz nasıl kılınır?", "oruç kimlere farzdır?" |
| COMPARISON | 2 | "hayız ile nifas farkı?" |
| EDGE_CASE | 6 | "nmaz nedir?" (typo), "namaz ve dua ilişkisi" |
| KB_MISS | 4 | Out-of-scope questions (should fallback to OpenAI) |

**Interpret Results:**

```json
{
  "summary": {
    "total_tests": 443,
    "passed": 439,
    "failed": 4,
    "pass_rate": 99.1,
    "status": "✅ PASS"
  },
  "failed_tests": [
    {
      "question": "Some edge case question",
      "expected_topic": "some_topic",
      "category": "EDGE_CASE",
      "score": "0.72",
      "reason": "Score below threshold: 72.0%"
    }
  ],
  "test_breakdown": {
    "BASIC": 326,
    "VARIATIONS": 105,
    "COMPARISON": 2,
    "EDGE_CASE": 6,
    "KB_MISS": 4
  }
}
```

**What to Do:**

- **Pass Rate > 95%:** ✅ KB is production ready
- **Pass Rate 85-95%:** ⚠️ Review failed tests, may need KB refinement
- **Pass Rate < 85%:** ❌ Fix routing issues before launch

**Improve Pass Rate:**

```bash
# 1. Check which questions failed
cat logs/qa-test-results.json | jq '.failed_tests'

# 2. Add missing KB entries for failed questions
# Example: If "alkol gunah mi?" failed, create alkol_gunah_mi.json

# 3. Improve keywords in related entries
# If test score is 0.72, the KB entry exists but isn't scoring high enough
# Add more keywords to increase semantic match

# 4. Re-run suite to verify fix
npm run test:qa-suite
```

---

## Complete Pre-Launch Flow

**Step 1: Generate All Tests**
```bash
npm run qa:pre-launch
```

**Step 2: View Summary**
```bash
cat logs/PRE-LAUNCH-REPORT.md
```

Output shows:
- Semantic collision status
- Coverage validation pass rate
- QA test results
- Overall launch readiness

**Step 3: Review Detailed Reports**

```bash
# Collision analysis
cat logs/semantic-collisions.json | jq '.[0:3]'

# Coverage issues
cat logs/coverage-report.md

# Failed test details
cat logs/qa-test-results.json | jq '.failed_tests'
```

**Step 4: Address Issues**

For each issue found:
```bash
# 1. Identify the problem
# 2. Modify KB entry
# 3. Re-run validator
# 4. Confirm fix
```

Example workflow:
```bash
# 1. Detect collision in nifas_nedir.json
npm run detect:collisions | grep "nifas_nedir" -A 10

# 2. Edit the file
nano server/data/ilmihal/nifas_nedir.json

# 3. Replace "namaz kılınmaz" with "ibadet yapılamaz"

# 4. Verify fix
npm run detect:collisions | grep "nifas_nedir" -A 10
# Should show reduced collision_count
```

**Step 5: Deploy**

Once all checks pass:
```bash
git add server/data/ilmihal/
git add server/logs/PRE-LAUNCH-REPORT.md
git commit -m "docs: Pre-launch QA passed, ready for production"
git push origin main
```

---

## Monitoring Post-Launch

### Daily KB-Miss Check

```bash
# Check what questions users are asking that KB doesn't cover
curl -s "https://hakai-backend.onrender.com/debug/kb-misses?days=1" | jq '.top_missing_questions'
```

Sample response:
```json
{
  "top_missing_questions": [
    {
      "question": "Modern teknoloji İslami kurallara uygun mu?",
      "count": 3
    },
    {
      "question": "Sosyal medyada İslami davranış kuralları",
      "count": 2
    }
  ]
}
```

### Weekly KB Expansion

```bash
# 1. Identify top 5 missing questions
curl -s "https://hakai-backend.onrender.com/debug/kb-misses?days=7" | jq '.top_missing_questions[0:5]'

# 2. Create new KB entries for top questions
# Example: server/data/ilmihal/modern_teknoloji_islam.json

# 3. Add to codebase
git add server/data/ilmihal/modern_teknoloji_islam.json

# 4. Re-validate
npm run qa:pre-launch

# 5. Deploy
git push origin main
```

### Monthly QA Review

```bash
# Run full QA suite
npm run qa:pre-launch

# Compare with previous month
# Review:
# - Are collisions increasing? (might need refactoring)
# - Is coverage still 95%+? (monitor for structure drift)
# - Is pass rate above 90%? (monitor for routing issues)

# Archive report
cp logs/PRE-LAUNCH-REPORT.md "reports/qa-$(date +%Y-%m-%d).md"
```

---

## Troubleshooting Common Issues

### Issue: 50+ Failed Tests After Adding Entry

**Root Cause:** New entry keywords colliding with existing entries

**Fix:**
```bash
# 1. Check collisions
npm run detect:collisions | grep "your_new_entry"

# 2. Adjust keywords to be more specific
# Example: Instead of ["namaz"], use ["teravihnamazi"]

# 3. Re-test
npm run test:qa-suite
```

### Issue: Collision Score Increasing

**Root Cause:** Similar topics sharing keywords (expected)

**Fix:**
```bash
# 1. Check if it's a CRITICAL issue
cat logs/semantic-collisions.json | jq '.[] | select(.severity == "CRITICAL")'

# 2. If CRITICAL, fix the entry
# If WARNING, it's expected behavior

# Only fix if causing actual routing failures
```

### Issue: Pass Rate Below 90%

**Root Cause:** Routing ambiguity or missing KB entries

**Fix:**
```bash
# 1. Identify failing questions
cat logs/qa-test-results.json | jq '.failed_tests | .[] | .question'

# 2. For each failed question:
#    a. Check if KB entry exists
#    b. If exists, improve keywords
#    c. If missing, create entry

# 3. Re-validate
npm run qa:pre-launch
```

---

## Integration with CI/CD

**Pre-deployment validation:**

```bash
#!/bin/bash
# .github/workflows/pre-deploy.yml

- name: Run QA Suite
  run: npm --prefix server run qa:pre-launch

- name: Check Results
  run: |
    if [ -f "server/logs/pre-launch-final-report.json" ]; then
      STATUS=$(jq -r '.overall_status' < server/logs/pre-launch-final-report.json)
      if [ "$STATUS" != "✅ READY FOR LAUNCH" ]; then
        echo "QA checks failed. Review logs."
        exit 1
      fi
    fi

- name: Upload Artifacts
  uses: actions/upload-artifact@v2
  with:
    name: qa-reports
    path: server/logs/
```

---

## Performance Notes

**Run Times:**
- Semantic Collision Detector: ~5 seconds
- Coverage Validator: ~3 seconds
- QA Test Suite: ~15 seconds
- Pre-Launch Orchestrator (all 3): ~30 seconds

**File Sizes:**
- KB data: ~2.5 MB (163 entries)
- Generated reports: ~500 KB total
- Logs: ~1 MB

---

## Appendix: Test Examples

### Example BASIC Test
```javascript
{
  "question": "namaz nedir?",
  "expected_topic": "namaz_nedir",
  "category": "BASIC",
  "difficulty": "EASY",
  "expected_score": 0.95+
}
```

### Example VARIATION Test
```javascript
{
  "question": "namaz nasıl kılınır?",
  "expected_topic": "namaz_nedir",
  "category": "VARIATIONS",
  "difficulty": "MEDIUM",
  "expected_score": 0.85+
}
```

### Example EDGE_CASE Test
```javascript
{
  "question": "nmaz nedir?",  // typo
  "expected_topic": "namaz_nedir",
  "category": "EDGE_CASE",
  "difficulty": "HARD",
  "expected_score": 0.75+
}
```

### Example KB_MISS Test
```javascript
{
  "question": "Dijital çağda İslam nasıl uygulanır?",
  "expected_topic": null,  // Out of KB
  "category": "KB_MISS",
  "difficulty": "HARD",
  "expected_score": null  // Falls back to OpenAI
}
```

---

**Last Updated:** 2026-05-28
**Status:** ✅ All Systems Operational
