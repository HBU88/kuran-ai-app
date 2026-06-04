// 100 soruluk büyük ayet modülü testi — tüm duygular ve konular.
// Çalıştır: node server/tests/ayet_100_buyuk_test.mjs
// Her soru için: beklenen konu + kabul edilen ayet referansları (küme üyeleri).
// PASS = dönen ayet kabul listesinde VEYA tag'leri beklenen konuyla örtüşüyor.

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { buildChatResponse } = require("../agent/index.js");

// Beklenen konu → kabul edilen "surah:ayah" referansları (CURATED_TOPIC_CLUSTERS'tan).
const CLUSTERS = {
  yalnızlık: ["2:186", "50:16", "57:4", "13:28", "93:3", "40:60"],
  korku: ["3:173", "9:51", "13:28", "65:3"],
  kaygı: ["13:28", "2:286", "65:3"],
  tövbe: ["39:53", "2:37", "25:70", "66:8"],
  umut: ["94:5", "94:6", "15:49", "39:53", "65:3", "13:28", "93:5", "3:139", "12:87"],
  sabır: ["2:153", "2:250", "3:200", "103:3", "2:155", "11:115", "16:127", "42:43", "2:156"],
  şifa: ["26:80", "17:82", "10:57", "41:44"],
  rızık: ["11:6", "65:2", "65:3", "51:58"],
  öfke: ["3:134", "42:40"],
  hüzün: ["12:86", "94:5"],
  sevinç: ["10:58", "16:97"],
  haset: ["113:5"],
  kibir: ["31:18"],
  "ölüm korkusu": ["3:185", "39:30", "62:8", "21:35"],
  imtihan: ["2:155", "2:286", "3:200", "103:3"],
  adalet: ["4:135", "5:8", "16:90", "42:41"],
  "nefs mücadelesi": ["91:9", "13:11", "2:286"],
  zikir: ["13:28", "2:152"],
  aile: ["25:74", "14:40", "46:15", "30:21"],
  evlilik: ["30:21", "4:19", "2:187"],
  "kul hakki": ["83:1", "2:188", "4:29", "11:85"],
  helal: ["2:168", "2:173", "5:87"],
  haramlar: ["17:32", "7:33"],
  iyilikler: ["2:261", "3:134", "49:13"],
  gıybet: ["49:12"],
  infak: ["2:261", "2:195"],
  emanet: ["4:58"],
  doğruluk: ["33:70", "4:135"],
  ahiret: ["3:185", "99:8", "74:38", "2:201"],
  ölüm: ["3:185", "3:102", "74:38"],
  şükür: ["14:7", "16:18", "10:58", "57:23"],
  iman: ["49:15", "2:285", "3:102", "13:28"],
  mucizeler: ["21:30", "3:190", "17:88"],
  yaratılış: ["21:30", "3:190", "95:4"],
  hz_muhammed: ["47:7", "33:21", "68:4", "21:107", "48:29"],
  "hz. musa": ["20:20", "26:63"],
  "hz. ibrahim": ["21:69"],
  "hz. isa": ["3:49", "19:30"],
  "hz. süleyman": ["21:81"],
  "hz. davud": ["34:10"],
  "hz. meryem": ["3:37"],
  tevekkül: ["65:3", "9:51", "3:173", "13:28"],
  çaresizlik: ["94:5", "94:6", "12:87", "39:53"],
};

// Konu eş-anlamlıları (tag eşleştirmesi için).
const TOPIC_TAGS = {
  yalnızlık: ["yalnızlık"],
  korku: ["korku"],
  kaygı: ["kaygı"],
  tövbe: ["tövbe", "bağışlanma", "günahlar"],
  umut: ["umut", "rahmet"],
  sabır: ["sabır", "sebat"],
  şifa: ["şifa", "hastalık"],
  rızık: ["rızık"],
  öfke: ["öfke", "affetmek"],
  hüzün: ["hüzün"],
  sevinç: ["sevinç"],
  haset: ["haset"],
  kibir: ["kibir"],
  "ölüm korkusu": ["ölüm"],
  imtihan: ["sabır", "tevekkül"],
  adalet: ["adalet", "haksızlık"],
  "nefs mücadelesi": ["nefs mücadelesi", "irade"],
  zikir: ["zikir", "Allah'ı anma"],
  aile: ["aile", "çocuk", "nesil"],
  evlilik: ["evlilik", "aile"],
  "kul hakki": ["kul hakkı"],
  helal: ["helal", "haramlar"],
  haramlar: ["haramlar"],
  iyilikler: ["iyilikler", "iyilik"],
  gıybet: ["gıybet"],
  infak: ["infak"],
  emanet: ["emanet"],
  doğruluk: ["doğruluk"],
  ahiret: ["ahiret"],
  ölüm: ["ölüm", "ahiret"],
  şükür: ["şükür"],
  iman: ["iman"],
  mucizeler: ["mucizeler"],
  yaratılış: ["yaratılış"],
  hz_muhammed: ["peygamberler"],
  tevekkül: ["tevekkül"],
  çaresizlik: ["umut"],
};

