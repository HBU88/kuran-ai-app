# 🧪 Automated QA System for Semantic Matching

Comprehensive daily testing system with dynamic question generation, performance analysis, and critical issue alerts.

## System Overview

The QA system tests semantic matching accuracy by:
1. **Generating fresh questions daily** - Uses OpenAI to create contextually appropriate Turkish variations
2. **Testing against live backend** - Sends questions to `/ilmihal-chat` endpoint
3. **Analyzing performance** - Tracks accuracy, response time, and confidence scores
4. **Identifying issues** - Flags low scores and critical failures
5. **Recommending improvements** - Uses AI to suggest fixes for problem areas

## Components

### 1. Question Generator (`question-generator.js`)
**Purpose:** Generate fresh test questions daily

**Features:**
- 8 Islamic topics (kurban, selam, namaz, abdest, oruç, zekat, hac, dua)
- Pattern-based questions for consistency
- OpenAI-generated variations for creativity
- Daily cache to avoid regenerating questions
- ~80-100 questions per day

**Usage:**
```bash
npm run generate:questions
```

**Output:**
- `generated_questions_YYYY-MM-DD.json` - Contains all questions for the day

### 2. Test Suite (`test-suite.js`)
**Purpose:** Execute all generated questions against backend

**Metrics Tracked:**
- Response time (target: <5s per request)
- Match score (0-100%)
- Correct topic routing
- Error/timeout count

