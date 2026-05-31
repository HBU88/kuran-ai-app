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

  if (needsSensitiveDisclaimer(value) && !value.includes("Bu paylaşım genel bilgilendirme")) {
    return `${value}\n\nNot: Bu paylaşım genel bilgilendirme ve manevi destek amaçlıdır; kişisel dinî karar, hukukî/medikal danışmanlık veya acil destek yerine geçmez. Hassas bir durum varsa ehil bir uzmana ya da yerel acil destek birimlerine başvur.`;
  }

  return value;
}

function containsHostileOrViolentContent(text) {
  const normalized = normalizeText(text);

  // Broad substring check causes false positives:
  //   - "öldürünce" (historical narrative) in Hz. Musa biography
  //   - "doldur" (to fill) contains "oldur" substring — different root entirely
  // Solution:
  //   For the ASCII fallback "oldur", require it to NOT be preceded by a consonant
  //   that makes it part of a different root (e.g. "d" in "doldur").
  const narrativeSuffixes = ["ünce", "ünmek", "ülür", "ülmek", "üldü", "üyor", "ünden", "üyle"];

  function containsKillVerb(text) {
    if (text.includes("öldür")) return true;
    // ASCII fallback: find "oldur" but skip if preceded by another letter
    // ("doldur" → 'd' before 'oldur' → false positive for doldur, kondur, etc.)
    let pos = text.indexOf("oldur");
    while (pos >= 0) {
      const charBefore = pos > 0 ? text[pos - 1] : "";
      const isLetter = /[a-zçğışöüâîû]/.test(charBefore);
      if (!isLetter) return true; // "oldur" at word start or after space/punct
      pos = text.indexOf("oldur", pos + 1);
    }
    return false;
  }

  const hasOldur = containsKillVerb(normalized);
  const isNarrativeOldur = hasOldur && narrativeSuffixes.some((suffix) =>
    normalized.includes("öldür" + suffix) || normalized.includes("oldur" + suffix)
  );
  // Block only if "öldür" is NOT in a pure narrative past-tense form
  if (hasOldur && !isNarrativeOldur) {
    return true;
  }

  const otherPatterns = [
    "nefret et",
    "saldır",
    "saldir",
    "mezhep düşman",
    "mezhep dusman",
    "soykırım",
    "soykirim",
  ];
  return otherPatterns.some((pattern) => normalized.includes(pattern));
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