const QUESTIONS = [
  // ── Yalnızlık ──
  ["çok yalnızım", "yalnızlık"],
  ["kimsem yok", "yalnızlık"],
  ["yalnız hissediyorum", "yalnızlık"],
  ["Allah benden uzak mı", "yalnızlık"],
  // ── Korku ──
  ["korkuyorum", "korku"],
  ["çok korkuyorum", "korku"],
  ["korku ve endişe için ayet", "korku"],
  // ── Kaygı ──
  ["kaygılıyım", "kaygı"],
  ["gelecek kaygısı yaşıyorum", "kaygı"],
  ["içim daralıyor", "kaygı"],
  ["endişeliyim", "kaygı"],
  // ── Tövbe ──
  ["tövbe etmek istiyorum", "tövbe"],
  ["günah işledim pişmanım", "tövbe"],
  ["Allah günahları affeder mi", "tövbe"],
  // ── Umut ──
  ["umut veren bir ayet", "umut"],
  ["motivasyona ihtiyacım var", "umut"],
  ["bana moral ver", "umut"],
  // ── Çaresizlik / umutsuzluk ──
  ["umutsuzluğa düştüm", "çaresizlik"],
  ["çaresizim ne yapacağımı bilmiyorum", "çaresizlik"],
  // ── Sabır ──
  ["sabır ile ilgili ayet", "sabır"],
  ["sabredemiyorum", "sabır"],
  ["zor zamanlardan geçiyorum", "sabır"],
  // ── Şifa ──
  ["hastayım şifa istiyorum", "şifa"],
  ["şifa ayeti", "şifa"],
  ["iyileşmek istiyorum", "şifa"],
  // ── Rızık ──
  ["rızık sıkıntısı çekiyorum", "rızık"],
  ["işimi kaybettim", "rızık"],
  ["maddi sıkıntıdayım", "rızık"],
  ["çok borcum var", "rızık"],
  // ── Öfke ──
  ["çok öfkeliyim", "öfke"],
  ["çok kızgınım", "öfke"],
  // ── Hüzün ──
  ["çok üzgünüm", "hüzün"],
  ["kederliyim", "hüzün"],
  ["ağlıyorum çok mahzunum", "hüzün"],
  // ── Sevinç ──
  ["çok mutluyum", "sevinç"],
  ["sevinçliyim şükür dolu hissediyorum", "sevinç"],
  // ── Haset ──
  ["kıskançlık hissediyorum", "haset"],
  ["haset ediyorum", "haset"],
  // ── Kibir ──
  ["kibir hakkında ayet", "kibir"],
  ["kendini beğenmiş insanlar", "kibir"],
  // ── Ölüm korkusu ──
  ["ölmekten korkuyorum", "ölüm korkusu"],
  ["ölüm korkusu için ayet", "ölüm korkusu"],
  // ── İmtihan ──
  ["imtihandan geçiyorum", "imtihan"],
  ["başıma musibet geldi", "imtihan"],
  // ── Adalet ──
  ["adalet hakkında ayet", "adalet"],
  ["haksızlığa uğradım", "adalet"],
  ["zulüm görüyorum", "adalet"],
  ["arkadaşım bana ihanet etti", "adalet"],
  // ── Nefs mücadelesi ──
  ["nefsimle mücadele ediyorum", "nefs mücadelesi"],
  ["nefsimi arındırmak istiyorum", "nefs mücadelesi"],
  ["kendimi değiştirmek istiyorum", "nefs mücadelesi"],
  // ── Zikir ──
  ["zikir hakkında ayet", "zikir"],
  ["Allah'ı anmak", "zikir"],
  ["tesbih çekmenin önemi", "zikir"],
  // ── Aile ──
  ["çocuklarım için dua", "aile"],
  ["ailem için bir ayet", "aile"],
  ["evladım için dua", "aile"],
  // ── Evlilik ──
  ["evlilik hakkında ayet", "evlilik"],
  ["eşime nasıl davranmalıyım", "evlilik"],
  // ── Kul hakkı ──
  ["kul hakkı nedir", "kul hakki"],
  ["başkasının hakkını yemek", "kul hakki"],
  // ── Helal ──
  ["helal kazanç hakkında ayet", "helal"],
  ["helal ve haram", "helal"],
  // ── Haramlar ──
  ["haramdan kaçınmak", "haramlar"],
  ["zinaya yaklaşmamak", "haramlar"],
  // ── İyilikler ──
  ["iyilik yapmak", "iyilikler"],
  ["hayır işlemenin sevabı", "iyilikler"],
  // ── Gıybet ──
  ["gıybet etmek günah mı", "gıybet"],
  ["dedikodu yapmak", "gıybet"],
  // ── İnfak ──
  ["sadaka vermek", "infak"],
  ["infak hakkında ayet", "infak"],
  // ── Emanet ──
  ["emanet hakkında ayet", "emanet"],
  // ── Doğruluk ──
  ["dürüstlük hakkında ayet", "doğruluk"],
  ["doğru sözlü olmak", "doğruluk"],
  // ── Ahiret ──
  ["ahiret hakkında ayet", "ahiret"],
  ["kıyamet günü", "ahiret"],
  // ── Ölüm ──
  ["ölüm hakkında ayet", "ölüm"],
  ["öldükten sonra ne olacak", "ölüm"],
  // ── Şükür ──
  ["şükür hakkında ayet", "şükür"],
  ["nimetlere şükretmek", "şükür"],
  // ── İman ──
  ["iman hakkında ayet", "iman"],
  ["imanımı güçlendirmek istiyorum", "iman"],
  // ── Mucizeler ──
  ["mucizeler hakkında ayet", "mucizeler"],
  // ── Yaratılış ──
  ["yaratılış hakkında ayet", "yaratılış"],
  ["kainatı düşünmek tefekkür", "yaratılış"],
  // ── Tevekkül ──
  ["Allah'a tevekkül etmek", "tevekkül"],
  ["Allah'a güvenmek", "tevekkül"],
  // ── Peygamberler ──
  ["Muhammed", "hz_muhammed"],
  ["peygamberimiz hakkında ayet", "hz_muhammed"],
  ["Hz. Musa kimdir", "hz. musa"],
  ["Musa peygamber", "hz. musa"],
  ["Hz. İbrahim", "hz. ibrahim"],
  ["Hz. İsa", "hz. isa"],
  ["Hz. Süleyman", "hz. süleyman"],
  ["Hz. Davud", "hz. davud"],
  ["Hz. Meryem", "hz. meryem"],
  // ── Ek varyasyonlar ──
  ["geçinemiyorum param yetmiyor", "rızık"],
  ["aile huzuru için dua", "aile"],
  ["sabretmeyi öğrenmek istiyorum", "sabır"],
  ["günahkarım umudum kaldı mı", "tövbe"],
];

