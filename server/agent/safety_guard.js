// Central safety hook for the chat agent.

function applySafetyGuard(response) {
  return {
    ...response,
    assistant_text: guardAssistantText(response.assistant_text),
  };
}

function guardAssistantText(text) {
  const value = typeof text === "string" ? text : "";
  if (!value.trim()) return value;

  if (containsHostileOrViolentContent(value)) {
    return "Bu konuda zarar, nefret veya şiddeti destekleyen bir yönlendirme yapamam. Dilersen konuyu güvenli, sakin ve yapıcı bir dille ele alabiliriz.";
  }

  if (needsSensitiveDisclaimer(value) && !value.includes("Bu yanıt genel bilgilendirme içindir")) {
    return `${value}\n\nNot: Bu yanıt genel bilgilendirme içindir; resmî fetva, hukukî/medikal danışmanlık veya acil destek yerine geçmez. Hassas bir durum varsa ehil bir uzmana ya da yerel acil destek birimlerine başvur.`;
  }

  return value;
}

function containsHostileOrViolentContent(text) {
  const normalized = normalizeText(text);
  const patterns = [
    "öldür",
    "oldur",
    "nefret et",
    "saldır",
    "saldir",
    "mezhep düşman",
    "mezhep dusman",
    "soykırım",
    "soykirim",
  ];
  return patterns.some((pattern) => normalized.includes(pattern));
}

function needsSensitiveDisclaimer(text) {
  const normalized = normalizeText(text);
  const patterns = [
    "fetva",
    "haram",
    "helal",
    "günah",
    "gunah",
    "caiz",
    "hukuk",
    "mahkeme",
    "tıbbi",
    "tibbi",
    "doktor",
    "acil",
    "kendine zarar",
  ];
  return patterns.some((pattern) => normalized.includes(pattern));
}

function normalizeText(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC");
}

module.exports = {
  applySafetyGuard,
  guardAssistantText,
  containsHostileOrViolentContent,
  needsSensitiveDisclaimer,
};
