# 🔍 Ilmihal Debug Logging Guide

Comprehensive debug logging for the `/ilmihal-chat` endpoint to diagnose semantic matching and routing issues.

## Overview

The debug logger tracks the complete semantic matching process:
1. **Incoming question** - Logs the user's query
2. **Semantic matching** - Shows matching process and scores
3. **Knowledge base hit** - Logs which KB entry matched
4. **Match score** - Confidence and accuracy metrics
5. **Final response** - Shows what gets sent back to user
6. **Rejected candidates** - Lists KB entries that didn't match

## Quick Start

### 1. Start Backend with Logging Enabled
```bash
cd server
npm start
```

### 2. Real-Time Console Output
All ilmihal-chat requests will show debug logs in the console:
```
════════════════════════════════════════════════════════════════════════════════
🔍 ILMIHAL QUESTION #1
════════════════════════════════════════════════════════════════════════════════
📝 Message: "namaz nedir?"

► Initiating semantic matching for: "namaz nedir?"

📚 Knowledge Base Candidates Found: 8
   [1] ID: namaz_nedir | Topic: namaz_nedir | Label: Namaz Nedir?
   [2] ID: nifas_nedir | Topic: nifas_nedir | Label: Nifas Nedir?
   ...

✅ KNOWLEDGE BASE HIT
   id: namaz_nedir
   expectedTopic: namaz_nedir
   label: Namaz Nedir?
   matchScore: 0.85
   routingScore: 0.78
   confidence: 0.87
   answerPreview: Namaz, İslamda en temel ibadetlerden birisidir...

🛣️  ROUTING DECISION
   Route Type: namaz_nedir
   Matched Topic: Namaz Nedir?
   Score: 85.00%
   Confidence: 87.00%

📤 FINAL RESPONSE
   Type: knowledge_base
   Preview: "Namaz, İslamda en temel ibadetlerden birisidir..."
   Length: 1247 characters
```

### 3. Persistent Log File
Logs are also saved to: `server/logs/ilmihal-debug.log`

View with:
```bash
# Last 50 lines
tail -50 server/logs/ilmihal-debug.log

# Watch in real-time
tail -f server/logs/ilmihal-debug.log

# Full file
cat server/logs/ilmihal-debug.log
```

## What Gets Logged

### For Each Question

#### 1. **Question Header**
```
════════════════════════════════════════════════════════════════════════════════
🔍 ILMIHAL QUESTION #N
════════════════════════════════════════════════════════════════════════════════
📝 Message: "user's question here"
```

#### 2. **Semantic Matching Start**
```
► Initiating semantic matching for: "namaz nedir?"
```

#### 3. **Available Candidates**
```
📚 Knowledge Base Candidates Found: 8
   [1] ID: namaz_nedir | Topic: namaz_nedir | Label: Namaz Nedir?
   [2] ID: nifas_nedir | Topic: nifas_nedir | Label: Nifas Nedir?
   ...
```

#### 4. **Matched Entry (If Found)**
```
✅ KNOWLEDGE BASE HIT
   id: namaz_nedir
   expectedTopic: namaz_nedir
   label: Namaz Nedir?
   matchScore: 0.85
   routingScore: 0.78
   confidence: 0.87
   answerPreview: Namaz, İslamda...
```

#### 5. **Routing Decision**
```
🛣️  ROUTING DECISION
   Route Type: namaz_nedir
   Matched Topic: Namaz Nedir?
   Score: 85.00%
   Confidence: 87.00%
```

#### 6. **Rejected Candidates (If Any)**
```
❌ REJECTED CANDIDATES
   [1] nifas_nedir (nifas_nedir): 35.42% - Reason: threshold not met
   [2] bayram_namazi_nedir (bayram_namazi): 42.18% - Reason: threshold not met
```

#### 7. **Final Response**
```
📤 FINAL RESPONSE
   Type: knowledge_base
   Preview: "Namaz, İslamda en temel ibadetlerden birisidir..."
   Length: 1247 characters
```

## Diagnosing Issues

### Problem: Wrong Topic Matched
**Example:** "namaz nedir?" maps to "nifas" instead of "namaz"

**Debug Process:**
1. Look at "Available Candidates" section
2. Check "Matched Entry" - is it the wrong one?
3. Look at "Rejected Candidates" - is correct entry listed?
4. Check scores: why did wrong entry score higher?

**Example Output:**
```
✅ KNOWLEDGE BASE HIT (WRONG!)
   id: nifas_nedir
   expectedTopic: nifas_nedir
   matchScore: 0.68

❌ REJECTED CANDIDATES
   [1] namaz_nedir: 0.42% - Reason: threshold not met
```

**Diagnosis:** `namaz_nedir` scored too low (42%) compared to `nifas` (68%)

**Next Steps:**
1. Check semantic descriptions in knowledge base
2. Review Turkish lemmatization for query
3. Verify synonym mappings
4. Increase semantic score threshold if too strict

### Problem: No Match Found
**Debug Output:**
```
► Initiating semantic matching for: "Turkish question?"

⊘ NO MATCH FOUND
   Query: "Turkish question?"
   Reason: No candidate exceeded confidence threshold
```

**Diagnosis:** All candidates scored below threshold

**Next Steps:**
1. Check if query is too obscure
2. Verify knowledge base has relevant entry
3. Check semantic descriptions completeness
4. Consider lowering confidence threshold

