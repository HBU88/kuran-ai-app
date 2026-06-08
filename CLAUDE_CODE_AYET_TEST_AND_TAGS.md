# HAKAI — Ayet Rehberi: Pre-Launch Test + Duygu Etiket Denetimi

## BAĞLAM

HAKAI uygulaması App Store'a gönderilmeden önce iki kritik görev var:

1. **50-soru pre-launch testi** — live backend'e soru göndererek yanıt kalitesini ölç
2. **Duygu etiketi denetimi** — `assets/data/ayahs.json`'daki ayetlerin tag'larını denetle ve eksik/zayıf olanları güncelle

**Backend:** https://hakai-backend.onrender.com  
**Ayet dataset:** `assets/data/ayahs.json` (97 curated ayet)  
**Havuz dataset:** `server/data/ayet-rehberi/havuz.json` (378 ayet, kategorize edilmiş)  
**Test dosyası:** `server/tests/ayet_50_prelaunch.mjs` (hazır — sadece çalıştır)  
**Rapor:** `server/tests/ayet_50_report.json` (test sonrası oluşur)

---

## GÖREV 1 — 50-Soru Pre-Launch Testi

### Adım 1.1 — Önce dosyaları oku

Şu dosyaları oku, değişiklik yapma:
- `server/tests/ayet_50_prelaunch.mjs` — test kodunu anlamak için
- `server/agent/ayah_ranker.js` — ranker mantığını anlamak için
- `assets/data/ayahs.json` — hangi ayetlerin curated olduğunu görmek için

### Adım 1.2 — Backend health check

```bash
curl -s https://hakai-backend.onrender.com/health | python3 -m json.tool
```

`ok: true` ve `openai_configured: true` görmelisin. Değilse 15 saniye bekle (Render cold-start) ve tekrar dene.

### Adım 1.3 — Testi çalıştır

```bash
node server/tests/ayet_50_prelaunch.mjs
```

Bu komut:
- 50 soruyu sırayla backend'e gönderir (~3-5 dakika sürer)
- `server/tests/ayet_50_report.json` dosyasına JSON rapor yazar
- Terminal'e özet basar

**App Store eşikleri:**
| Kriter | Gerekli |
|--------|---------|
| PASS oranı | ≥ 44/50 (%88) |
| FAIL sayısı | ≤ 3 |
| Ort. yanıt süresi | ≤ 6 saniye |
| Kategori E edge case | ≥ 3/5 |
| "bana bir ayet ver" İnşirah bug | ❌ olmamalı |

### Adım 1.4 — Raporu analiz et

`server/tests/ayet_50_report.json` okunduktan sonra:

- FAIL olan her soru için root cause tespit et
- Olası nedenler:
  - **Yanlış ayet** → `ayah_ranker.js`'de hangi tag grubu tetikleniyor?
  - **Boş yanıt** → backend'de OpenAI timeout mu, route hatası mı?
  - **İnşirah 94 fallback** → override mantığında bug var mı?
  - **WARN (bağlam zayıf)** → tag eksikliği mi?

Her FAIL için şunu raporla:
```
FAIL #XX [kategori:soru]
  Soru    : ...
  Dönen   : Surah X:Y
  Beklenen: Surah A, B, C
  Neden   : ...
  Önerilen düzeltme: ayahs.json tag ekleme / ranker fix / OpenAI prompt fix
```

**DEĞİŞİKLİK YAPMA** — sadece analiz et ve raporla. Düzeltmeler Görev 2 kapsamında.

---

## GÖREV 2 — Duygu Etiketi Denetimi ve Güncelleme

### Bağlam

`assets/data/ayahs.json` dosyasındaki her ayet şu yapıya sahip:

```json
{
  "id": 1,
  "surah": "İnşirah",
  "surahNumber": 94,
  "ayah": 5,
  "ayahNumber": 5,
  "text_ar": "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
  "text_tr": "Şüphesiz zorlukla beraber bir kolaylık vardır.",
  "tags": ["umut", "sabır", "sebat"],
  "short_explanation": "...",
  "notes": "..."
}
```

