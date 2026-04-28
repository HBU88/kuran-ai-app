// Compatibility shim for older imports and CLI smoke checks.

const { buildChatResponse, analyzeUserMessage, rankAyahs } = require("./agent/index");

module.exports = {
  analyzeUserMessage,
  rankAyahs,
  buildChatResponse,
};

if (require.main === module) {
  buildChatResponse(process.argv.slice(2).join(" ") || "çok yalnız hissediyorum")
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
