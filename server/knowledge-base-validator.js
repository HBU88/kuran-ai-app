#!/usr/bin/env node
/**
 * Knowledge Base Validator
 * Checks which Islamic Q&A topics are covered vs missing
 * Outputs: missing-questions.json + kb-coverage-report.md
 */

const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, 'data', 'ilmihal');
const OUTPUT_DIR = path.join(__dirname, 'test_results');

// ─── Comprehensive topic map ─────────────────────────────────────────────────
// Each entry: { id, title, category, keywords[] }
// id must match the filename (without .json)
const COMPREHENSIVE_TOPICS = [

  // ── NAMAZ ──────────────────────────────────────────────────────────────────
  { id: 'namaz_nedir',              title: 'Namaz Nedir?',                   category: 'namaz', keywords: ['namaz nedir','namaz ne demek','namaz hakkında','namaz açıklama'] },
  { id: 'namaz_kimlere_farzdir',    title: 'Namaz Kimlere Farzdır?',         category: 'namaz', keywords: ['namaz kimlere farz','namaz farzdır','namaz zorunlu','namaza muhatap'] },
  { id: 'namaz_farzlari',           title: 'Namazın Farzları',               category: 'namaz', keywords: ['namazın farzları','namaz farzları','namazın şartları'] },
  { id: 'namaz_vacipleri',          title: 'Namazın Vacipleri',              category: 'namaz', keywords: ['namazın vacipleri','namaz vacipleri'] },
  { id: 'namaz_nasil_kilinir',      title: 'Namaz Nasıl Kılınır?',           category: 'namaz', keywords: ['namaz nasıl kılınır','namaz kılma','namaz adımları'] },
  { id: 'namazi_bozanlar',          title: 'Namazı Bozan Şeyler',            category: 'namaz', keywords: ['namazı bozan','namaz bozulur','namaz biter'] },
  { id: 'namaz_kacirinca_ne_yapilir', title: 'Namaz Kaçınca Ne Yapılır?',   category: 'namaz', keywords: ['namaz kaçınca','namaz kaza','kaza namazı'] },
  { id: 'gec_kalinan_namaz_nasil_kilinir', title: 'Geç Kalınan Namaz Nasıl Kılınır?', category: 'namaz', keywords: ['geç kalınan namaz','geciktirilen namaz','kaza namazı nasıl'] },
  { id: 'namaz_hizli_kilinirsa_olur_mu', title: 'Namaz Hızlı Kılınırsa Olur mu?', category: 'namaz', keywords: ['namaz hızlı','çabuk namaz','süratli namaz'] },
  { id: 'namazda_sasirma_ne_yapilir', title: 'Namazda Şaşırınca Ne Yapılır?', category: 'namaz', keywords: ['namazda şaşırmak','namaz yanılma','sehiv secdesi'] },
  { id: 'yolculukta_namaz_nasil_kilinir', title: 'Yolculukta Namaz Nasıl Kılınır?', category: 'namaz', keywords: ['yolculukta namaz','seferi namaz','yolcu namazı','kasrı salat'] },
  { id: 'aracta_namaz_kilinir_mi',  title: 'Araçta Namaz Kılınır mı?',      category: 'namaz', keywords: ['araçta namaz','arabada namaz','taşıtta namaz'] },
  { id: 'oturarak_namaz_kilinir_mi', title: 'Oturarak Namaz Kılınır mı?',   category: 'namaz', keywords: ['oturarak namaz','hasta namazı','ayakta duramıyorum namaz'] },
  { id: 'isyerinde_namaz_kilinir_mi', title: 'İş Yerinde Namaz Kılınır mı?', category: 'namaz', keywords: ['işyerinde namaz','ofiste namaz','iş yerinde kılmak'] },
  { id: 'cem_edilerek_namaz_kilinir_mi', title: 'Namazlar Cem Edilebilir mi?', category: 'namaz', keywords: ['cem etmek namaz','namazları birleştirmek','cem'] },
  { id: 'cuma_namazi_nedir',        title: 'Cuma Namazı Nedir?',             category: 'namaz', keywords: ['cuma namazı nedir','cuma namazı','cuma ne demek'] },
  { id: 'cuma_namazi_kac_rekat',    title: 'Cuma Namazı Kaç Rekattır?',     category: 'namaz', keywords: ['cuma kaç rekat','cuma namazı rekâtı'] },
  { id: 'cuma_namazi_kimlere_farzdır', title: 'Cuma Namazı Kimlere Farzdır?', category: 'namaz', keywords: ['cuma kimlere farz','cuma zorunlu mu','cuma farzdır'] },
  { id: 'bayram_namazi_nedir',      title: 'Bayram Namazı Nedir?',           category: 'namaz', keywords: ['bayram namazı nedir','eid namazı','bayram namazı'] },
  { id: 'bayram_namazi_nasil_kilinir', title: 'Bayram Namazı Nasıl Kılınır?', category: 'namaz', keywords: ['bayram namazı nasıl','bayram namazı kılmak'] },
  { id: 'bayram_namazi_kac_rekat',  title: 'Bayram Namazı Kaç Rekattır?',   category: 'namaz', keywords: ['bayram namazı kaç rekat','bayram rekât'] },
  { id: 'cenaze_namazi',            title: 'Cenaze Namazı',                  category: 'namaz', keywords: ['cenaze namazı','cenaze namazı nedir','cenaze namazı nasıl'] },
  { id: 'sabah_namazi',             title: 'Sabah Namazı',                   category: 'namaz', keywords: ['sabah namazı','fecr namazı','fecr vakti'] },
  { id: 'vitir_vacip',              title: 'Vitir Namazı Vacip mi?',         category: 'namaz', keywords: ['vitir namazı','vitir vacip mi','vitir nedir'] },
  { id: 'vitir_kilinmazsa_ne_olur', title: 'Vitir Kılınmazsa Ne Olur?',     category: 'namaz', keywords: ['vitir kılınmazsa','vitir terk','vitir eksik'] },
  { id: 'ozur_kani_namaz',          title: 'Özür Kanlı Kişi Nasıl Namaz Kılar?', category: 'namaz', keywords: ['özür kanı namaz','sürekli kan namaz','mazeretli namaz'] },
  { id: 'hayiz_halinde_namaz_oruc', title: 'Hayız Halinde Namaz ve Oruç',   category: 'namaz', keywords: ['hayızda namaz','adette namaz','hayız namaz'] },
  { id: 'namaz_niyeti',             title: 'Namaz Niyeti Nasıl Yapılır?',    category: 'namaz', keywords: ['namaz niyeti','niyet namaz','namaz için niyet'] },
  { id: 'namaz_vakitleri',          title: 'Namaz Vakitleri',                category: 'namaz', keywords: ['namaz vakitleri','beş vakit','namaz saatleri','imsak öğle ikindi akşam yatsı'] },
  { id: 'nafile_namaz_nedir',       title: 'Nafile Namaz Nedir?',            category: 'namaz', keywords: ['nafile namaz','nafile ibadet','nafile ne demek'] },
  { id: 'teravih_namazi',           title: 'Teravih Namazı',                 category: 'namaz', keywords: ['teravih namazı','teravih nedir','teravih kaç rekat'] },
  { id: 'gece_ibadetleri',          title: 'Gece İbadetleri',                category: 'namaz', keywords: ['gece ibadeti','teheccüt','gece namazı','gece kıyam'] },

  // ── ABDEST / TAHARET ───────────────────────────────────────────────────────
  { id: 'abdest',                   title: 'Abdest Nedir ve Nasıl Alınır?',  category: 'taharet', keywords: ['abdest nedir','abdest nasıl alınır','abdest alma'] },
  { id: 'abdest_bozanlar',          title: 'Abdesti Bozan Şeyler',           category: 'taharet', keywords: ['abdesti bozan','abdest bozulur','abdest gider'] },
  { id: 'gusul',                    title: 'Gusül Abdesti',                  category: 'taharet', keywords: ['gusül','boy abdesti','gusül nasıl','gusül nedir'] },
  { id: 'teyemmum_nedir',           title: 'Teyemmüm Nedir?',               category: 'taharet', keywords: ['teyemmüm nedir','teyemmüm ne demek','teyemmüm açıklama'] },
  { id: 'teyemmum_nasil_alinir',    title: 'Teyemmüm Nasıl Alınır?',        category: 'taharet', keywords: ['teyemmüm nasıl','teyemmüm yapmak','teyemmüm adımları'] },
  { id: 'teyemmumu_bozanlar',       title: 'Teyemmümü Bozan Şeyler',        category: 'taharet', keywords: ['teyemmümü bozan','teyemmüm bozulur'] },
  { id: 'mest_uzerine_mesh',        title: 'Mest Üzerine Mesh',             category: 'taharet', keywords: ['mest üzerine mesh','mest mesh','mest nedir'] },
  { id: 'sargi_uzerine_mesh',       title: 'Sargı Üzerine Mesh',            category: 'taharet', keywords: ['sargı üzerine mesh','alçı mesh','yara mesh'] },
  { id: 'hayiz_nedir',              title: 'Hayız Nedir?',                   category: 'taharet', keywords: ['hayız nedir','adet nedir','menstrüasyon','âdet kanaması'] },
  { id: 'nifas_nedir',              title: 'Nifas Nedir?',                   category: 'taharet', keywords: ['nifas nedir','doğum sonrası kanama','lohusalık'] },
  { id: 'istihaze_nedir',           title: 'İstihaze Nedir?',               category: 'taharet', keywords: ['istihaze nedir','özür kanı','kronik kanama'] },
  { id: 'niyet_nasil',              title: 'Niyet Nasıl Yapılır?',           category: 'taharet', keywords: ['niyet nasıl','niyet etmek','niyet nedir'] },

  // ── ORUÇ ───────────────────────────────────────────────────────────────────
  { id: 'oruc_nedir',               title: 'Oruç Nedir?',                    category: 'oruc', keywords: ['oruç nedir','oruç ne demek','oruç açıklama','siyam'] },
  { id: 'oruc_kimlere_farzdir',     title: 'Oruç Kimlere Farzdır?',         category: 'oruc', keywords: ['oruç kimlere farz','oruç zorunlu','oruç farzdır'] },
  { id: 'orucu_bozanlar',           title: 'Orucu Bozan Şeyler',            category: 'oruc', keywords: ['orucu bozan','oruç bozar','oruç bozulur'] },
  { id: 'orucu_bozmayanlar',        title: 'Orucu Bozmayan Şeyler',         category: 'oruc', keywords: ['orucu bozmayan','oruç bozulmaz','oruçta olur'] },
  { id: 'oruc_fidyesi',             title: 'Oruç Fidyesi',                   category: 'oruc', keywords: ['oruç fidyesi','fidye nedir','oruç fidye'] },
  { id: 'oruc_kazasi',              title: 'Oruç Kazası',                    category: 'oruc', keywords: ['oruç kazası','kaza orucu','oruç kaza'] },
  { id: 'oruc_kefaret',             title: 'Oruç Kefareti',                  category: 'oruc', keywords: ['oruç kefareti','kefaret orucu','oruç kefareti nedir'] },
  { id: 'adetliyken_oruc_kazasi',   title: 'Adet Döneminde Oruç Kazası',    category: 'oruc', keywords: ['adetliyken oruç','hayızda oruç','âdet orucu'] },
  { id: 'sahur_nedir',              title: 'Sahur Nedir?',                   category: 'oruc', keywords: ['sahur nedir','sahur vakti','sahur yemeği'] },
  { id: 'oruc_yolculukta',         title: 'Yolculukta Oruç',               category: 'oruc', keywords: ['yolculukta oruç','seferde oruç','yolcunun orucu'] },
  { id: 'oruc_ve_hastalar',         title: 'Hastalıkta Oruç',               category: 'oruc', keywords: ['hastada oruç','hastalıkta oruç','hasta oruç tutabilir mi'] },
  { id: 'oruc_spor',                title: 'Oruçta Spor Yapılır mı?',       category: 'oruc', keywords: ['oruçta spor','oruçluyken spor','oruç egzersiz'] },
  { id: 'ramazan_nedir',            title: 'Ramazan Ayı',                    category: 'oruc', keywords: ['ramazan nedir','ramazan ayı','ramazan orucu'] },

  // ── ZEKAT ──────────────────────────────────────────────────────────────────
  { id: 'zekat_nedir',              title: 'Zekat Nedir?',                   category: 'zekat', keywords: ['zekat nedir','zekat ne demek','zekat açıklama','zekât'] },
  { id: 'zekat_kimlere_farzdir',    title: 'Zekat Kimlere Farzdır?',        category: 'zekat', keywords: ['zekat kimlere farz','zekat zorunlu','zekat farzdır'] },
  { id: 'zekat_nisap_nedir',        title: 'Zekat Nisabı Nedir?',           category: 'zekat', keywords: ['zekat nisabı','nisap nedir','zekat sınırı'] },
  { id: 'zekat_kime_verilir',       title: 'Zekat Kime Verilir?',           category: 'zekat', keywords: ['zekat kime','zekat alıcıları','zekat hak sahibi'] },
  { id: 'zekat_kime_verilmez',      title: 'Zekat Kime Verilmez?',          category: 'zekat', keywords: ['zekat kime verilmez','zekat kimlere verilmez','zekat yasak'] },
  { id: 'zekat_hesaplama',          title: 'Zekat Hesaplama',               category: 'zekat', keywords: ['zekat hesaplama','zekat miktarı','zekat oranı','zekat nasıl hesaplanır'] },
  { id: 'fitre_nedir',              title: 'Fitre (Sadaka-i Fıtr) Nedir?',  category: 'zekat', keywords: ['fitre nedir','fitre ne demek','sadaka-i fıtr'] },
  { id: 'fitre_ne_zaman_verilir',   title: 'Fitre Ne Zaman Verilir?',       category: 'zekat', keywords: ['fitre ne zaman','fitre vakti','bayramdan önce fitre'] },
  { id: 'fitre_kime_verilir',       title: 'Fitre Kime Verilir?',           category: 'zekat', keywords: ['fitre kime','fitre alıcısı','fitre hak sahibi'] },
  { id: 'sadaka_nedir',             title: 'Sadaka Nedir?',                  category: 'zekat', keywords: ['sadaka nedir','sadaka ne demek','gönüllü bağış'] },
  { id: 'sadaka_kime_verilir',      title: 'Sadaka Kime Verilir?',          category: 'zekat', keywords: ['sadaka kime','sadaka alıcısı','sadaka verme'] },
  { id: 'zekat_ve_sadaka_farki',    title: 'Zekat ve Sadaka Farkı',         category: 'zekat', keywords: ['zekat sadaka farkı','zekat ve sadaka','zekat mı sadaka mı'] },

  // ── HAC / UMRE ─────────────────────────────────────────────────────────────
  { id: 'hac_nedir',                title: 'Hac Nedir?',                     category: 'hac', keywords: ['hac nedir','hac ne demek','hac açıklama'] },
  { id: 'hac_kimlere_farzdır',      title: 'Hac Kimlere Farzdır?',          category: 'hac', keywords: ['hac kimlere farz','hac zorunlu','hac farzdır'] },
  { id: 'haccin_farzlari',          title: 'Haccın Farzları',               category: 'hac', keywords: ['haccın farzları','hac farzları','hac şartları'] },
  { id: 'hac_ile_umre_farki',       title: 'Hac ile Umre Farkı',           category: 'hac', keywords: ['hac umre farkı','hac mı umre mi','hac ve umre'] },
  { id: 'umre_nedir',               title: 'Umre Nedir?',                    category: 'hac', keywords: ['umre nedir','umre ne demek','umre açıklama'] },
  { id: 'ihram_nedir',              title: 'İhram Nedir?',                   category: 'hac', keywords: ['ihram nedir','ihram ne demek','ihrama girmek'] },
  { id: 'tavaf_nedir',              title: 'Tavaf Nedir?',                   category: 'hac', keywords: ['tavaf nedir','tavaf ne demek','kabe tavafı'] },
  { id: 'say_nedir',                title: 'Sa\'y Nedir?',                  category: 'hac', keywords: ["say nedir","sa'y ne demek","safa merve sa'y"] },

  // ── KURBAN / ADAK ──────────────────────────────────────────────────────────
  { id: 'kurban_nedir',             title: 'Kurban Nedir?',                  category: 'kurban', keywords: ['kurban nedir','kurban ne demek','kurban açıklama'] },
  { id: 'kurban_kime_vaciptir',     title: 'Kurban Kime Vaciptir?',          category: 'kurban', keywords: ['kurban kime vacip','kurban zorunlu','kurban kesmek vacip mi'] },
  { id: 'kurban_ne_zaman_kesilir',  title: 'Kurban Ne Zaman Kesilir?',      category: 'kurban', keywords: ['kurban ne zaman','kurban vakti','kurban günleri'] },
  { id: 'kurbanlik_hayvan_sartlari', title: 'Kurbanlık Hayvan Şartları',    category: 'kurban', keywords: ['kurbanlık hayvan','kurban hayvanı şartı','hangi hayvan kurban'] },
  { id: 'kurban_keserken_nelere_dikkat_edilir', title: 'Kurban Keserken Dikkat Edilecekler', category: 'kurban', keywords: ['kurban kesme','kurban keserken','kurban nasıl kesilir'] },
  { id: 'kurban_eti_nasil_paylasilir', title: 'Kurban Eti Nasıl Paylaşılır?', category: 'kurban', keywords: ['kurban eti paylaşımı','kurban eti üçe bölme','kurban eti nasıl'] },
  { id: 'kurban_eti_kimlere_verilir', title: 'Kurban Eti Kimlere Verilir?', category: 'kurban', keywords: ['kurban eti kime','kurban eti dağıtma','kurban eti vermek'] },
  { id: 'kurban_hisse_olur_mu',     title: 'Kurbanda Hisse Olur mu?',       category: 'kurban', keywords: ['kurban hissesi','hisse kurbanı','büyükbaş kurban hisse'] },
  { id: 'kurban_yerine_para_verilir_mi', title: 'Kurban Yerine Para Verilebilir mi?', category: 'kurban', keywords: ['kurban yerine para','kurban bedeli','kurban para mı'] },
  { id: 'vekaletle_kurban',         title: 'Vekaletle Kurban Kesme',        category: 'kurban', keywords: ['vekaleten kurban','kurban vekalet','başkası için kurban'] },
  { id: 'adak_nedir',               title: 'Adak Nedir?',                    category: 'kurban', keywords: ['adak nedir','adak ne demek','nezr nedir'] },
  { id: 'adak_kurbani',             title: 'Adak Kurbanı',                   category: 'kurban', keywords: ['adak kurbanı','adak kurban','adak kurbanı nasıl'] },

  // ── DUA ────────────────────────────────────────────────────────────────────
  { id: 'dua_nedir',                title: 'Dua Nedir?',                     category: 'dua', keywords: ['dua nedir','dua ne demek','dua açıklama'] },
  { id: 'dua_nasil_edilir',         title: 'Dua Nasıl Edilir?',              category: 'dua', keywords: ['dua nasıl edilir','dua etme','dua nasıl yapılır'] },
  { id: 'dua_kabul_olur_mu',        title: 'Dua Kabul Olur mu?',            category: 'dua', keywords: ['dua kabul','dua kabulü','dua makbul','dualar kabul olur mu'] },
  { id: 'dua_vakitleri',            title: 'Duanın Kabul Vakitleri',         category: 'dua', keywords: ['dua vakti','kabul dua vakti','ne zaman dua edilmeli'] },
  { id: 'selamlasma_adabi',         title: 'Selamlaşma Adabı',               category: 'dua', keywords: ['selamlaşma','selam vermek','selam almak','merhaba','as-salamu alaykum'] },

  // ── AİLE / NİKAH ───────────────────────────────────────────────────────────
  { id: 'nikah_nedir',              title: 'Nikah Nedir?',                   category: 'aile', keywords: ['nikah nedir','nikah ne demek','evlilik nikahı'] },
  { id: 'nikah_sartlari',           title: 'Nikahın Şartları',              category: 'aile', keywords: ['nikah şartları','nikah nasıl','nikahın şartı'] },
  { id: 'bosanma_nedir',            title: 'Boşanma (Talak) Nedir?',        category: 'aile', keywords: ['boşanma nedir','talak nedir','boşanmak'] },
  { id: 'talak_nedir',              title: 'Talak Nedir?',                   category: 'aile', keywords: ['talak nedir','talak ne demek','boşama'] },
  { id: 'iddet_nedir',              title: 'İddet Nedir?',                   category: 'aile', keywords: ['iddet nedir','iddet süresi','iddah ne demek'] },
  { id: 'miras_nedir',              title: 'İslam\'da Miras',               category: 'aile', keywords: ['miras nedir','islam mirası','miras hükümleri'] },
  { id: 'miras_paylasimi_genel',    title: 'Miras Paylaşımı',               category: 'aile', keywords: ['miras paylaşımı','miras nasıl','miras bölüşümü'] },
  { id: 'anne_baba_hakki',          title: 'Anne Baba Hakkı',               category: 'aile', keywords: ['anne baba hakkı','ebeveyn hakkı','büyüklere saygı'] },
  { id: 'aile_hakki',               title: 'Aile Hakları',                   category: 'aile', keywords: ['aile hakkı','aile yükümlülüğü','akraba hakları'] },

  // ── FİNANS / TİCARET ────────────────────────────────────────────────────
  { id: 'faiz_nedir',               title: 'Faiz (Riba) Nedir?',            category: 'finans', keywords: ['faiz nedir','faiz ne demek','riba nedir','faiz haram mı'] },
  { id: 'banka_faizi_nedir',        title: 'Banka Faizi',                    category: 'finans', keywords: ['banka faizi','mevduat faiz','bankadan faiz almak'] },
  { id: 'faizli_kredi_kullanmak',   title: 'Faizli Kredi Kullanmak',        category: 'finans', keywords: ['faizli kredi','kredi çekmek','faizli borç'] },
  { id: 'kredi_karti_kullanmak_caiz_mi', title: 'Kredi Kartı Kullanmak Caiz mi?', category: 'finans', keywords: ['kredi kartı','kredi kartı caiz mi','kredi kartı helal mi'] },
  { id: 'helal_kazanc_nedir',       title: 'Helal Kazanç Nedir?',           category: 'finans', keywords: ['helal kazanç','helal gelir','helal iş','helal para'] },
  { id: 'haram_para_kazanmak',      title: 'Haram Para Kazanmak',           category: 'finans', keywords: ['haram para','haram kazanç','haram gelir','haram iş'] },
  { id: 'haram_para_nasil_temizlenir', title: 'Haram Paranın Temizlenmesi', category: 'finans', keywords: ['haram para temizlemek','haram para ne yapılır','haram kazancı temizlemek'] },
  { id: 'supheli_kazanc_ne_yapilir', title: 'Şüpheli Kazanç',              category: 'finans', keywords: ['şüpheli kazanç','şüpheli para','şüpheli gelir'] },
  { id: 'kul_hakki_nedir',          title: 'Kul Hakkı Nedir?',              category: 'finans', keywords: ['kul hakkı nedir','kul hakkı ne demek','başkasının hakkı'] },
  { id: 'kul_hakki_nasil_odenir',   title: 'Kul Hakkı Nasıl Ödenir?',      category: 'finans', keywords: ['kul hakkı ödemek','kul hakkını öde','kul hakkı nasıl'] },
  { id: 'kul_hakki_iceren_alisveris', title: 'Kul Hakkı İçeren Alışveriş', category: 'finans', keywords: ['kul hakkı alışveriş','aldatma alışveriş','haksız ticaret'] },
  { id: 'israf_nedir',              title: 'İsraf Nedir?',                   category: 'finans', keywords: ['israf nedir','israf ne demek','savurganlık','israf haram mı'] },
  { id: 'helal_haram_genel',        title: 'Helal ve Haram Genel',          category: 'finans', keywords: ['helal haram','helal nedir','haram nedir','helal ne demek'] },

  // ── AHLAK / GÜNAH ─────────────────────────────────────────────────────────
  { id: 'giybet_nedir',             title: 'Gıybet Nedir?',                  category: 'ahlak', keywords: ['gıybet nedir','dedikodu nedir','arkadan konuşmak'] },
  { id: 'giybet_ettim_ne_yapmaliyim', title: 'Gıybet Ettim Ne Yapmalıyım?', category: 'ahlak', keywords: ['gıybet ettim','dedikodu yaptım','gıybetten tövbe'] },
  { id: 'yalan_soylemek_gunah_mi',  title: 'Yalan Söylemek Günah mı?',     category: 'ahlak', keywords: ['yalan söylemek','yalan günah','yalan haram mı'] },
  { id: 'kalp_kirmak_kul_hakki_mi', title: 'Kalp Kırmak Kul Hakkı mı?',   category: 'ahlak', keywords: ['kalp kırmak','kalp kırma günah','gönül kırmak'] },
  { id: 'komsuluk_hakki',           title: 'Komşuluk Hakkı',               category: 'ahlak', keywords: ['komşuluk hakkı','komşu hakkı','komşu hakkı nedir'] },
  { id: 'tovbe_nasil_edilir',       title: 'Tövbe Nasıl Edilir?',           category: 'ahlak', keywords: ['tövbe nasıl','tövbe etmek','nasıl tövbe edilir'] },
  { id: 'tovbenin_sartlari',        title: 'Tövbenin Şartları',             category: 'ahlak', keywords: ['tövbenin şartları','tövbe kabul','tövbe şartı'] },
  { id: 'gunah_isledim_ne_yapmaliyim', title: 'Günah İşledim Ne Yapmalıyım?', category: 'ahlak', keywords: ['günah işledim','günah yaptım','günahtan dönmek'] },
  { id: 'ayni_gunahi_tekrar_islemek', title: 'Aynı Günahı Tekrar İşlemek', category: 'ahlak', keywords: ['aynı günahı tekrar','günahı tekrarlamak','tövbeden dönmek'] },
  { id: 'zina_gunahindan_tovbe',    title: 'Zina Günahından Tövbe',        category: 'ahlak', keywords: ['zina tövbe','zinadan dönmek','büyük günahtan tövbe'] },

  // ── YEMIN / KEFARET ─────────────────────────────────────────────────────────
  { id: 'yemin_nedir',              title: 'Yemin Nedir?',                   category: 'yemin', keywords: ['yemin nedir','yemin ne demek','ant içmek'] },
  { id: 'yemin_kefareti',           title: 'Yemin Kefareti',                 category: 'yemin', keywords: ['yemin kefareti','yemin keffareti','yemini bozmanın kefareti'] },
  { id: 'yalan_yere_yemin_etmek',   title: 'Yalan Yere Yemin Etmek',       category: 'yemin', keywords: ['yalan yemin','yalan yere yemin','yalancı yemin'] },
  { id: 'kefaret_nedir',            title: 'Kefaret Nedir?',                 category: 'yemin', keywords: ['kefaret nedir','kefaret ne demek','kefaret ödeme'] },

  // ── HELAL / HARAM GIDA ─────────────────────────────────────────────────────
  { id: 'alkol_gunah_mi',           title: 'Alkol Günah mı?',               category: 'gida', keywords: ['alkol günah','alkol haram','içki haram','içki günah mı'] },
  { id: 'sigara_haram_mi',          title: 'Sigara Haram mı?',              category: 'gida', keywords: ['sigara haram','sigara günah','sigara içmek','tütün haram'] },
  { id: 'bahis_kumar_haram_mi',     title: 'Bahis ve Kumar Haram mı?',      category: 'gida', keywords: ['bahis haram','kumar haram','şans oyunları','kumar oynamak'] },
  { id: 'muzik_dinlemek_gunah_mi',  title: 'Müzik Dinlemek Günah mı?',     category: 'gida', keywords: ['müzik günah','müzik haram','müzik dinlemek','şarkı dinlemek'] },
  { id: 'dovme_yaptirmak_caiz_mi',  title: 'Dövme Yaptırmak Caiz mi?',     category: 'gida', keywords: ['dövme caiz','dövme yaptırmak','dövme günah mı'] },

  // ── MANEVİ / RUHSAL ────────────────────────────────────────────────────────
  { id: 'buyu_var_mi',              title: 'Büyü Var mı?',                   category: 'manevi', keywords: ['büyü var mı','büyü gerçek mi','sihir nedir'] },
  { id: 'buyuden_korunma',          title: 'Büyüden Korunma',               category: 'manevi', keywords: ['büyüden korunmak','büyü korunma','büyüye karşı'] },
  { id: 'nazar_var_mi',             title: 'Nazar Var mı?',                  category: 'manevi', keywords: ['nazar var mı','nazar gerçek mi','nazar değer mi'] },
  { id: 'nazardan_korunma',         title: 'Nazardan Korunma',              category: 'manevi', keywords: ['nazardan korunmak','nazar korunma','nazar boncuğu'] },
  { id: 'cin_var_mi',               title: 'Cin Var mı?',                    category: 'manevi', keywords: ['cin var mı','cin nedir','cinler gerçek mi'] },
  { id: 'cin_musallat_olur_mu',     title: 'Cin Musallat Olur mu?',         category: 'manevi', keywords: ['cin musallat','cinlerin musallat olması','cin çarpmak'] },
  { id: 'vesvese_seytandan_mi',     title: 'Vesvese Şeytandan mı?',        category: 'manevi', keywords: ['vesvese','vesvese şeytan','kötü düşünceler'] },
  { id: 'kotu_ruya_gorunce_ne_yapmali', title: 'Kötü Rüya Görünce Ne Yapmalı?', category: 'manevi', keywords: ['kötü rüya','kötü rüya gördüm','kabus ne yapmalı'] },
  { id: 'korku_gelince_ne_yapmali', title: 'Korku Gelince Ne Yapmalı?',    category: 'manevi', keywords: ['korku dua','korku gelince','korktuğumda ne yapmalı'] },
  { id: 'gece_korkusu_neden_olur',  title: 'Gece Korkusu Neden Olur?',    category: 'manevi', keywords: ['gece korkusu','gece korkmak','karanlıkta korkmak'] },

  // ── DİNİ BİLGİ / GENEL ─────────────────────────────────────────────────────
  { id: 'kandil_geceleri_nedir',    title: 'Kandil Geceleri',               category: 'genel', keywords: ['kandil geceleri','kandil nedir','mübarek geceler'] },
  { id: 'mirac_kandili',            title: 'Miraç Kandili',                  category: 'genel', keywords: ['miraç kandili','miraç nedir','miraç gecesi'] },

  // ─── YENİ EKSİK KONULAR ────────────────────────────────────────────────────
  // NAMAZ (ek)
  { id: 'namaz_nedir',              title: 'Namaz Nedir?',                   category: 'namaz', keywords: ['namaz nedir','namaz ne demek','namaz tanımı','beş vakit namaz'] },
  { id: 'besmele_nedir',            title: 'Besmele Nedir?',                 category: 'genel', keywords: ['besmele nedir','besmele çekmek','bismillah'] },
  { id: 'tesbih_nedir',             title: 'Tesbih Nedir?',                  category: 'dua', keywords: ['tesbih nedir','tesbih çekmek','zikir tesbih'] },
  { id: 'zikir_nedir',              title: 'Zikir Nedir?',                   category: 'dua', keywords: ['zikir nedir','zikir ne demek','Allah\'ı anmak'] },
  { id: 'kuran_nedir',              title: 'Kur\'an Nedir?',                 category: 'genel', keywords: ["kur'an nedir",'kuran nedir','kuran ne demek','kitabı mukaddes'] },
  { id: 'adetliyken_kuran_okunur_mu', title: 'Adetliyken Kur\'an Okunur mu?', category: 'taharet', keywords: ['adetliyken kuran','hayızda kuran okumak','âdetliyken kuran'] },
  { id: 'iman_nedir',               title: 'İman Nedir?',                    category: 'genel', keywords: ['iman nedir','iman ne demek','inanmak','itikad'] },
  { id: 'imanin_sartlari',          title: 'İmanın Şartları',               category: 'genel', keywords: ['imanın şartları','iman şartları','iman esasları','amentü'] },
  { id: 'islamin_sartlari',         title: 'İslam\'ın Şartları',            category: 'genel', keywords: ["islam'ın şartları",'islamın şartları','beş şart','islam beş esas'] },
  { id: 'tevhid_nedir',             title: 'Tevhid Nedir?',                  category: 'genel', keywords: ['tevhid nedir','tevhid ne demek','Allah\'ın birliği','monoteizm'] },
  { id: 'sark_nedir',               title: 'Şirk Nedir?',                   category: 'genel', keywords: ['şirk nedir','şirk ne demek','Allah\'a ortak koşmak'] },
  { id: 'tövbe_nedir',              title: 'Tövbe Nedir?',                   category: 'ahlak', keywords: ['tövbe nedir','tövbe ne demek','günahtan dönmek','pişmanlık'] },
  { id: 'sabir_nedir',              title: 'Sabır Nedir?',                   category: 'ahlak', keywords: ['sabır nedir','sabır ne demek','sabırlı olmak','tahammül'] },
  { id: 'sukur_nedir',              title: 'Şükür Nedir?',                   category: 'ahlak', keywords: ['şükür nedir','şükretmek','Allah\'a şükür','minnet'] },
  { id: 'ihsan_nedir',              title: 'İhsan Nedir?',                   category: 'ahlak', keywords: ['ihsan nedir','ihsan ne demek','güzel ibadet','en iyi ibadet'] },
  { id: 'takva_nedir',              title: 'Takva Nedir?',                   category: 'ahlak', keywords: ['takva nedir','takva ne demek','Allah\'tan korkma','sakınmak'] },
  { id: 'tevekkul_nedir',           title: 'Tevekkül Nedir?',               category: 'ahlak', keywords: ['tevekkül nedir','tevekkül ne demek','Allah\'a güvenmek','tevakül'] },
];

