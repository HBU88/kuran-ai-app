/**
 * HAKAI Topic Guard
 *
 * Desteklenen konu alanları dışındaki soruları kibarca reddeder.
 * Yanlış cevap vermektense cevap vermemek tercih edilir.
 *
 * Desteklenen alanlar:
 *  - Namaz, abdest, oruç, hac, zekat (ibadet)
 *  - Akide, iman, tevhid, Kur'an, peygamberler
 *  - Helal/haram, dua, zikir, ahlak
 *  - Siyer, sahabe, İslam tarihi (temel)
 */

// ---------- Desteklenen konu sinyalleri ----------
const SUPPORTED_SIGNALS = [
  // İbadet
  "namaz", "namazın", "namazda", "rüku", "secde", "kıyam", "kıraat",
  "sabah namazı", "öğle namazı", "ikindi", "akşam namazı", "yatsı",
  "cuma", "bayram namazı", "cenaze namazı", "teravih", "vitir", "kuşluk",
  "abdest", "gusül", "teyemmüm", "mesh", "taharet", "necaset", "hadesten",
  "oruç", "ramazan", "sahur", "iftar", "fidye", "kaza orucu", "oruc",
  "zekat", "zekât", "nisap", "hac", "umre", "ihram", "tavaf", "sa'y", "arafat",
  "kurban", "adak",
  // Akide & Temel
  "iman", "imanın", "islamin", "kelime-i şehadet", "kelime-i tevhid",
  "tevhid", "akide", "kader", "kaza", "ahiret", "cennet", "cehennem",
  "melek", "melekler", "cin", "şeytan", "büyü", "nazar",
  "kur'an", "kuran", "ayet", "sure", "kıraat",
  "peygamber", "nebi", "resul", "sünnet", "hadis",
  "hz", "hazret",
  // Peygamberler / Siyer
  "muhammed", "ibrahim", "musa", "isa", "yusuf", "davud", "süleyman",
  "yunus", "nuh", "adem", "idris", "ilyas", "elyesa", "zülkifl",
  "dört halife", "ebu bekir", "ömer", "osman", "ali",
  "sahabeler", "sahabe", "siyer", "hicret",
  // Fıkıh & Ahlak
  "haram", "helal", "mekruh", "müstehap", "vacip", "farz",
  "günah", "sevap", "caiz", "fetva",
  "alkol", "faiz", "kumar", "domuz", "riba", "zina", "gasp",
  "nikah", "boşanma", "mehir", "talak", "iddet", "miras",
  // Dua & Zikir
  "dua", "zikir", "tesbih", "istiğfar", "tövbe", "tevbe",
  "kelimei tehlil", "salavat", "besmele", "fatiha",
  // Diğer İslami
  "cami", "kıble", "ezan", "imsak", "mümin", "müslüman",
  "islamda", "islami", "dini",
];

// ---------- Açıkça kapsam dışı kalıplar ----------
const OUT_OF_SCOPE_PATTERNS = [
  // Hava & Doğa
  /\bhava durumu\b/i,
  /\bsicakl[iı]k\b.*\bka[cç]\b/i,
  /\byağ[mı]ur\b.*\byağacak m[ıi]\b/i,
  // Finans / Yatırım
  /\bborsa\b/i,
  /\bhisse senedi\b/i,
  /\bkript[oa]\b/i,
  /\bbitcoin\b/i,
  /\bethereum\b/i,
  /\byat[iı]r[iı]m.*tavsiye\b/i,
  /\bportf[oö]y\b/i,
  // Siyaset
  /\bsiya(si|set)\b/i,
  /\bpolitika\b/i,
  /\bse[cç]im\b.*\bhan(gi|isi)\b/i,
  /\bparti.*han(gi|isi)\b/i,
  /\bhan(gi|isi).*parti.*oy\b/i,
  /\bcumhurba[şs][ıi]kan[ıi]\b.*\bseçmeliyim\b/i,
  // Teknoloji / Programlama
  /\bpython\b/i,
  /\bjavascript\b/i,
  /\byaz[iı]l[iı]m.*([oö]ğren|geliş)\b/i,
  /\bprogramlama\b/i,
  /\bkod yaz\b/i,
  /\bweb sitesi\b.*\byap\b/i,
  // Spor Tahmini
  /\bma[cç].*sonuc\b/i,
  /\bfutbol.*skor\b/i,
  /\bspor.*tahmin\b/i,
  // Eğlence Tavsiyeleri
  /\bfilm.*[oö]ner\b/i,
  /\bdizi.*[oö]ner\b/i,
  /\bm[uü]zik.*[oö]ner\b/i,
  // Yemek tarifi (genel)
  /\byemek.*tarif[i]\b/i,
  /\btarif.*p[iı][şs]ir\b/i,
  // Tıbbi Danışmanlık (genel)
  /\bdoktor yerine\b/i,
  /\bila[cç].*dozaj[iı]\b/i,
  /\bbana.*te[şs]his\b/i,
];

/**
 * Mesajın desteklenen konu alanında olup olmadığını kontrol eder.
 * @returns {{ supported: boolean, reason: string }}
 */
function checkTopicSupport(message) {
  if (!message || typeof message !== "string") {
    return { supported: false, reason: "empty_message" };
  }

  const raw = message.trim();
  const lower = raw.toLocaleLowerCase("tr-TR");

  // 1) Açıkça kapsam dışı kalıpları kontrol et
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(raw) || pattern.test(lower)) {
      return { supported: false, reason: "out_of_scope_pattern" };
    }
  }

  // 2) Desteklenen sinyal varsa geçir
  for (const signal of SUPPORTED_SIGNALS) {
    if (lower.includes(signal)) {
      return { supported: true, reason: "supported_signal_match" };
    }
  }

  // 3) Çok kısa veya belirsiz sorgular → geçir (pipeline kendi karar versin)
  const tokenCount = raw.split(/\s+/).filter(Boolean).length;
  if (tokenCount <= 2) {
    return { supported: true, reason: "short_query_passthrough" };
  }

  // 4) Soru işareti veya "nedir/nelerdir/nasıl/kim" içeriyorsa muhtemelen dini soru
  const questionSignals = ["nedir", "nelerdir", "nasıl", "nasil", "kim", "ne zaman",
    "kaç", "kac", "hangi", "niçin", "neden", "neden", "mi?", "mı?", "mu?", "mü?"];
  if (questionSignals.some((s) => lower.includes(s))) {
    return { supported: true, reason: "question_passthrough" };
  }

  // 5) Belirsizse geçir — yanlış reddetmek, yanlış cevaptan daha kötü değil
  return { supported: true, reason: "default_passthrough" };
}

/**
 * Kapsam dışı soru için döndürülecek mesaj.
 */
function getTopicRejectionResponse() {
  return {
    ok: true,
    assistant_text:
      "Bu konuda yardımcı olamıyorum. HAKAI yalnızca namaz, abdest, oruç, " +
      "hac, zekat, akide, Kur'an ve temel dini pratikler gibi İslami konularda " +
      "bilgi sunar. Başka bir dini konuda soru sormak istersen buradayım.",
    decision_meta: {
      route_mode: "topic_rejected",
      module: "topic_guard",
    },
  };
}

module.exports = { checkTopicSupport, getTopicRejectionResponse };
