const fs = require("fs");

const orucFile = {
  id: "oruc_nedir",
  title: "Oruç Nedir?",
  category: "worship_practice",
  summary:
    "Oruç, imsaktan iftara kadar yeme, içme ve orucu bozan davranışlardan uzak durarak Allah için tutulan ibadettir. Ramazan orucu farzdır.",
  keywords: [
    "oruc farz mi",
    "oruç farz mı",
    "oruc nedir",
    "oruç nedir",
    "oruc nasil tutulur",
    "oruç nasıl tutulur",
    "ramazan orucu",
  ],
  farzlar: [
    "Ramazan orucunu tutmak farzdır.",
    "İmsaktan iftara kadar yeme, içme ve orucu bozan davranışlardan uzak durmak gerekir.",
    "Niyet etmek gerekir.",
  ],
  vacipler: [],
  sunnetler: [
    "Sahur yapmak.",
    "İftarı geciktirmemek.",
    "İftarı hurma veya su ile açmak.",
    "Orucu güzel söz ve davranışla korumak.",
  ],
  step_by_step: [
    "Oruç için niyet edilir.",
    "Sahur yapılır ve imsaktan önce hazırlık tamamlanır.",
    "İmsak vaktinden iftara kadar yeme, içme ve orucu bozan davranışlardan uzak durulur.",
    "Gün boyunca oruç korunur.",
    "Akşam ezanı ile iftar edilir.",
    "İftar yapılırken dua edilir.",
  ],
  attention_points: [
    "Ramazan orucu farzdır.",
    "İmsak vaktine dikkat edilmelidir.",
    "Oruç, sadece yemeyi içmeyi bırakmak değil, orucu bozan davranışlardan da uzak durmaktır.",
    "Sahur terk edilse bile oruç geçerliliğini koruyabilir; fakat sahur tavsiye edilir.",
  ],
  common_mistakes: [
    "İmsak girmeden yemek yemeyi sürdürmek.",
    "İftar vaktini beklemeden orucu bozmak.",
    "Niyeti unutmak.",
    "Oruçta ölçüsüz davranışlarla ibadeti zayıflatmak.",
  ],
  related_questions: [
    "Oruç farz mı?",
    "Oruç nedir?",
    "Oruç nasıl tutulur?",
    "Oruç kimlere farzdır?",
    "Sahur şart mı?",
  ],
  source_notes: [
    "Diyanet İşleri Başkanlığı ve Türkiye’de yaygın Hanefî ilmihal öğretimi esas alınmıştır.",
    "TDV İslâm Ansiklopedisi çizgisinde, pratik ve doğrudan anlatım hazırlanmıştır.",
  ],
};

fs.writeFileSync("server/data/ilmihal/oruc_nedir.json", JSON.stringify(orucFile, null, 2) + "\n", "utf8");
console.log("wrote server/data/ilmihal/oruc_nedir.json");
