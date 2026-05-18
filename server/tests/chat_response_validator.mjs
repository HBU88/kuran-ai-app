const ENDPOINT = "http://localhost:3000/chat";
const RANDOM_DEFAULT = 12;
const UTF8_BAD_TOKENS = ["├", "┼", "▒", "�", "Ã", "â€œ", "â€", "ÔÇ"];
const AYAH_TYPES = new Set(["direct_ayah", "supportive_ayah", "sensitive_support"]);
const TOPIC_RULES = {
  sabir: new Set([2, 3, 94, 103]),
  prophet: new Set([33, 68, 21, 48, 47]),
  hope: new Set([94, 39, 65, 13]),
  repentance: new Set([39, 2]),
};

function matchesSelectedAyahExpectation(payload, expectation) {
  if (typeof expectation === "number") {
    return (payload?.selected_ayah?.id ?? null) === expectation;
  }
  if (!expectation || typeof expectation !== "object") {
    return true;
  }
  if (typeof expectation.id === "number" && (payload?.selected_ayah?.id ?? null) !== expectation.id) {
    return false;
  }
  if (
    typeof expectation.surahNumber === "number" &&
    Number(payload?.selected_ayah?.surahNumber) !== Number(expectation.surahNumber)
  ) {
    return false;
  }
  if (
    typeof expectation.ayahNumber === "number" &&
    Number(payload?.selected_ayah?.ayahNumber ?? payload?.selected_ayah?.ayah) !== Number(expectation.ayahNumber)
  ) {
    return false;
  }
  return true;
}

