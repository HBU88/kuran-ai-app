// Central safety hook for the chat agent. It currently preserves existing output.

function applySafetyGuard(response) {
  return {
    ...response,
    assistant_text: guardAssistantText(response.assistant_text),
  };
}

function guardAssistantText(text) {
  // Existing response composers already use non-authoritative language.
  // Keep this as a no-op hook so policy checks can be expanded later.
  return text;
}

module.exports = {
  applySafetyGuard,
  guardAssistantText,
};