Ranker sistemi (`server/agent/ayah_ranker.js`) ayetleri kullanıcı duygusuna göre eşleştirirken **tag'lara** dayanır. Eksik veya yanlış tag → yanlış ayet eşleşmesi → App Store'da kullanıcı memnuniyetsizliği.

### Mevcut Tag Listesi

```
sabır, umut, sebat, tevekkül, tövbe, şükür, huzur, yalnızlık, korku, kaygı,
öfke, sevinç, hüzün, pişmanlık, iman, rahmet, dua, adalet, ahiret, ölüm,
evlilik, aile, şifa, mucizeler, peygamberler, günahlar, bağışlanma, istiğfar,
affetmek, merhamet, iyilikler, kötülükler, haramlar, kibir, haset, gıybet,
cömertlik, infak, emanet, doğruluk, irade, zikir, zulüm, çocuk, anne-baba,
kul hakkı, helal, hesap, ibadet, takva, tefekkür, yaratılış, güzel ahlak,
İsra ve Mirac, Kur'an, Hz. Musa, Hz. İbrahim, Hz. İsa, Hz. Muhammed,
Hz. Süleyman, Hz. Davud, Hz. Zekeriyya, Hz. Meryem, Hz. Âdem,
Allah'a yakınlık, Allah'a yöneliş, Allah'ın rahmeti, Allah'ı anma,
kalp huzuru, manevi sükunet, korunma, rehberlik, yardım dileme,
çaresizlik, ölçü, eşitlik, haksızlık, hastalık, şükür, sevinç
```

Yeni tag ekleyebilirsin — mevcut listeyle tutarlı olmalı (Türkçe, küçük harf, kavramsal).

### Adım 2.1 — Her ayeti duygu açısından denetle

`assets/data/ayahs.json` dosyasını oku. Her ayet için:

1. `text_tr` mealini ve `short_explanation`'ı değerlendir
2. Mevcut `tags[]` listesinin yeterli olup olmadığını kontrol et
3. Şu kriterlere göre SORUN işaretle:

