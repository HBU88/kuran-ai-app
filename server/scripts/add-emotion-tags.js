#!/usr/bin/env node
/**
 * add-emotion-tags.js
 * Mevcut 220 ilmihal JSON dosyasına emotion_tags ve category_type field'ı ekler.
 * Mevcut field'lara DOKUNMAZ — sadece ekler.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const ILMIHAL_DIR = path.join(__dirname, "../data/ilmihal");

// ── Emotion etiketleri ───────────────────────────────────────────────────────
// Dosya adı → emotion_tags listesi
// Bilinmeyenler 'general' alır.
const EMOTION_MAP = {
  // ── Tövbe / günah / pişmanlık ──────────────────────────────────────────────
  "tovbe_nedir.json":               ["guilt", "forgiveness", "hope", "repentance"],
  "tövbe_nedir.json":               ["guilt", "forgiveness", "hope", "repentance"],
  "tovbe_nasil_edilir.json":        ["guilt", "repentance", "hope", "forgiveness"],
  "tovbenin_sartlari.json":         ["guilt", "repentance", "hope", "forgiveness"],
  "zina_gunahindan_tovbe.json":     ["guilt", "repentance", "hope", "forgiveness"],
  "ayni_gunahi_tekrar_islemek.json":["guilt", "repentance", "hope"],
  "gunah_isledim_ne_yapmaliyim.json":["guilt","repentance","hope","forgiveness"],
  "giybet_ettim_ne_yapmaliyim.json":["guilt", "repentance", "guidance"],
  "giybet_nedir.json":              ["guilt", "guidance", "justice"],
  // ── Kul hakkı / adalet ────────────────────────────────────────────────────
  "kul_hakki_nedir.json":           ["guilt", "justice", "guidance"],
  "kul_hakki_nasil_odenir.json":    ["guilt", "justice", "repentance", "guidance"],
  "kul_hakki_iceren_alisveris.json":["guilt", "justice", "conscience"],
  "kalp_kirmak_kul_hakki_mi.json":  ["guilt", "justice", "guidance"],
  "komsuluk_hakki.json":            ["justice", "guidance", "peace"],
  "aile_hakki.json":                ["justice", "guidance", "family"],
  "anne_baba_hakki.json":           ["guilt", "justice", "family", "guidance"],
  // ── Sabır / zorluk / teselli ──────────────────────────────────────────────
  "sabir_nedir.json":               ["sadness", "anxiety", "patience", "hope"],
  "tevekkul_nedir.json":            ["hope", "patience", "peace", "guidance"],
  "kaza_kader_nedir.json":          ["hope", "patience", "guidance", "peace"],
  "hicret_nedir.json":              ["guidance", "patience", "hope"],
  // ── Dua / zikir / namaz ───────────────────────────────────────────────────
  "dua_nedir.json":                 ["anxiety", "hope", "guidance", "peace"],
  "dua_nasil_edilir.json":          ["hope", "anxiety", "peace", "guidance"],
  "dua_kabul_olur_mu.json":         ["hope", "anxiety", "guidance"],
  "dua_vakitleri.json":             ["hope", "peace", "guidance"],
  "zikir_nedir.json":               ["peace", "gratitude", "hope", "spiritual_connection"],
  "tesbih_nedir.json":              ["peace", "guidance", "gratitude"],
  "kunut_duasi.json":               ["hope", "peace", "guidance", "spiritual_connection"],
  "tahiyyat_duasi.json":            ["peace", "guidance", "spiritual_connection"],
  "subhaneke_nedir.json":           ["peace", "guidance", "spiritual_connection"],
  "salli_barik_nedir.json":         ["peace", "guidance", "spiritual_connection"],
  "allahumme_salli_nedir.json":     ["peace", "guidance", "spiritual_connection"],
  "namazda_salavat_nedir.json":     ["peace", "guidance", "spiritual_connection"],
  "namaza_baslangic_duasi.json":    ["peace", "guidance", "spiritual_connection"],
  "besmele_nedir.json":             ["peace", "guidance", "spiritual_connection"],
  "ezan_metni.json":                ["peace", "guidance", "spiritual_connection"],
  // ── Namaz ─────────────────────────────────────────────────────────────────
  "namaz_nedir.json":               ["peace", "spiritual_connection", "hope"],
  "namaz_nasil_kilinir.json":       ["guidance", "peace", "spiritual_connection"],
  "namaz_farzlari.json":            ["guidance", "peace"],
  "namaz_vacipleri.json":           ["guidance"],
  "namaz_kimlere_farzdir.json":     ["guidance"],
  "namaz_vakitleri.json":           ["guidance", "peace"],
  "namaz_niyeti.json":              ["guidance", "confidence"],
  "namaz_hizli_kilinirsa_olur_mu.json":["guidance"],
  "namaz_kacirinca_ne_yapilir.json":["guilt", "guidance"],
  "namazi_bozanlar.json":           ["guidance"],
  "namaz_tesbihleri.json":          ["peace", "guidance", "spiritual_connection"],
  "namazda_okunan_sureler.json":    ["guidance", "peace"],
  "namazda_sasirma_ne_yapilir.json":["guidance"],
  "nafile_namaz_nedir.json":        ["peace", "guidance", "spiritual_connection"],
  "gec_kalinan_namaz_nasil_kilinir.json":["guilt", "guidance"],
  "sabah_namazi.json":              ["peace", "guidance", "spiritual_connection"],
  "aksam_namazi.json":              ["peace", "guidance", "spiritual_connection"],
  "teravih_namazi.json":            ["peace", "guidance", "spiritual_connection"],
  "vitir_vacip.json":               ["guidance", "peace"],
  "vitir_kilinmazsa_ne_olur.json":  ["guidance", "guilt"],
  "isyerinde_namaz_kilinir_mi.json":["guidance"],
  "aracta_namaz_kilinir_mi.json":   ["guidance"],
  "oturarak_namaz_kilinir_mi.json": ["guidance", "patience"],
  "cem_edilerek_namaz_kilinir_mi.json":["guidance"],
  "yolculukta_namaz_nasil_kilinir.json":["guidance", "patience"],
  // ── Cuma / Bayram ─────────────────────────────────────────────────────────
  "cuma_namazi_nedir.json":         ["peace", "guidance", "spiritual_connection"],
  "cuma_namazi_kac_rekat.json":     ["guidance"],
  "cuma_namazi_kimlere_farzdır.json":["guidance"],
  "cuma_namazinda_okunan_sureler.json":["guidance", "peace"],
  "bayram_namazi_nedir.json":       ["peace", "gratitude", "guidance"],
  "bayram_namazi_nasil_kilinir.json":["guidance", "peace"],
  "bayram_namazi_kac_rekat.json":   ["guidance"],
  "bayram_namazinda_okunanlar.json":["guidance", "peace"],
  "bayram_namazi_ilave_tekbirleri.json":["guidance"],
  // ── Abdest / gusül / taharet ──────────────────────────────────────────────
  "abdest.json":                    ["peace", "guidance", "spiritual_connection"],
  "abdest_bozanlar.json":           ["guidance", "peace"],
  "gusul.json":                     ["guidance", "peace"],
  "teyemmum_nedir.json":            ["guidance"],
  "teyemmum_nasil_alinir.json":     ["guidance"],
  "teyemmumu_bozanlar.json":        ["guidance"],
  "mest_uzerine_mesh.json":         ["guidance"],
  "sargi_uzerine_mesh.json":        ["guidance"],
  "ozur_kani_namaz.json":           ["guidance", "patience"],
  // ── Hayız / nifas / istihaze ──────────────────────────────────────────────
  "hayiz_nedir.json":               ["guidance", "patience"],
  "hayiz_halinde_namaz_oruc.json":  ["guidance", "patience"],
  "adetliyken_kuran_okunur_mu.json":["guidance", "patience"],
  "adetliyken_oruc_kazasi.json":    ["guidance", "patience"],
  "nifas_nedir.json":               ["guidance", "patience"],
  "istihaze_nedir.json":            ["guidance", "patience"],
  // ── Oruç ──────────────────────────────────────────────────────────────────
  "oruc_nedir.json":                ["patience", "guidance", "spiritual_connection"],
  "oruc_kimlere_farzdir.json":      ["guidance", "patience"],
  "orucu_bozanlar.json":            ["guidance"],
  "orucu_bozmayanlar.json":         ["guidance"],
  "oruc_kazasi.json":               ["guilt", "guidance"],
  "oruc_kefaret.json":              ["guilt", "repentance", "guidance"],
  "oruc_fidyesi.json":              ["guidance"],
  "oruc_spor.json":                 ["guidance"],
  "oruc_ve_hastalar.json":          ["guidance", "patience"],
  "oruc_yolculukta.json":           ["guidance", "patience"],
  "sahur_nedir.json":               ["guidance", "patience"],
  "ramazan_nedir.json":             ["patience", "guidance", "peace", "spiritual_connection"],
  // ── Zekat / sadaka / fitre ────────────────────────────────────────────────
  "zekat_nedir.json":               ["gratitude", "guidance"],
  "zekat_kimlere_farzdir.json":     ["guidance"],
  "zekat_kime_verilir.json":        ["gratitude", "guidance"],
  "zekat_kime_verilmez.json":       ["guidance"],
  "zekat_hesaplama.json":           ["guidance"],
  "zekat_nisap_nedir.json":         ["guidance"],
  "zekat_ve_sadaka_farki.json":     ["gratitude", "guidance"],
  "sadaka_nedir.json":              ["gratitude", "guidance", "hope"],
  "sadaka_kime_verilir.json":       ["gratitude", "guidance"],
  "fitre_nedir.json":               ["gratitude", "guidance"],
  "fitre_kime_verilir.json":        ["gratitude", "guidance"],
  "fitre_ne_zaman_verilir.json":    ["guidance"],
  // ── Hac / umre ────────────────────────────────────────────────────────────
  "hac_nedir.json":                 ["spiritual_connection", "guidance", "peace"],
  "hac_kimlere_farzdır.json":       ["guidance"],
  "haccin_farzlari.json":           ["guidance"],
  "hac_ile_umre_farki.json":        ["guidance"],
  "ihram_nedir.json":               ["guidance"],
  "tavaf_nedir.json":               ["guidance", "spiritual_connection"],
  "say_nedir.json":                 ["guidance"],
  "umre_nedir.json":                ["spiritual_connection", "guidance", "peace"],
  // ── Kurban / adak ─────────────────────────────────────────────────────────
  "kurban_nedir.json":              ["gratitude", "guidance", "spiritual_connection"],
  "kurban_kime_vaciptir.json":      ["guidance"],
  "kurban_ne_zaman_kesilir.json":   ["guidance"],
  "kurban_eti_nasil_paylasilir.json":["gratitude", "guidance"],
  "kurban_eti_kimlere_verilir.json":["gratitude", "guidance"],
  "kurban_hisse_olur_mu.json":      ["guidance"],
  "kurban_yerine_para_verilir_mi.json":["guidance"],
  "kurbanlik_hayvan_sartlari.json": ["guidance"],
  "kurban_keserken_nelere_dikkat_edilir.json":["guidance"],
  "vekaletle_kurban.json":          ["guidance"],
  "adak_nedir.json":                ["gratitude", "guidance"],
  "adak_kurbani.json":              ["gratitude", "guidance"],
  // ── Gece ibadetleri / kandil ──────────────────────────────────────────────
  "gece_ibadetleri.json":           ["peace", "spiritual_connection", "hope"],
  "kandil_geceleri_nedir.json":     ["peace", "hope", "spiritual_connection"],
  "mirac_kandili.json":             ["hope", "peace", "spiritual_connection"],
  // ── Iman / akaid ──────────────────────────────────────────────────────────
  "iman_nedir.json":                ["hope", "guidance", "peace", "confidence"],
  "imanin_sartlari.json":           ["guidance", "hope", "confidence"],
  "islamin_sartlari.json":          ["guidance", "hope", "confidence"],
  "tevhid_nedir.json":              ["hope", "confidence", "peace"],
  "ihsan_nedir.json":               ["hope", "confidence", "guidance", "peace"],
  "takva_nedir.json":               ["hope", "guidance", "confidence", "peace"],
  "kelime_i_sehadet.json":          ["hope", "confidence", "guidance"],
  "kelime_i_tevhid.json":           ["hope", "confidence", "peace"],
  "kuran_nedir.json":               ["hope", "guidance", "confidence"],
  "peygamberler_nedir.json":        ["hope", "guidance", "confidence"],
  "melekler_nedir.json":            ["hope", "guidance", "fear"],
  "kutsal_kitaplar_nedir.json":     ["guidance", "hope"],
  "sunnet_nedir.json":              ["guidance", "confidence"],
  "kabir_hayati_nedir.json":        ["fear", "guidance", "hope"],
  "kiyamet_alametleri.json":        ["fear", "guidance", "hope"],
  "cehennem_nedir.json":            ["fear", "guidance"],
  "cennet_nedir.json":              ["hope", "guidance", "peace"],
  "sahabeler_kimdir.json":          ["guidance", "hope"],
  "dort_halife_kimdir.json":        ["guidance", "confidence"],
  // ── Peygamber kısasları ───────────────────────────────────────────────────
  "hz_muhammed_hayati.json":        ["hope", "guidance", "patience", "confidence"],
  "hz_ibrahim_kimdir.json":         ["hope", "patience", "faith", "guidance"],
  "hz_musa_kimdir.json":            ["hope", "patience", "guidance", "confidence"],
  "hz_isa_kimdir.json":             ["hope", "guidance", "faith"],
  "hz_yusuf_kimdir.json":           ["hope", "patience", "sadness", "guidance"],
  "hz_eyyub_kimdir.json":           ["hope", "patience", "sadness", "guidance"],
  "hz_yunus_kimdir.json":           ["hope", "repentance", "guidance", "forgiveness"],
  "hz_adem_kimdir.json":            ["hope", "guidance", "repentance"],
  "hz_nuh_kimdir.json":             ["hope", "patience", "guidance"],
  "hz_davud_kimdir.json":           ["hope", "patience", "guidance", "gratitude"],
  "hz_suleyman_kimdir.json":        ["hope", "guidance", "gratitude"],
  "hz_yahya_kimdir.json":           ["hope", "guidance", "patience"],
  "hz_zekeriya_kimdir.json":        ["hope", "guidance", "patience"],
  "hz_ismail_kimdir.json":          ["hope", "patience", "guidance"],
  "hz_ishak_kimdir.json":           ["hope", "guidance"],
  "hz_yakup_kimdir.json":           ["sadness", "hope", "patience", "guidance"],
  "hz_lut_kimdir.json":             ["guidance", "hope"],
  "hz_hud_kimdir.json":             ["guidance", "hope", "patience"],
  "hz_salih_kimdir.json":           ["guidance", "hope", "patience"],
  "hz_suayb_kimdir.json":           ["justice", "guidance", "hope"],
  "hz_idris_kimdir.json":           ["guidance", "hope"],
  "hz_ilyas_kimdir.json":           ["guidance", "hope", "patience"],
  "hz_elyesa_kimdir.json":          ["guidance", "hope"],
  "hz_harun_kimdir.json":           ["guidance", "hope", "patience"],
  "hz_zulkifl_kimdir.json":         ["guidance", "hope", "patience"],
  "hz_ali_kimdir.json":             ["guidance", "justice", "confidence"],
  "hz_ebubekir_kimdir.json":        ["guidance", "hope", "confidence"],
  "hz_omer_kimdir.json":            ["guidance", "justice", "confidence"],
  "hz_osman_kimdir.json":           ["guidance", "confidence"],
  // ── Korku / kaygı / vesves ────────────────────────────────────────────────
  "korku_gelince_ne_yapmali.json":  ["fear", "anxiety", "guidance", "peace"],
  "gece_korkusu_neden_olur.json":   ["fear", "anxiety", "guidance", "peace"],
  "vesvese_seytandan_mi.json":      ["anxiety", "fear", "guidance", "peace"],
  "kotu_ruya_gorunce_ne_yapmali.json":["fear", "anxiety", "guidance", "peace"],
  "cin_var_mi.json":                ["fear", "guidance"],
  "cin_musallat_olur_mu.json":      ["fear", "anxiety", "guidance"],
  "nazar_var_mi.json":              ["fear", "anxiety", "guidance"],
  "nazardan_korunma.json":          ["fear", "anxiety", "guidance", "peace"],
  "buyu_var_mi.json":               ["fear", "anxiety", "guidance"],
  "buyuden_korunma.json":           ["fear", "anxiety", "guidance", "peace"],
  // ── Aile / nikah / boşanma ────────────────────────────────────────────────
  "nikah_nedir.json":               ["hope", "guidance", "family"],
  "nikah_sartlari.json":            ["guidance", "family"],
  "bosanma_nedir.json":             ["sadness", "guidance", "patience", "family"],
  "talak_nedir.json":               ["sadness", "guidance", "patience", "family"],
  "iddet_nedir.json":               ["guidance", "patience"],
  "miras_nedir.json":               ["justice", "guidance"],
  "miras_paylasimi_genel.json":     ["justice", "guidance", "anxiety"],
  // ── Haram / helal / para ──────────────────────────────────────────────────
  "helal_haram_genel.json":         ["guidance", "anxiety"],
  "helal_kazanc_nedir.json":        ["guidance", "confidence", "gratitude"],
  "haram_para_kazanmak.json":       ["guilt", "anxiety", "guidance"],
  "haram_para_nasil_temizlenir.json":["guilt", "repentance", "guidance", "hope"],
  "supheli_kazanc_ne_yapilir.json": ["guilt", "anxiety", "guidance"],
  "faiz_nedir.json":                ["guilt", "anxiety", "guidance"],
  "faizli_kredi_kullanmak.json":    ["guilt", "anxiety", "guidance"],
  "banka_faizi_nedir.json":         ["guilt", "anxiety", "guidance"],
  "kredi_karti_kullanmak_caiz_mi.json":["anxiety", "guidance"],
  "bahis_kumar_haram_mi.json":      ["guilt", "guidance"],
  "sigara_haram_mi.json":           ["guilt", "guidance"],
  "alkol_gunah_mi.json":            ["guilt", "guidance", "repentance"],
  "dovme_yaptirmak_caiz_mi.json":   ["guilt", "guidance"],
  "muzik_dinlemek_gunah_mi.json":   ["guilt", "guidance"],
  "israf_nedir.json":               ["guilt", "guidance"],
  // ── Sünnet / ahlak / şükür ────────────────────────────────────────────────
  "sukur_nedir.json":               ["gratitude", "peace", "hope"],
  "selamlasma_adabi.json":          ["peace", "guidance"],
  "niyet_nasil.json":               ["guidance", "confidence"],
  "kefaret_nedir.json":             ["guilt", "repentance", "guidance"],
  "yemin_nedir.json":               ["guidance", "justice"],
  "yalan_soylemek_gunah_mi.json":   ["guilt", "guidance", "justice"],
  "yalan_yere_yemin_etmek.json":    ["guilt", "guidance", "justice"],
  "yemin_kefareti.json":            ["guilt", "repentance", "guidance"],
  "sark_nedir.json":                ["guidance"],
  // ── Genel ─────────────────────────────────────────────────────────────────
};

// ── category_type haritası ───────────────────────────────────────────────────
function getCategoryType(filename) {
  if (/^(namaz|abdest|gusul|teyemmum|oruc|zekat|hac|umre|kurban|adak|vitir|cuma|bayram|sahur|ramazan|teravih|nafile|gece_ib|mirac|kandil)/.test(filename)) return "ibadet";
  if (/^(giybet|yalan|israf|alkol|sigara|bahis|kumar|dovme|muzik|kul_hakki|aile_hakki|anne_baba|komsuluk|kalp_kir|helal|haram|faiz|banka|kredi|supheli|haram_para)/.test(filename)) return "ahlak";
  if (/^(iman|imanin|islamin|tevhid|ihsan|takva|kelime|kuran|peygamber|melekler|kutsal|sunnet|kabir|kiyamet|cehennem|cennet|sahabe|dort_halife|kaza_kader)/.test(filename)) return "akaid";
  if (/^(hz_)/.test(filename)) return "kisas_enbiya";
  if (/^(dua|zikir|tesbih|kunut|tahiyyat|subhaneke|salli|allahumme|namazda_sal|namaza_basl|besmele|ezan|sukur)/.test(filename)) return "dua_zikir";
  if (/^(nikah|bosanma|talak|iddet|miras)/.test(filename)) return "aile_hukuku";
  if (/^(zekat|sadaka|fitre|infak)/.test(filename)) return "zekat_sadaka";
  if (/^(buyu|buyuden|cin|nazar|nazardan|vesvese|korku|gece_korku|kotu_ruya)/.test(filename)) return "korku_kaygi";
  if (/^(tovbe|tövbe|tovbenin|gunah|zina|ayni_gunahi|giybet_ettim)/.test(filename)) return "tovbe_istigfar";
  return "genel";
}

// ── Ana script ───────────────────────────────────────────────────────────────
function main() {
  const files = fs.readdirSync(ILMIHAL_DIR).filter(f => f.endsWith(".json"));
  console.log(`\n🔄 ${files.length} dosya işlenecek...\n`);

  let updated = 0, skipped = 0, errors = 0;

  for (const filename of files) {
    const filepath = path.join(ILMIHAL_DIR, filename);
    try {
      const raw  = fs.readFileSync(filepath, "utf8");
      const data = JSON.parse(raw);

      // Zaten emotion_tags varsa skip
      if (data.emotion_tags && data.category_type) {
        console.log(`⏭️  ${filename} (zaten işlenmiş)`);
        skipped++;
        continue;
      }

      // Emotion tags belirle
      const emotionTags = EMOTION_MAP[filename] || ["general"];
      const categoryType = getCategoryType(filename);

      // Yalnızca yoksa ekle
      if (!data.emotion_tags)   data.emotion_tags   = emotionTags;
      if (!data.category_type)  data.category_type  = categoryType;

      // Güncelle
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf8");
      console.log(`✅ ${filename} → emotion: [${emotionTags.join(", ")}] | cat: ${categoryType}`);
      updated++;
    } catch (err) {
      console.error(`❌ ${filename}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n📊 SONUÇ: ${updated} güncellendi | ${skipped} atlandı | ${errors} hata`);

  // Doğrulama
  let valid = 0, invalid = 0;
  for (const filename of files) {
    const filepath = path.join(ILMIHAL_DIR, filename);
    try {
      const data = JSON.parse(fs.readFileSync(filepath, "utf8"));
      if (Array.isArray(data.emotion_tags) && data.category_type) valid++;
      else invalid++;
    } catch {
      invalid++;
    }
  }
  console.log(`✅ Doğrulama: ${valid}/${files.length} dosya geçerli`);
  if (invalid > 0) console.warn(`⚠️  ${invalid} dosya doğrulanamadı`);
}

main();