### Problem: Low Confidence Match
**Debug Output:**
```
✅ KNOWLEDGE BASE HIT
   matchScore: 0.42
   confidence: 0.35
```

**Diagnosis:** Match score is below ideal (typically target >0.70)

**Next Steps:**
1. Review semantic description completeness
2. Add more synonym mappings
3. Check Turkish lemmatization accuracy
4. Verify query tokens match profile keywords

## Log File Format

### Console Format
```
[TIMESTAMP] [EMOJI] MESSAGE
[TIMESTAMP] Nested details with indentation
```

### File Format
```
════════════════════════════════════════════════════════════════════════════════
QUESTION #N
MESSAGE: "user question"
TIMESTAMP: 2026-05-28T...

► Initiating semantic matching for: "..."
```

### Sample Log Entries
```
[2026-05-28T10:30:15.123Z] ════════════════════════════════════════════════════════════════════════════════
[2026-05-28T10:30:15.123Z] 🔍 ILMIHAL QUESTION #5
[2026-05-28T10:30:15.123Z] ════════════════════════════════════════════════════════════════════════════════
[2026-05-28T10:30:15.123Z] 📝 Message: "namaz nedir?"
[2026-05-28T10:30:15.123Z] ► Initiating semantic matching for: "namaz nedir?"
[2026-05-28T10:30:15.124Z] 📚 Knowledge Base Candidates Found: 8
[2026-05-28T10:30:15.124Z]    [1] ID: namaz_nedir | Topic: namaz_nedir | Label: Namaz Nedir?
...
```

## Usage in Development

### 1. Interactive Testing
```bash
# Start backend
npm start

# In another terminal, send test question
curl -X POST http://localhost:3000/ilmihal-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "namaz nedir?"}'

# Watch console output
# Or tail the log file:
tail -f logs/ilmihal-debug.log
```

### 2. Batch Testing
```bash
# Test multiple questions
npm run test:qa

# All questions logged with routing details
tail -50 logs/ilmihal-debug.log
```

### 3. Analyzing Patterns
```bash
# Count matched topics
grep "Route Type:" logs/ilmihal-debug.log | sort | uniq -c

# Find low-confidence matches
grep "Confidence:" logs/ilmihal-debug.log | awk -F': ' '$2 < 0.70'

# Find mismatches
grep "WRONG\|NO MATCH" logs/ilmihal-debug.log
```

## Configuration

### Enable/Disable Logging
Currently, logging is **always enabled** for ilmihal-chat.

To disable, comment out logging calls in `server/index.js`:
```javascript
// if (module === "ilmihal") {
//   ilmihalDebugLogger.logIncomingQuestion(requestCounter, message);
// }
```

### Log File Retention
- Logs append to existing file
- Clear manually: `rm server/logs/ilmihal-debug.log`
- Or programmatically: `npm run clear:ilmihal-logs` (if script added)

### Log Level
Currently logs all questions and matches.

For production:
- Log only errors: modify `ilmihal-debug-logger.js`
- Log only low-confidence: add threshold check
- Log only mismatches: add verification logic

## Common Score Ranges

### Match Score Interpretation
```
0.90-1.00  : Excellent match (high confidence)
0.75-0.89  : Good match (reliable)
0.60-0.74  : Fair match (monitor)
0.40-0.59  : Weak match (likely wrong)
<0.40      : Very weak (almost certainly wrong)
```

### Confidence Interpretation
```
0.90-1.00  : Very certain
0.75-0.89  : Fairly certain
0.60-0.74  : Moderately confident
<0.60      : Low confidence (questionable)
```

## Troubleshooting Logging

### Log File Not Created
```bash
# Check logs directory exists
ls -la server/logs/

# Create if missing
mkdir -p server/logs

# Verify permissions
chmod 755 server/logs
```

### Console Output Missing
- Check backend started successfully
- Verify `/ilmihal-chat` endpoint receiving requests
- Check request has valid `message` field

### Log File Too Large
```bash
# Check size
du -h server/logs/ilmihal-debug.log

# Clear and restart
rm server/logs/ilmihal-debug.log
npm start
```

## Related Files

- **Logger:** `server/ilmihal-debug-logger.js` - Debug logging module
- **Main Handler:** `server/index.js` - handleChatModuleRequest() function
- **Knowledge Router:** `server/agent/knowledge_router.js` - Matching logic
- **Semantic Matcher:** `server/agent/semantic_topic_matcher.js` - Scoring algorithm

## API Integration

The logger is automatically called by:
1. `POST /ilmihal-chat` - Main endpoint
2. `GET /debug/resolve?q=question&module=ilmihal` - Debug endpoint

Both endpoints log the full matching process.

## Next Steps

Use debug logs to:
1. **Identify routing errors** - Which topics are matching incorrectly?
2. **Fix semantic descriptions** - Update profiles with better keywords
3. **Adjust thresholds** - Should confidence threshold be higher/lower?
4. **Test improvements** - Re-run same question, compare scores
5. **Build regression tests** - Save logs for known-good baselines

---

**Log Directory:** `server/logs/ilmihal-debug.log`  
**Logger Module:** `server/ilmihal-debug-logger.js`  
**Main Integration:** `server/index.js` (handleChatModuleRequest)