**SORUN kriterleri:**
- Tag sayısı ≤ 1 → çok zayıf kapsam
- Mealdeki ana duygu/tema tag listesinde yok (örn. ayetin içeriği "şifa" ama tags'de "şifa" yok)
- Kullanıcı senaryosu eşleşmesi eksik: `havuz.json`'da bu ayet hangi kategoride? O kategorinin duygusal tema tag'ı `ayahs.json`'da var mı?
- `havuz.json`'da olan ama `ayahs.json`'da olmayan ayetler → bunlar için de tag öner (ama ayahs.json'a ekleme — sadece listele)

**Özel dikkat gerektiren ayetler (Görev 1 FAIL/WARN analizi ile çapraz kontrol et):**
Test'te WARN veya FAIL alan soruların konusuyla ilgili ayetler öncelikli.

### Adım 2.2 — Eksik tag'ları belirle

Her sorunlu ayet için:
```
AYET: Surah X:Y (id: N)
  Mevcut tags : [...]
  Eksik tags  : [...]
  Gerekçe     : Bu ayetin içeriği X, Y, Z duygularını kapsar çünkü ...
  Havuz kategorisi: sadness / hope / patience / ...
```

**DİNİ İÇERİK HASSAS KURALI:**
- Mealin açıkça desteklemediği bir tag ekleme
- "Genel anlamda iyi" gerekçesiyle belirsiz tag koyma
- Emin olmadığında tag önerme, sadece "belirsiz" olarak işaretle

### Adım 2.3 — ayahs.json'u güncelle

Belirlenen eksik tag'ları `assets/data/ayahs.json` dosyasına ekle.

**Güncelleme kuralları:**
1. Mevcut tag'ları silme — sadece eksik olanları ekle
2. Tag sıralaması: en belirgin/birincil tema önce
3. Her değişiklik için kısa gerekçe yaz (iç yorum — dosyaya değil, terminale)
4. Maximum 6 tag per ayet (aşarsa önceliklendirme yap)

**Format — sadece `tags` alanını güncelle, diğer alanlar değişmez:**
```json
"tags": ["mevcut_tag1", "mevcut_tag2", "yeni_tag1", "yeni_tag2"]
```

### Adım 2.4 — Havuz-Curated fark analizi

`server/data/ayet-rehberi/havuz.json` okunarak şunları tespit et:

1. Havuzda olup `ayahs.json`'da **olmayan** önemli ayetler (surahNumber + ayahNumber ile karşılaştır)
2. Bu ayetlerin kategorileri ve duygu tag önerileri
3. Öncelik sırası: test'te WARN/FAIL alan kategorilerle örtüşen ayetler önce

**Listeyi terminale bas — ayahs.json'a ekleme yapma** (bu ayrı bir sprint):
```
HAVUZDA VAR, CURATED'DA YOK:
  Zümer 39:10 — sabır, umut, tevekkül → test'te "sabır konusu" WARN aldı
  Ra'd 13:28 — huzur, zikir, kalp huzuru → test'te "huzur için" WARN aldı
  ...
```

---

## GÖREV 3 — Sonrası

### Adım 3.1 — Test sonuçlarını değerlendir

App Store eşikleri karşılandı mı?

```
GENEL DURUM: ✅ HAZIR / ❌ EŞİK SAĞLANAMADI
PASS: X/50  WARN: Y/50  FAIL: Z/50
Ortalama yanıt: Xms
```

Eşik karşılanmadıysa hangi kategoride sorun var, hangi dosyada düzeltme gerekiyor yaz.

### Adım 3.2 — Regresyon testi çalıştır

```bash
node server/tests/ayet_full_audit.mjs
```

ayahs.json tag güncellemesinden sonra offline ranker testi 60/60 geçmeli. Geçmezse hangi tag değişikliğinin bozduğunu tespit et.

### Adım 3.3 — dart analyze

```bash
dart analyze
```

Hata yoksa tüm testler tamamlandı demektir.

---

## ÇALIŞTIRMA SIRASI

```bash
# 1. Backend kontrol
curl -s https://hakai-backend.onrender.com/health

# 2. 50-soru test (3-5 dakika)
node server/tests/ayet_50_prelaunch.mjs

# 3. Offline ranker regresyon testi
node server/tests/ayet_full_audit.mjs

# 4. Dart analiz
dart analyze
```

---

## RAPOR FORMATI (sonda bas)

```
═══════════════════════════════════════════════════════════════
 HAKAI — Pre-Launch Denetim Raporu
═══════════════════════════════════════════════════════════════

[GÖREV 1 — 50-SORU TEST]
  PASS   : X/50
  WARN   : Y/50
  FAIL   : Z/50
  Ort. yanıt : Xms
  App Store  : ✅ HAZIR / ❌ EŞİK SAĞLANAMADI

  FAIL listesi:
    #XX [kategori] — neden + önerilen düzeltme

[GÖREV 2 — DUYGU ETİKET DENETİMİ]
  Güncellenen ayet : X
  Eklenen tag      : Y adet
  
  Değiştirilen ayetler:
    Surah X:Y → eklendi: [tag1, tag2]
    ...

  Havuzda olup curated'da olmayan (öncelikli):
    ...

[GÖREV 3 — REGRESYON]
  ayet_full_audit.mjs : ✅ X/60 GEÇTI / ❌ Y BAŞARISIZ
  dart analyze        : ✅ TEMİZ / ❌ HATALAR

[DEĞİŞTİRİLEN DOSYALAR]
  - assets/data/ayahs.json (tag güncellemeleri)
  - server/tests/ayet_50_report.json (test raporu, otomatik oluştu)

[KALAN RİSKLER]
  ...
```

---

## ÖNEMLİ NOTLAR

- **Dini içerik hassasiyeti:** Yanlış etiket, yanlış ayet eşleşmesine yol açar. Emin olmadığın tag'ı ekleme.
- **Test süresi:** 50-soru test ~3-5 dakika. Sabırla bekle, cancel etme.
- **Render cold-start:** Backend uyandırılması 10-15 saniye sürebilir. Health check'te `ok: true` görünce devam et.
- **Sadece tag güncelle:** `text_ar`, `text_tr`, `short_explanation` alanlarına dokunma.
- **Commit:** Test raporu ve tag güncellemeleri ayrı commit olarak push et.
