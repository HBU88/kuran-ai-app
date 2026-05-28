#!/usr/bin/env node
/**
 * Knowledge Base Expander
 * Creates missing KB entries using the validated missing-questions.json list.
 *
 * Strategy:
 *  1. Load missing-questions.json (produced by knowledge-base-validator.js)
 *  2. For each missing topic, use a static content library (no API cost)
 *  3. Write JSON files to server/data/ilmihal/
 *
 * Run after knowledge-base-validator.js
 */

const fs   = require('fs');
const path = require('path');

const KB_DIR         = path.join(__dirname, 'data', 'ilmihal');
const MISSING_FILE   = path.join(__dirname, 'test_results', 'missing-questions.json');

// ──────────────────────────────────────────────────────────────────────────────
// STATIC CONTENT LIBRARY
// One object per missing topic id → ready-to-write KB entry
// ──────────────────────────────────────────────────────────────────────────────
const CONTENT_LIBRARY = {

  // ── NAMAZ ──────────────────────────────────────────────────────────────────
  namaz_nedir: {
    id: 'namaz_nedir',
    title: 'Namaz Nedir?',
    category: 'worship_practice',
    summary: 'Namaz, İslam\'ın beş şartından biri olup günde beş vakit kılınan zorunlu ibadettir.',
    keywords: ['namaz nedir', 'namaz ne demek', 'namaz hakkında', 'namaz tanımı', 'beş vakit namaz', 'salat nedir'],
    manual_semantic_descriptions: [
      'Namaz İslam\'ın beş temel ibadetinden biridir',
      'Müslümanların günde beş kez yaptığı zorunlu ibadet',
      'Namaz tanımı ve açıklaması',
      'Namaz ne demek sorusunun cevabı',
      'Salat İslam\'da farz bir ibadettir'
    ],
    step_by_step: [
      'Namaz, İslam\'ın beş şartından ikincisidir.',
      'Günde beş vakit kılınması her müslümana farzdır (sabah, öğle, ikindi, akşam, yatsı).',
      'Allah\'ın huzurunda O\'na yönelik yapılan söz ve eylemlerden oluşan ibadet bütünüdür.',
      'Kıyam (ayakta durmak), kıraat (Kur\'an okumak), rükû ve secde içerir.',
      'Namaz öncesinde abdest alınması şarttır.'
    ],
    farzlar: ['Beş vakti vaktinde kılmak', 'Abdestli olmak', 'Kıbleye yönelmek', 'Avret yerini örtmek'],
    vacipler: [],
    sunnetler: ['Sünnet rekâtları kılmak', 'Cemaatle kılmak', 'Ezanı beklemek'],
    attention_points: [
      'Namaz İslam\'ın direğidir; terk etmek büyük günahtır.',
      'Vakit çıkmadan kılmaya özen gösterilmelidir.',
      'Çocuklara 7 yaşından itibaren öğretilmesi tavsiye edilir.'
    ],
    common_mistakes: [
      'Aceleyle kılmak, secde ve rükûyu tam yapmamak.',
      'Niyet etmeyi unutmak.',
      'Abdesti olmadan namaza durmak.'
    ],
    related_questions: ['Namaz nasıl kılınır?', 'Namaz kimlere farzdır?', 'Namazın farzları nelerdir?', 'Namaz kaç rekattır?'],
    source_notes: ['Diyanet İşleri Başkanlığı ve TDV İslam Ansiklopedisi esas alınmıştır.']
  },

  namaz_kimlere_farzdir: {
    id: 'namaz_kimlere_farzdir',
    title: 'Namaz Kimlere Farzdır?',
    category: 'worship_practice',
    summary: 'Namaz; akıl sağlığı yerinde olan, ergenlik çağına ulaşmış her Müslümana farzdır.',
    keywords: ['namaz kimlere farz', 'namaz zorunlu', 'namaza muhatap', 'namaz farziyeti', 'namaz kılmak zorunda mıyım'],
    step_by_step: [
      'Müslüman olmak: Namaz yalnızca Müslümanlara farzdır.',
      'Akıl sağlığı: Akıl hastalarına farz değildir.',
      'Ergenlik: Çocuklara farz değildir; ancak 7 yaşından itibaren alıştırılır.',
      'Hayız ve nifas: Bu hallerdeki kadınlar namaz kılmaz, kaza da etmez.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Çocuklara 10 yaşına kadar tatlılıkla alıştırılması sünnettir.'],
    common_mistakes: ['Çocukların namaz kılmamasını hoş görmek.'],
    related_questions: ['Namaz nedir?', 'Namaz nasıl kılınır?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  namaz_niyeti: {
    id: 'namaz_niyeti',
    title: 'Namaz Niyeti Nasıl Yapılır?',
    category: 'worship_practice',
    summary: 'Namaz niyeti kalple yapılır; dil ile söylemek mendup (müstehap)tur.',
    keywords: ['namaz niyeti', 'niyet namaz', 'namaz için niyet', 'namaz niyeti nasıl', 'niyet sözlü mü'],
    step_by_step: [
      'Kalple niyet etmek farzdır; hangi namazı kıldığını bilmek yeterlidir.',
      'Dil ile söylemek (örn. "Öğle namazı kılmaya niyet ettim") müstehabtır.',
      'Namaza başlarken "Allahu Ekber" tekbirini almadan hemen önce yapılır.',
      'Namaz başladıktan sonra niyet değiştirilemez.'
    ],
    farzlar: ['Kalben niyet etmek'],
    vacipler: [],
    sunnetler: ['Dil ile de ifade etmek'],
    attention_points: ['Niyet kalbin işidir; zorla ezberletilmiş söz yeterli değildir.'],
    common_mistakes: ['Niyeti yüksek sesle bağırmak.', 'Niyeti unuttuğunu sanıp namazı bozmak.'],
    related_questions: ['Namaz nasıl kılınır?', 'Niyet nasıl yapılır?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  namaz_vakitleri: {
    id: 'namaz_vakitleri',
    title: 'Beş Vakit Namaz Vakitleri',
    category: 'worship_practice',
    summary: 'Beş vakit namazın vakitleri ve başlangıç-bitiş süreleri.',
    keywords: ['namaz vakitleri', 'beş vakit', 'namaz saatleri', 'imsak öğle ikindi akşam yatsı', 'namaz zamanları'],
    step_by_step: [
      'Sabah (Fecr): Fecr-i sadıktan güneş doğana kadar.',
      'Öğle (Zuhr): Güneşin tepe noktasından geçmesinden ikindi vaktine kadar.',
      'İkindi (Asr): Öğleden sonra gölge uzunluğunun belirli miktara ulaşmasından güneş batana kadar.',
      'Akşam (Mağrib): Güneş battıktan sonra ufuktaki kızıllık/beyazlık gidinceye kadar.',
      'Yatsı (İşa): Akşam vaktinin çıkmasından fecre (imsağa) kadar.'
    ],
    farzlar: ['Her namazı kendi vaktinde kılmak'],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Vakit çıkmadan kılmak farzdır.', 'Ezanı takip ederek vakitleri öğrenmek kolaylaştırır.'],
    common_mistakes: ['İkindi namazını öğleyle karıştırmak.', 'Yatsıyı geç vakitte kılmayı ihmal etmek.'],
    related_questions: ['Namaz nedir?', 'Namaz kaç rekattır?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  nafile_namaz_nedir: {
    id: 'nafile_namaz_nedir',
    title: 'Nafile Namaz Nedir?',
    category: 'worship_practice',
    summary: 'Farz ve vacip dışında kılınan, kişinin kendiliğinden kıldığı ek namazlardır.',
    keywords: ['nafile namaz', 'nafile ibadet', 'nafile ne demek', 'gönüllü namaz', 'sünnet nafile fark'],
    step_by_step: [
      'Nafile, farz ve vacibin dışında kılınan gönüllü namazlardır.',
      'Teheccüt, kuşluk (duha), Evvabin ve nafile namaz örnekleridir.',
      'Kılınması sevap, terk edilmesi günah değildir (sünnetin aksine).',
      'Farzların eksiğini tamamlamaya yardımcı olur.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Teheccüt namazı', 'Kuşluk namazı', 'Evvâbîn namazı'],
    attention_points: ['Nafile ibadetlerde aşırıya kaçmamak gerekir.'],
    common_mistakes: ['Nafile ile sünneti karıştırmak.'],
    related_questions: ['Gece ibadetleri nedir?', 'Teheccüt namazı nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  teravih_namazi: {
    id: 'teravih_namazi',
    title: 'Teravih Namazı',
    category: 'worship_practice',
    summary: 'Teravih, Ramazan ayında yatsı namazından sonra cemaatle kılınan sünnet namazdır.',
    keywords: ['teravih namazı', 'teravih nedir', 'teravih kaç rekat', 'ramazan namazı', 'kıyam-ı ramazan'],
    step_by_step: [
      'Teravih, Ramazan ayına özel bir sünnettir.',
      'Yatsı namazının ardından kılınır.',
      'Hanefîlere göre 20, bazı görüşlere göre 8 rekâttır.',
      'Her 4 rekâtta bir dinlenilir (terviha denir).',
      'Vitir namazından önce kılınır.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Cemaatle kılmak', '20 rekât kılmak (Hanefî görüşü)'],
    attention_points: ['Tek başına da kılınabilir.'],
    common_mistakes: ['Teravihi vitirden sonra kılmak.'],
    related_questions: ['Ramazan nedir?', 'Vitir namazı nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  // ── TAHARET ────────────────────────────────────────────────────────────────
  abdest_bozanlar: {
    id: 'abdest_bozanlar',
    title: 'Abdesti Bozan Şeyler',
    category: 'worship_practice',
    summary: 'Abdesti bozan başlıca durumlar: bedenin arka veya ön tarafından bir şey çıkması, bayılma/derin uyku ve kan akması.',
    keywords: ['abdesti bozan', 'abdest bozulur', 'abdest gider', 'abdest bozan şeyler', 'abdesti ne bozar'],
    step_by_step: [
      'Ön veya arka avret bölgesinden bir şey çıkması (idrar, dışkı, gaz, meni vs.) abdesti bozar.',
      'Uyku (uzanarak, yaslanarak veya oturarak derin uyku) abdesti bozar.',
      'Bayılmak, sarhoş olmak, cinnet geçirmek abdesti bozar.',
      'Kan, irin gibi şeylerin aktığı yer dışına çıkması (Hanefî mezhebine göre) abdesti bozar.',
      'Ağız dolusu kusmak abdesti bozar.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Şüphe durumunda abdest tazelemek daha güvenlidir.'],
    common_mistakes: ['Küçük bir kanın abdesti bozduğunu zannedip gereksiz abdest almak.'],
    related_questions: ['Abdest nasıl alınır?', 'Teyemmüm nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  // ── ORUÇ ──────────────────────────────────────────────────────────────────
  oruc_kimlere_farzdir: {
    id: 'oruc_kimlere_farzdir',
    title: 'Oruç Kimlere Farzdır?',
    category: 'worship_practice',
    summary: 'Oruç; Müslüman, akıllı ve ergenlik çağına gelmiş kişilere farzdır.',
    keywords: ['oruç kimlere farz', 'oruç zorunlu', 'oruç farzdır', 'oruç tutma zorunluluğu'],
    step_by_step: [
      'Müslüman olmak şarttır.',
      'Akıl sağlığı yerinde olmak şarttır.',
      'Ergenlik çağına (bülûğa) ulaşmış olmak şarttır.',
      'Oruç tutmaya fiziksel güç yetmesi şarttır (ciddi hastalık mazerette).',
      'Kadın için hayız ve nifas dönemlerinde oruç tutulmaz, sonradan kaza edilir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Sürekli hastalık ve yaşlılıkta fidye ödenebilir.'],
    common_mistakes: ['Çocukların oruç tutmak zorunda olduğunu düşünmek.'],
    related_questions: ['Oruç nedir?', 'Oruç fidyesi nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  oruc_kefaret: {
    id: 'oruc_kefaret',
    title: 'Oruç Kefareti',
    category: 'worship_practice',
    summary: 'Ramazan orucunu bilerek cinsel ilişki ile bozan kişiye ağır kefaret gerekir.',
    keywords: ['oruç kefareti', 'kefaret orucu', 'oruç kefareti nedir', 'kasten oruç bozmak'],
    step_by_step: [
      'Ramazan orucunu bilerek ve kasten cinsel ilişki ile bozmak kefareti gerektirir.',
      'Sırasıyla: 1) Köle azat etmek (günümüzde yok), 2) Art arda 60 gün oruç tutmak, 3) 60 fakiri doyurmak.',
      'Bir gün oruç kefaret için hem kaza hem de kefaret gerekir.',
      'Kefaret yalnızca cinsel ilişki sebebiyle gerekir; yemek-içmek için yalnızca kaza yeterlidir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Kefareti art arda yerine getirmek gerekir; aralık vermek saydırmaz.'],
    common_mistakes: ['Her oruç bozma durumunda kefaret gerektiğini zannetmek.'],
    related_questions: ['Oruç kazası nedir?', 'Kefaret nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  oruc_yolculukta: {
    id: 'oruc_yolculukta',
    title: 'Yolculukta Oruç',
    category: 'worship_practice',
    summary: 'Yolculukta oruç tutmamak ruhsatı vardır; tutulmazsa sonradan kaza edilir.',
    keywords: ['yolculukta oruç', 'seferde oruç', 'yolcunun orucu', 'seyahatte oruç'],
    step_by_step: [
      'Yolculuk (sefer) durumundaki kişi oruç tutmamayı seçebilir.',
      'Tutmadığı günleri Ramazan\'dan sonra kaza etmesi gerekir.',
      'Güç yetiyorsa tutmak daha faziletlidir.',
      'Meşakkatli yolculuklarda tutmamak daha uygundur.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Kaza daha sonra tutulmalıdır.'],
    common_mistakes: ['Yolculukta tutmamayı günah saymak.'],
    related_questions: ['Oruç kimlere farzdır?', 'Oruç kazası nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  oruc_ve_hastalar: {
    id: 'oruc_ve_hastalar',
    title: 'Hastalıkta Oruç',
    category: 'worship_practice',
    summary: 'Oruç hastalığı artıracak veya iyileşmeyi geciktirecekse tutmamak ruhsatı vardır.',
    keywords: ['hastada oruç', 'hastalıkta oruç', 'hasta oruç tutabilir mi', 'hastalık mazeret oruç'],
    step_by_step: [
      'Oruç hastalığa zarar veriyorsa tutmamak caizdir.',
      'Kısa süreli hastalıkta: Kaza edilir.',
      'Sürekli hastalıkta (iyileşme umudu yok): Fidye ödenir.',
      'İlaç almak gereken durum: Oruç bozulabilir, kaza gerekir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Doktor görüşü alınması tavsiye edilir.'],
    common_mistakes: ['Hafif başağrısıyla orucu bozmak.'],
    related_questions: ['Oruç kimlere farzdır?', 'Oruç fidyesi nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  oruc_spor: {
    id: 'oruc_spor',
    title: 'Oruçta Spor Yapılabilir mi?',
    category: 'worship_practice',
    summary: 'Oruçta hafif spor yapılabilir; ağır egzersiz orucu bozmaz ama sağlığa zararlı olabilir.',
    keywords: ['oruçta spor', 'oruçluyken spor', 'oruç egzersiz', 'ramazanda spor'],
    step_by_step: [
      'Spor yapmak orucu bozmaz (vücut dışından bir şey girmediği sürece).',
      'Yoğun terleme, ağır egzersiz sağlığı bozabilir.',
      'Hafif yürüyüş, esneme egzersizleri uygundur.',
      'İftara yakın yapılması daha iyidir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Bayılacak hale gelmek sağlığa zarar verdiğinden kaçınılmalıdır.'],
    common_mistakes: ['Terlemenin orucu bozduğunu sanmak.'],
    related_questions: ['Orucu bozan şeyler nedir?', 'Orucu bozmayan şeyler nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  ramazan_nedir: {
    id: 'ramazan_nedir',
    title: 'Ramazan Ayı',
    category: 'worship_practice',
    summary: 'Ramazan, Hicri takvimin 9. ayı olup oruç tutmanın farz olduğu mübarek aydır.',
    keywords: ['ramazan nedir', 'ramazan ayı', 'ramazan orucu', 'oruç ayı', 'şehr-i ramazan'],
    step_by_step: [
      'Ramazan, Hicri takvimin 9. ayıdır.',
      'Kur\'an bu ayda indirilmeye başlanmıştır.',
      'Bu ayda oruç tutmak her Müslümana farzdır.',
      'Kadir Gecesi bu ayın son 10 gününde aranır.',
      'Teravih namazı bu ayda kılınır.'
    ],
    farzlar: ['Oruç tutmak'],
    vacipler: [],
    sunnetler: ['Teravih kılmak', 'Kur\'an okumak', 'Sadaka vermek'],
    attention_points: ['Ramazan manevi arınma ve ibadeti yoğunlaştırma fırsatıdır.'],
    common_mistakes: ['Yalnızca açlık-susuzluk olarak görmek; manevi boyutunu ihmal etmek.'],
    related_questions: ['Oruç nedir?', 'Teravih namazı nedir?', 'Kadir Gecesi nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  // ── ZEKAT ────────────────────────────────────────────────────────────────
  zekat_kimlere_farzdir: {
    id: 'zekat_kimlere_farzdir',
    title: 'Zekat Kimlere Farzdır?',
    category: 'worship_practice',
    summary: 'Zekat; Müslüman, hür, akıllı, ergen ve nisab miktarı mala sahip olan kişiye farzdır.',
    keywords: ['zekat kimlere farz', 'zekat zorunlu', 'zekat farzdır', 'zekat mükellefi'],
    step_by_step: [
      'Müslüman olmak şarttır.',
      'Aklı yerinde ve ergen olmak şarttır.',
      'Nisab miktarında (belirli değerin üzerinde) mala sahip olmak şarttır.',
      'Bu malın üzerinden bir hicri yıl (havl) geçmiş olması şarttır.',
      'Borçlar düşüldükten sonra nisabın üzerinde mal kalması gerekir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Nisab hesabı altın veya gümüş üzerinden yapılır.'],
    common_mistakes: ['Tüm borçlular için zekat gerekmediğini bilmemek.'],
    related_questions: ['Zekat nedir?', 'Zekat nisabı nedir?', 'Zekat hesaplama nasıl?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  zekat_hesaplama: {
    id: 'zekat_hesaplama',
    title: 'Zekat Hesaplama',
    category: 'worship_practice',
    summary: 'Zekat oranı genellikle %2.5\'tur; altın, gümüş, nakit, ticaret malları için uygulanır.',
    keywords: ['zekat hesaplama', 'zekat miktarı', 'zekat oranı', 'zekat nasıl hesaplanır', 'yüzde kaç zekat'],
    step_by_step: [
      'Toplam varlıklarınızı belirleyin (nakit, altın, gümüş, ticaret malı).',
      'Kısa vadeli borçları çıkarın.',
      'Kalan miktar nisabın üzerindeyse ve üzerinden 1 yıl geçtiyse zekat gerekir.',
      'Zekat oranı %2.5\'tur (40\'ta 1).',
      'Ürün zekatı (öşür) ise %5 veya %10 olabilir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Altın nisabı: 80.18 gr altın veya eşdeğeri değerdir.'],
    common_mistakes: ['Tüm mal varlığı üzerinden değil, zekata tabi kısım üzerinden hesaplamamak.'],
    related_questions: ['Zekat nedir?', 'Zekat nisabı nedir?', 'Zekat kime verilir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  zekat_ve_sadaka_farki: {
    id: 'zekat_ve_sadaka_farki',
    title: 'Zekat ve Sadaka Farkı',
    category: 'worship_practice',
    summary: 'Zekat farz, belirli oran ve şartlara bağlıdır. Sadaka ise gönüllü olup herhangi bir miktarda verilebilir.',
    keywords: ['zekat sadaka farkı', 'zekat ve sadaka', 'zekat mı sadaka mı', 'gönüllü bağış'],
    step_by_step: [
      'Zekat: Şartları olana farzdır; belirli oranı (% 2.5) belirli alıcılara verilir.',
      'Sadaka: Herkese her zaman gönüllü olarak verilebilir; miktar ve alıcı serbest.',
      'Fitre: Ramazan sonunda farz olan özel bir zekat türüdür.',
      'Sadaka-ı cariye: Devam eden fayda sağlayan gönüllü bağıştır (köprü, okul, su kuyusu gibi).'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Sadaka vermek'],
    attention_points: ['Zekat niyeti sadakadan ayrı tutulmalıdır.'],
    common_mistakes: ['Sadakayı zekat niyetiyle vermek veya tersini yapmak.'],
    related_questions: ['Zekat nedir?', 'Sadaka nedir?', 'Fitre nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  // ── HAC ──────────────────────────────────────────────────────────────────
  ihram_nedir: {
    id: 'ihram_nedir',
    title: 'İhram Nedir?',
    category: 'worship_practice',
    summary: 'İhram, hac ve umre için girilmesi gereken, bazı davranışları yasaklayan kutsal haldir.',
    keywords: ['ihram nedir', 'ihram ne demek', 'ihrama girmek', 'hacda ihram', 'ihram kıyafeti'],
    step_by_step: [
      'İhram, hac veya umreye başlamak için yapılan özel bir niyetle girilir.',
      'Erkekler dikişsiz iki beyaz bez sarar; kadınlar normal tesettür giyar.',
      'İhramda iken: koku, tıraş, cinsel ilişki, av yapmak, dikişli elbise giymek (erkek) yasaktır.',
      'Talbiye (Lebbeyk Allahümme lebbeyk) duasıyla ihlal devam eder.',
      'Hac/umre bitince ihramdan çıkılır.'
    ],
    farzlar: ['Niyet', 'Talbiye'],
    vacipler: [],
    sunnetler: ['Gusül almak', 'Koku sürmek (ihrama girmeden önce)'],
    attention_points: ['İhramı bozmak kefaret gerektirir.'],
    common_mistakes: ['İhramlıyken koku sürmeye devam etmek.'],
    related_questions: ['Hac nedir?', 'Umre nedir?', 'Tavaf nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  tavaf_nedir: {
    id: 'tavaf_nedir',
    title: 'Tavaf Nedir?',
    category: 'worship_practice',
    summary: 'Tavaf, Kâbe\'nin etrafında sola alarak 7 kez dönmek demektir; hac ve umrenin temel menasiklerindendir.',
    keywords: ['tavaf nedir', 'tavaf ne demek', 'kabe tavafı', 'kabe etrafı dönmek'],
    step_by_step: [
      'Kâbe\'nin sol tarafını alarak başlanır (Hacerü\'l-Esved hizasından).',
      '7 tur arka arkaya yapılır.',
      'Tavaf bitince iki rekât namaz kılınır (Makam-ı İbrahim civarında).',
      'Abdestli olmak gerekir.',
      'Tavaf sırasında zikir ve dua yapılır.'
    ],
    farzlar: ['Abdestli olmak', '7 tur tamamlamak'],
    vacipler: ['Makam-ı İbrahim\'de namaz kılmak'],
    sunnetler: ['İlk 3 turda remel (hızlı yürümek)'],
    attention_points: ['Tavafı bölmek mümkündür (abdest için).'],
    common_mistakes: ['Hacerü\'l-Esved\'i zorunlu öpmek sanmak; kalabalıkta işaret de yeterlidir.'],
    related_questions: ['Hac nedir?', 'Umre nedir?', "Sa'y nedir?"],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  say_nedir: {
    id: 'say_nedir',
    title: "Sa'y Nedir?",
    category: 'worship_practice',
    summary: "Sa'y, Safa ile Merve tepeleri arasında 7 kez gidip gelmektir; hac ve umrenin vaciplerindendir.",
    keywords: ["say nedir", "sa'y nedir", "safa merve say", "safa merve arasında koşmak"],
    step_by_step: [
      "Safa tepesinden başlanır, Merve tepesiyle bitirilir.",
      "7 defa gidip gelinir (Safa'dan Merve'ye gitmek 1 sayılır).",
      "Tavafın ardından yapılır.",
      "Abdest şart değildir (vacip değil).",
      "Hz. Hacer'in su arayışını anmak amacıyla yapılır."
    ],
    farzlar: [],
    vacipler: ["Sa'y'ı tamamlamak"],
    sunnetler: ["Safa ve Merve'de dua etmek"],
    attention_points: ["Yeşil ışıklar arasında erkekler koşar."],
    common_mistakes: ["Sa'y'ı Tavaf'tan önce yapmak."],
    related_questions: ['Tavaf nedir?', 'Hac nedir?', 'Umre nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  // ── DUA ──────────────────────────────────────────────────────────────────
  dua_kabul_olur_mu: {
    id: 'dua_kabul_olur_mu',
    title: 'Dua Kabul Olur mu?',
    category: 'worship_practice',
    summary: 'Allah duaları işitir; kabul hemen, ertelenmiş veya ahirette farklı biçimde gerçekleşebilir.',
    keywords: ['dua kabul', 'dua kabulü', 'dua makbul', 'dualar kabul olur mu', 'dua neden kabul olmaz'],
    step_by_step: [
      'Allah\'ın her duayı işittiği Kur\'an\'da bildirilir (Bakara 186).',
      'Kabul üç şekilde olabilir: Aynen verilir, daha hayırlısı verilir veya ahirette karşılık verilir.',
      'Haramlı lokma, günahta ısrar duanın kabulünü zorlaştırır.',
      'Haram olmayan konularda tam bir güvenle dua edilmelidir.',
      'Sabır ve süreklilik önemlidir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Temiz ortamda, abdestli, kıbleye yönelik dua etmek'],
    attention_points: ['Haram şeyler için dua etmemek gerekir.'],
    common_mistakes: ['Kabul olmadı diye duayı bırakmak.'],
    related_questions: ['Dua nedir?', 'Dua nasıl edilir?', 'Duanın kabul vakitleri nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  dua_vakitleri: {
    id: 'dua_vakitleri',
    title: 'Duanın Kabul Vakitleri',
    category: 'worship_practice',
    summary: 'Duanın daha çok makbul olduğu özel vakitler vardır: Cuma günü, seher vakti, yağmur yağarken vb.',
    keywords: ['dua vakti', 'kabul dua vakti', 'ne zaman dua edilmeli', 'dua kabul vakitleri'],
    step_by_step: [
      'Cuma günü bir saat vardır ki dualar kabul olur.',
      'Seher vakti (tan ağarmadan önce) özellikle makbuldür.',
      'Farz namazların ardından.',
      'Yağmur yağarken.',
      'Ezan ile kamet arasında.',
      'Hasta ziyaretinde, seferden dönüşte ve Kâbe\'yi görünce.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Bu vakitleri değerlendirmek'],
    attention_points: ['Her an dua etmek de mümkündür ve teşvik edilir.'],
    common_mistakes: ['Yalnızca belirli vakitlerde dua etmek gerektiğini sanmak.'],
    related_questions: ['Dua nedir?', 'Dua nasıl edilir?', 'Dua kabul olur mu?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  tesbih_nedir: {
    id: 'tesbih_nedir',
    title: 'Tesbih Nedir?',
    category: 'worship_practice',
    summary: 'Tesbih, "Sübhanallah" diyerek Allah\'ı her türlü eksiklikten tenzih etmektir.',
    keywords: ['tesbih nedir', 'tesbih çekmek', 'zikir tesbih', 'sübhanallah', 'tesbih taneleri'],
    step_by_step: [
      '"Sübhanallah" Allah\'ı eksikliklerden tenzih etmek demektir.',
      '"Elhamdülillah" hamd, "Allahu Ekber" tekbirdir; bunlar tesbihin tamamlayıcılarıdır.',
      'Namazın ardından 33\'er kez söylenmesi sünnet olan zikir formülleri vardır.',
      'Tesbih boncukları bu sayımı kolaylaştırmak için kullanılır.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Sabah-akşam tesbihat', 'Namazdan sonra 33\'er zikir'],
    attention_points: ['Anlamını düşünerek yapmak kalbi daha çok etkiler.'],
    common_mistakes: ['Tesbih boncuğunu zorunlu saymak.'],
    related_questions: ['Zikir nedir?', 'Dua nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  zikir_nedir: {
    id: 'zikir_nedir',
    title: 'Zikir Nedir?',
    category: 'worship_practice',
    summary: 'Zikir, Allah\'ı dil, kalp veya fiil ile anmaktır; en faziletli ibadetlerden sayılır.',
    keywords: ["zikir nedir", "zikir ne demek", "Allah'ı anmak", "zikrullah", "zikir ibadet"],
    step_by_step: [
      "Zikir; dil ile (sübhanallah, elhamdülillah, Allahu Ekber, lailaheillallah demek), kalp ile (Allah'ı düşünmek) veya fiil ile (ibadet etmek) olabilir.",
      "Kur'an zikrin en faziletlisi olduğunu bildirir.",
      "Sabah-akşam zikirler sünnettir.",
      "Cemaatle yüksek sesle zikir meselesin ihtilaf vardır; sessiz zikir daha güvenlidir."
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Sabah-akşam zikir', 'Namazdan sonra zikir'],
    attention_points: ['Zikrin kalbe tesir etmesi için huşu gerekir.'],
    common_mistakes: ['Zikirde sayıyı ezberleyip anlamı ihmal etmek.'],
    related_questions: ['Tesbih nedir?', 'Dua nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  besmele_nedir: {
    id: 'besmele_nedir',
    title: 'Besmele Nedir?',
    category: 'worship_practice',
    summary: '"Bismillahirrahmanirrahim" cümlesidir; Allah\'ın adıyla başlamayı ifade eder.',
    keywords: ['besmele nedir', 'besmele çekmek', 'bismillah', 'bismillahirrahmanirrahim'],
    step_by_step: [
      '"Bismillahirrahmanirrahim": "Rahman ve Rahim olan Allah\'ın adıyla" demektir.',
      'Her hayırlı işe besmeleyle başlamak sünnettir.',
      'Yemekte, okumada, konuşmaya başlarken söylenir.',
      'Namazda Fatiha\'dan önce okunur (Hanefîlere göre gizlice).',
      'Kur\'an\'ın her suresi (Tevbe suresi hariç) besmeleyle başlar.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Her işe besmeleyle başlamak'],
    attention_points: ['Haram işlere besmele çekilmez.'],
    common_mistakes: ['Yalnızca yemekte söylenmesi gerektiğini zannetmek.'],
    related_questions: ['Dua nedir?', 'Zikir nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  // ── İTİKAT / GENEL ────────────────────────────────────────────────────────
  kuran_nedir: {
    id: 'kuran_nedir',
    title: "Kur'an Nedir?",
    category: 'religious_knowledge',
    summary: "Kur'an, Hz. Muhammed'e Cebrail aracılığıyla vahyedilen ve ibadet amacıyla okunan İslam'ın kutsal kitabıdır.",
    keywords: ["kur'an nedir", 'kuran nedir', 'kuran ne demek', 'islam kutsal kitabı', 'mushaf'],
    step_by_step: [
      "Kur'an, Allah'ın Hz. Muhammed'e Cebrail vasıtasıyla vahyettiği kelamdır.",
      "23 yılda aşamalı olarak indirilmiştir (Hira mağarasından başlayarak).",
      "114 sure ve yaklaşık 6.236 ayetten oluşur.",
      "Arapça olup okumak başlı başına ibadet sayılır.",
      "Kıyamete kadar hiç değişmeden korunacağı Allah tarafından güvence altına alınmıştır."
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ["Kur'an okumak", "Kur'an'ı hatmetmek"],
    attention_points: ["Kur'an'a abdestsiz elle dokunmak caiz değildir."],
    common_mistakes: ["Yalnızca Arapça okunması gerektiğini bilip anlamını ihmal etmek."],
    related_questions: ["Sure nedir?", "Ayet nedir?", "Hadis nedir?"],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  iman_nedir: {
    id: 'iman_nedir',
    title: 'İman Nedir?',
    category: 'religious_knowledge',
    summary: 'İman, Hz. Peygamberin bildirdiği İslam esaslarını kalben tasdik etmek ve dil ile ikrar etmektir.',
    keywords: ['iman nedir', 'iman ne demek', 'inanmak', 'itikad', 'iman esasları'],
    step_by_step: [
      'İman: Kalben tasdik + dil ile ikrar.',
      'İmanın şartları 6 tanedir: Allah, melekler, kitaplar, peygamberler, ahiret, kader.',
      'İmanın artıp azalabileceği konusunda mezhep görüşleri vardır.',
      'İman amelden ayrı kabul edilir (Ehl-i Sünnet görüşü).',
      'İmanın gitmesi için açık inkâr şarttır.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Şüphe ile iman bir arada olabilir; şüpheye karşı ilim ve dua tavsiye edilir.'],
    common_mistakes: ['Günah işleyince imanın gittiğini düşünmek.'],
    related_questions: ["İmanın şartları nedir?", "İslam'ın şartları nedir?", 'Tevhid nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  imanin_sartlari: {
    id: 'imanin_sartlari',
    title: 'İmanın Şartları (Âmentü)',
    category: 'religious_knowledge',
    summary: 'İmanın altı şartı: Allah\'a, meleklere, kitaplara, peygamberlere, ahirete ve kadere iman.',
    keywords: ['imanın şartları', 'iman şartları', 'iman esasları', 'âmentü', 'altı iman şartı'],
    step_by_step: [
      '1. Allah\'a iman: O\'nun varlığına, birliğine, sıfatlarına inanmak.',
      '2. Meleklere iman: Allah\'ın nuranî kullarına inanmak.',
      '3. Kitaplara iman: Tevrat, Zebur, İncil ve Kur\'an\'a inanmak.',
      '4. Peygamberlere iman: Hz. Adem\'den Hz. Muhammed\'e kadar.',
      '5. Ahirete iman: Ölüm, kabir, kıyamet, cennet ve cehenneme inanmak.',
      '6. Kadere iman: Her şeyin Allah\'ın bilgisi ve iradesiyle gerçekleştiğine inanmak.'
    ],
    farzlar: ['Bu altı şarta inanmak'],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Birini inkâr etmek imanı zedeler.'],
    common_mistakes: ['Kadere imanı kadercilikle (tembellikle) karıştırmak.'],
    related_questions: ['İman nedir?', "İslam'ın şartları nedir?"],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  islamin_sartlari: {
    id: 'islamin_sartlari',
    title: "İslam'ın Beş Şartı",
    category: 'religious_knowledge',
    summary: "İslam'ın beş şartı: Kelime-i Şehadet, Namaz, Oruç, Zekat ve Hac.",
    keywords: ["islamın şartları", "islam'ın şartları", 'beş şart', 'islam beş esas', 'islam sütunları'],
    step_by_step: [
      '1. Kelime-i Şehadet: "Lailaheillallah Muhammedürrasulullah" demek.',
      '2. Namaz: Günde beş vakit kılmak.',
      '3. Oruç: Ramazanda oruç tutmak.',
      '4. Zekat: Nisab miktarında mala sahipse zekat vermek.',
      '5. Hac: Güç yetenlerin ömürde bir kez hacca gitmesi.'
    ],
    farzlar: ['Bu beş şartı yerine getirmek'],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Bunlar imanın değil uygulamanın temel şartlarıdır.'],
    common_mistakes: ["Haccı unutarak İslam'ın dört şartı olduğunu sanmak."],
    related_questions: ['İmanın şartları nedir?', 'Namaz nedir?', 'Hac nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  tevhid_nedir: {
    id: 'tevhid_nedir',
    title: 'Tevhid Nedir?',
    category: 'religious_knowledge',
    summary: "Tevhid, Allah'ın bir ve tek olduğuna, eşi ve ortağı bulunmadığına inanmaktır; İslam'ın özüdür.",
    keywords: ["tevhid nedir", "tevhid ne demek", "Allah'ın birliği", 'monoteizm', 'la ilahe illallah'],
    step_by_step: [
      "Tevhid üç boyutludur: Ulûhiyet (yalnız Allah'a ibadet), Rubûbiyet (yalnız Allah'ın Rab olması), Sıfat (Allah'ın eşsiz sıfatları).",
      '"Lailaheillallah" tevhidin kelime özüdür.',
      'Tevhide aykırı davranış şirktir.',
      'İslam\'ın en temel ilkesidir.'
    ],
    farzlar: ['Tevhide inanmak'],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Tevhidi bozmaya yönelik pratiklerden kaçınmak gerekir.'],
    common_mistakes: ["Allah'tan başkasına dua etmeyi meşru saymak."],
    related_questions: ['İman nedir?', 'Şirk nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  sark_nedir: {
    id: 'sark_nedir',
    title: 'Şirk Nedir?',
    category: 'religious_knowledge',
    summary: "Şirk, Allah'a ortak koşmaktır; İslam'da en büyük günahtır.",
    keywords: ["şirk nedir", "şirk ne demek", "Allah'a ortak koşmak", 'küfür şirk', 'politeizm'],
    step_by_step: [
      "Şirk: Allah'a başka bir varlığı O'na has sıfat ve yetkide ortak saymaktır.",
      'Açık şirk: Puta tapmak, Allah\'tan başkasına ibadet etmek.',
      'Gizli şirk: Riya (gösteriş için ibadet), süm\'a (duyulsun diye ibadet).',
      'Şirk tevbesiz kalırsa affolunmayacak günah olarak bildirilmiştir (Nisa 4:48).',
      'Tövbe ile şirkten dönülür ve kurtuluş mümkündür.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: [],
    attention_points: ['Küçük şirke (riya) karşı da uyanık olmak gerekir.'],
    common_mistakes: ["Veli veya peygamberleri aracı olarak kullanmayı şirkle özdeşleştirmek – ihtilaf konusudur."],
    related_questions: ['Tevhid nedir?', 'İman nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  // ── AHLAK ────────────────────────────────────────────────────────────────
  tövbe_nedir: {
    id: 'tövbe_nedir',
    title: 'Tövbe Nedir?',
    category: 'ethics',
    summary: 'Tövbe, işlenen günahtan pişman olup Allah\'a dönmek ve bir daha yapmamaya azmetmektir.',
    keywords: ['tövbe nedir', 'tövbe ne demek', 'günahtan dönmek', 'pişmanlık', 'tövbekâr'],
    step_by_step: [
      'Pişmanlık duymak (geçmiş günaha üzülmek).',
      'Günahı bırakmak (anında terk etmek).',
      'Bir daha yapmamaya azmetmek.',
      'Kul hakkı varsa sahibiyle helâlleşmek veya iade etmek.',
      'Samimi tövbe Allah tarafından kabul edilir (Zümer 39:53).'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Hemen tövbe etmek', 'Günahın ardından iyilik yapmak'],
    attention_points: ['Tövbe ertelemek tehlikelidir; ölüm anında tövbe kabul olmaz.'],
    common_mistakes: ['Tövbe sonrası günahı tekrar işleyince umut kesmek.'],
    related_questions: ['Tövbe nasıl edilir?', 'Tövbenin şartları nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  sabir_nedir: {
    id: 'sabir_nedir',
    title: 'Sabır Nedir?',
    category: 'ethics',
    summary: 'Sabır, Allah\'ın rızası için sıkıntılara katlanmak, günahlara karşı durmak ve ibadetlerde devamlı olmaktır.',
    keywords: ['sabır nedir', 'sabır ne demek', 'sabırlı olmak', 'tahammül', 'sabredmek'],
    step_by_step: [
      'Musibetlere sabrı: Hastalık, kayıp gibi acıları Allah rızası için katlanmak.',
      'Günaha karşı sabrı: Nefsanî arzulara karşı durmak.',
      'İbadette sabrı: Zorlu zamanlarda ibadeti bırakmamak.',
      'Kur\'an\'da sabır 90\'dan fazla yerde geçer.',
      'Sabredenler için sınırsız ödül vaat edilmiştir (Zümer 39:10).'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Musibette "İnna lillahi ve inna ileyhi raciun" demek'],
    attention_points: ['Sabır teslimiyetçilik değil; aktif bir irade gösterisidir.'],
    common_mistakes: ['Sabır ile tembelliği karıştırmak.'],
    related_questions: ['Şükür nedir?', 'Tevekkül nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  sukur_nedir: {
    id: 'sukur_nedir',
    title: 'Şükür Nedir?',
    category: 'ethics',
    summary: 'Şükür, Allah\'ın nimetlerini kalben, dilen ve eylemle tanımak ve O\'na hamd etmektir.',
    keywords: ["şükür nedir", "şükretmek", "Allah'a şükür", 'minnet', 'hamd etmek'],
    step_by_step: [
      "Kalben şükür: Allah'ın nimetlerini O'ndan bilmek.",
      'Dil ile şükür: "Elhamdülillah" demek.',
      'Eylemle şükür: Nimeti Allah\'ın gösterdiği şekilde kullanmak.',
      'Kur\'an, şükredenlerin nimetinin artırılacağını bildirir (İbrahim 14:7).',
      'Namaz, dua ve sadaka şükrün pratik biçimleridir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Elhamdülillah demek', 'Şükür secdesi yapmak (nimet gelince)'],
    attention_points: ['Nankörlük (küfran-ı nimet) azabı getirir.'],
    common_mistakes: ['Yalnızca büyük nimetleri şükre değer görmek; küçük nimetleri ihmal etmek.'],
    related_questions: ['Sabır nedir?', 'Tevekkül nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  ihsan_nedir: {
    id: 'ihsan_nedir',
    title: 'İhsan Nedir?',
    category: 'ethics',
    summary: "İhsan, Allah'ı görür gibi ibadet etmek; O görse de görülmese de en güzel şekilde davranmaktır.",
    keywords: ['ihsan nedir', 'ihsan ne demek', 'güzel ibadet', 'en iyi ibadet', 'ihlasla ibadet'],
    step_by_step: [
      "Peygamberimiz ihsanı şöyle tarif etmiştir: 'Allah'ı görür gibi ibadet etmendir; sen O'nu görmesen de O seni görür.' (Cibril Hadisi)",
      "İhsan üç boyuttur: İbadette, insanlarla ilişkide ve tüm hayatında güzel davranmak.",
      'İmanın ve İslam\'ın en üst mertebesidir.',
      'İhsan sahibine muhsin denir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Her işte en güzeli yapmaya çalışmak'],
    attention_points: ['İhsan iç dünyayı dış görünüşten daha çok düzeltir.'],
    common_mistakes: ['İhsanı yalnızca namaz ve ibadetlerle sınırlamak.'],
    related_questions: ['Takva nedir?', 'Riya nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  takva_nedir: {
    id: 'takva_nedir',
    title: 'Takva Nedir?',
    category: 'ethics',
    summary: "Takva, Allah'ın azabından korkarak O'nun yasaklarından kaçınmak ve emirlerini yerine getirmektir.",
    keywords: ["takva nedir", "takva ne demek", "Allah'tan korkma", 'sakınmak', 'muttaki'],
    step_by_step: [
      "Takva; korku, saygı ve sevgiyle Allah'a bağlılıktır.",
      'Haram ve günahlardan kaçınmak temel göstergesidir.',
      'Kur\'an\'da en değerlinin takvaca üstün olan olduğu bildirilir (Hucurat 49:13).',
      'Takvayı artırmak için: oruç, gece namazı, Kur\'an okuma ve zikir tavsiye edilir.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Nafile ibadetler', 'Günahlardan kaçınmak'],
    attention_points: ['Takva bir sefere özgü değil; yaşam boyu süren bir hâldir.'],
    common_mistakes: ['Takvayı yalnızca dış görünüşle ölçmek.'],
    related_questions: ['İhsan nedir?', 'Sabır nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },

  tevekkul_nedir: {
    id: 'tevekkul_nedir',
    title: 'Tevekkül Nedir?',
    category: 'ethics',
    summary: "Tevekkül, gerekli tedbirleri aldıktan sonra sonucu Allah'a bırakmak ve O'na güvenmektir.",
    keywords: ["tevekkül nedir", "tevekkül ne demek", "Allah'a güvenmek", 'tevakül', 'teslim olmak'],
    step_by_step: [
      'Tedbir almak: Tevekkül tembelliğe kapı aralamaz.',
      "Dua ve çalışma: 'Deveni bağla, sonra tevekkül et.' (Hadis)",
      "Sonucu Allah'a bırakmak: Çalıştıktan sonra neticeyi O'ndan beklemek.",
      'Tevekkül kalpte olur; bedensel çaba yine sürer.'
    ],
    farzlar: [],
    vacipler: [],
    sunnetler: ['Tedbir alıp dua etmek'],
    attention_points: ['Tembelliği tevekkül saymak büyük yanlıştır.'],
    common_mistakes: ["'Allah halleder' deyip hiç çalışmamak."],
    related_questions: ['Sabır nedir?', 'Şükür nedir?'],
    source_notes: ['Diyanet ve TDV ilmihal üslubuyla hazırlanmıştır.']
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// ENGINE
// ──────────────────────────────────────────────────────────────────────────────
function loadMissingList() {
  if (!fs.existsSync(MISSING_FILE)) {
    console.error(`❌ Run knowledge-base-validator.js first to generate ${MISSING_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(MISSING_FILE, 'utf8')).missing;
}

function createEntry(topic) {
  const content = CONTENT_LIBRARY[topic.id];

  if (!content) {
    // Fallback: generate a minimal entry with metadata from validator
    return {
      id: topic.id,
      title: topic.title,
      category: 'worship_practice',
      summary: `${topic.title} hakkında özet bilgi.`,
      keywords: topic.keywords || [topic.id.replace(/_/g, ' ')],
      manual_semantic_descriptions: topic.keywords || [],
      step_by_step: [`${topic.title} konusunda Diyanet kaynakları incelenmelidir.`],
      farzlar: [],
      vacipler: [],
      sunnetler: [],
      attention_points: [],
      common_mistakes: [],
      related_questions: [],
      source_notes: ['Bu giriş otomatik oluşturulmuştur; içerik güncellenmesi önerilir.'],
      _needs_content_review: true,
    };
  }

  return {
    ...content,
    // Always ensure manual_semantic_descriptions exists
    manual_semantic_descriptions: content.manual_semantic_descriptions || content.keywords || [],
    _auto_generated: false,
  };
}

async function main() {
  fs.mkdirSync(KB_DIR, { recursive: true });

  const missingTopics = loadMissingList();
  console.log(`\n📝 Creating ${missingTopics.length} missing KB entries...\n`);

  let created = 0;
  let skipped = 0;
  let needsReview = 0;

  for (const topic of missingTopics) {
    const filePath = path.join(KB_DIR, `${topic.id}.json`);

    if (fs.existsSync(filePath)) {
      console.log(`   ⏭️  ${topic.id} already exists — skipped`);
      skipped++;
      continue;
    }

    const entry = createEntry(topic);
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');

    if (entry._needs_content_review) {
      console.log(`   ⚠️  ${topic.id} — minimal stub (needs content review)`);
      needsReview++;
    } else {
      console.log(`   ✅ ${topic.id}`);
    }
    created++;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Created  : ${created}`);
  console.log(`⏭️  Skipped  : ${skipped}`);
  console.log(`⚠️  Needs review: ${needsReview}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📁 Output: ${KB_DIR}\n`);
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
