import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..", "..");
const PROJECT_ROOT = path.resolve(SERVER_ROOT, "..");
const DATA_DIR = path.join(SERVER_ROOT, "data", "ilmihal");
const INDEX_PATH = path.join(PROJECT_ROOT, "assets", "data", "knowledge", "ilmihal_knowledge_base.json");
const BACKUP_DIR = path.join(SERVER_ROOT, "data", "ilmihal_backup_before_encoding_rewrite");

const SHARED = {
  healthCaution: "Sağlık açısından şüpheli bir durum varsa doktora danışılmalıdır.",
  legalCaution:
    "Bu konu kişisel ve hukuki sonuçlar doğurabileceği için özel durumlarda güvenilir bir din görevlisi ve ilgili hukuk uzmanından destek alınmalıdır.",
  religiousEdgeCaution: "Özel durumlarda güvenilir bir din görevlisine danışılabilir.",
};

function tidy(text) {
  return String(text || "").trim();
}

function normalizeForKey(value) {
  return tidy(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC");
}

function fileBase(fileName) {
  return fileName.replace(/\.json$/i, "");
}

function titleize(text) {
  return tidy(text)
    .replace(/_/g, " ")
    .replace(/\b\p{L}/gu, (match) => match.toLocaleUpperCase("tr-TR"));
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const normalized = normalizeForKey(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(tidy(value));
  }
  return out;
}

function pathFor(fileName) {
  return path.join("server", "data", "ilmihal", fileName).split(path.sep).join("\\");
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeEntry(spec) {
  const base = clone(BASES[spec.base] || {});
  const source = {
    id: spec.id,
    title: spec.title,
    category: spec.category,
    summary: spec.summary,
    keywords: unique(spec.keywords || []),
    step_by_step: unique(base.step_by_step || []),
    farzlar: unique(base.farzlar || []),
    vacipler: unique(base.vacipler || []),
    sunnetler: unique(base.sunnetler || []),
    attention_points: unique(base.attention_points || []),
    common_mistakes: unique(base.common_mistakes || []),
    related_questions: unique(base.related_questions || []),
    source_notes: unique(base.source_notes || [spec.sourceNote || "Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."]),
  };

  const titleAlias = tidy(spec.title);
  const idAlias = fileBase(spec.file).replace(/_/g, " ");
  const aliases = unique([
    titleAlias,
    titleAlias.replace(/\?$/, ""),
    idAlias,
    ...(spec.aliases || []),
    ...(spec.keywords || []),
    ...(base.related_questions || []),
  ]);

  const triggers = unique([
    titleAlias,
    source.summary,
    ...(spec.triggers || []),
    ...(spec.keywords || []),
    ...(base.related_questions || []),
    ...(base.step_by_step || []).slice(0, 3),
    ...(base.attention_points || []).slice(0, 2),
  ]);

  return {
    file: spec.file,
    source,
    index: {
      id: spec.id,
      type: spec.category,
      topic: spec.topic || spec.id,
      aliases,
      triggers,
      keywords: unique(spec.keywords || []),
      answer_tr: tidy(spec.summary),
      source_note: spec.sourceNote || "Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet.",
      requires_ayah: false,
      response_file: pathFor(spec.file),
    },
  };
}

const BASES = {
  abdest: {
    step_by_step: [
      "Niyet edilir ve besmele çekilir.",
      "Eller bileklere kadar üç defa yıkanır.",
      "Ağza üç defa su verilir ve çalkalanır.",
      "Buruna üç defa su verilir ve temizlenir.",
      "Yüz üç defa yıkanır.",
      "Kollar dirseklerle birlikte üç defa yıkanır.",
      "Başın dörtte biri mesh edilir.",
      "Kulaklar ve boyun mesh edilir.",
      "Ayaklar topuklarla birlikte üç defa yıkanır.",
    ],
    farzlar: [
      "Yüzü bir defa yıkamak.",
      "Kolları dirseklerle birlikte bir defa yıkamak.",
      "Başın dörtte birini mesh etmek.",
      "Ayakları topuklarla birlikte bir defa yıkamak.",
    ],
    sunnetler: [
      "Besmele çekmek.",
      "Azaları sağdan başlamak üzere yıkamak.",
      "Ağıza ve buruna su vermek.",
    ],
    attention_points: [
      "Oruçluyken ağıza ve buruna su verirken dikkatli olmak gerekir.",
      "Meshte suyu saçlı bölgeye ulaştırmak yeterlidir.",
      "Abdestte sırayı korumak faydalıdır.",
    ],
    common_mistakes: [
      "Farzları eksik yapmak.",
      "Ağız ve burun temizliğini ihmal etmek.",
      "Yıkama sayısını karıştırmak.",
    ],
    related_questions: [
      "Abdestin farzları nelerdir?",
      "Abdesti bozan şeyler nelerdir?",
      "Oruçluyken abdest alınır mı?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  gusul: {
    step_by_step: [
      "Niyet edilir ve besmele çekilir.",
      "Eller yıkanır, edep yerleri temizlenir.",
      "Bedende necaset varsa giderilir.",
      "Namaz abdesti gibi abdest alınır.",
      "Ağza üç defa su verilir.",
      "Buruna üç defa su verilir.",
      "Başa üç defa su dökülür.",
      "Sağ omuzdan başlanarak tüm beden kuru yer kalmayacak şekilde yıkanır.",
      "Sol omuz ve diğer taraflar da eksiksiz yıkanır.",
    ],
    farzlar: [
      "Ağza su vermek.",
      "Buruna su vermek.",
      "Bütün bedeni kuru yer kalmayacak şekilde yıkamak.",
    ],
    sunnetler: [
      "Besmele çekmek.",
      "Önce elleri ve edep yerini temizlemek.",
      "Namaz abdesti almak.",
    ],
    attention_points: [
      "Saç dipleri, kulak arkası, göbek deliği ve kat yerleri kuru kalmamalıdır.",
      "Oruçluyken ağza ve buruna su verirken dikkatli olunmalıdır.",
    ],
    common_mistakes: [
      "Bedende kuru yer bırakmak.",
      "Ağız ve buruna suyu ihmal etmek.",
      "Temizlik sırasını karıştırmak.",
    ],
    related_questions: [
      "Gusül abdesti nasıl alınır?",
      "Boy abdesti nasıl alınır?",
      "Guslün farzları nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  namazHowTo: {
    step_by_step: [
      "Abdest alınır ve kıbleye dönülür.",
      "Niyet edilir ve iftitah tekbiri alınır.",
      "Sübhaneke okunur, Eûzü besmele çekilir.",
      "Fatiha ve zammı sure okunur.",
      "Rükûda Sübhâne rabbiyel azîm denir.",
      "Secdede Sübhâne rabbiyel a'lâ denir.",
      "İki secde yapılır ve ikinci rekâta kalkılır.",
      "Son oturuşta Tahiyyat, Salli-Barik ve Rabbena duaları okunur.",
      "Sağa ve sola selam verilir.",
    ],
    attention_points: [
      "Namazın özünde huşu, düzen ve devamlılık vardır.",
      "Rekât sayısı namaza göre değişebilir.",
    ],
    common_mistakes: [
      "Kıraat sırasını karıştırmak.",
      "Rükû ve secdede tesbihleri unutmak.",
      "Son oturuşu eksik bırakmak.",
    ],
    related_questions: [
      "Namaz nasıl kılınır?",
      "Namaza nasıl başlanır?",
      "Rekât nasıl kılınır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  namazFarz: {
    farzlar: [
      "Hadesten taharet.",
      "Necasetten taharet.",
      "Setr-i avret.",
      "İstikbal-i kıble.",
      "Vakit.",
      "Niyet.",
      "İftitah tekbiri.",
      "Kıyam.",
      "Kıraat.",
      "Rükû.",
      "Secde.",
      "Ka'de-i âhire.",
    ],
    attention_points: [
      "Dış şartlar namazdan önce, iç farzlar namazın içinde tamamlanır.",
      "Niyet ve vakit namazın temel düzenini belirler.",
    ],
    common_mistakes: [
      "Dış farzları hafife almak.",
      "Kıyam veya kıraati eksik yapmak.",
      "Son oturuşu unutmak.",
    ],
    related_questions: [
      "Namazın farzları nelerdir?",
      "Namazın dış farzları nelerdir?",
      "Namazın iç farzları nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  namazVacip: {
    vacipler: [
      "Fatiha okumak.",
      "Fatiha'dan sonra zammı sure okumak.",
      "Farz namazların ilk iki rekâtında kıraat yapmak.",
      "Secdede alın ve burnu yere koymak.",
      "Tadil-i erkâna dikkat etmek.",
      "İlk oturuş.",
      "Son oturuşta Tahiyyat okumak.",
      "Namaz sonunda selam vermek.",
      "Vitir namazında kunut tekbiri ve kunut duası.",
    ],
    attention_points: [
      "Vacipler namazın düzenini güçlendirir ve ihmal edilmemelidir.",
    ],
    common_mistakes: [
      "Fatiha'yı atlamak.",
      "Tadil-i erkânı aceleye getirmek.",
      "Kunut duasını unutmak.",
    ],
    related_questions: [
      "Namazın vacipleri nelerdir?",
      "Vitir namazının vacipleri nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  namazBozan: {
    common_mistakes: [
      "Namazda konuşmak.",
      "Namazda yemek veya içmek.",
      "Kıble yönünden tamamen dönmek.",
      "Abdesti bozulan kişinin namazı sürdürmesi.",
      "Namazın farzlarından birini terk etmek.",
      "Kahkaha ile gülmek.",
      "Aşırı hareket etmek.",
      "Avret yerinin açılması.",
      "Bilinç kaybı veya bayılma.",
    ],
    attention_points: [
      "Namazda sükûnet ve dikkati korumak gerekir.",
    ],
    related_questions: [
      "Namazı bozan şeyler nelerdir?",
      "Namazda konuşmak namazı bozar mı?",
      "Namazda kahkaha ile gülmek namazı bozar mı?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  sabah: {
    step_by_step: [
      "Sabah namazının önce 2 rekât sünneti kılınır.",
      "Ardından 2 rekât farzı kılınır.",
      "İlk rekâtta Fatiha ve zammı sure okunur.",
      "İkinci rekâtta da aynı düzen sürdürülür.",
      "Son oturuşta Tahiyyat, Salli-Barik ve Rabbena duaları okunur.",
      "Selam verilerek namaz tamamlanır.",
    ],
    farzlar: ["Sabah namazının farzı 2 rekâttır."],
    attention_points: [
      "Sünnet ile farz ayrı niyetle kılınır.",
      "Vakit girdikten sonra kılınması gerekir.",
    ],
    common_mistakes: [
      "Sünneti farzla karıştırmak.",
      "Son oturuşu unutmak.",
    ],
    related_questions: [
      "Sabah namazı nasıl kılınır?",
      "Sabah namazı kaç rekâttır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  oruc: {
    step_by_step: [
      "Oruç için niyet edilir.",
      "Sahur yapılır ve imsak vaktine dikkat edilir.",
      "İmsaktan iftara kadar yeme, içme ve orucu bozan şeylerden uzak durulur.",
      "İftar vaktiyle birlikte oruç açılır.",
    ],
    attention_points: [
      "Ramazan orucu farzdır; diğer oruçlar niyet ve gününe göre değerlendirilir.",
      "Sahur bereketli bir başlangıç sayılır.",
    ],
    common_mistakes: [
      "Niyeti ihmal etmek.",
      "İmsak vaktini kaçırmak.",
      "Oruçla ilgili bozan ve bozmayan hâlleri karıştırmak.",
    ],
    related_questions: [
      "Oruç nedir?",
      "Oruç nasıl tutulur?",
      "Orucu bozan şeyler nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  orucBozan: {
    common_mistakes: [
      "Bilerek yemek ve içmek.",
      "Cinsel ilişki.",
      "İsteyerek kusmak.",
      "Sigara içmek.",
      "Bilerek ilaç almak.",
      "Adet ve lohusalık hâlinde oruç tutmaya devam etmek.",
    ],
    attention_points: [
      "Unutma ile olan durumlar farklı değerlendirilir.",
    ],
    related_questions: [
      "Orucu bozan şeyler nelerdir?",
      "Orucu bozan davranışlar nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  orucBozmayan: {
    common_mistakes: [
      "Unutarak yemek ve içmek orucu bozmaz.",
      "İstemeden kusmak orucu bozmaz.",
      "Diş fırçalamak genel olarak orucu bozmaz; macunsuz tercih edilir.",
      "Kan vermek orucu bozmaz.",
      "Göz damlasında kısa bir ihtilaf notu vardır.",
      "Duş almak orucu bozmaz.",
    ],
    attention_points: [
      "Şüpheli durumlarda ihtiyatlı davranmak iyi olur.",
    ],
    related_questions: [
      "Orucu bozmayan şeyler nelerdir?",
      "Hangi durumlar orucu bozmaz?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  orucFidye: {
    step_by_step: [
      "Oruç tutamama durumu değerlendirilir.",
      "Yaşlılık veya kronik hastalık gibi kalıcı engel olup olmadığına bakılır.",
      "Her gün için bir fakir doyurma esasıyla fidye verilir.",
      "Ramazan sonunda toplam miktar gözden geçirilir.",
    ],
    attention_points: [
      "Fidye, kaza ile karıştırılmamalıdır.",
      "Kalıcı güç yetmeme hâli temel ölçüdür.",
    ],
    common_mistakes: [
      "Geçici hastalıkta fidye ile yetinmek.",
      "Kaza ile fidyeyi birbirine karıştırmak.",
    ],
    related_questions: [
      "Oruç fidyesi nedir?",
      "Kimler fidye verir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  orucKaza: {
    step_by_step: [
      "Kaza gerektiren durum belirlenir.",
      "Hastalık, yolculuk veya adet gibi mazeret değerlendirilir.",
      "Bilerek bozulan oruçlar için de kaza gerektiği unutulmaz.",
      "Uygun zamanda kaza orucu tutulur.",
    ],
    attention_points: [
      "Kaza için uygun zamanı geciktirmemek iyidir.",
    ],
    common_mistakes: [
      "Kaza ve fidyeyi karıştırmak.",
      "Mazereti yanlış değerlendirmek.",
    ],
    related_questions: [
      "Oruç kazası nedir?",
      "Hangi durumlarda oruç kazası gerekir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  zekatNedir: {
    step_by_step: [
      "Malın nisap miktarına ulaşıp ulaşmadığına bakılır.",
      "Bir kamerî yıl geçip geçmediği kontrol edilir.",
      "Zekât verilecek malın türü değerlendirilir.",
      "Zekât niyetiyle uygun kişilere verilir.",
    ],
    attention_points: [
      "Zekât, her yıl düzenli olarak değerlendirilen bir ibadettir.",
      "Malın türüne ve borç durumuna dikkat edilir.",
    ],
    related_questions: [
      "Zekât nedir?",
      "Zekât kimlere verilir?",
      "Zekât nisap nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  zekatRecipients: {
    step_by_step: [
      "Fakir ve miskin olup olmadığına bakılır.",
      "Borçlu, yolda kalmış veya Allah yolunda olanlar değerlendirilir.",
      "İhtiyaç durumu gözetilerek zekât verilir.",
    ],
    attention_points: [
      "Gerçek ihtiyaç sahibi olması önemlidir.",
    ],
    common_mistakes: [
      "Zekâtı ihtiyaç sahibi olmayanlara vermek.",
      "Aile içi bakmakla yükümlü olunan kişileri karıştırmak.",
    ],
    related_questions: [
      "Zekât kimlere verilir?",
      "Zekât kime verilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  zekatNotRecipients: {
    step_by_step: [
      "Anne baba, çocuklar ve eş listelenir.",
      "Bakmakla yükümlü olunan kişiler değerlendirilir.",
      "Zengin kişiler dışarıda tutulur.",
    ],
    attention_points: [
      "Aileye yardım ayrı bir iyilik olabilir; bu her zaman zekât yerine geçmez.",
    ],
    common_mistakes: [
      "Zekâtı anne babaya veya çocuğa vermek.",
      "Zengin kişiye zekât vermek.",
    ],
    related_questions: [
      "Zekât kimlere verilmez?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  zekatNisap: {
    step_by_step: [
      "Nisap miktarı kavramı hatırlanır.",
      "Altın üzerinden yaklaşık örnek hesap yapılır.",
      "Bir yıl şartı ayrıca değerlendirilir.",
    ],
    attention_points: [
      "Nisap hesabında güncel değerler göz önüne alınabilir.",
    ],
    common_mistakes: [
      "Nisabı sadece nakit para sanmak.",
      "Yıl şartını atlamak.",
    ],
    related_questions: [
      "Zekât nisap nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  fitreNedir: {
    step_by_step: [
      "Fitrenin kişi başına verilen vacip sadaka olduğu hatırlanır.",
      "Ramazan sonunda vacip hale geldiği değerlendirilir.",
      "Aile bireyleri için ayrı ayrı hesap yapılır.",
    ],
    attention_points: [
      "Fitre miktarı ve ödeme zamanı topluca gözden geçirilir.",
    ],
    common_mistakes: [
      "Fitreyi sadaka ile tamamen aynı sanmak.",
    ],
    related_questions: [
      "Fitre nedir?",
      "Fitre kime verilir?",
      "Fitre ne zaman verilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  fitreRecipients: {
    step_by_step: [
      "İhtiyaç sahibi ve fakir kişiler değerlendirilir.",
      "Zekât verilebilen kişiler ölçüsünde hareket edilir.",
    ],
    attention_points: [
      "Temel ihtiyaç sahibi olanlara öncelik verilir.",
    ],
    related_questions: [
      "Fitre kime verilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  fitreTime: {
    step_by_step: [
      "Fitre Ramazan içinde verilebilir.",
      "Bayramdan önce verilmesi tercih edilir.",
      "Bayram sabahına kadar verilmesi gerekir.",
    ],
    attention_points: [
      "Zamanında verilmesi önemlidir.",
    ],
    related_questions: [
      "Fitre ne zaman verilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  kurbanNedir: {
    step_by_step: [
      "Kurban, Allah rızası için kesilen ibadettir.",
      "Kurban Bayramı günlerinde yapılır.",
      "Niyet ve usule dikkat edilir.",
    ],
    attention_points: [
      "Kurban ibadetinin özünde ihlas ve paylaşma vardır.",
    ],
    common_mistakes: [
      "Kurbanı sadece et elde etme işi gibi görmek.",
    ],
    related_questions: [
      "Kurban nedir?",
      "Kurban kimlere vaciptir?",
      "Kurban ne zaman kesilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  kurbanVacip: {
    step_by_step: [
      "Müslüman, akıllı ve ergen olmak şartı değerlendirilir.",
      "Nisap miktarı mala sahip olup olmadığına bakılır.",
      "Yolcu olup olmadığı kontrol edilir.",
    ],
    attention_points: [
      "Maddi imkân ve yol durumu birlikte düşünülür.",
    ],
    related_questions: [
      "Kurban kimlere vaciptir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  kurbanTime: {
    step_by_step: [
      "Kurban Bayramı günleri dikkate alınır.",
      "Bayram namazından sonra kesilir.",
      "Vakit genel ve sade bir çerçevede değerlendirilir.",
    ],
    attention_points: [
      "Kurban, bayram günleri içinde yerine getirilir.",
    ],
    related_questions: [
      "Kurban ne zaman kesilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  kurbanShare: {
    step_by_step: [
      "Et aile içinde kullanılabilir.",
      "Akraba, komşu ve ihtiyaç sahipleriyle paylaşılır.",
      "Üçe bölme tavsiyesi pratik bir yöntem olarak uygulanabilir.",
    ],
    attention_points: [
      "Paylaşma ruhu ve ihtiyaç sahipleri gözetilir.",
    ],
    related_questions: [
      "Kurban eti nasıl paylaşılır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  kurbanAttention: {
    step_by_step: [
      "Hayvana eziyet edilmez.",
      "Ehil kişi tarafından kesim yapılır.",
      "Besmele çekilir.",
      "Hijyen ve vekâlet konusu gözetilir.",
    ],
    attention_points: [
      "Vekâletle kurban mümkündür.",
    ],
    common_mistakes: [
      "Ehil olmayan kişiye kestirmek.",
      "Hijyeni ihmal etmek.",
    ],
    related_questions: [
      "Kurban keserken nelere dikkat edilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  hacNedir: {
    step_by_step: [
      "Hac, belirli zamanda yapılan büyük ibadettir.",
      "Kâbe ve kutsal mekânlarla bağlantılıdır.",
      "Niyet, ihram ve menasik birlikte düşünülür.",
    ],
    attention_points: [
      "Hac belli vakit ve mekânlara bağlıdır.",
    ],
    related_questions: [
      "Hac nedir?",
      "Hac kimlere farzdır?",
      "Haccın farzları nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  hacFarz: {
    step_by_step: [
      "İhrama girilir.",
      "Arafat vakfesi yapılır.",
      "Ziyaret tavafı yapılır.",
    ],
    attention_points: [
      "Bu üç temel unsur hac ibadetinin özünü oluşturur.",
    ],
    related_questions: [
      "Haccın farzları nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  umreNedir: {
    step_by_step: [
      "İhrama girilir.",
      "Tavaf yapılır.",
      "Sa'y yapılır.",
      "Tıraş olup ihramdan çıkılır.",
    ],
    attention_points: [
      "Umre yılın çoğu zamanında yapılabilen bir ibadettir.",
    ],
    related_questions: [
      "Umre nedir?",
      "Hac ile umre farkı nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  hacUmreFarki: {
    step_by_step: [
      "Hac belirli zamanda yapılır.",
      "Umre yılın çoğu zamanında yapılabilir.",
      "Hacda Arafat vakfesi vardır.",
      "İki ibadetin hüküm ve vakit çerçevesi farklıdır.",
    ],
    attention_points: [
      "Hac ile umre benzer yönler taşısa da aynı ibadet değildir.",
    ],
    related_questions: [
      "Hac ile umre farkı nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  teyemmumNedir: {
    step_by_step: [
      "Su bulunmadığında veya su kullanılamadığında teyemmüm düşünülür.",
      "Temiz toprak cinsinden bir şeyle niyet edilir.",
      "Yüz mesh edilir.",
      "Kollar mesh edilir.",
    ],
    attention_points: [
      "Teyemmüm suyun yokluğunda kolaylık sağlar.",
    ],
    related_questions: [
      "Teyemmüm nedir?",
      "Teyemmüm nasıl alınır?",
      "Teyemmümü bozan şeyler nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  teyemmumNasil: {
    step_by_step: [
      "Niyet edilir.",
      "Eller temiz toprak cinsinden bir yere vurulur.",
      "Yüz mesh edilir.",
      "Eller tekrar vurularak kollar mesh edilir.",
    ],
    attention_points: [
      "Temiz ve uygun yüzey tercih edilir.",
    ],
    related_questions: [
      "Teyemmüm nasıl alınır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  teyemmumBozan: {
    common_mistakes: [
      "Su bulunduğunda teyemmümle devam etmek.",
      "Teyemmümü gerektiren özür ortadan kalktığında güncellememek.",
    ],
    attention_points: [
      "Özür kalkarsa normal abdest veya gusül gerekir.",
    ],
    related_questions: [
      "Teyemmümü bozan şeyler nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  meshMest: {
    step_by_step: [
      "Mest üzerine mesh, abdestli giyilmiş mestin üst kısmını ıslak elle meshetmektir.",
      "Kolaylık sağlayan bir ruhsattır.",
    ],
    attention_points: [
      "Mesh üst yüzeye yapılır.",
    ],
    related_questions: [
      "Mest üzerine mesh nasıl yapılır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  meshSargi: {
    step_by_step: [
      "Sargı veya bandaj üzerindeki zorunlu alan dikkatle mesh edilir.",
      "Yara ve tedavi durumu gözetilir.",
    ],
    attention_points: [
      "Özre zarar vermeden kolaylık sağlanır.",
    ],
    related_questions: [
      "Sargı üzerine mesh nasıl yapılır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  cumaNedir: {
    step_by_step: [
      "Cuma günü öğle vaktinde cemaatle kılınır.",
      "Hutbe ile birlikte yürütülür.",
      "Haftalık toplu ibadet bilinci taşır.",
    ],
    attention_points: [
      "Cuma namazı cemaat ve hutbe yönüyle öne çıkar.",
    ],
    related_questions: [
      "Cuma namazı nedir?",
      "Cuma namazı kaç rekâttır?",
      "Cuma namazı kimlere farzdır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  cumaKac: {
    step_by_step: [
      "Cuma namazının farzı 2 rekâttır.",
      "Farzdan önce ve sonra sünnetler kılınır.",
    ],
    attention_points: [
      "Sünnetlerle uygulama ayrıntısı yerel pratiğe göre değişebilir.",
    ],
    related_questions: [
      "Cuma namazı kaç rekâttır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  cumaKimlere: {
    step_by_step: [
      "Müslüman, akıllı, ergen ve mukim olup olmadığına bakılır.",
      "Mazeretsiz erkekler için sorumluluk değerlendirilir.",
    ],
    attention_points: [
      "Kadınlar ve yolcular için hüküm ayrı değerlendirilir.",
    ],
    related_questions: [
      "Cuma namazı kimlere farzdır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  bayramNedir: {
    step_by_step: [
      "Ramazan ve Kurban Bayramı sabahı kılınır.",
      "Cemaatle ve iki rekât olarak eda edilir.",
    ],
    attention_points: [
      "Bayram namazı sevincin cemaatle paylaşılmasıdır.",
    ],
    related_questions: [
      "Bayram namazı nedir?",
      "Bayram namazı nasıl kılınır?",
      "Bayram namazı kaç rekâttır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  bayramNasil: {
    step_by_step: [
      "İlk rekâtta iftitah tekbiri ve ilave tekbirler alınır.",
      "Fatiha ve zammı sure okunur.",
      "İkinci rekâtta da ilave tekbirler alınır.",
      "Namaz selamla tamamlanır.",
    ],
    attention_points: [
      "İlave tekbirler bayram namazının ayırt edici yönüdür.",
    ],
    related_questions: [
      "Bayram namazı nasıl kılınır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  bayramKac: {
    step_by_step: [
      "Bayram namazı 2 rekâttır.",
      "İlave tekbirlerle kılınır.",
    ],
    attention_points: [
      "Cemaatle kılınması yaygındır.",
    ],
    related_questions: [
      "Bayram namazı kaç rekâttır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  hayiz: {
    step_by_step: [
      "Hayız, kadının doğal adet hâlidir.",
      "Bu dönemde namaz kılınmaz.",
      "Oruç tutulmaz; tutulamayan oruç daha sonra kaza edilir.",
      "Namazlar ise kaza edilmez.",
    ],
    attention_points: [
      "Hayız bir temizlik veya eksiklik hâli değil, doğal bir süreçtir.",
    ],
    common_mistakes: [
      "Namazları sonradan kaza etmeye çalışmak.",
      "Oruç ve namaz hükümlerini karıştırmak.",
    ],
    related_questions: [
      "Hayız nedir?",
      "Adetliyken namaz kılınır mı?",
      "Adetliyken oruç tutulur mu?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  nifas: {
    step_by_step: [
      "Nifas, doğum sonrası lohusalık kanamasıdır.",
      "Bu dönemde namaz kılınmaz ve oruç tutulmaz.",
      "Tutulamayan oruçlar daha sonra kaza edilir.",
      "Namazlar kaza edilmez.",
    ],
    attention_points: [
      "Lohusalık süreci sağlık açısından da hassas olabilir.",
    ],
    common_mistakes: [
      "Namazı kaza etmeye çalışmak.",
      "Oruç kazasını ihmal etmek.",
    ],
    related_questions: [
      "Nifas nedir?",
      "Lohusalıkta namaz kılınır mı?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  istihaze: {
    step_by_step: [
      "İstihaze, hayız ve nifas dışında gelen özür kanıdır.",
      "Namaza ve oruca engel sayılmaz.",
      "Abdest ve özür hükümlerine göre ibadet edilir.",
    ],
    attention_points: [
      "Şüpheli durumda sağlık açısından doktora danışılmalıdır.",
    ],
    common_mistakes: [
      "İstihaze ile hayız/nifası aynı görmek.",
    ],
    related_questions: [
      "İstihaze nedir?",
      "Özür kanı namazı etkiler mi?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  hayizOrucNamaz: {
    step_by_step: [
      "Adetliyken namaz kılınmaz.",
      "Adetliyken oruç tutulmaz.",
      "Namaz kaza edilmez.",
      "Oruç kaza edilir.",
    ],
    attention_points: [
      "Bu hükümler hayız dönemine özgü temel hükümlerdir.",
    ],
    related_questions: [
      "Adetliyken namaz kılınır mı?",
      "Adetliyken oruç tutulur mu?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  hayizKaza: {
    step_by_step: [
      "Ramazan'da adet nedeniyle tutulamayan oruçlar tespit edilir.",
      "Uygun zamanda kaza edilir.",
      "Fidye ile karıştırılmaz.",
    ],
    attention_points: [
      "Kaza, daha sonra tutma anlamına gelir.",
    ],
    related_questions: [
      "Adetliyken tutulamayan oruç kaza edilir mi?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  hayizKuran: {
    step_by_step: [
      "Mushafa dokunma ve Kur'an okuma konusu dikkatli değerlendirilir.",
      "Dua, zikir ve salavat okunabilir.",
    ],
    attention_points: [
      "Bu konuda mezhepler arasında ayrıntılar vardır.",
    ],
    common_mistakes: [
      "İhtilaflı ayrıntıları tek cümleyle kesin hükme bağlamak.",
    ],
    related_questions: [
      "Adetliyken Kur'an okunur mu?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  ozurKani: {
    step_by_step: [
      "Vakit girdikten sonra abdest alınır.",
      "Her vakit için abdest yenilenir.",
      "Özür devam ediyorsa bu kolaylık sürer.",
    ],
    attention_points: [
      "Özür kanı namaza engel değildir; düzenli abdest esastır.",
    ],
    related_questions: [
      "Özür kanı olan kişi namaz kılabilir mi?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  niyet: {
    step_by_step: [
      "Niyet, yapılacak ibadeti kalben bilmektir.",
      "Dil ile söylemek şart değildir.",
      "Namaz, oruç, abdest ve gusülde niyet ibadeti yönlendirir.",
    ],
    attention_points: [
      "Niyetin özü kalbin ibadete yönelmesidir.",
    ],
    related_questions: [
      "Niyet nasıl edilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  yeminNedir: {
    step_by_step: [
      "Yemin, bir sözü Allah adına güçlendirmektir.",
      "Vallahi, billahi gibi ifadeler yemin sayılabilir.",
      "Yemin bozulursa kefaret gündeme gelir.",
    ],
    attention_points: [
      "Yalan yere yeminden sakınmak gerekir.",
    ],
    common_mistakes: [
      "Her güçlü cümleyi yemin sanmak.",
    ],
    related_questions: [
      "Yemin nedir?",
      "Yemin bozulursa ne olur?",
      "Yemin kefareti nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  yeminKefaret: {
    step_by_step: [
      "Yemin bozulduysa kefaret gerekir.",
      "Genel olarak bir fakiri doyurma veya giydirme yolu düşünülür.",
      "Buna gücü yetmeyen için oruç gündeme gelir.",
    ],
    attention_points: [
      "Kefaretin uygulanışı somut duruma göre değerlendirilir.",
    ],
    common_mistakes: [
      "Kefareti sıradan bir bağış gibi görmek.",
    ],
    related_questions: [
      "Yemin kefareti nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  adakNedir: {
    step_by_step: [
      "Adak, bir işi Allah rızası için yerine getirmeyi vaat etmektir.",
      "Ciddi bir niyet ve sorumluluk içerir.",
      "Mümkünse yerine getirilmelidir.",
    ],
    attention_points: [
      "Adak, kolay söylenen bir söz değil, bağlayıcı bir taahhüttür.",
    ],
    common_mistakes: [
      "Adak sözünü hafife almak.",
    ],
    related_questions: [
      "Adak nedir?",
      "Adak adamak ne anlama gelir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  adakKurbani: {
    step_by_step: [
      "Adak kurbanı adağın bir türüdür.",
      "Etin değerlendirilmesinde adak sahibinin durumu gözetilir.",
      "Genelde ihtiyaç sahiplerine dağıtım esastır.",
    ],
    attention_points: [
      "Adak kurbanı, sıradan et ihtiyacından ayrı değerlendirilir.",
    ],
    common_mistakes: [
      "Adak etini herkesin rahatça yiyebileceği bir et gibi görmek.",
    ],
    related_questions: [
      "Adak kurbanı nedir?",
      "Adak kurbanı eti nasıl değerlendirilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  kefaretNedir: {
    step_by_step: [
      "Kefaret, bazı ihlallerin telafisi için uygulanan ibadettir.",
      "Yemin, oruç ve benzeri konularda gündeme gelebilir.",
      "Somut durumun türüne göre değerlendirilir.",
    ],
    attention_points: [
      "Kefaret, sırf pişmanlıktan farklı olarak belirli bir telafi düzenidir.",
    ],
    related_questions: [
      "Kefaret nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  tovbe: {
    step_by_step: [
      "Günaha pişmanlık duyulur.",
      "Günah hemen bırakılır.",
      "Tekrar etmemeye niyet edilir.",
      "Kul hakkı varsa helalleşilir.",
    ],
    attention_points: [
      "Tövbe samimi dönüş demektir.",
    ],
    common_mistakes: [
      "Pişmanlığı davranış değişikliğine çevirmemek.",
    ],
    related_questions: [
      "Tövbe nasıl edilir?",
      "Tevbe nasıl edilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  duaNedir: {
    step_by_step: [
      "Dua, kulun Allah'a yönelmesidir.",
      "İhtiyaç, şükür ve yöneliş içerebilir.",
      "Samimiyet ve ümit önemlidir.",
    ],
    attention_points: [
      "Dua bir teslimiyet ve yöneliş ifadesidir.",
    ],
    related_questions: [
      "Dua nedir?",
      "Dua nasıl edilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  duaNasil: {
    step_by_step: [
      "Hamd ve salavatla başlamak güzeldir.",
      "İhtiyaç açık ve sade şekilde söylenir.",
      "Dua samimi bir üslupla sürdürülür.",
      "Ümit ve sabır korunur.",
    ],
    attention_points: [
      "Uzunluk değil samimiyet önemlidir.",
    ],
    related_questions: [
      "Dua nasıl edilir?",
      "Dua ederken nelere dikkat edilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  helalHaram: {
    step_by_step: [
      "Helal, yapılması serbest ve temiz görülen alanı ifade eder.",
      "Haram, kaçınılması gereken alanı ifade eder.",
      "Günlük hayatta ölçü, niyet ve sonuç birlikte değerlendirilir.",
    ],
    attention_points: [
      "Şüpheli durumlarda ihtiyatlı davranmak iyi olur.",
    ],
    related_questions: [
      "Helal haram nedir?",
      "Helal ve haram arasındaki temel ölçü nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  faiz: {
    step_by_step: [
      "Faiz, borç ilişkilerinde fazlalık şartı üzerinden yürüyen bir konudur.",
      "Sakınılması gereken bir alandır.",
      "Modern finans ürünlerinde dikkatli değerlendirme gerekir.",
    ],
    attention_points: [
      "Sözleşme ve işlem ayrıntıları önemlidir.",
    ],
    common_mistakes: [
      "Her kâr oranını faiz sanmak ya da tam tersini düşünmek.",
    ],
    related_questions: [
      "Faiz nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  kulHakki: {
    step_by_step: [
      "Zarar verilen kişiden helallik istenir.",
      "Maddi zarar varsa iade edilir.",
      "Sözlü incitme varsa telafi edilir.",
    ],
    attention_points: [
      "Hak sahibi bulunabiliyorsa doğrudan telafi etmek en doğru yoldur.",
    ],
    common_mistakes: [
      "Kul hakkını sadece manevi bir düşünce sanmak.",
    ],
    related_questions: [
      "Kul hakkı nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  anneBaba: {
    step_by_step: [
      "Anne babaya saygı gösterilir.",
      "İyilik, dua ve bakım sorumluluğu gözetilir.",
      "Kırıcı söz ve davranışlardan kaçınılır.",
    ],
    attention_points: [
      "Bu hak sadece sözlü saygı değil, fiili iyilik de ister.",
    ],
    common_mistakes: [
      "Bakım sorumluluğunu ihmal etmek.",
    ],
    related_questions: [
      "Anne baba hakkı nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  giybet: {
    step_by_step: [
      "Gıybet, bir kişinin hoşlanmayacağı şeyi arkasından söylemektir.",
      "Sakınılması gereken bir davranıştır.",
      "Susmak, konuyu değiştirmek ve hayra yönelmek faydalıdır.",
    ],
    attention_points: [
      "Dil terbiyesi günlük ahlakın merkezindedir.",
    ],
    common_mistakes: [
      "Eleştiriyi gıybet zannetmek ya da gıybeti normal görmek.",
    ],
    related_questions: [
      "Gıybet nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  israf: {
    step_by_step: [
      "Yeme, para, zaman ve imkânlarda ölçü korunur.",
      "Fazla tüketimden kaçınılır.",
      "Kaynaklar faydalı yere yönlendirilir.",
    ],
    attention_points: [
      "İsraf sadece maddede değil, zamanda da olabilir.",
    ],
    common_mistakes: [
      "Küçük israfı önemsiz görmek.",
    ],
    related_questions: [
      "İsraf nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  selam: {
    step_by_step: [
      "Selam vermek güzel bir sünnet ve nezaket göstergesidir.",
      "Selam alınır ve mümkünse daha güzel bir ifadeyle karşılık verilir.",
      "Günlük ilişkilerde selamlaşma sıcaklık oluşturur.",
    ],
    attention_points: [
      "Kısa bir selam bile toplumsal bağı güçlendirir.",
    ],
    related_questions: [
      "Selamlaşma adabı nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  komsuluk: {
    step_by_step: [
      "Komşuya eziyet edilmez.",
      "İhtiyaç hâlinde yardım edilir.",
      "İyi geçim ve selam sürdürülür.",
    ],
    attention_points: [
      "Komşuluk hakkı karşılıklı nezaket ve güven ister.",
    ],
    common_mistakes: [
      "Komşuyu sadece rahatsız etmeme ile sınırlı görmek.",
    ],
    related_questions: [
      "Komşuluk hakkı nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  nikah: {
    step_by_step: [
      "Nikâh, aile kurmanın dinî çerçevesini oluşturur.",
      "Karşılıklı rıza ve açık bir akit esastır.",
      "Aile sorumluluğu ve saygı gözetilir.",
    ],
    attention_points: [
      SHARED.legalCaution,
    ],
    common_mistakes: [
      "Nikâhı sadece tören gibi görmek.",
    ],
    related_questions: [
      "Nikâh nedir?",
      "Nikâh şartları nelerdir?",
      "Aile hakkı nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  nikahSartlari: {
    step_by_step: [
      "Tarafların rızası değerlendirilir.",
      "Akit ve şahitlik şartları gözetilir.",
      "Engel oluşturan durumlar kontrol edilir.",
    ],
    attention_points: [
      SHARED.legalCaution,
    ],
    common_mistakes: [
      "Sadece niyete dayanıp akit düzenini ihmal etmek.",
    ],
    related_questions: [
      "Nikâh şartları nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  aileHakki: {
    step_by_step: [
      "Eşler arasında sevgi ve saygı korunur.",
      "Sorumluluklar paylaşılır.",
      "Çocuklar ve ev içi düzen gözetilir.",
    ],
    attention_points: [
      SHARED.legalCaution,
    ],
    common_mistakes: [
      "Aile hakkını sadece duygusal bir mesele gibi görmek.",
    ],
    related_questions: [
      "Aile hakkı nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  bosanma: {
    step_by_step: [
      "Boşanma, evlilik bağının sona ermesidir.",
      "Acele edilmeden ve sonuçları düşünülerek yaklaşılır.",
      "Çocuk, mal ve haklar ayrıca değerlendirilir.",
    ],
    attention_points: [
      SHARED.legalCaution,
    ],
    common_mistakes: [
      "Duygusal tepkiyle konuşup hukuki sonuçları hesaba katmamak.",
    ],
    related_questions: [
      "Boşanma nedir?",
      "Talak nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  talak: {
    step_by_step: [
      "Talak, boşanma sözünü ifade eder.",
      "Sonuçları ciddi olduğu için dikkatli yaklaşılır.",
      "Gerekiyorsa resmî ve dinî boyut birlikte düşünülür.",
    ],
    attention_points: [
      SHARED.legalCaution,
    ],
    common_mistakes: [
      "Talakı sıradan tartışma cümlesi gibi kullanmak.",
    ],
    related_questions: [
      "Talak nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  miras: {
    step_by_step: [
      "Miras, vefat sonrası mal paylaşımıyla ilgilidir.",
      "Vasiyet, borç ve haklar birlikte değerlendirilir.",
      "Paylaşımda şer'i ve hukuki boyut gözetilir.",
    ],
    attention_points: [
      SHARED.legalCaution,
    ],
    common_mistakes: [
      "Borçları ve vasiyeti hesaba katmamak.",
    ],
    related_questions: [
      "Miras nedir?",
      "Miras paylaşımı genel nasıl değerlendirilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  mirasPaylasimi: {
    step_by_step: [
      "Önce borçlar ve vasiyet değerlendirilir.",
      "Sonra paylar genel ilmihal çerçevesinde ele alınır.",
      "Kişisel ayrıntılar ayrıca kontrol edilir.",
    ],
    attention_points: [
      SHARED.legalCaution,
    ],
    common_mistakes: [
      "Paylaşımı tek bir cümleyle bitmiş sanmak.",
    ],
    related_questions: [
      "Miras paylaşımı genel nasıl olur?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  sadaka: {
    step_by_step: [
      "Sadaka, ihtiyaç sahiplerine gönülden yapılan yardımdır.",
      "Miktardan çok niyet ve fayda öne çıkar.",
    ],
    attention_points: [
      "Sadaka günlük iyilik ve paylaşma dilini güçlendirir.",
    ],
    related_questions: [
      "Sadaka nedir?",
      "Sadaka kime verilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  sadakaKime: {
    step_by_step: [
      "İhtiyaç sahibi kişiler değerlendirilir.",
      "Fakir ve benzeri durumlar gözetilir.",
    ],
    attention_points: [
      "Gerçek ihtiyaç sahibi olana yönelmek uygundur.",
    ],
    related_questions: [
      "Sadaka kime verilir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  kandil: {
    step_by_step: [
      "Kandil geceleri manevi yoğunluğu yüksek geceler olarak anılır.",
      "Geceyi dua, tövbe ve zikirle değerlendirmek amaçlanır.",
      "İbadet ve tefekkür için fırsat görülür.",
    ],
    attention_points: [
      "Temel ibadet bilinci korunur; aşırılıktan kaçınılır.",
    ],
    common_mistakes: [
      "Manevi anlamı abartıp esas ibadetleri ihmal etmek.",
    ],
    related_questions: [
      "Kandil geceleri nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  gece: {
    step_by_step: [
      "Gece ibadetlerinde dua, zikir, Kur'an okuma ve teheccüd öne çıkar.",
      "Kısa ama düzenli bir alışkanlık daha sürdürülebilirdir.",
    ],
    attention_points: [
      "Az ama devamlı ibadet çoğu zaman daha uygulanabilirdir.",
    ],
    related_questions: [
      "Gece ibadetleri nelerdir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  mirac: {
    step_by_step: [
      "Miraç Kandili, Hz. Peygamber'in Miraç hadisesini hatırlatan manevi bir gecedir.",
      "Gecede dua, tövbe, zikir ve salavatla meşgul olmak uygundur.",
    ],
    attention_points: [
      "Manevi geceyi sade ve bilinçli bir şekilde değerlendirmek yeterlidir.",
    ],
    related_questions: [
      "Miraç Kandili nedir?",
      "İsra ve Miraç gecesi nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  cenaze: {
    step_by_step: [
      "Cenaze namazı, vefat eden Müslüman için topluca yapılan kısa bir duadır.",
      "Niyet edilir ve tekbirlerle namaz tamamlanır.",
      "Sonunda selam verilir.",
    ],
    attention_points: [
      "Cenaze namazı kısa ve dua ağırlıklıdır.",
    ],
    related_questions: [
      "Cenaze namazı nedir?",
      "Cenaze namazı nasıl kılınır?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  sahur: {
    step_by_step: [
      "Sahurda yeme içme ile oruca hazırlanılır.",
      "İmsak vaktine dikkat edilir.",
      "Oruç için niyet ve düzen sağlanır.",
    ],
    attention_points: [
      "Sahur, oruç için bereketli ve faydalı bir hazırlıktır.",
    ],
    related_questions: [
      "Sahur nedir?",
      "Sahur şart mı?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  iddet: {
    step_by_step: [
      "İddet, boşanma veya vefat sonrası bekleme süresidir.",
      "Süre ve ayrıntılar kişisel duruma göre değerlendirilir.",
    ],
    attention_points: [
      SHARED.legalCaution,
    ],
    related_questions: [
      "İddet nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
  helalKazanc: {
    step_by_step: [
      "Kazancın meşru bir işten olması gözetilir.",
      "Faiz ve haksızlık içermeyen yollar tercih edilir.",
      "Emeğe, dürüstlüğe ve sözleşme ahlakına dikkat edilir.",
    ],
    attention_points: [
      "Helal kazanç, sadece gelir değil, yöntemin temizliğini de içerir.",
    ],
    related_questions: [
      "Helal kazanç nedir?",
    ],
    source_notes: ["Diyanet ve TDV ilmihal üslubuyla hazırlanmış kısa özet."],
  },
};

const SPECS = [
  { file: "abdest.json", id: "abdest_howto", title: "Abdest Nasıl Alınır?", category: "worship_practice", summary: "Abdest, namaz ve bazı ibadetler için alınan temizliktir. Niyet, yıkama ve mesh adımlarıyla yapılır.", keywords: ["abdest", "abdest nasıl alınır", "abdestin farzları", "abdesti bozan şeyler", "boy abdesti", "wudu"], aliases: ["abdest nasıl alınır", "abdestin farzları", "abdesti bozan şeyler", "boy abdesti"], base: "abdest" },
  { file: "gusul.json", id: "gusul_howto", title: "Gusül Abdesti Nasıl Alınır?", category: "worship_practice", summary: "Gusül, büyük hadesten temizlenmek için alınan boy abdestidir. Ağza, buruna ve tüm bedene su ulaştırmak esastır.", keywords: ["gusül", "gusul", "gusül abdesti nasıl alınır", "boy abdesti", "guslün farzları"], aliases: ["gusül abdesti nasıl alınır", "boy abdesti nasıl alınır", "guslün farzları nelerdir"], base: "gusul" },
  { file: "namaz_nasil_kilinir.json", id: "namaz_nasil_kilinir", title: "Namaz Nasıl Kılınır?", category: "worship_practice", summary: "Namaz, abdestten sonra kıbleye dönülerek niyetle başlayan ve selamla tamamlanan ibadettir.", keywords: ["namaz nasıl kılınır", "namaza nasıl başlanır", "rekât nasıl kılınır", "namaz"], aliases: ["namaz nasıl kılınır", "namaza nasıl başlanır", "rekât nasıl kılınır"], base: "namazHowTo" },
  { file: "namaz_farzlari.json", id: "namaz_farzlari", title: "Namazın Farzları", category: "worship_practice", summary: "Namazın farzları dış şartlar ve iç farzlar olarak birlikte düşünülür.", keywords: ["namazın farzları", "namaz farzları", "namazın dış farzları", "namazın iç farzları"], aliases: ["namazın farzları nelerdir", "namaz farzları"], base: "namazFarz" },
  { file: "namazi_bozanlar.json", id: "namazi_bozanlar", title: "Namazı Bozanlar", category: "worship_practice", summary: "Namaz bazı söz, davranış ve durumlarla bozulabilir.", keywords: ["namazı bozan şeyler", "namazı bozan", "namaz bozanlar", "geçersiz kılan"], aliases: ["namazı bozan şeyler nelerdir", "namazı bozanlar nelerdir"], base: "namazBozan" },
  { file: "namaz_vacipleri.json", id: "namaz_vacipleri", title: "Namazın Vacipleri", category: "worship_practice", summary: "Namazın vacipleri, namazın düzenini ve tamamlayıcılığını güçlendirir.", keywords: ["namazın vacipleri", "namaz vacipleri", "vacipler"], aliases: ["namazın vacipleri nelerdir", "namaz vacipleri"], base: "namazVacip" },
  { file: "sabah_namazi.json", id: "sabah_namazi", title: "Sabah Namazı", category: "worship_practice", summary: "Sabah namazı 2 rekât sünnet ve 2 rekât farzdan oluşur.", keywords: ["sabah namazı", "sabah namazı nasıl kılınır", "sabah namazı kaç rekât"], aliases: ["sabah namazı nasıl kılınır", "sabah namazı kaç rekât"], base: "sabah" },
  { file: "oruc_nedir.json", id: "oruc_nedir", title: "Oruç Nedir?", category: "worship_practice", summary: "Oruç, imsaktan iftara kadar yeme, içme ve orucu bozan davranışlardan uzak durma ibadetidir. Ramazan orucu farzdır.", keywords: ["oruç nedir", "oruç nasıl tutulur", "oruç farz mı", "oruc farz mi", "oruçlu"], aliases: ["oruç nedir", "oruç nasıl tutulur", "oruç farz mı", "oruc farz mi"], base: "oruc" },
  { file: "orucu_bozanlar.json", id: "orucu_bozanlar", title: "Orucu Bozanlar", category: "worship_practice", summary: "Orucu bozan durumlar açık ve bilerek yapılan eylemlerle ilgilidir.", keywords: ["orucu bozan", "orucu bozan şeyler", "orucu bozan şeyler nelerdir", "orucu bozan davranışlar"], aliases: ["orucu bozan şeyler nelerdir", "orucu bozanlar"], base: "orucBozan" },
  { file: "orucu_bozmayanlar.json", id: "orucu_bozmayanlar", title: "Orucu Bozmayanlar", category: "worship_practice", summary: "Bazı hâller orucu bozmaz; unutma ve istem dışı durumlar buna örnektir.", keywords: ["orucu bozmayan", "orucu bozmayan şeyler", "orucu bozmayan şeyler nelerdir"], aliases: ["orucu bozmayan şeyler nelerdir", "orucu bozmayanlar"], base: "orucBozmayan" },
  { file: "oruc_fidyesi.json", id: "oruc_fidyesi", title: "Oruç Fidyesi", category: "worship_practice", summary: "Oruç fidyesi, tutmaya gücü yetmeyen bazı kimselerin her gün için verdiği bedeldir.", keywords: ["oruç fidyesi", "oruc fidyesi", "fidye"], aliases: ["oruç fidyesi nedir", "oruc fidyesi nedir"], base: "orucFidye" },
  { file: "oruc_kazasi.json", id: "oruc_kazasi", title: "Oruç Kazası", category: "worship_practice", summary: "Oruç kazası, tutulamayan veya bozulmuş oruçların daha sonra tutulmasıdır.", keywords: ["oruç kazası", "oruc kazasi", "oruç kazası nedir"], aliases: ["oruç kazası nedir", "oruc kazasi nedir"], base: "orucKaza" },
  { file: "zekat_nedir.json", id: "zekat_nedir", title: "Zekât Nedir?", category: "worship_practice", summary: "Zekât, nisap miktarına ulaşan malın belirli kısmının Allah rızası için verilmesidir.", keywords: ["zekât nedir", "zekat nedir", "nisap", "yılda bir kez"], aliases: ["zekât nedir", "zekat nedir"], base: "zekatNedir" },
  { file: "zekat_kime_verilir.json", id: "zekat_kime_verilir", title: "Zekât Kimlere Verilir?", category: "worship_practice", summary: "Zekât fakirlere, miskinlere, borçlulara, yolda kalmışlara ve Allah yolunda olanlara verilir.", keywords: ["zekât kimlere verilir", "zekat kime verilir", "zekat kimlere verilir", "fakirler", "miskinler", "borçlular", "yolda kalmışlar", "Allah yolunda olanlar"], aliases: ["zekât kimlere verilir", "zekat kime verilir", "zekat kimlere verilir"], base: "zekatRecipients" },
  { file: "zekat_kime_verilmez.json", id: "zekat_kime_verilmez", title: "Zekât Kimlere Verilmez?", category: "worship_practice", summary: "Zekât anne babaya, çocuklara, eşe, zenginlere ve bakmakla yükümlü olunan kişilere verilmez.", keywords: ["zekât kimlere verilmez", "zekat kimlere verilmez", "zekat kime verilmez"], aliases: ["zekât kimlere verilmez", "zekat kimlere verilmez"], base: "zekatNotRecipients" },
  { file: "zekat_nisap_nedir.json", id: "zekat_nisap_nedir", title: "Zekât Nisap Nedir?", category: "worship_practice", summary: "Nisap, zekât yükümlülüğü için esas alınan asgari mal ölçüsüdür.", keywords: ["zekât nisap nedir", "zekat nisap nedir", "nisap"], aliases: ["zekât nisap nedir", "zekat nisap nedir"], base: "zekatNisap" },
  { file: "fitre_nedir.json", id: "fitre_nedir", title: "Fitre Nedir?", category: "worship_practice", summary: "Fitre, Ramazan Bayramı'na ulaşan ve temel ihtiyaçlarının üstünde imkâna sahip olan kimsenin kişi başına verdiği vacip sadakadır.", keywords: ["fitre nedir", "fitre", "fitre kime verilir", "fitre ne zaman verilir"], aliases: ["fitre nedir"], base: "fitreNedir" },
  { file: "fitre_kime_verilir.json", id: "fitre_kime_verilir", title: "Fitre Kime Verilir?", category: "worship_practice", summary: "Fitre, ihtiyaç sahiplerine ve zekât verilebilen kimselere verilir.", keywords: ["fitre kime verilir", "fitre kimlere verilir"], aliases: ["fitre kime verilir"], base: "fitreRecipients" },
  { file: "fitre_ne_zaman_verilir.json", id: "fitre_ne_zaman_verilir", title: "Fitre Ne Zaman Verilir?", category: "worship_practice", summary: "Fitre Ramazan içinde verilebilir; bayramdan önce verilmesi tercih edilir ve bayram sabahına kadar verilmesi gerekir.", keywords: ["fitre ne zaman verilir", "fitre zamanı"], aliases: ["fitre ne zaman verilir"], base: "fitreTime" },
  { file: "kurban_nedir.json", id: "kurban_nedir", title: "Kurban Nedir?", category: "worship_practice", summary: "Kurban, Kurban Bayramı günlerinde Allah rızası için kesilen ibadettir.", keywords: ["kurban nedir", "kurban"], aliases: ["kurban nedir"], base: "kurbanNedir" },
  { file: "kurban_kime_vaciptir.json", id: "kurban_kime_vaciptir", title: "Kurban Kimlere Vaciptir?", category: "worship_practice", summary: "Kurban, Müslüman, akıllı, ergen, nisap miktarı mala sahip ve yolcu olmayan kimse için vacip olur.", keywords: ["kurban kimlere vaciptir", "kurban kime vaciptir"], aliases: ["kurban kimlere vaciptir", "kurban kime vaciptir"], base: "kurbanVacip" },
  { file: "kurban_ne_zaman_kesilir.json", id: "kurban_ne_zaman_kesilir", title: "Kurban Ne Zaman Kesilir?", category: "worship_practice", summary: "Kurban, bayram namazından sonra ve Kurban Bayramı günleri içinde kesilir.", keywords: ["kurban ne zaman kesilir", "kurban zamanı"], aliases: ["kurban ne zaman kesilir"], base: "kurbanTime" },
  { file: "kurban_eti_nasil_paylasilir.json", id: "kurban_eti_nasil_paylasilir", title: "Kurban Eti Nasıl Paylaşılır?", category: "worship_practice", summary: "Kurban eti aile içinde kullanılabilir; akraba, komşu ve ihtiyaç sahipleriyle paylaşmak uygundur.", keywords: ["kurban eti nasıl paylaşılır", "kurban eti", "kurban paylaşımı"], aliases: ["kurban eti nasıl paylaşılır"], base: "kurbanShare" },
  { file: "kurban_keserken_nelere_dikkat_edilir.json", id: "kurban_keserken_nelere_dikkat_edilir", title: "Kurban Keserken Nelere Dikkat Edilir?", category: "worship_practice", summary: "Kurban kesiminde hayvana eziyet etmemek, ehil kişi tarafından kesilmesi, besmele ve hijyen önemlidir.", keywords: ["kurban keserken nelere dikkat edilir", "kurban keserken", "vekalet"], aliases: ["kurban keserken nelere dikkat edilir"], base: "kurbanAttention" },
  { file: "hac_nedir.json", id: "hac_nedir", title: "Hac Nedir?", category: "worship_practice", summary: "Hac, belirli zamanda yapılan ve Kâbe ile kutsal mekânlara bağlı büyük ibadettir.", keywords: ["hac nedir", "hac"], aliases: ["hac nedir"], base: "hacNedir" },
  { file: "hac_kimlere_farzdır.json", id: "hac_kimlere_farzdır", title: "Hac Kimlere Farzdır?", category: "worship_practice", summary: "Hac, Müslüman, akıllı, ergen, hür, maddi ve bedeni imkâna sahip ve yol güvenliği bulunan kimseye farzdır.", keywords: ["hac kimlere farzdır", "hac kimlere farzdır", "hac"], aliases: ["hac kimlere farzdır", "hac kimlere farzdır"], base: "hacFarz" },
  { file: "haccin_farzlari.json", id: "haccin_farzlari", title: "Haccın Farzları", category: "worship_practice", summary: "Haccın temel farzları ihram, Arafat vakfesi ve ziyaret tavafıdır.", keywords: ["haccın farzları", "haccin farzlari", "hac farzları"], aliases: ["haccın farzları nelerdir", "haccin farzlari nelerdir"], base: "hacFarz" },
  { file: "umre_nedir.json", id: "umre_nedir", title: "Umre Nedir?", category: "worship_practice", summary: "Umre, ihramla başlayıp tavaf, sa'y ve tıraş olup ihramdan çıkmakla tamamlanan ibadettir.", keywords: ["umre nedir", "umre"], aliases: ["umre nedir"], base: "umreNedir" },
  { file: "hac_ile_umre_farki.json", id: "hac_ile_umre_farki", title: "Hac ile Umre Farkı Nedir?", category: "worship_practice", summary: "Hac belirli zamanda yapılır ve Arafat vakfesi vardır; umre ise yılın çoğu zamanında yapılabilir.", keywords: ["hac ile umre farkı", "hac ve umre farkı"], aliases: ["hac ile umre farkı nedir", "hac ve umre farkı nedir"], base: "hacUmreFarki" },
  { file: "teyemmum_nedir.json", id: "teyemmum_nedir", title: "Teyemmüm Nedir?", category: "worship_practice", summary: "Teyemmüm, su bulunmadığında veya su kullanılamadığında yapılan temizlik kolaylığıdır.", keywords: ["teyemmüm nedir", "teyemmum nedir", "teyemmum"], aliases: ["teyemmüm nedir", "teyemmum nedir"], base: "teyemmumNedir" },
  { file: "teyemmum_nasil_alinir.json", id: "teyemmum_nasil_alinir", title: "Teyemmüm Nasıl Alınır?", category: "worship_practice", summary: "Teyemmüm, niyet edilip temiz toprak cinsinden bir yüzeye vurularak yüz ve kolların mesh edilmesiyle alınır.", keywords: ["teyemmüm nasıl alınır", "teyemmum nasıl alınır", "teyemmum"], aliases: ["teyemmüm nasıl alınır", "teyemmum nasıl alınır"], base: "teyemmumNasil" },
  { file: "teyemmumu_bozanlar.json", id: "teyemmumu_bozanlar", title: "Teyemmümü Bozanlar", category: "worship_practice", summary: "Su bulunduğunda veya teyemmümü gerektiren özür ortadan kalktığında teyemmüm bozulur.", keywords: ["teyemmümü bozanlar", "teyemmumu bozanlar", "teyemmum bozanlar"], aliases: ["teyemmümü bozan şeyler nelerdir", "teyemmumu bozan şeyler nelerdir"], base: "teyemmumBozan" },
  { file: "mest_uzerine_mesh.json", id: "mest_uzerine_mesh", title: "Mest Üzerine Mesh", category: "worship_practice", summary: "Mest üzerine mesh, abdestli giyilmiş mestin üst kısmını ıslak elle meshetme kolaylığıdır.", keywords: ["mest üzerine mesh", "mest uzerine mesh"], aliases: ["mest üzerine mesh nasıl yapılır"], base: "meshMest" },
  { file: "sargi_uzerine_mesh.json", id: "sargi_uzerine_mesh", title: "Sargı Üzerine Mesh", category: "worship_practice", summary: "Sargı üzerine mesh, özür ve tedavi hâlinde abdest kolaylığı sağlayan bir uygulamadır.", keywords: ["sargı üzerine mesh", "sargi uzerine mesh"], aliases: ["sargı üzerine mesh nasıl yapılır"], base: "meshSargi" },
  { file: "cuma_namazi_nedir.json", id: "cuma_namazi_nedir", title: "Cuma Namazı Nedir?", category: "worship_practice", summary: "Cuma namazı, cuma günü öğle vaktinde cemaatle ve hutbe ile kılınan önemli bir namazdır.", keywords: ["cuma namazı nedir", "cuma namazı"], aliases: ["cuma namazı nedir"], base: "cumaNedir" },
  { file: "cuma_namazi_kac_rekat.json", id: "cuma_namazi_kac_rekat", title: "Cuma Namazı Kaç Rekât?", category: "worship_practice", summary: "Cuma namazının farzı 2 rekâttır; sünnetlerle birlikte kılınır.", keywords: ["cuma namazı kaç rekât", "cuma namazı kaç rekat"], aliases: ["cuma namazı kaç rekât", "cuma namazı kaç rekat"], base: "cumaKac" },
  { file: "cuma_namazi_kimlere_farzdır.json", id: "cuma_namazi_kimlere_farzdır", title: "Cuma Namazı Kimlere Farzdır?", category: "worship_practice", summary: "Cuma namazı, akıllı, ergen, hür, mukim ve mazeretsiz Müslüman erkeklere farzdır.", keywords: ["cuma namazı kimlere farzdır", "cuma namazı kimlere farzdır"], aliases: ["cuma namazı kimlere farzdır", "cuma namazı kimlere farzdır"], base: "cumaKimlere" },
  { file: "bayram_namazi_nedir.json", id: "bayram_namazi_nedir", title: "Bayram Namazı Nedir?", category: "worship_practice", summary: "Bayram namazı, Ramazan ve Kurban Bayramı sabahı cemaatle kılınan iki rekâtlık namazdır.", keywords: ["bayram namazı nedir", "bayram namazı"], aliases: ["bayram namazı nedir"], base: "bayramNedir" },
  { file: "bayram_namazi_nasil_kilinir.json", id: "bayram_namazi_nasil_kilinir", title: "Bayram Namazı Nasıl Kılınır?", category: "worship_practice", summary: "Bayram namazı iki rekât olarak ilave tekbirlerle kılınır.", keywords: ["bayram namazı nasıl kılınır", "bayram namazı nasıl kilinir"], aliases: ["bayram namazı nasıl kılınır"], base: "bayramNasil" },
  { file: "bayram_namazi_kac_rekat.json", id: "bayram_namazi_kac_rekat", title: "Bayram Namazı Kaç Rekât?", category: "worship_practice", summary: "Bayram namazı 2 rekâttır.", keywords: ["bayram namazı kaç rekât", "bayram namazı kaç rekat"], aliases: ["bayram namazı kaç rekât", "bayram namazı kaç rekat"], base: "bayramKac" },
  { file: "hayiz_nedir.json", id: "hayiz_nedir", title: "Hayız Nedir?", category: "worship_practice", summary: "Hayız, kadının doğal adet hâlidir; bu dönemde namaz kılınmaz, oruç tutulmaz ve tutulamayan oruçlar sonra kaza edilir.", keywords: ["hayız nedir", "adet nedir", "regl nedir"], aliases: ["hayız nedir", "adet nedir", "regl nedir"], base: "hayiz" },
  { file: "nifas_nedir.json", id: "nifas_nedir", title: "Nifas Nedir?", category: "worship_practice", summary: "Nifas, doğum sonrası lohusalık kanamasıdır; bu dönemde namaz kılınmaz ve oruç tutulmaz.", keywords: ["nifas nedir", "lohusalıkta namaz", "lohusalık"], aliases: ["nifas nedir", "lohusalıkta namaz"], base: "nifas" },
  { file: "istihaze_nedir.json", id: "istihaze_nedir", title: "İstihaze Nedir?", category: "worship_practice", summary: "İstihaze, hayız ve nifas dışında gelen özür kanıdır; namaza ve oruca engel olmaz.", keywords: ["istihaze nedir", "özür kanı", "ozur kani"], aliases: ["istihaze nedir", "özür kanı"], base: "istihaze" },
  { file: "hayiz_halinde_namaz_oruc.json", id: "hayiz_halinde_namaz_oruc", title: "Hayız Hâlinde Namaz ve Oruç", category: "worship_practice", summary: "Adetliyken namaz kılınmaz, oruç tutulmaz; namaz kaza edilmez, oruç kaza edilir.", keywords: ["adetliyken namaz kılınır mı", "adetliyken oruç tutulur mu", "regl iken namaz"], aliases: ["adetliyken namaz kılınır mı", "adetliyken oruç tutulur mu"], base: "hayizOrucNamaz" },
  { file: "adetliyken_oruc_kazasi.json", id: "adetliyken_oruc_kazasi", title: "Adetliyken Oruç Kazası", category: "worship_practice", summary: "Ramazan'da adet nedeniyle tutulamayan oruçlar daha sonra kaza edilir; fidye ile karıştırılmaz.", keywords: ["adetliyken oruç kazası", "adetliyken tutulamayan oruç kaza edilir mi"], aliases: ["adetliyken oruç kazası", "adetliyken tutulamayan oruç kaza edilir mi"], base: "hayizKaza" },
  { file: "adetliyken_kuran_okunur_mu.json", id: "adetliyken_kuran_okunur_mu", title: "Adetliyken Kur'an Okunur mu?", category: "worship_practice", summary: "Mushafa dokunma ve Kur'an okuma konusunda ihtilaflı ayrıntılar vardır; dua, zikir ve salavat okunabilir.", keywords: ["adetliyken kuran okunur mu", "hayız halinde kuran okunur mu"], aliases: ["adetliyken Kur'an okunur mu"], base: "hayizKuran" },
  { file: "ozur_kani_namaz.json", id: "ozur_kani_namaz", title: "Özür Kanı Olan Kişi Namaz Kılabilir mi?", category: "worship_practice", summary: "Özür kanı olan kişi vakit girdikten sonra abdest alarak namaz kılabilir; özür devam ederse her vakit için abdest uygulanır.", keywords: ["özür kanı namaz", "özür kanı olan kişi namaz kılabilir mi", "ozur kani namaz"], aliases: ["özür kanı namaz", "özür kanı olan kişi namaz kılabilir mi"], base: "ozurKani" },
  { file: "niyet_nasil.json", id: "niyet_nasil", title: "Niyet Nasıl Edilir?", category: "daily_practice", summary: "Niyet, yapılacak ibadeti kalben bilmek ve onu Allah rızası için yapmaya yönelmektir. Dil ile söylemek şart değildir.", keywords: ["niyet nasıl edilir", "nasıl niyet edilir", "ibadete niyet", "kalben niyet"], aliases: ["niyet nasıl edilir", "nasıl niyet edilir", "ibadete niyet"], base: "niyet" },
  { file: "yemin_nedir.json", id: "yemin_nedir", title: "Yemin Nedir?", category: "daily_practice", summary: "Yemin, bir sözü Allah adına güçlendirmektir; yemin bozulursa kefaret gündeme gelir.", keywords: ["yemin nedir", "hangi sözler yemin sayılır", "yemin bozulursa ne olur"], aliases: ["yemin nedir", "hangi sözler yemin sayılır"], base: "yeminNedir" },
  { file: "yemin_kefareti.json", id: "yemin_kefareti", title: "Yemin Kefareti Nedir?", category: "daily_practice", summary: "Yemin kefareti, bozulan yemin için yerine getirilen telafi yoludur.", keywords: ["yemin kefareti nedir", "yemin kefareti", "yemin bozulursa"], aliases: ["yemin kefareti nedir"], base: "yeminKefaret" },
  { file: "adak_nedir.json", id: "adak_nedir", title: "Adak Nedir?", category: "daily_practice", summary: "Adak, bir işi Allah rızası için yerine getirmeyi vaat etmektir.", keywords: ["adak nedir", "adak adamak", "adak yerine getirilmeli mi"], aliases: ["adak nedir", "adak adamak"], base: "adakNedir" },
  { file: "adak_kurbani.json", id: "adak_kurbani", title: "Adak Kurbanı Nedir?", category: "daily_practice", summary: "Adak kurbanı, adağa bağlı olarak kesilen kurbandır; etin dağıtımı dikkatle değerlendirilir.", keywords: ["adak kurbanı nedir", "adak kurbani nedir", "adak kurbanı eti"], aliases: ["adak kurbanı nedir", "adak kurbanı eti kimlere verilir"], base: "adakKurbani" },
  { file: "kefaret_nedir.json", id: "kefaret_nedir", title: "Kefaret Nedir?", category: "daily_practice", summary: "Kefaret, bazı ihlallerin telafisi için uygulanan ibadettir.", keywords: ["kefaret nedir", "kefaret"], aliases: ["kefaret nedir"], base: "kefaretNedir" },
  { file: "tovbe_nasil_edilir.json", id: "tovbe_nasil_edilir", title: "Tövbe Nasıl Edilir?", category: "daily_practice", summary: "Tövbe; pişmanlık, günahı bırakma, tekrar etmemeye niyet ve gerekiyorsa helalleşmeyi içerir.", keywords: ["tövbe nasıl edilir", "tevbe nasıl edilir", "nasıl tövbe etmeliyim"], aliases: ["tövbe nasıl edilir", "tevbe nasıl edilir"], base: "tovbe" },
  { file: "dua_nedir.json", id: "dua_nedir", title: "Dua Nedir?", category: "daily_practice", summary: "Dua, kulun Allah'a yönelmesidir.", keywords: ["dua nedir", "dua ne demek"], aliases: ["dua nedir", "dua ne demek"], base: "duaNedir" },
  { file: "dua_nasil_edilir.json", id: "dua_nasil_edilir", title: "Dua Nasıl Edilir?", category: "daily_practice", summary: "Dua ederken hamd, salavat, samimiyet ve ümit gözetilir.", keywords: ["dua nasıl edilir", "dua nasıl yapılır"], aliases: ["dua nasıl edilir", "dua nasıl yapılır"], base: "duaNasil" },
  { file: "helal_haram_genel.json", id: "helal_haram_genel", title: "Helal Haram Genel", category: "daily_practice", summary: "Helal, yapılması uygun olan; haram, kaçınılması gereken alanı ifade eder.", keywords: ["helal haram nedir", "helal ve haram"], aliases: ["helal haram nedir", "helal ve haram"], base: "helalHaram" },
  { file: "faiz_nedir.json", id: "faiz_nedir", title: "Faiz Nedir?", category: "daily_practice", summary: "Faiz, sakınılması gereken bir konudur; modern finans ürünlerinde dikkatli değerlendirme gerekir.", keywords: ["faiz nedir", "faiz"], aliases: ["faiz nedir"], base: "faiz" },
  { file: "kul_hakki_nedir.json", id: "kul_hakki_nedir", title: "Kul Hakkı Nedir?", category: "daily_practice", summary: "Kul hakkı, bir insana verilen zararın telafisini ve helalleşmeyi gerektirir.", keywords: ["kul hakkı nedir", "kul hakki nedir"], aliases: ["kul hakkı nedir", "kul hakki nedir"], base: "kulHakki" },
  { file: "anne_baba_hakki.json", id: "anne_baba_hakki", title: "Anne Baba Hakkı Nedir?", category: "daily_practice", summary: "Anne baba hakkı, saygı, iyilik, dua ve bakım sorumluluğunu içerir.", keywords: ["anne baba hakkı nedir", "anne baba hakki nedir"], aliases: ["anne baba hakkı nedir", "anne baba hakki nedir"], base: "anneBaba" },
  { file: "giybet_nedir.json", id: "giybet_nedir", title: "Gıybet Nedir?", category: "daily_practice", summary: "Gıybet, bir kişinin hoşlanmayacağı şeyi arkasından söylemektir.", keywords: ["gıybet nedir", "giybet nedir"], aliases: ["gıybet nedir", "giybet"], base: "giybet" },
  { file: "israf_nedir.json", id: "israf_nedir", title: "İsraf Nedir?", category: "daily_practice", summary: "İsraf, yeme, para, zaman ve imkânlarda ölçüyü aşmaktır.", keywords: ["israf nedir", "israf"], aliases: ["israf nedir"], base: "israf" },
  { file: "selamlasma_adabi.json", id: "selamlasma_adabi", title: "Selamlaşma Adabı", category: "daily_practice", summary: "Selam vermek ve almak günlük nezaketin ve İslami kardeşliğin güzel bir parçasıdır.", keywords: ["selamlaşma adabı", "selamlasma adabi"], aliases: ["selamlaşma adabı"], base: "selam" },
  { file: "komsuluk_hakki.json", id: "komsuluk_hakki", title: "Komşuluk Hakkı Nedir?", category: "daily_practice", summary: "Komşuluk hakkı, komşuya eziyet etmemek ve iyi geçimi sürdürmektir.", keywords: ["komşuluk hakkı nedir", "komsuluk hakki nedir"], aliases: ["komşuluk hakkı nedir", "komsuluk hakki nedir"], base: "komsuluk" },
  { file: "nikah_nedir.json", id: "nikah_nedir", title: "Nikâh Nedir?", category: "daily_practice", summary: "Nikâh, aile kurmanın dinî çerçevesini oluşturan evlilik akdidir.", keywords: ["nikâh nedir", "nikah nedir"], aliases: ["nikâh nedir", "nikah nedir"], base: "nikah" },
  { file: "nikah_sartlari.json", id: "nikah_sartlari", title: "Nikâh Şartları", category: "daily_practice", summary: "Nikâhın şartları, taraf rızası, akit ve şahitlik gibi temel unsurları içerir.", keywords: ["nikâh şartları", "nikah şartları"], aliases: ["nikâh şartları", "nikah şartları"], base: "nikahSartlari" },
  { file: "aile_hakki.json", id: "aile_hakki", title: "Aile Hakkı", category: "daily_practice", summary: "Aile hakkı, eşler arasında sevgi, saygı, sorumluluk ve çocukların gözetilmesidir.", keywords: ["aile hakkı", "aile hakki"], aliases: ["aile hakkı"], base: "aileHakki" },
  { file: "bosanma_nedir.json", id: "bosanma_nedir", title: "Boşanma Nedir?", category: "daily_practice", summary: "Boşanma, evlilik bağının sona ermesidir ve ciddi sonuçlar doğurur.", keywords: ["boşanma nedir", "bosanma nedir"], aliases: ["boşanma nedir", "bosanma nedir"], base: "bosanma" },
  { file: "talak_nedir.json", id: "talak_nedir", title: "Talak Nedir?", category: "daily_practice", summary: "Talak, boşanma sözünü ve hukukunu ifade eder.", keywords: ["talak nedir", "talak"], aliases: ["talak nedir"], base: "talak" },
  { file: "miras_nedir.json", id: "miras_nedir", title: "Miras Nedir?", category: "daily_practice", summary: "Miras, vefat sonrası mal paylaşımıyla ilgilidir.", keywords: ["miras nedir", "miras"], aliases: ["miras nedir"], base: "miras" },
  { file: "miras_paylasimi_genel.json", id: "miras_paylasimi_genel", title: "Miras Paylaşımı Genel", category: "daily_practice", summary: "Miras paylaşımı, borç, vasiyet ve payların birlikte değerlendirilmesini gerektirir.", keywords: ["miras paylaşımı", "miras paylasimi"], aliases: ["miras paylaşımı", "miras paylaşımı genel"], base: "mirasPaylasimi" },
  { file: "sadaka_nedir.json", id: "sadaka_nedir", title: "Sadaka Nedir?", category: "daily_practice", summary: "Sadaka, ihtiyaç sahiplerine gönülden yapılan yardımdır.", keywords: ["sadaka nedir", "sadaka"], aliases: ["sadaka nedir"], base: "sadaka" },
  { file: "sadaka_kime_verilir.json", id: "sadaka_kime_verilir", title: "Sadaka Kime Verilir?", category: "daily_practice", summary: "Sadaka, ihtiyaç sahibi ve fakir kişilere verilir.", keywords: ["sadaka kime verilir", "sadaka kimlere verilir"], aliases: ["sadaka kime verilir"], base: "sadakaKime" },
  { file: "kandil_geceleri_nedir.json", id: "kandil_geceleri_nedir", title: "Kandil Geceleri Nedir?", category: "daily_practice", summary: "Kandil geceleri, manevi yoğunluğu yüksek geceler olarak anılır; dua, tövbe ve zikirle değerlendirmek amaçlanır.", keywords: ["kandil geceleri nedir", "kandil geceleri", "gece ibadetleri nelerdir"], aliases: ["kandil geceleri nedir", "kandil geceleri"], base: "kandil" },
  { file: "gece_ibadetleri.json", id: "gece_ibadetleri", title: "Gece İbadetleri", category: "daily_practice", summary: "Gece ibadetleri, dua, zikir, Kur'an okuma ve teheccüd gibi pratikleri içerir.", keywords: ["gece ibadetleri", "gece ibadetleri nelerdir"], aliases: ["gece ibadetleri nelerdir"], base: "gece" },
  { file: "mirac_kandili.json", id: "mirac_kandili_nedir", title: "Miraç Kandili Nedir?", category: "daily_practice", summary: "Miraç Kandili, Hz. Peygamber'in Miraç hadisesini hatırlatan manevi bir gecedir.", keywords: ["mirac kandili", "miraç kandili", "isra ve mirac", "isra mirac gecesi"], aliases: ["mirac kandili", "miraç kandili", "isra ve mirac", "isra mirac gecesi"], base: "mirac" },
  { file: "cenaze_namazi.json", id: "cenaze_namazi", title: "Cenaze Namazı", category: "worship_practice", summary: "Cenaze namazı, vefat eden Müslüman için kılınan kısa ve dua ağırlıklı bir ibadettir.", keywords: ["cenaze namazı", "cenaze namazı nasıl kılınır"], aliases: ["cenaze namazı nedir", "cenaze namazı nasıl kılınır"], base: "cenaze" },
  { file: "sahur_nedir.json", id: "sahur_nedir", title: "Sahur Nedir?", category: "worship_practice", summary: "Sahur, oruç öncesi yeme içme ve imsaka hazırlanma zamanıdır.", keywords: ["sahur nedir", "sahur şart mı", "sahur"], aliases: ["sahur nedir", "sahur şart mı"], base: "sahur" },
  { file: "iddet_nedir.json", id: "iddet_nedir", title: "İddet Nedir?", category: "daily_practice", summary: "İddet, boşanma veya vefat sonrası bekleme süresidir.", keywords: ["iddet nedir", "iddet"], aliases: ["iddet nedir"], base: "iddet" },
  { file: "helal_kazanc_nedir.json", id: "helal_kazanc_nedir", title: "Helal Kazanç Nedir?", category: "daily_practice", summary: "Helal kazanç, meşru yoldan ve dürüst emekle elde edilen kazançtır.", keywords: ["helal kazanç", "helal kazanc"], aliases: ["helal kazanç nedir"], base: "helalKazanc" },
];

function buildGenericSpec(fileName) {
  const stem = fileBase(fileName);
  return {
    file: fileName,
    id: stem,
    title: titleize(stem),
    category: "daily_practice",
    summary: `${titleize(stem)} konusu için kısa ve sade bir ilmihal özeti.`,
    keywords: [stem.replace(/_/g, " ")],
    aliases: [stem.replace(/_/g, " ")],
    base: "gece",
  };
}

function main() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.warn(`Backup directory not found: ${BACKUP_DIR}`);
  }

  const specByFile = new Map(SPECS.map((spec) => [spec.file, spec]));
  const files = unique([
    ...fs.readdirSync(DATA_DIR).filter((name) => name.endsWith(".json")),
    ...SPECS.map((spec) => spec.file),
  ]).sort((a, b) => a.localeCompare(b, "tr"));
  const indexEntries = [];
  const seenAliases = new Set();

  for (const fileName of files) {
    const spec = specByFile.get(fileName) || buildGenericSpec(fileName);
    const generated = makeEntry(spec);
    generated.index.aliases = generated.index.aliases.filter((alias) => {
      const normalized = normalizeForKey(alias);
      if (!normalized || seenAliases.has(normalized)) return false;
      seenAliases.add(normalized);
      return true;
    });
    const filePath = path.join(DATA_DIR, fileName);
    writeJson(filePath, generated.source);
    indexEntries.push(generated.index);
  }

  indexEntries.sort((a, b) => String(a.id).localeCompare(String(b.id), "tr"));
  writeJson(INDEX_PATH, indexEntries);

  console.log(`Rewrote ${files.length} ilmihal source files.`);
  console.log(`Rebuilt ${path.relative(PROJECT_ROOT, INDEX_PATH)} with ${indexEntries.length} entries.`);
}

main();