// ─── Load current KB ──────────────────────────────────────────────────────────
function getCurrentKBIds() {
  const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.json'));
  return new Set(files.map(f => f.replace('.json', '')));
}

// ─── Validate ────────────────────────────────────────────────────────────────
function validateKB() {
  const currentIds = getCurrentKBIds();

  const present   = [];
  const missing   = [];
  const seen      = new Set();

  for (const topic of COMPREHENSIVE_TOPICS) {
    if (seen.has(topic.id)) continue;   // skip duplicates in the map above
    seen.add(topic.id);

    if (currentIds.has(topic.id)) {
      present.push(topic);
    } else {
      missing.push(topic);
    }
  }

  return { present, missing, total: seen.size };
}

// ─── Report ──────────────────────────────────────────────────────────────────
function generateReport({ present, missing, total }) {
  const pct = ((present.length / total) * 100).toFixed(1);

  let report = `# Knowledge Base Coverage Report\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Overview\n`;
  report += `| Metric | Value |\n|--------|-------|\n`;
  report += `| Total Topics Defined | ${total} |\n`;
  report += `| Present in KB | ${present.length} |\n`;
  report += `| Missing from KB | ${missing.length} |\n`;
  report += `| Coverage | ${pct}% |\n\n`;

  const byCategory = {};
  for (const t of missing) {
    byCategory[t.category] = (byCategory[t.category] || []);
    byCategory[t.category].push(t.id);
  }

  report += `## Missing by Category\n`;
  for (const [cat, ids] of Object.entries(byCategory)) {
    report += `\n### ${cat} (${ids.length} missing)\n`;
    ids.forEach(id => { report += `- \`${id}\`\n`; });
  }

  report += `\n## Already Present\n`;
  present.forEach(t => { report += `- ✅ \`${t.id}\`\n`; });

  return report;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(KB_DIR)) {
    console.error(`❌ KB directory not found: ${KB_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const result = validateKB();

  console.log(`\n📊 Knowledge Base Validation`);
  console.log(`   Defined topics : ${result.total}`);
  console.log(`   Present in KB  : ${result.present.length}`);
  console.log(`   Missing        : ${result.missing.length}`);
  console.log(`   Coverage       : ${((result.present.length / result.total) * 100).toFixed(1)}%\n`);

  if (result.missing.length > 0) {
    console.log('❌ MISSING ENTRIES:');
    result.missing.forEach(t => console.log(`   - ${t.id} (${t.category})`));
  }

  // Write outputs
  const missingPath = path.join(OUTPUT_DIR, 'missing-questions.json');
  fs.writeFileSync(missingPath, JSON.stringify({ missing: result.missing, generatedAt: new Date().toISOString() }, null, 2));
  console.log(`\n💾 Missing list saved: ${missingPath}`);

  const reportPath = path.join(__dirname, 'kb-coverage-report.md');
  fs.writeFileSync(reportPath, generateReport(result));
  console.log(`📄 Coverage report saved: ${reportPath}`);

  return result;
}

module.exports = { validateKB, COMPREHENSIVE_TOPICS };

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