**Testing Strategy:**
- ~100ms delay between requests (rate limiting)
- 10 second timeout per request
- Records all responses for analysis
- Always exits with code 0 (we measure, don't enforce)

**Usage:**
```bash
npm run test:qa
```

**Output:**
- `test_results_YYYY-MM-DD.json` - Complete test results

### 3. Question Analyzer (`question-analyzer.js`)
**Purpose:** Analyze test results and identify patterns

**Analysis:**
- Topic-by-topic accuracy breakdown
- Identifies low-performing topics (<70% accuracy)
- Highlights low-confidence questions (<70% score)
- Detects slow responses (>2 seconds)
- Generates actionable recommendations

**Usage:**
```bash
npm run analyze:qa
```

**Output:**
- `analysis_YYYY-MM-DD.json` - Machine-readable analysis
- `analysis_YYYY-MM-DD.txt` - Human-readable report

### 4. Auto-Fix System (`auto-fix.js`) — Cost-Optimized
**Purpose:** Intelligent issue analysis with minimal API costs

**Two-Tier Strategy:**
- **Tier 1 (API):** Critical failures (timeouts/crashes/errors) — AI analysis
- **Tier 2 (Pattern-Based):** Low-score questions — Local analysis, NO API cost

**Score-Based Classification:**
```
0.75-1.00: ✅ Good (no action needed)
0.60-0.74: ⚠️  Pattern-based suggestions only (cost: $0.00)
<0.60:     🚨 Critical (API analysis if timeouts/crashes)
```

**Cost Optimization:**
- Pattern-based analysis for low scores: **$0.00** (no API calls)
- Batch critical issues into single API call: **~$0.03** per batch
- Monthly cost: **<$0.50** (vs $1.50+ without optimization)

**Usage:**
```bash
npm run fix:qa
```

**Output:**
- `recommendations_YYYY-MM-DD.json` - Issue analysis + cost breakdown
- Console output shows API calls and estimated cost per run

**See Also:**
- `COST_OPTIMIZATION.md` - Detailed cost breakdown and strategy

## Full QA Workflow

Run complete workflow:
```bash
npm run qa:full
```

This runs:
1. Generate fresh questions
2. Execute all tests
3. Analyze results
4. Review critical issues

## GitHub Actions Setup

### Configuration

Add these GitHub Secrets:
```
OPENAI_API_KEY     - For question generation and analysis
SLACK_WEBHOOK      - For notifications (optional)
```

### Workflow File

- Location: `.github/workflows/daily-qa-tests.yml`
- Schedule: Daily at 2 AM UTC (customizable)
- Manual trigger: Available via "Actions" tab
- Timeout: 30 minutes

### Workflow Steps

1. **Checkout** - Get latest code
2. **Setup** - Install Node.js 18
3. **Generate** - Create fresh questions
4. **Server** - Start backend on localhost:3000
5. **Test** - Run all questions through backend
6. **Analyze** - Generate performance report
7. **Auto-Fix** - Analyze critical issues
8. **Commit** - Save results to repo
9. **Notify** - Post to Slack (if configured)

## Test Results

### Directory Structure
```
server/test_results/
├── test_results_2026-05-28.json       # Complete test results
├── analysis_2026-05-28.json           # Machine-readable analysis
├── analysis_2026-05-28.txt            # Human-readable report
└── recommendations_2026-05-28.json    # AI-generated recommendations
```

### Result Format

**test_results_YYYY-MM-DD.json:**
```json
{
  "timestamp": "2026-05-28T...",
  "totalQuestions": 87,
  "summary": {
    "totalTests": 87,
    "successfulResponses": 85,
    "failedResponses": 2,
    "avgMatchScore": 78.5,
    "avgResponseTime": 1250,
    "errors": 2
  },
  "criticalIssues": [...],
  "testResults": [
    {
      "question": "kurban nedir?",
      "topic": "kurban",
      "matchScore": "85.3",
      "responseTime": 1200,
      "status": "success"
    }
  ]
}
```

## Local Testing

### Quick Start

```bash
# Terminal 1: Start backend
npm start

# Terminal 2: Run full QA workflow
npm run qa:full
```

### Individual Steps

```bash
# Generate questions (with OpenAI API key)
OPENAI_API_KEY=sk-... npm run generate:questions

# Run tests
BACKEND_URL=http://localhost:3000 npm run test:qa

# Analyze results
npm run analyze:qa

# Check critical issues
OPENAI_API_KEY=sk-... npm run fix:qa
```

## Performance Targets

| Metric | Target | Alert |
|--------|--------|-------|
| Avg Match Score | >75% | <70% |
| Response Time | <1s | >2s |
| Success Rate | >95% | <90% |
| Timeouts | 0 | >0 |
| Errors | 0 | >0 |

## Interpreting Results

### High-Confidence Questions (>80% score)
✅ Working well - no action needed

### Medium-Confidence (60-80%)
⚠️ Monitor - may need semantic improvements

### Low-Confidence (<60%)
❌ Needs attention - consider:
- Adding synonyms to knowledge base
- Improving semantic descriptions
- Adding question variations to routing

### Critical Issues
🚨 Immediate action required:
- Timeouts suggest backend overload
- Errors may indicate code bugs
- Invalid responses = parsing problems

## Cost Management

### Monthly Cost Breakdown
| Component | Cost | Notes |
|-----------|------|-------|
| Question Generation | ~$0.03 | OpenAI gpt-4o-mini, daily |
| Critical Issue Analysis | <$0.20 | Only when timeouts/crashes occur |
| Low-Score Analysis | $0.00 | Pattern-based, no API calls |
| **Total** | **<$0.50/month** | 65-87% reduction vs naive approach |

### Cost Monitoring
```bash
# Check latest cost
grep "estimatedCost" server/test_results/recommendations_*.json | tail -1

# View monthly total
cat server/test_results/recommendations_*.json \
  | jq '.costOptimization.estimatedCost'
```

### Cost Alerts
If monthly cost exceeds $1.00:
1. Check for excessive critical issues
2. Review backend logs for errors
3. Consider increasing test frequency to catch issues earlier
4. See `COST_OPTIMIZATION.md` for detailed strategies

## Troubleshooting

### "OPENAI_API_KEY not set"
- Question generation falls back to pattern-based mode
- Auto-fix system cannot analyze critical issues
- Set environment variable to enable AI features:
```bash
export OPENAI_API_KEY=sk-...
```

### "Cannot reach backend"
- Ensure server is running: `npm start`
- Check BACKEND_URL environment variable
- Default: `http://localhost:3000`

### Questions not improving
- Review `analysis_*.txt` report
- Check `recommendations_*.json` for pattern-based suggestions
- Implement recommended semantic improvements
- Re-run test suite to measure progress

### High response times
- May indicate backend performance issues
- Check server logs for errors
- Profile backend API calls
- Consider caching improvements

### Unexpectedly high costs
- Review `recommendations_*.json` costOptimization section
- Check if critical issues are being batched (should be 1 call per run)
- Verify OPENAI_API_KEY is set (if not, questions use pattern-based fallback)
- See `COST_OPTIMIZATION.md` for debugging guide

## Integration with CI/CD

The workflow automatically:
1. ✅ Generates fresh tests daily
2. ✅ Runs against production backend
3. ✅ Commits results to repo
4. ✅ Posts summaries to Slack
5. ✅ Archives artifacts for 30 days

No manual intervention required after setup.

## Future Enhancements

### Planned Features
- [ ] Dashboard for trend tracking
- [ ] Machine learning for question classification
- [ ] Automated semantic description generation
- [ ] Regression detection (comparing week-over-week)
- [ ] Per-topic benchmarking

### Data Collection (Phase 2)
- Track question patterns over time
- Identify most problematic topics
- Measure improvement from fixes
- Build ML models for quality prediction

## Contributing

To add new topics:

1. Edit `question-generator.js` - Add topic to `TOPICS`
2. Define keywords and question patterns
3. Add expected topic mapping
4. Run `npm run generate:questions` to test
5. Commit changes

Example:
```javascript
{
  ihsan: {
    label: 'İhsan (Virtue)',
    expectedTopic: 'ihsan_nedir',
    keywords: ['ihsan', 'seçkin ibadet', 'kalbten ibadet'],
    questionPatterns: [
      '{keyword} nedir?',
      '{keyword} ne demek?',
      // ... more patterns
    ]
  }
}
```

## Support

For issues or questions:
1. Check test results in `test_results/` directory
2. Review recommendations in `recommendations_*.json`
3. Check GitHub Actions logs for detailed output
4. Contact QA team with `test_results_YYYY-MM-DD.json` attached
