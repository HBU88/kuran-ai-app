/**
 * Ilmihal Debug Logger
 * Logs semantic matching and routing decisions for ilmihal-chat endpoint
 *
 * Writes to: server/logs/ilmihal-debug.log
 * Also console.logs for real-time viewing
 */

const fs = require('fs');
const path = require('path');

const DEBUG_LOG_DIR = path.join(__dirname, 'logs');
const DEBUG_LOG_FILE = path.join(DEBUG_LOG_DIR, 'ilmihal-debug.log');

// Ensure logs directory exists
function ensureLogsDir() {
  try {
    if (!fs.existsSync(DEBUG_LOG_DIR)) {
      fs.mkdirSync(DEBUG_LOG_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('[ilmihal-debug] Failed to create logs directory:', error.message);
  }
}

/**
 * Append to debug log file
 */
function appendToLog(message) {
  ensureLogsDir();
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    fs.appendFileSync(DEBUG_LOG_FILE, logEntry + '\n', 'utf8');
  } catch (error) {
    console.error('[ilmihal-debug] Failed to write to log file:', error.message);
  }
}

/**
 * Log incoming question
 */
function logIncomingQuestion(questionNumber, message) {
  const divider = '═'.repeat(80);
  const consoleMsg = `\n${divider}\n🔍 ILMIHAL QUESTION #${questionNumber}\n${divider}`;
  const fileMsg = `\n${'═'.repeat(80)}\nQUESTION #${questionNumber}`;

  console.log(consoleMsg);
  console.log(`📝 Message: "${message}"`);

  appendToLog(fileMsg);
  appendToLog(`MESSAGE: "${message}"`);
  appendToLog(`TIMESTAMP: ${new Date().toISOString()}`);
}

/**
 * Log semantic matching initiation
 */
function logSemanticMatchStart(message) {
  const msg = `\n► Initiating semantic matching for: "${message}"`;
  console.log(msg);
  appendToLog(msg);
}

/**
 * Log knowledge base candidates
 */
function logKnowledgeBaseCandidates(candidates) {
  const msg = `\n📚 Knowledge Base Candidates Found: ${candidates.length}`;
  console.log(msg);
  appendToLog(msg);

  if (Array.isArray(candidates) && candidates.length > 0) {
    candidates.forEach((candidate, index) => {
      const candidateLog = `   [${index + 1}] ID: ${candidate.id || 'N/A'} | Topic: ${candidate.expectedTopic || 'N/A'} | Label: ${candidate.label || 'N/A'}`;
      console.log(candidateLog);
      appendToLog(candidateLog);
    });
  }
}

/**
 * Log semantic matching process
 */
function logSemanticMatch(query, profileData, score, details = {}) {
  const msg = `\n🔬 SEMANTIC MATCHING PROCESS`;
  console.log(msg);
  appendToLog(msg);

  console.log(`   Query: "${query}"`);
  appendToLog(`   Query: "${query}"`);

  if (profileData) {
    console.log(`   Profile Keywords: ${Array.isArray(profileData.keywords) ? profileData.keywords.join(', ') : 'N/A'}`);
    appendToLog(`   Profile Keywords: ${Array.isArray(profileData.keywords) ? profileData.keywords.join(', ') : 'N/A'}`);
  }

  console.log(`   Match Score: ${(score * 100).toFixed(2)}%`);
  appendToLog(`   Match Score: ${(score * 100).toFixed(2)}%`);

  if (details && Object.keys(details).length > 0) {
    Object.entries(details).forEach(([key, value]) => {
      const detailLog = `   ${key}: ${JSON.stringify(value)}`;
      console.log(detailLog);
      appendToLog(detailLog);
    });
  }
}

/**
 * Log matched knowledge base entry
 */
function logKnowledgeBaseHit(hit) {
  const msg = `\n✅ KNOWLEDGE BASE HIT`;
  console.log(msg);
  appendToLog(msg);

  if (hit) {
    const hitLog = {
      id: hit.id,
      expectedTopic: hit.expectedTopic,
      label: hit.label,
      matchScore: hit.matchScore,
      routingScore: hit.routingScore,
      confidence: hit.confidence,
      answerPreview: typeof hit.answer === 'string' ? hit.answer.substring(0, 100) + '...' : 'N/A'
    };

    Object.entries(hitLog).forEach(([key, value]) => {
      const logLine = `   ${key}: ${value}`;
      console.log(logLine);
      appendToLog(logLine);
    });
  } else {
    console.log('   No knowledge base hit found');
    appendToLog('   No knowledge base hit found');
  }
}

/**
 * Log routing decision
 */
function logRoutingDecision(routeType, matchedTopic, score, confidence) {
  const msg = `\n🛣️  ROUTING DECISION`;
  console.log(msg);
  appendToLog(msg);

  console.log(`   Route Type: ${routeType}`);
  appendToLog(`   Route Type: ${routeType}`);

  console.log(`   Matched Topic: ${matchedTopic}`);
  appendToLog(`   Matched Topic: ${matchedTopic}`);

  console.log(`   Score: ${(score * 100).toFixed(2)}%`);
  appendToLog(`   Score: ${(score * 100).toFixed(2)}%`);

  if (typeof confidence !== 'undefined') {
    console.log(`   Confidence: ${(confidence * 100).toFixed(2)}%`);
    appendToLog(`   Confidence: ${(confidence * 100).toFixed(2)}%`);
  }
}

/**
 * Log final response
 */
function logFinalResponse(response, answerType) {
  const msg = `\n📤 FINAL RESPONSE`;
  console.log(msg);
  appendToLog(msg);

  console.log(`   Type: ${answerType}`);
  appendToLog(`   Type: ${answerType}`);

  if (typeof response === 'string') {
    const preview = response.substring(0, 150);
    console.log(`   Preview: "${preview}${response.length > 150 ? '...' : ''}"`);
    appendToLog(`   Preview: "${preview}${response.length > 150 ? '...' : ''}"`);
    console.log(`   Length: ${response.length} characters`);
    appendToLog(`   Length: ${response.length} characters`);
  } else if (typeof response === 'object') {
    console.log(`   Structure: ${JSON.stringify(Object.keys(response))}`);
    appendToLog(`   Structure: ${JSON.stringify(Object.keys(response))}`);
  }
}

/**
 * Log rejected candidates with scores
 */
function logRejectedCandidates(rejected) {
  if (!Array.isArray(rejected) || rejected.length === 0) return;

  const msg = `\n❌ REJECTED CANDIDATES`;
  console.log(msg);
  appendToLog(msg);

  rejected.forEach((candidate, index) => {
    const rejectLog = `   [${index + 1}] ${candidate.id || 'unknown'} (${candidate.expectedTopic || 'unknown'}): ${(candidate.score * 100).toFixed(2)}% - Reason: ${candidate.reason || 'threshold not met'}`;
    console.log(rejectLog);
    appendToLog(rejectLog);
  });
}

/**
 * Log error
 */
function logError(error) {
  const msg = `\n❌ ERROR`;
  console.error(msg);
  appendToLog(msg);

  const errorLog = `   ${error.message || String(error)}`;
  console.error(errorLog);
  appendToLog(errorLog);

  if (error.stack) {
    const stackLog = `   Stack: ${error.stack.split('\n').slice(0, 3).join(' > ')}`;
    console.error(stackLog);
    appendToLog(stackLog);
  }
}

/**
 * Log no match
 */
function logNoMatch(query, reason = 'No candidate exceeded threshold') {
  const msg = `\n⊘ NO MATCH FOUND`;
  console.log(msg);
  appendToLog(msg);

  console.log(`   Query: "${query}"`);
  appendToLog(`   Query: "${query}"`);

  console.log(`   Reason: ${reason}`);
  appendToLog(`   Reason: ${reason}`);
}

/**
 * Clear log file (useful for testing)
 */
function clearLog() {
  ensureLogsDir();
  try {
    fs.writeFileSync(DEBUG_LOG_FILE, '', 'utf8');
    console.log('[ilmihal-debug] Log file cleared');
  } catch (error) {
    console.error('[ilmihal-debug] Failed to clear log file:', error.message);
  }
}

/**
 * Get log file path
 */
function getLogPath() {
  return DEBUG_LOG_FILE;
}

module.exports = {
  logIncomingQuestion,
  logSemanticMatchStart,
  logKnowledgeBaseCandidates,
  logSemanticMatch,
  logKnowledgeBaseHit,
  logRoutingDecision,
  logFinalResponse,
  logRejectedCandidates,
  logError,
  logNoMatch,
  clearLog,
  getLogPath,
};