function normTr(s) {
  return String(s || "").toLocaleLowerCase("tr");
}

async function run() {
  const results = [];
  for (const [q, expected] of QUESTIONS) {
    let row;
    try {
      const r = await buildChatResponse(q, [], { module: "ayah" });
      const a = r.selected_ayah;
      if (!a) {
        row = { q, expected, ref: "—", surah: "(ayet yok)", verdict: "FAIL", reason: "ayet dönmedi" };
      } else {
        const ref = `${a.surahNumber}:${a.ayahNumber}`;
        const accepted = CLUSTERS[expected] || [];
        const inCluster = accepted.includes(ref);
        const tags = (a.tags || []).map(normTr);
        const wantTags = (TOPIC_TAGS[expected] || [expected]).map(normTr);
        const tagHit = wantTags.some((t) => tags.includes(t));
        const verdict = inCluster || tagHit ? "PASS" : "FAIL";
        const reason = inCluster ? "küme üyesi" : tagHit ? "tag örtüşmesi" : "konu dışı";
        row = { q, expected, ref, surah: a.surah, verdict, reason };
      }
    } catch (e) {
      row = { q, expected, ref: "—", surah: "(hata)", verdict: "FAIL", reason: e.message };
    }
    results.push(row);
  }

  const pass = results.filter((r) => r.verdict === "PASS");
  const fail = results.filter((r) => r.verdict === "FAIL");

  console.log("\n================ 100 SORULUK BÜYÜK TEST ================\n");
  for (const r of results) {
    const mark = r.verdict === "PASS" ? "✅" : "❌";
    console.log(
      `${mark} [${r.expected}] soru: "${r.q}" → ${r.surah} ${r.ref} (${r.reason})`
    );
  }
  console.log("\n================ ÖZET ================");
  console.log(`Toplam: ${results.length}`);
  console.log(`PASS:   ${pass.length}`);
  console.log(`FAIL:   ${fail.length}`);
  console.log(`Başarı: %${Math.round((pass.length / results.length) * 100)}`);
  if (fail.length) {
    console.log("\n--- GEÇMEYEN TESTLER ---");
    for (const r of fail) {
      console.log(`❌ "${r.q}" (beklenen: ${r.expected}) → ${r.surah} ${r.ref} [${r.reason}]`);
    }
  }
}

run();
