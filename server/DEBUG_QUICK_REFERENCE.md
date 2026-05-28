# 🚀 Debug Logging Quick Reference

## Enable Debug Logging in 2 Steps

### Step 1: Start Backend
```bash
cd server
npm start
```

### Step 2: Test Problem Question
```bash
curl -X POST http://localhost:3000/ilmihal-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "namaz nedir?"}'
```

**Output:** See console immediately + `server/logs/ilmihal-debug.log`

---

## Diagnose: "namaz nedir?" → Wrong Topic

### What to Look For

1. **Correct entry score too low:**
   ```
   ❌ REJECTED CANDIDATES
      [1] namaz_nedir: 0.42 - Reason: threshold not met
   ```
   → Semantic description needs more keywords

2. **Wrong entry scored higher:**
   ```
   ✅ KNOWLEDGE BASE HIT (WRONG!)
      id: nifas_nedir
      matchScore: 0.68
   ```
   → Check why "nifas" keywords matched "namaz" query

3. **Token mismatch:**
   ```
   Profile Keywords: nifas, kanaması, temizlenme
   Query: "namaz nedir?"
   ```
   → Lemmatization not working correctly for this query

---

## Common Issues & Fixes

| Issue | Debug Sign | Fix |
|-------|-----------|-----|
| Wrong topic matched | WRONG! in log + rejected correct entry | Add more synonyms to correct entry's semantic description |
| Low confidence | matchScore: 0.45 | Expand keyword list in semantic profile |
| No match found | NO MATCH FOUND | Lower threshold or add semantic description |
| Nifas problem | nifas scores high for non-nifas questions | Review nifas keywords for false positives |

---

## Log Interpretation

### ✅ Good Log
```
✅ KNOWLEDGE BASE HIT
   matchScore: 0.85              ← High score
   confidence: 0.87              ← High confidence
   
🛣️  ROUTING DECISION
   Matched Topic: Namaz Nedir?   ← Correct topic
   Score: 85.00%                 ← Confidence level
```

### ❌ Bad Log (Wrong Match)
```
✅ KNOWLEDGE BASE HIT (WRONG!)
   id: nifas_nedir              ← WRONG!
   matchScore: 0.68
   confidence: 0.62

❌ REJECTED CANDIDATES
   [1] namaz_nedir: 0.35         ← TOO LOW (should be highest)
```

### ⊘ No Match Log
```
⊘ NO MATCH FOUND
   Query: "namaz nedir?"
   Reason: No candidate exceeded threshold
   
→ FIX: Add/improve semantic description for namaz_nedir
```

---

## Quick Commands

### View Latest Debug Log
```bash
tail -20 server/logs/ilmihal-debug.log
```

### Watch in Real-Time
```bash
tail -f server/logs/ilmihal-debug.log
```

### Count Issues by Topic
```bash
grep "id:" server/logs/ilmihal-debug.log | sort | uniq -c
```

### Find All Mismatches
```bash
grep "WRONG\|NO MATCH" server/logs/ilmihal-debug.log
```

### Search Specific Question
```bash
grep '"namaz nedir?"' server/logs/ilmihal-debug.log
```

### Clear Log
```bash
rm server/logs/ilmihal-debug.log
```

---

## Debug Endpoint (Alternative)

Test without making requests:
```bash
curl "http://localhost:3000/debug/resolve?q=namaz%20nedir%3F&module=ilmihal"
```

Shows same semantic matching information in JSON format.

---

## Score Interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| 0.90+ | Excellent | Trust result |
| 0.75-0.89 | Good | Likely correct |
| 0.60-0.74 | Fair | Monitor/verify |
| 0.40-0.59 | Weak | Probably wrong |
| <0.40 | Very weak | Almost certainly wrong |

---

## Fix Workflow

1. **Identify Wrong Match** in debug log
2. **Note the scores** - which entry should have won?
3. **Edit semantic description** in knowledge base
4. **Restart backend** `npm start`
5. **Test again** - does score improve?
6. **Verify** - check all similar questions

---

## Log File Locations

```
Live Console:     Terminal where npm start is running
Log File:         server/logs/ilmihal-debug.log
Logger Module:    server/ilmihal-debug-logger.js
Integration:      server/index.js (lines ~408-430)
```

---

## Next Steps After Fix

1. **Test with similar questions:**
   ```bash
   curl ... -d '{"message": "namaz nasıl yapılır?"}'
   curl ... -d '{"message": "namaz farzı nedir?"}'
   ```

2. **Run full regression:**
   ```bash
   npm run test:qa
   ```

3. **Check analyzer report:**
   ```bash
   npm run analyze:qa
   ```

---

**Need More Details?** See `ILMIHAL_DEBUG_GUIDE.md`