const fixedTests = [
  { kind: "fixed", group: "sabir", prompt: "sabır ile ilgili ayet", explicitTopic: true },
  { kind: "fixed", group: "prophet", prompt: "muhammed ile ilgili ayet", explicitTopic: true },
  { kind: "fixed", group: "hope", prompt: "motive edici ayet", explicitTopic: true },
  { kind: "fixed", group: "hope", prompt: "umut veren ayet", explicitTopic: true },
  { kind: "fixed", group: "fear", prompt: "korku ile ilgili ayet", explicitTopic: true },
  {
    kind: "fixed",
    group: "casual",
    prompt: "nasılsın",
    explicitTopic: false,
    expectedContains: "HAKAI’ye hoş geldin",
    expectedPlannerSource: "local_fast_path",
    expectedRouteMode: "quran_guidance",
  },
  {
    kind: "fixed",
    group: "casual",
    prompt: "merhaba",
    explicitTopic: false,
    expectedContains: "HAKAI’ye hoş geldin",
    expectedPlannerSource: "local_fast_path",
    expectedRouteMode: "quran_guidance",
  },
  {
    kind: "fixed",
    group: "fear",
    prompt: "iyiyim ama biraz üzgünüm",
    explicitTopic: false,
    expectSelectedAyah: true,
    expectedPlannerSource: "local_fast_path",
    expectedRouteMode: "quran_guidance",
  },
  { kind: "fixed", group: "fear", prompt: "çok korkuyorum", explicitTopic: false, expectedSurahSet: [3, 9, 65] },
  { kind: "fixed", group: "fear", prompt: "içim daralıyor", explicitTopic: false },
  { kind: "fixed", group: "fear", prompt: "gelecek için endişeliyim", explicitTopic: false, expectedSurahSet: [28, 94, 13] },
  { kind: "fixed", group: "loneliness", prompt: "çok yalnız hissediyorum", explicitTopic: false },
  { kind: "fixed", group: "loneliness", prompt: "yalnız hissediyorum", explicitTopic: false, expectedRouteMode: "quran_guidance", expectedSurahSet: [2, 13, 50, 57, 93] },
  { kind: "fixed", group: "loneliness", prompt: "kimsem yok gibi hissediyorum", explicitTopic: false },
  { kind: "fixed", group: "repentance", prompt: "günah işledim", explicitTopic: false, expectedSurahSet: [39, 2] },
  { kind: "fixed", group: "repentance", prompt: "Allah beni affeder mi", explicitTopic: false, expectedSurahSet: [39, 2] },
  {
    kind: "fixed",
    group: "repentance",
    prompt: "çok pişmanım",
    explicitTopic: false,
    expectedSurahSet: [39],
    expectedSelectedAyah: { surahNumber: 39, ayahNumber: 53 },
    expectedContains: ["ümit", "rahmet"],
  },
  { kind: "fixed", group: "sabir", prompt: "sabır hakkında Kur'an'dan bir şey söyle", explicitTopic: true },
  { kind: "fixed", group: "prophet", prompt: "peygamberimizle ilgili ayet göster", explicitTopic: true },
  { kind: "fixed", group: "fear", prompt: "maddi sıkıntı yaşıyorum", explicitTopic: false, expectedSurahSet: [11, 65, 51] },
  { kind: "fixed", group: "fear", prompt: "haksızlığa uğradım", explicitTopic: false, expectedSurahSet: [4, 5, 16, 42] },
  { kind: "fixed", group: "fear", prompt: "borcum var", explicitTopic: false, expectedRouteMode: "quran_guidance", expectedSurahSet: [11, 65, 51] },
  { kind: "fixed", group: "fear", prompt: "çok hastayım", explicitTopic: false, expectedRouteMode: "quran_guidance", expectedSurahSet: [26, 17, 10, 41] },
  { kind: "fixed", group: "fear", prompt: "sabredemiyorum", explicitTopic: false, expectedRouteMode: "quran_guidance", expectedSurahSet: [2, 11, 16, 103] },
  { kind: "fixed", group: "fear", prompt: "birini kaybettim", explicitTopic: false, expectedRouteMode: "quran_guidance", expectedSurahSet: [2, 11, 16, 103] },
  { kind: "fixed", group: "fear", prompt: "Allah benden uzak mı", explicitTopic: false, expectedRouteMode: "quran_guidance", expectedSurahSet: [2, 13, 40, 50, 57, 93] },
  { kind: "fixed", group: "prayer", prompt: "akşam namazı kaç rekat?", expectedRakats: 5 },
  { kind: "fixed", group: "prayer", prompt: "sabah namazı kaç rekat?", expectedRakats: 4 },
  { kind: "fixed", group: "prayer", prompt: "öğle namazı kaç rekat?", expectedRakats: 10 },
  { kind: "fixed", group: "prayer", prompt: "ikindi namazı kaç rekat?", expectedRakats: 8 },
  { kind: "fixed", group: "prayer", prompt: "yatsı namazı kaç rekat?", expectedRakats: 13 },
  { kind: "fixed", group: "prayer", prompt: "vitir kaç rekat?", expectedRakats: 3 },
  { kind: "fixed", group: "prayer", prompt: "teravi namazi kac rekat", expectedContains: "teravih" },
  { kind: "fixed", group: "prayer", prompt: "teravih namazı kaç rekât?", expectedContains: "teravih" },
  { kind: "fixed", group: "prayer", prompt: "ramazanda teravi namazi kac rekat", expectedContains: "teravih" },
  { kind: "fixed", group: "prayer", prompt: "cuma namazi", expectedContains: "cuma" },
  { kind: "fixed", group: "prayer", prompt: "cuma namazı kaç rekat?", expectedContains: "cuma" },
  { kind: "fixed", group: "prayer", prompt: "bayram namazı kaç rekat?", expectedContains: "bayram" },
  { kind: "fixed", group: "prayer", prompt: "cenaze namazı nasıl kılınır", expectedContains: "cenaze" },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "abdest nasıl alınır",
    mustBeDirectAnswer: true,
    expectedContains: ["Ağza üç defa", "Buruna üç defa", "Farzları"],
    expectedNotContains: ["hocaya danış", "hocaya danismak"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "gusül abdesti nasıl alınır",
    mustBeDirectAnswer: true,
    expectedContains: ["Ağza üç defa", "Buruna üç defa", "kuru yer kalmayacak"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "seferi namaz kaç rekât",
    mustBeDirectAnswer: true,
    expectedKnowledgeHitId: "yolculukta_namaz_nasil_kilinir",
    expectedContains: ["iki rekât", "yolculuk"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "vitir namazı vacip mi",
    mustBeDirectAnswer: true,
    expectedKnowledgeHitId: "vitir_vacip",
    expectedContains: ["Hanefî", "vaciptir"],
  },
  { kind: "fixed", group: "knowledge", prompt: "bayram namazı nasıl kılınır", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "abdestin farzları nelerdir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "abdesti bozan şeyler nelerdir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "orucu bozan şeyler", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "oruç kimlere farzdır", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "oruç kimlere farz değildir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "sahur şart mı", mustBeDirectAnswer: true },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "namaz kaçırınca ne yapılır",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "namaz_kacirinca_ne_yapilir",
    expectedContains: ["kaza", "tevbe"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "işyerinde namaz kılınır mı",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "isyerinde_namaz_kilinir_mi",
    expectedContains: ["temiz", "kıble"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "oturarak namaz kılınır mı",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "oturarak_namaz_kilinir_mi",
    expectedContains: ["ayakta durmaya gücü yetmeyen", "oturarak"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "araçta namaz kılınır mı",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "aracta_namaz_kilinir_mi",
    expectedContains: ["zorunlu", "kıble"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "namaz hızlı kılınırsa olur mu",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "namaz_hizli_kilinirsa_olur_mu",
    expectedContains: ["aceleye", "huşu"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "cem edilerek namaz kılınır mı",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "cem_edilerek_namaz_kilinir_mi",
    expectedContains: ["cem edilmez", "vaktinde"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "yolculukta namaz nasıl kılınır",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "yolculukta_namaz_nasil_kilinir",
    expectedContains: ["iki rekât", "seferî"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "geç kalınan namaz nasıl kılınır",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "gec_kalinan_namaz_nasil_kilinir",
    expectedContains: ["kaza", "ilk zamanda"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "vitir kılınmazsa ne olur",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "vitir_kilinmazsa_ne_olur",
    expectedContains: ["borç", "kaza"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "namazda şaşırma ne yapılır",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "namazda_sasirma_ne_yapilir",
    expectedContains: ["sehiv secdesi", "güçlü görülen"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "zekat kime verilir",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "zekat_kime_verilir",
    expectedContains: ["fakirler", "ihtiyaç sahibi"],
    expectedNotContains: ["Zek?t", "miktar?na", "M?sl?man"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "zekât nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "zekat_nedir",
    expectedContains: ["nisap", "yılda bir kez"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "zekât kimlere verilir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "zekat_kime_verilir",
    expectedContains: ["fakirler", "miskinler", "borçlular"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "zekât kimlere verilmez?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "zekat_kime_verilmez",
    expectedContains: ["Anne", "çocuklar", "eş", "zenginler"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "zekât nisap nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "zekat_nisap_nedir",
    expectedContains: ["nisap", "altın"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "fitre nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "fitre_nedir",
    expectedContains: ["vacip", "kişi başına"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "fitre kime verilir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "fitre_kime_verilir",
    expectedContains: ["fakirler", "ihtiyaç sahipleri"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "fitre ne zaman verilir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "fitre_ne_zaman_verilir",
    expectedContains: ["Ramazan", "bayramdan önce", "bayram sabahına kadar"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Kurban nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kurban_nedir",
    expectedContains: ["Kurban Bayramı", "Allah rızası"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Kurban kimlere vaciptir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kurban_kime_vaciptir",
    expectedContains: ["Müslüman", "akıllı", "ergen", "nisap"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Kurban ne zaman kesilir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kurban_ne_zaman_kesilir",
    expectedContains: ["bayram namazından sonra", "Kurban Bayramı günleri"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Kurban eti nasıl paylaşılır?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kurban_eti_nasil_paylasilir",
    expectedContains: ["aile", "akraba", "ihtiyaç sahipleri"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Kurban keserken nelere dikkat edilir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kurban_keserken_nelere_dikkat_edilir",
    expectedContains: ["eziyet", "ehil kişi", "besmele", "hijyen", "vekalet"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "büyükbaş kurbana kaç kişi ortak olabilir",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kurban_hisse_olur_mu",
    expectedContains: ["yedi kişi", "ortak", "niyet"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "kurban yerine para verilir mi",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kurban_yerine_para_verilir_mi",
    expectedContains: ["para", "bağış", "vekalet", "kesmek"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "kurban eti kimlere verilir",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kurban_eti_kimlere_verilir",
    expectedContains: ["aile", "akraba", "ihtiyaç sahipleri"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "kurbanlık hayvan nasıl olmalı",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kurbanlik_hayvan_sartlari",
    expectedContains: ["yaş", "kusur", "sağlıklı"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "vekaletle kurban olur mu",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "vekaletle_kurban",
    expectedContains: ["vekalet", "vekâlet", "online"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Hac nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "hac_nedir",
    expectedContains: ["Kâbe", "kutsal mekânlar"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Hac kimlere farzdır?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "hac_kimlere_farzdır",
    expectedContains: ["Müslüman", "akıllı", "ergen", "yol güvenliği"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Haccın farzları nelerdir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "haccin_farzlari",
    expectedContains: ["İhrama girmek", "Arafat vakfesi", "Ziyaret tavafı"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Umre nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "umre_nedir",
    expectedContains: ["ihram", "tavaf", "sa‘y"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Hac ile umre farkı nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "hac_ile_umre_farki",
    expectedContains: ["Arafat vakfesi", "belirli zamanda", "yılın çoğu zamanında"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Cuma namazı nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "cuma_namazi_nedir",
    expectedContains: ["cuma günü", "hutbe"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Cuma namazı kaç rekâttır?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "cuma_namazi_kac_rekat",
    expectedContains: ["2 rekattır", "ilk sünnet", "son sünnet"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Cuma namazı kimlere farzdır?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "cuma_namazi_kimlere_farzdır",
    expectedContains: ["Müslüman erkeklere", "kadınlara", "yolculara"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Bayram namazı nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "bayram_namazi_nedir",
    expectedContains: ["Ramazan", "Kurban Bayramı", "iki rekâtlık"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Bayram namazı nasıl kılınır?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "bayram_namazi_nasil_kilinir",
    expectedContains: ["ilave tekbirler", "Fatiha", "selam"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Bayram namazı kaç rekâttır?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "bayram_namazi_kac_rekat",
    expectedContains: ["2 rekattır", "vacip"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Teyemmüm nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "teyemmum_nedir",
    expectedContains: ["toprak", "temizlik"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Teyemmüm nasıl alınır?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "teyemmum_nasil_alinir",
    expectedContains: ["niyet", "yüz", "kollar"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Teyemmümü bozan şeyler nelerdir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "teyemmumu_bozanlar",
    expectedContains: ["su bulunduğunda", "özür"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Mest üzerine mesh nasıl yapılır?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "mest_uzerine_mesh",
    expectedContains: ["mest", "mesh"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Sargı üzerine mesh nasıl yapılır?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "sargi_uzerine_mesh",
    expectedContains: ["sargı", "mesh"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Hayız nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "hayiz_nedir",
    expectedContains: ["namaz", "oruç"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Adetliyken namaz kılınır mı?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "hayiz_halinde_namaz_oruc",
    expectedContains: ["namaz kılınmaz", "oruç"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Adetliyken oruç tutulur mu?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "hayiz_halinde_namaz_oruc",
    expectedContains: ["oruç tutulmaz", "kaza"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Adetliyken tutulamayan oruç kaza edilir mi?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "adetliyken_oruc_kazasi",
    expectedContains: ["kaza", "fidye"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Nifas nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "nifas_nedir",
    expectedContains: ["lohusalık", "namaz"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "İstihaze nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "istihaze_nedir",
    expectedContains: ["özür kanı", "namaza"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Özür kanı olan kişi namaz kılabilir mi?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "ozur_kani_namaz",
    expectedContains: ["namaz kılabilir", "abdest"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Adetliyken Kur’an okunur mu?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "adetliyken_kuran_okunur_mu",
    expectedContains: ["Dua", "zikir", "salavat"],
  },
  { kind: "fixed", group: "knowledge", prompt: "zekât oranı nedir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "zekât kimlere verilir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "dua nasıl edilir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "tövbe nasıl edilir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "namaz vakitleri nelerdir", mustBeDirectAnswer: true },
  { kind: "fixed", group: "knowledge", prompt: "Hz Muhammed nasıl biriydi", mustBeDirectAnswer: true },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Yemin nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "yemin_nedir",
    expectedContains: ["Allah adına", "kefaret"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Yemin kefareti nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "yemin_kefareti",
    expectedContains: ["kefaret", "yoksul"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Adak nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "adak_nedir",
    expectedContains: ["adak", "yerine getiril"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Adak kurbanı nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "adak_kurbani",
    expectedContains: ["ihtiyaç sahipleri", "adağı adayan"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Kefaret nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kefaret_nedir",
    expectedContains: ["telafi", "yemin"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Tövbe nasıl edilir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "tovbe_nasil_edilir",
    expectedContains: ["pişmanlık", "helalleşme"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Dua nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "dua_nedir",
    expectedContains: ["Allah", "istekte bulunması"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Dua nasıl edilir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "dua_nasil_edilir",
    expectedContains: ["hamd", "salavat"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Helal haram nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "helal_haram_genel",
    expectedContains: ["Helal", "haram"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Faiz nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "faiz_nedir",
    expectedContains: ["sakınılması", "modern finans"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Kul hakkı nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kul_hakki_nedir",
    expectedContains: ["iade", "helalleşme"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Anne baba hakkı nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "anne_baba_hakki",
    expectedContains: ["saygı", "dua"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Gıybet nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "giybet_nedir",
    expectedContains: ["arkasından", "hoşlanmayacağı"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "İsraf nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "israf_nedir",
    expectedContains: ["ölçüsüz", "gereksiz"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Selamlaşma adabı nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "selamlasma_adabi",
    expectedContains: ["selam vermek", "selam almak"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Komşuluk hakkı nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "komsuluk_hakki",
    expectedContains: ["eziyet", "yardımlaşılır"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Nikâh nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "nikah_nedir",
    expectedContains: ["aile", "rıza"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Nikâh şartları nelerdir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "nikah_sartlari",
    expectedContains: ["şart", "hukuk"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Boşanma nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "bosanma_nedir",
    expectedContains: ["aile", "hukuk"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Talak nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "talak_nedir",
    expectedContains: ["boşanma", "fıkhî"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Miras nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "miras_nedir",
    expectedContains: ["paylaşım", "borç"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Sadaka nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "sadaka_nedir",
    expectedContains: ["Allah", "paylaşma"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Sadaka kime verilir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "sadaka_kime_verilir",
    expectedContains: ["ihtiyaç", "fakir"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Mirac kandili nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "mirac_kandili_nedir",
    expectedContains: ["Miraç", "dua"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Kandil geceleri nedir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "kandil_geceleri_nedir",
    expectedContains: ["manevi", "yoğunluğu", "yüksek", "tövbe", "değerlendirmek"],
    expectedNotContains: ["yo?un", "y?ksek", "t?vbe", "de?erlendirmek"],
  },
  {
    kind: "fixed",
    group: "knowledge",
    prompt: "Gece ibadetleri nelerdir?",
    mustBeDirectAnswer: true,
    expectedIntent: "general_islamic_question",
    expectedKnowledgeHitId: "gece_ibadetleri",
    expectedContains: ["teheccüd", "zikir"],
  },
  { kind: "context", group: "knowledge", prompt: "abdest nasıl alınır", followUp: "nasıl alınır?", expectedContains: "abdest" },
  { kind: "context", group: "knowledge", prompt: "vitir namazı vacip mi", followUp: "vacip mi?", expectedContains: "vitir", followUpExpectedContains: "vitir vaciptir", followUpExpectedKnowledgeHitId: "vitir_vacip" },
  { kind: "context", group: "prayer", prompt: "cuma namazı", followUp: "kaç rekat?", expectedContains: "cuma" },
  { kind: "context", group: "prayer", prompt: "cuma namazı", followUp: "teravi namazı kaç rekat", expectedContains: "cuma", followUpExpectedContains: "teravih" },
  { kind: "context", group: "prayer", prompt: "teravi namazı kaç rekat", followUp: "kaç rekat?", expectedContains: "teravih", followUpExpectedContains: "teravih" },
  { kind: "context", group: "fear", prompt: "gelecek için endişeliyim", followUp: "haksızlığa uğradım", followUpExpectedSurahSet: [4, 5, 16, 42], followUpNotSameAsFirst: true },
  { kind: "context", group: "fear", prompt: "gelecek için endişeliyim", followUp: "maddi sıkıntı yaşıyorum", followUpExpectedSurahSet: [11, 65, 51], followUpNotSameAsFirst: true },
];

const randomPromptPools = {
  sabir: [
    "sabır konusunda bir ayet var mı",
    "sabretmekle ilgili ayet öner",
    "zor zamanlarda sabır ayeti isterim",
    "sabır hakkında Kur'an'dan bir şey söyle",
  ],
  prophet: [
    "Hz Muhammed hakkında ayet var mı",
    "peygamberimizle ilgili ayet göster",
    "Resulullah ile ilgili bir ayet paylaş",
    "Muhammed peygamber hakkında Kur'an'da ne geçiyor",
  ],
  hope: [
    "bana umut veren bir ayet söyler misin",
    "motive edici bir ayet paylaş",
    "moralim bozuk bana ayet öner",
    "içimi güçlendirecek bir ayet var mı",
  ],
  fear: [
    "çok korkuyorum",
    "başıma kötü bir şey gelecek diye korkuyorum",
    "gelecek kaygım arttı",
    "içim sıkılıyor ve endişeliyim",
  ],
  loneliness: [
    "çok yalnız hissediyorum",
    "kimsem yok gibi hissediyorum",
    "yalnızlıkla ilgili ayet var mı",
    "Allah bana yakın mı",
  ],
  repentance: [
    "Allah beni affeder mi",
    "günah işledim",
    "tövbe etmek istiyorum",
    "pişmanım bana umut veren bir ayet söyler misin",
  ],
  casual: [
    "nasılsın",
    "merhaba",
    "selam",
    "bugün konuşabilir miyiz",
  ],
};

async function main() {
  const randomCount = readRandomCount();
  const rng = buildRandomSource(process.env.CHAT_TEST_SEED);
  const randomTests = buildRandomTests(randomCount, rng);

  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Fixed tests: ${fixedTests.length}`);
  console.log(`Random tests: ${randomTests.length}`);
  console.log("Selected random prompts:");
  for (const test of randomTests) {
    console.log(`- [${test.group}] ${test.prompt}`);
  }

  await assertEndpointReachable();
  await runModuleEndpointSmokeTests();
  if (isDebugChatEngineEnabled()) {
    await runDebugResolveSmokeTest();
  }

  const fixedResults = [];
  for (const test of fixedTests) {
    fixedResults.push(await runTest(test));
  }

  const randomResults = [];
  for (const test of randomTests) {
    randomResults.push(await runTest(test));
  }

  const allResults = [...fixedResults, ...randomResults];
  const failed = allResults.filter((result) => !result.passed);

  console.log("");
  console.log(`TOTAL TESTS: ${allResults.length}`);
  console.log(`FIXED PASSED: ${fixedResults.filter((result) => result.passed).length}/${fixedResults.length}`);
  console.log(`RANDOM PASSED: ${randomResults.filter((result) => result.passed).length}/${randomResults.length}`);
  console.log(`FAILED: ${failed.length}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

function readRandomCount() {
  const parsed = Number.parseInt(process.env.CHAT_RANDOM_TEST_COUNT || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : RANDOM_DEFAULT;
}

function buildRandomSource(seedValue) {
  if (!seedValue) return Math.random;
  let state = hashSeed(seedValue) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input) {
  let hash = 1779033703 ^ String(input).length;
  for (const char of String(input)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

function buildRandomTests(targetCount, rng) {
  const groupNames = Object.keys(randomPromptPools);
  const minPerGroup = targetCount >= groupNames.length * 2 ? 2 : 1;
  const maxPerGroup = 3;
  const selected = [];
  const selectedByGroup = new Map(groupNames.map((group) => [group, []]));

  for (const group of groupNames) {
    const picks = pickUnique(randomPromptPools[group], Math.min(minPerGroup, randomPromptPools[group].length), rng);
    selectedByGroup.set(group, picks.slice());
    for (const prompt of picks) {
      selected.push({ kind: "random", group, prompt, explicitTopic: group !== "casual" && group !== "fear" && group !== "loneliness" && group !== "repentance" });
    }
  }

  while (selected.length < targetCount) {
    const eligibleGroups = groupNames.filter((group) => {
      const used = selectedByGroup.get(group) || [];
      return used.length < Math.min(maxPerGroup, randomPromptPools[group].length);
    });
    if (eligibleGroups.length === 0) break;

    const group = pickOne(eligibleGroups, rng);
    const used = new Set(selectedByGroup.get(group) || []);
    const remaining = randomPromptPools[group].filter((prompt) => !used.has(prompt));
    if (remaining.length === 0) continue;
    const prompt = pickOne(remaining, rng);
    selectedByGroup.get(group).push(prompt);
    selected.push({ kind: "random", group, prompt, explicitTopic: group !== "casual" && group !== "fear" && group !== "loneliness" && group !== "repentance" });
  }

  return selected.slice(0, targetCount);
}

function pickUnique(values, count, rng) {
  const pool = values.slice();
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function pickOne(values, rng) {
  return values[Math.floor(rng() * values.length)];
}

async function assertEndpointReachable() {
  try {
    const response = await fetch("http://localhost:3000/health");
    if (!response.ok) throw new Error(`/health returned ${response.status}`);
  } catch (error) {
    console.error(`FAIL [setup] backend unavailable -> ${error.message}`);
    process.exit(1);
  }
}

async function runDebugResolveSmokeTest() {
  const cases = [
    {
      q: "çok yalnız hissediyorum",
      expectedCluster: "yalnızlık",
      expectedRankerSource: "override",
      expectedPlannerSource: "local_fast_path",
      maxIntentPlannerMs: 20,
      maxAyahRankerMs: 100,
    },
    {
      q: "içim daralıyor",
      expectedCluster: "kaygı",
      expectedRankerSource: "override",
      expectedPlannerSource: "local_fast_path",
      maxIntentPlannerMs: 20,
      maxAyahRankerMs: 100,
    },
    {
      q: "haksızlığa uğradım",
      expectedCluster: "adalet",
      expectedRankerSource: "override",
      expectedPlannerSource: "local_fast_path",
      maxIntentPlannerMs: 20,
    },
    {
      q: "maddi sıkıntı yaşıyorum",
      expectedCluster: "rızık",
      expectedRankerSource: "override",
      expectedPlannerSource: "local_fast_path",
      maxIntentPlannerMs: 20,
    },
    {
      q: "abdest nasıl alınır",
      expectedPlannerSource: "local_fast_path",
      expectedKnowledgeHit: true,
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      maxIntentPlannerMs: 20,
    },
    {
      q: "arkadan konusmak gunah mi",
      expectedPlannerSource: "local_fast_path",
      expectedKnowledgeHit: true,
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedSemanticMatchedTopic: "giybet_nedir",
      minSemanticMatchScore: 0.7,
      expectedPreRouteStage: "semantic",
      maxIntentPlannerMs: 20,
    },
    {
      q: "arkadan konuşmak günah mı",
      expectedPlannerSource: "local_fast_path",
      expectedKnowledgeHit: true,
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedSemanticMatchedTopic: "giybet_nedir",
      minSemanticMatchScore: 0.7,
      expectedPreRouteStage: "semantic",
      maxIntentPlannerMs: 20,
    },
    {
      q: "nasılsın",
      expectedPlannerSource: "local_fast_path",
      expectedRouteMode: "quran_guidance",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      maxIntentPlannerMs: 20,
    },
    {
      q: "merhaba",
      expectedPlannerSource: "local_fast_path",
      expectedRouteMode: "quran_guidance",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      maxIntentPlannerMs: 20,
    },
    {
      q: "iyiyim ama biraz üzgünüm",
      expectedPlannerSource: "local_fast_path",
      expectedRouteMode: "quran_guidance",
      expectedResponseType: "supportive_ayah",
      maxIntentPlannerMs: 20,
    },
  ];

  for (const test of cases) {
    const payload = await postDebugResolve(test.q);
    const failures = [];
    if (test.expectedCluster && payload?.matched_override_cluster !== test.expectedCluster) {
      failures.push(`matched_override_cluster=${payload?.matched_override_cluster}`);
    }
    if (test.expectedRankerSource && payload?.ranker_source !== test.expectedRankerSource) {
      failures.push(`ranker_source=${payload?.ranker_source}`);
    }
    if (test.expectedPlannerSource && payload?.planner_source !== test.expectedPlannerSource) {
      failures.push(`planner_source=${payload?.planner_source}`);
    }
    if (test.expectedRouteMode && payload?.route_mode !== test.expectedRouteMode) {
      failures.push(`route_mode=${payload?.route_mode}`);
    }
    if (typeof test.expectedResponseType === "string" && payload?.response_type !== test.expectedResponseType) {
      failures.push(`response_type=${payload?.response_type}`);
    }
    if (test.expectedKnowledgeHit === true && !payload?.knowledge_hit_id) {
      failures.push("knowledge_hit_id missing");
    }
    if (Object.prototype.hasOwnProperty.call(test, "expectedSelectedAyah")) {
      const selectedAyahId = payload?.selected_ayah_id ?? null;
      if (selectedAyahId !== test.expectedSelectedAyah) {
        failures.push(`selected_ayah_id=${selectedAyahId}`);
      }
    } else if (!payload?.selected_ayah_id) {
      failures.push("selected_ayah_id missing");
    }
    if (typeof test.maxIntentPlannerMs === "number") {
      const plannerMs = Number(payload?.timing_ms?.intent_planner_ms || 0);
      if (plannerMs > test.maxIntentPlannerMs) {
        failures.push(`intent_planner_ms=${plannerMs}`);
      }
    }
    if (typeof test.expectedSemanticMatchedTopic === "string" && payload?.debug?.semantic_matched_topic !== test.expectedSemanticMatchedTopic) {
      failures.push(`semantic_matched_topic=${payload?.debug?.semantic_matched_topic}`);
    }
    if (typeof test.expectedPreRouteStage === "string" && payload?.debug?.pre_route_stage !== test.expectedPreRouteStage) {
      failures.push(`pre_route_stage=${payload?.debug?.pre_route_stage}`);
    }
    if (typeof test.minSemanticMatchScore === "number") {
      const semanticScore = Number(payload?.debug?.semantic_match_score || 0);
      if (semanticScore < test.minSemanticMatchScore) {
        failures.push(`semantic_match_score=${semanticScore}`);
      }
    }
    if (typeof test.maxAyahRankerMs === "number") {
      const rankerMs = Number(payload?.timing_ms?.ayah_ranker_ms || 0);
      if (rankerMs > test.maxAyahRankerMs) {
        failures.push(`ayah_ranker_ms=${rankerMs}`);
      }
    }
    if (failures.length > 0) {
      console.error(`FAIL [debug] ${test.q} -> ${failures.join("; ")}`);
      process.exit(1);
    }
    console.log(`PASS [debug] ${test.q} -> ${payload.planner_source}:${payload.matched_override_cluster || payload.route_mode}:${payload.selected_ayah_id ?? "null"}`);
  }
}

async function runModuleEndpointSmokeTests() {
  const debugChecksEnabled = isDebugChatEngineEnabled();
  const ayahTests = [
    {
      path: "/ayah-chat",
      prompt: "çok korkuyorum",
      expectedModule: "ayah",
      expectedRouteMode: "quran_guidance",
      expectedRankerSource: "override",
      expectSelectedAyah: true,
      expectedSurahSet: [3, 9, 65],
      maxAyahRankerMs: 100,
    },
    {
      path: "/ayah-chat",
      prompt: "haksızlığa uğradım",
      expectedModule: "ayah",
      expectedRouteMode: "quran_guidance",
      expectedRankerSource: "override",
      expectSelectedAyah: true,
      expectedSurahSet: [4, 5, 16, 42],
      maxAyahRankerMs: 100,
    },
    {
      path: "/ayah-chat",
      prompt: "abdest nasıl alınır",
      expectedModule: "ayah",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedRedirectModule: "ilmihal",
      expectAssistantContains: "İlmihal Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 20,
    },
    {
      path: "/ilmihal-chat",
      prompt: "sabır ile ilgili ayet",
      expectedModule: "ilmihal",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedRedirectModule: "ayah",
      expectAssistantContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "Merhaba",
      expectedModule: "ilmihal",
      expectedIntent: "casual_conversation",
      expectedRouteMode: "casual_conversation",
      unexpectedRouteMode: "quran_guidance",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedRedirectModule: null,
      expectAssistantContains: "Merhaba, Dinî Bilgiler bölümündeyim. Namaz, ibadet, helal-haram ve günlük dinî konularda soru sorabilirsin.",
      expectAssistantNotContains: "Ayet Rehberi",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "selam",
      expectedModule: "ilmihal",
      expectedRouteMode: "casual_conversation",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedRedirectModule: null,
      expectAssistantContains: "Merhaba, Dinî Bilgiler bölümündeyim. Namaz, ibadet, helal-haram ve günlük dinî konularda soru sorabilirsin.",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "hello",
      expectedModule: "ilmihal",
      expectedRouteMode: "casual_conversation",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedRedirectModule: null,
      expectAssistantContains: "Merhaba, Dinî Bilgiler bölümündeyim. Namaz, ibadet, helal-haram ve günlük dinî konularda soru sorabilirsin.",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "arkadan konusmak gunah mi",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "giybet_nedir",
      expectedSemanticMatchedTopic: "giybet_nedir",
      expectedPreRouteStage: "semantic",
      minSemanticMatchScore: 0.7,
      expectAssistantContains: "gıybet",
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "arkadan konuşmak günah mı",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "giybet_nedir",
      expectedSemanticMatchedTopic: "giybet_nedir",
      expectedPreRouteStage: "semantic",
      minSemanticMatchScore: 0.7,
      expectAssistantContains: "gıybet",
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "komsuya kotu davranmak",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "komsuluk_hakki",
      expectedSemanticMatchedTopic: "komsuluk_hakki",
      minSemanticMatchScore: 0.7,
      expectAssistantContains: ["komşu", "eziyet"],
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "anneme babama nasil davranmaliyim",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "anne_baba_hakki",
      expectedSemanticMatchedTopic: "anne_baba_hakki",
      minSemanticMatchScore: 0.7,
      expectAssistantContains: ["anne", "baba"],
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "yalniz hissediyorum",
      expectedModule: "ilmihal",
      expectedRouteMode: "quran_guidance_redirect",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedRedirectModule: "ayah",
      expectAssistantContains: ["manevi destek", "Ayet Rehberi bölümünü"],
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "Allah beni affeder mi",
      expectedModule: "ilmihal",
      expectedRouteMode: "quran_guidance_redirect",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedRedirectModule: "ayah",
      expectAssistantContains: ["Tövbe", "Ayet Rehberi bölümünü"],
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "çok pişmanım",
      expectedModule: "ilmihal",
      expectedRouteMode: "quran_guidance_redirect",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedRedirectModule: "ayah",
      expectAssistantContains: ["Tövbe", "Ayet Rehberi bölümünü"],
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "gereksiz harcama yapmak gunah mi",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "israf_nedir",
      expectedSemanticMatchedTopic: "israf_nedir",
      minSemanticMatchScore: 0.7,
      expectAssistantContains: ["israf", "gereksiz"],
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "komsu hakki nedir",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "komsuluk_hakki",
      expectedSemanticMatchedTopic: "komsuluk_hakki",
      minSemanticMatchScore: 0.7,
      expectAssistantContains: ["komşu", "eziyet"],
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "faizli kredi caiz mi",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "faiz_nedir",
      expectedSemanticMatchedTopic: "faiz_nedir",
      minSemanticMatchScore: 0.7,
      expectAssistantContains: ["faiz", "kredi"],
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "namaz kaç rekat",
      expectedModule: "ilmihal",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectAssistantContains: "rekat",
      expectedKnowledgeHit: true,
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "niyet nasil edilir",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "niyet_nasil",
      expectedRedirectModule: null,
      expectAssistantContains: "kalben",
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "nasıl niyet edilir",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "niyet_nasil",
      expectedRedirectModule: null,
      expectAssistantContains: "kalben",
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "niyet nasıl edilir",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "niyet_nasil",
      expectedRedirectModule: null,
      expectAssistantContains: "kalben",
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "nasıl niyet edilir",
      expectedModule: "ilmihal",
      expectedRouteMode: "ilmihal_knowledge",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedKnowledgeHitId: "niyet_nasil",
      expectedRedirectModule: null,
      expectAssistantContains: "kalben",
      expectAssistantNotContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
    {
      path: "/ilmihal-chat",
      prompt: "çok korkuyorum",
      expectedModule: "ilmihal",
      expectedResponseType: "direct_answer",
      expectedSelectedAyah: null,
      expectedRedirectModule: "ayah",
      expectAssistantContains: "Ayet Rehberi bölümüne daha uygundur",
      maxAyahRankerMs: 0,
    },
  ];

  for (const test of ayahTests) {
    const payload = await postModuleChat(test.path, test.prompt);
    const routingPayload = debugChecksEnabled ? await postDebugResolve(test.prompt, moduleFromPath(test.path)) : null;
    const failures = [];
    if (debugChecksEnabled) {
      if ((routingPayload?.module || null) !== test.expectedModule) {
        failures.push(`decision_meta.module=${routingPayload?.module}`);
      }
      if (test.expectedIntent && routingPayload?.intent !== test.expectedIntent) {
        failures.push(`intent=${routingPayload?.intent}`);
      }
      if (test.expectedRouteMode && routingPayload?.route_mode !== test.expectedRouteMode) {
        failures.push(`route_mode=${routingPayload?.route_mode}`);
      }
      if (test.unexpectedRouteMode && routingPayload?.route_mode === test.unexpectedRouteMode) {
        failures.push(`route_mode must not be ${test.unexpectedRouteMode}`);
      }
      if (test.expectedRankerSource && routingPayload?.ranker_source !== test.expectedRankerSource) {
        failures.push(`ranker_source=${routingPayload?.ranker_source}`);
      }
      if (typeof test.expectedResponseType === "string" && routingPayload?.response_type !== test.expectedResponseType) {
        failures.push(`response_type=${routingPayload?.response_type}`);
      }
      if (test.expectedKnowledgeHit === true && !routingPayload?.knowledge_hit_id) {
        failures.push("knowledge_hit_id missing");
      }
      if (typeof test.expectedKnowledgeHitId === "string" && routingPayload?.knowledge_hit_id !== test.expectedKnowledgeHitId) {
        failures.push(`knowledge_hit_id=${routingPayload?.knowledge_hit_id}`);
      }
      if (typeof test.expectedSemanticMatchedTopic === "string" && routingPayload?.semantic_matched_topic !== test.expectedSemanticMatchedTopic) {
        failures.push(`semantic_matched_topic=${routingPayload?.semantic_matched_topic}`);
      }
      if (typeof test.expectedPreRouteStage === "string" && routingPayload?.pre_route_stage !== test.expectedPreRouteStage) {
        failures.push(`pre_route_stage=${routingPayload?.pre_route_stage}`);
      }
      if (typeof test.minSemanticMatchScore === "number") {
        const semanticScore = Number(routingPayload?.semantic_match_score || 0);
        if (semanticScore < test.minSemanticMatchScore) {
          failures.push(`semantic_match_score=${semanticScore}`);
        }
      }
    }
    if (Object.prototype.hasOwnProperty.call(test, "expectedRedirectModule")) {
      const redirectModule = payload?.redirect_module || null;
      if (redirectModule !== test.expectedRedirectModule) {
        failures.push(`redirect_module=${redirectModule}`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(test, "expectedSelectedAyah")) {
      const selectedAyahId = payload?.selected_ayah?.id ?? null;
      if (selectedAyahId !== test.expectedSelectedAyah) {
        failures.push(`selected_ayah_id=${selectedAyahId}`);
      }
    } else if (test.expectSelectedAyah && !payload?.selected_ayah) {
      failures.push("selected_ayah missing");
    }
    if (typeof test.maxAyahRankerMs === "number" && debugChecksEnabled) {
      const rankerMs = Number(routingPayload?.timing_ms?.ayah_ranker_ms || 0);
      if (rankerMs > test.maxAyahRankerMs) {
        failures.push(`ayah_ranker_ms=${rankerMs}`);
      }
    }
    if (typeof test.expectAssistantNotContains === "string" && payload?.assistant_text?.includes(test.expectAssistantNotContains)) {
      failures.push(`assistant_text contains ${test.expectAssistantNotContains}`);
    }
    if (typeof test.expectAssistantContains === "string") {
      const expected = normalizeForMatch(test.expectAssistantContains);
      if (!normalizeForMatch(payload?.assistant_text || "").includes(expected)) {
        failures.push(`assistant_text missing ${expected}`);
      }
    } else if (Array.isArray(test.expectAssistantContains)) {
      const assistantText = normalizeForMatch(payload?.assistant_text || "");
      for (const expectedValue of test.expectAssistantContains) {
        const expected = normalizeForMatch(expectedValue);
        if (!assistantText.includes(expected)) {
          failures.push(`assistant_text missing ${expected}`);
        }
      }
    }
    if (failures.length > 0) {
      console.error(`FAIL [module] ${test.path} ${test.prompt} -> ${failures.join("; ")}`);
      process.exit(1);
    }
    console.log(`PASS [module] ${test.path} ${test.prompt} -> ${test.path.includes('ilmihal') ? 'ilmihal' : 'ayah'}:${payload?.selected_ayah ? 'ayah' : 'direct_answer'}:${payload?.selected_ayah?.id ?? "null"}`);
  }
}

async function runTest(test) {
  try {
    if (test.kind === "context") return await runContextTest(test);

    const payload = await postChat(test.prompt);
    const failures = validatePayload(test, payload);
    if (failures.length > 0) return failResult(test, failures.join("; "), payload);

    console.log(`PASS [${test.kind}] ${test.prompt} -> ${formatAyahLabel(payload)}`);
    return { ...test, passed: true, payload };
  } catch (error) {
    return failResult(test, error.message);
  }
}

function validatePayload(test, payload) {
  const failures = [];
  const requiredStringFields = ["assistant_text"];
  for (const field of requiredStringFields) {
    if (typeof payload?.[field] !== "string" || payload[field].trim().length === 0) {
      failures.push(`missing ${field}`);
    }
  }
  if (!(payload?.selected_ayah === null || (payload?.selected_ayah && typeof payload.selected_ayah === "object"))) {
    failures.push("selected_ayah must be object or null");
  }

  const decisionMeta = payload?.decision_meta && typeof payload.decision_meta === "object"
    ? payload.decision_meta
    : null;

  if (typeof payload?.assistant_text === "string") {
    for (const token of UTF8_BAD_TOKENS) {
      if (payload.assistant_text.includes(token)) {
        failures.push(`assistant_text contains mojibake token ${JSON.stringify(token)}`);
        break;
      }
    }
  }

  if (test.prompt === "Kandil geceleri nedir?") {
    const assistantText = normalizeForMatch(payload?.assistant_text || "");
    const requiredTokens = ["manevi", "yoğunluğu", "yüksek", "tövbe", "değerlendirmek"];
    const forbiddenTokens = ["yo?un", "y?ksek", "t?vbe", "de?erlendirmek"];
    for (const token of requiredTokens) {
      if (!assistantText.includes(normalizeForMatch(token))) {
        failures.push(`assistant_text missing expected text ${normalizeForMatch(token)}`);
      }
    }
    for (const token of forbiddenTokens) {
      if (assistantText.includes(normalizeForMatch(token))) {
        failures.push(`assistant_text contains forbidden text ${normalizeForMatch(token)}`);
      }
    }
  }

  if (payload?.selected_ayah) {
    if (!assistantTextIncludesAyah(payload.assistant_text, payload.selected_ayah)) {
      failures.push("assistant_text does not include selected ayah reference/text");
    }
  }

  if (Object.prototype.hasOwnProperty.call(test, "expectedSelectedAyah")) {
    if (!matchesSelectedAyahExpectation(payload, test.expectedSelectedAyah)) {
      const selectedAyah = payload?.selected_ayah || null;
      const selectedKey = selectedAyah
        ? `${selectedAyah.surahNumber}:${selectedAyah.ayahNumber || selectedAyah.ayah}`
        : "null";
      failures.push(`selected_ayah=${selectedKey}`);
    }
  }

  if (test.expectSelectedAyah === true && !payload?.selected_ayah) {
    failures.push("selected_ayah missing");
  }

  if (test.expectSelectedAyah === false && payload?.selected_ayah) {
    failures.push("selected_ayah should be null");
  }


  if (test.group === "casual") {
    if (payload?.selected_ayah !== null) failures.push("casual flow returned selected_ayah");
  }

  if (test.group === "prayer") {
    if (payload?.selected_ayah !== null) failures.push("prayer question returned selected_ayah");
    if (typeof test.expectedRakats === "number" && !String(payload?.assistant_text || "").includes(String(test.expectedRakats))) {
      failures.push(`prayer answer missing expected rakat count ${test.expectedRakats}`);
    }
    if (typeof test.expectedContains === "string") {
      const expectedText = normalizeForMatch(test.expectedContains);
      if (!normalizeForMatch(payload?.assistant_text || "").includes(expectedText)) {
        failures.push(`prayer answer missing expected text ${expectedText}`);
      }
    }
  }

  if (test.group === "knowledge") {
    if (payload?.selected_ayah !== null) failures.push("knowledge question returned selected_ayah");
    if (test.mustBeDirectAnswer && typeof payload?.assistant_text !== "string") failures.push("knowledge question missing assistant_text");
  }

  if (typeof test.expectedPlannerSource === "string" && decisionMeta && decisionMeta.planner_source !== test.expectedPlannerSource) {
    failures.push(`planner_source=${decisionMeta.planner_source}`);
  }

  if (typeof test.expectedRouteMode === "string" && decisionMeta && decisionMeta.route_mode !== test.expectedRouteMode) {
    failures.push(`route_mode=${decisionMeta.route_mode}`);
  }

  const notContains = normalizeNotContainsList(test.expectedNotContains);
  if (notContains.length > 0) {
    const assistantText = normalizeForMatch(payload?.assistant_text || "");
    for (const token of notContains) {
      if (assistantText.includes(token)) {
        failures.push(`assistant_text unexpectedly contained ${token}`);
      }
    }
  }

  const alignmentRule = TOPIC_RULES[test.group];
  if (alignmentRule && test.explicitTopic) {
    const surahNumber = payload?.selected_ayah?.surahNumber;
    if (!payload?.selected_ayah) failures.push("explicit topic request returned null selected_ayah");
    else if (!alignmentRule.has(Number(surahNumber))) failures.push(`surahNumber ${surahNumber} not in allowed set ${Array.from(alignmentRule).join(",")}`);
  }

  if (Array.isArray(test.expectedSurahSet) && test.expectedSurahSet.length > 0) {
    const surahNumber = Number(payload?.selected_ayah?.surahNumber);
    if (!payload?.selected_ayah) {
      failures.push("expected selected_ayah for ranked override prompt");
    } else if (!test.expectedSurahSet.includes(surahNumber)) {
      failures.push(`surahNumber ${surahNumber} not in expected set ${test.expectedSurahSet.join(",")}`);
    }
  }

  return failures;
}

function normalizeNotContainsList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => normalizeForMatch(item))
    .filter(Boolean);
}

async function runContextTest(test) {
  const first = await postChat(test.prompt);
  const firstFailures = validatePayload({ ...test, kind: "fixed" }, first);
  if (firstFailures.length > 0) return failResult(test, `context setup failed: ${firstFailures.join("; ")}`, first);

  const second = await postChat(test.followUp, [
    {
      role: "user",
      text: test.prompt,
      context_topic: first.context_topic || null,
      primary_theme: first.primary_theme || null,
      emotion: first.emotion || null,
      secondary_themes: Array.isArray(first.secondary_themes) ? first.secondary_themes : [],
      response_type: first.response_type || null,
      selected_ayah_id: first?.selected_ayah?.id || first?.selected_ayah_id || null,
    },
    {
      role: "assistant",
      text: first.assistant_text || "",
      context_topic: first.context_topic || null,
      primary_theme: first.primary_theme || null,
      emotion: first.emotion || null,
      secondary_themes: Array.isArray(first.secondary_themes) ? first.secondary_themes : [],
      response_type: first.response_type || null,
      selected_ayah_id: first?.selected_ayah?.id || first?.selected_ayah_id || null,
    },
  ]);
  const followUpTest = { ...test, kind: "fixed", prompt: `${test.prompt} -> ${test.followUp}`, expectedContains: test.followUpExpectedContains || test.expectedContains };
  const failures = validatePayload(followUpTest, second);
  const expectedFollowUp = normalizeForMatch(test.followUpExpectedContains || test.expectedContains || "");
  if (expectedFollowUp && !normalizeForMatch(second?.assistant_text || "").includes(expectedFollowUp)) {
    failures.push(`context follow-up did not match expected topic ${expectedFollowUp}`);
  }
  if (Array.isArray(test.followUpExpectedSurahSet) && test.followUpExpectedSurahSet.length > 0) {
    const secondSurah = Number(second?.selected_ayah?.surahNumber);
    if (!second?.selected_ayah) {
      failures.push("context follow-up returned null selected_ayah");
    } else if (!test.followUpExpectedSurahSet.includes(secondSurah)) {
      failures.push(`context follow-up surahNumber ${secondSurah} not in expected set ${test.followUpExpectedSurahSet.join(",")}`);
    }
  }
  if (test.followUpNotSameAsFirst && first?.selected_ayah && second?.selected_ayah) {
    const firstKey = `${first.selected_ayah.surahNumber}:${first.selected_ayah.ayahNumber || first.selected_ayah.ayah}`;
    const secondKey = `${second.selected_ayah.surahNumber}:${second.selected_ayah.ayahNumber || second.selected_ayah.ayah}`;
    if (firstKey === secondKey) {
      failures.push("context follow-up reused the previous ayah");
    }
  }
  if (failures.length > 0) return failResult(test, failures.join("; "), second);

  console.log(`PASS [${test.kind}] ${test.prompt} -> ${formatAyahLabel(second)}`);
  return { ...test, passed: true, payload: second };
}

async function postChat(message, history = []) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ message, history }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON response: ${error.message}`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload?.error || text}`);
  return payload;
}

async function postModuleChat(path, message, history = []) {
  const response = await fetch(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ message, history }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid module JSON response: ${error.message}`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload?.error || text}`);
  return payload;
}

async function postDebugResolve(q, module = "chat") {
  const response = await fetch(
    `http://localhost:3000/debug/resolve?module=${encodeURIComponent(module)}&q=${encodeURIComponent(q)}`
  );
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid debug JSON response: ${error.message}`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload?.error || text}`);
  return payload;
}

function moduleFromPath(path) {
  if (String(path || "").includes("ilmihal")) return "ilmihal";
  if (String(path || "").includes("ayah")) return "ayah";
  return "chat";
}

function isDebugChatEngineEnabled() {
  return String(process.env.DEBUG_CHAT_ENGINE || "").trim().toLowerCase() === "true";
}

function assistantTextIncludesAyah(assistantText, ayah) {
  const text = normalizeForMatch(assistantText);
  const ayahText = normalizeForMatch(ayah?.text_tr || "");
  const ayahSnippet = ayahText.slice(0, 32);
  const reference = `${ayah?.surahNumber}:${ayah?.ayahNumber || ayah?.ayah}`;
  return Boolean((ayahSnippet && text.includes(ayahSnippet)) || (reference && text.includes(reference)));
}

function normalizeForMatch(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
}

function formatAyahLabel(payload) {
  if (!payload?.selected_ayah) return payload?.response_type || "no_response_type";
  const assistantText = String(payload.assistant_text || "");
  const referenceMatch = assistantText.match(/([\p{L}'` -]+ \d+:\d+)/u);
  if (referenceMatch) return referenceMatch[1].trim();
  return `${payload.selected_ayah.surahNumber}:${payload.selected_ayah.ayahNumber || payload.selected_ayah.ayah}`;
}

function failResult(test, reason, payload = null) {
  console.log(`FAIL [${test.kind}] ${test.prompt} -> ${reason}`);
  return { ...test, passed: false, reason, payload };
}

await main();
