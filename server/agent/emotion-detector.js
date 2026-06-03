"use strict";

/**
 * emotion-detector.js
 * Kullanıcı girdisinden duygu(lar) tespit eder.
 * Türkçe keyword matching — NLP kütüphanesi gerekmez.
 */

// ── 15 duygu kategorisi ve Türkçe anahtar kelimeleri ────────────────────────
const EMOTION_KEYWORDS = {
  sadness: [
    "üzgün", "üzgünüm", "üzüldüm", "keder", "kederli",
    "mutsuz", "mutsuzum", "dert", "derdim", "hüzün", "hüzünlü",
    "mahzun", "acı", "elem", "ağlıyorum", "ağladım", "yasa büründüm",
    "kalp kırık", "içim sıkışıyor",
  ],
  anxiety: [
    "kaygı", "kaygılı", "kaygılanıyorum", "endişe", "endişeli",
    "endişeleniyorum", "tedirgin", "huzursuz", "huzur yok",
    "gergin", "stres", "stresli", "stres altında", "panik",
    "panikledim", "içim daralıyor",
  ],
  anger: [
    "öfke", "öfkeli", "öfkelendim", "sinir", "sinirli",
    "sinirleniyorum", "kızgın", "kızdım", "gaddar", "kin",
    "nefret", "hiddet", "sabırsız", "tahammül edemiyorum",
  ],
  guilt: [
    "pişman", "pişmanım", "suçlu", "suçluyum", "hata", "hata yaptım",
    "özür", "özür dilerim", "affet", "günahım", "günah işledim",
    "vicdan", "vicdan azabı", "kötü hissediyorum", "kendimi affetmek",
  ],
  loneliness: [
    "yalnız", "yalnızım", "yalnız hissediyorum", "tek", "tek başıma",
    "terk", "terk edildim", "kimsem yok", "kimse yok", "ıssız",
    "ıssız hissediyorum", "destek yok",
  ],
  longing: [
    "özlem", "özledim", "hasret", "hasretim", "hasrette",
    "özlüyorum", "ayrılık", "uzak", "kayıp",
  ],
  hope: [
    "umut", "umutluyum", "ümit", "inşallah", "diliyorum",
    "bekliyorum", "umut ediyorum", "iyileşmek istiyorum",
    "çıkış yolu", "ışık görüyorum",
  ],
  patience: [
    "sabır", "sabrediyorum", "sabırlı", "sabredemiyorum",
    "çok zor", "dayanamazsam", "katlanmak", "tahammül",
    "beklemek zorunda", "sabır istiyorum",
  ],
  forgiveness: [
    "affet", "bağışla", "bağışlanmak", "affedilmek", "özür",
    "günahım affedilsin", "Allah affetsin", "tövbe",
  ],
  gratitude: [
    "şükür", "şükrediyorum", "teşekkür", "minnettarım",
    "nimeti", "nimetler", "Allah'a şükür", "elhamdülillah",
  ],
  fear: [
    "korkuyorum", "korku", "korktu", "çekiniyorum", "fena",
    "büyü", "cin", "nazar", "vesvese", "gece korkusu",
    "ölüm korkusu", "korkunç rüya",
  ],
  justice: [
    "haksızlık", "adalet", "zulüm", "zalim", "hak",
    "hakkımı aldılar", "kul hakkı", "hakkaniyetsizlik",
  ],
  guidance: [
    "yol göster", "hidayet", "rehber", "doğru yol", "ne yapmalıyım",
    "nasıl yapmalıyım", "bilmiyorum", "kararsız kaldım",
    "karar veremiyorum",
  ],
  peace: [
    "huzur", "huzur istiyorum", "rahat", "dingin", "ferah",
    "iç huzuru", "sükunet", "kalp huzuru", "manevi huzur",
  ],
  confidence: [
    "güven", "güvenmiyorum", "kararlı", "sağlam", "imanımı güçlendir",
    "kendime güven", "Allah'a güven",
  ],
  repentance: [
    "tövbe", "tövbe etmek", "istiğfar", "günah", "pişmanlık",
    "dönmek istiyorum", "yeniden başlamak", "Allah'a dönmek",
  ],
};

/**
 * Kullanıcı girdisinden duygu(ları) tespit eder.
 * @param {string} userInput
 * @returns {string[]} Tespit edilen duygu listesi. Hiç bulunamazsa ["general"].
 */
function detectEmotions(userInput) {
  if (!userInput || typeof userInput !== "string") return ["general"];

  const normalized = userInput
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, " ")
    .trim();

  const detected = new Set();

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        detected.add(emotion);
        break; // Bu duygu için ilk eşleşme yeterli
      }
    }
  }

  return detected.size > 0 ? Array.from(detected) : ["general"];
}

module.exports = { detectEmotions, EMOTION_KEYWORDS };
