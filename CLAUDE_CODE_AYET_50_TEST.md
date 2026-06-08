# HAKAI — Ayet Rehberi 50-Soru Kapsamlı Test

## Bağlam

Bu prompt, HAKAI uygulamasının App Store'da yayınlanmadan önce Ayet Rehberi modülünü
kapsamlı biçimde test etmek için hazırlanmıştır.

**Backend:** https://hakai-backend.onrender.com  
**Test edilecek endpoint:** `POST /chat` (mode: ayet veya rehberlik)  
**Mevcut test altyapısı:** `server/tests/`  
**Referans test:** `server/tests/ayet_full_audit.mjs`

---

## GÖREVİN KAPSAMI

1. `server/agent/index.js` ve `server/index.js` dosyalarını okuyarak Ayet Rehberi için
   doğru endpoint ve request body formatını belirle.
2. `server/tests/ayet_full_audit.mjs` dosyasını referans alarak yeni bir test dosyası oluştur:
   `server/tests/ayet_50_prelaunch.mjs`
3. Aşağıdaki 50 soruyu sırayla backend'e gönder.
4. Her sorgu için şunları kaydet ve değerlendir:
   - Dönen sure adı ve ayet numarası (ör. "Bakara 2:286")
   - Dönen meal/metin (varsa)
   - HTTP status kodu
   - Yanıt süresi (ms)
   - `source` alanı: KB hit mi, OpenAI mi, fallback mı?
   - Konuyla alakalı mı? (aşağıdaki beklenti tablosuna göre)
5. Test tamamlandığında `server/tests/ayet_50_report.json` dosyasına yaz.
6. Terminal'e özet rapor bas:
   - ✅ PASS: Doğru/alakalı ayet döndü
   - ⚠️ WARN: Ayet döndü ama bağlam zayıf
   - ❌ FAIL: Hata, boş yanıt veya tamamen alakasız ayet

---

## REQUEST FORMAT

Önce `server/index.js` dosyasını okuyarak endpoint'i doğrula.
Büyük ihtimalle şu formatta:

```javascript
POST /chat
Content-Type: application/json
{
  "message": "<sorgu metni>",
  "mode": "ayet",           // veya "rehberlik" — kodu okuyarak doğrula
  "deviceId": "test-device-50q",
  "conversationHistory": []
}
```

Yanıtta şunları ara:
- `response` veya `message` alanı (metin)
- `ayah` veya `verse` alanı (sure/ayet bilgisi)
- `source` alanı (KB / OpenAI / fallback)

---

## 50 TEST SORUSU

### KATEGORİ A — Tek Duygu (Temel, 15 soru)

| # | Sorgu | Beklenen Konu | Kabul Edilebilir Sureler |
|---|-------|---------------|--------------------------|
| 1 | `üzüntü hakkında ayet` | Üzüntü / sabır | Bakara, Zumar, İnşirah, Ra'd |
| 2 | `korku için ayet` | Korku / Allah'a sığınma | Âl-i İmrân, Talâk, Zümer |
| 3 | `umut hakkında ayet` | Umut / rahmet | Zümer, Hicr, Yusuf |
| 4 | `sabır konusunda ayet` | Sabır | Bakara 153, Zümer 10, Âl-i İmrân 200 |
| 5 | `şükür hakkında ayet` | Şükür | İbrahim 7, Lokmân 12 |
| 6 | `pişmanlık için ayet` | Tövbe / pişmanlık | Zümer 53, Nisa 110, Hud 90 |
| 7 | `yalnızlık hissediyorum ayet ver` | Yalnızlık / Allah ile beraberlik | Bakara 186, Kaf 16, Hadid 4 |
| 8 | `öfke için ayet` | Öfkeyi yenmek | Âl-i İmrân 134 |
| 9 | `tevekkül hakkında ayet` | Tevekkül | Talâk 3, Âl-i İmrân 159, Maide 23 |
| 10 | `sevinç ve mutluluk için ayet` | Sevinç / müminlerin mutluluğu | Yunus 58, Ra'd 28 |
| 11 | `endişe için ayet` | Kaygı / huzur | Ra'd 28, Bakara 286, Talâk 3 |
| 12 | `karamsarlık için ayet` | Ümitsizlik yasak | Zümer 53, Hicr 56 |
| 13 | `huzur için ayet` | Kalp huzuru | Ra'd 28, Fecr 27-28 |
| 14 | `keder için ayet` | Keder / teselli | Duha, İnşirah, Bakara |
| 15 | `minnet ve şükran için ayet` | Şükür | İbrahim 7, Rahmân |

### KATEGORİ B — Hayat Durumu (15 soru)

| # | Sorgu | Beklenen Konu | Kabul Edilebilir Sureler |
|---|-------|---------------|--------------------------|
| 16 | `işimi kaybettim ne yapmalıyım` | Sabır / tevekkül / rızık | Talâk 3, Bakara 286 |
| 17 | `hastalandım bana ayet ver` | Hastalık / şifa / sabır | Şuarâ 80, Enbiyâ 83-84 |
| 18 | `annem vefat etti teselli edecek ayet` | Ölüm / sabır / rahmet | Bakara 156, İnna lillah |
| 19 | `maddi sıkıntıdayım ayet` | Rızık / bolluk / sabır | Talâk 7, Bakara 155-157 |
| 20 | `sınav korkusu için ayet` | Korku / Allah'a güven | Âl-i İmrân 173, Talâk 3 |
| 21 | `evlenmek istiyorum ayet` | Evlilik / eş | Rûm 21, Nisâ 1 |
| 22 | `aile kavgası yaşıyorum` | Sabır / af / aile | Nisâ 19, Rûm 21, Hucurât 10 |
| 23 | `yurt dışında yalnız hissediyorum` | Yalnızlık / Allah ile beraberlik | Bakara 186, Kaf 16 |
| 24 | `iş hayatında adalet için ayet` | Adalet | Nisa 135, Maide 8 |
| 25 | `çocuklarım için dua` | Çocuk / aile duası | İbrahim 40, Ahkaf 15, Furkan 74 |
| 26 | `borçluyum sıkıntıdayım` | Mali sıkıntı / sabır | Bakara 280, Talâk 7 |
| 27 | `arkadaşım beni ihane etti` | Af / sabır / güven | Maide 8, Âl-i İmrân 120 |
| 28 | `sevdiğim biri hastalandı` | Şifa / dua / sabır | Şuarâ 80, Enbiyâ 83 |
| 29 | `işsizim motivasyon ayet` | Ümit / rızık / tevekkül | Talâk 3, Bakara 286 |
| 30 | `yeni bir başlangıç için ayet` | Umut / yeni sayfa | İnşirah, Zuhruf 13, Hicr |

### KATEGORİ C — Kombinasyon Duygular (10 soru)

| # | Sorgu | Beklenen Konu |
|---|-------|---------------|
| 31 | `hem üzgün hem de korkuyorum` | Sabır + Allah'a güven |
| 32 | `sabır ve şükür hakkında ayet` | Sabır + şükür |
| 33 | `umut ve tevekkül için ayet` | Umut + tevekkül |
| 34 | `pişmanlık ve af için ayet` | Tövbe + af |
| 35 | `hem yalnız hem de karamsarım` | Yalnızlık + ümit |
| 36 | `korku ve endişeyle başa çıkmak için` | Korku + huzur |
| 37 | `günahlarım için tövbe ve umut` | Tövbe + rahmet |
| 38 | `zor zamanda sabır ve güç için` | Sabır + güç |
| 39 | `hem mutlu hem de minnetarım` | Şükür + sevinç |
| 40 | `acı ve ümit bir arada` | Sabır + umut |

### KATEGORİ D — Dini Tema (5 soru)

| # | Sorgu | Beklenen Konu |
|---|-------|---------------|
| 41 | `Allah'ın rahmeti hakkında ayet` | Rahmet / mağfiret |
| 42 | `tövbe ve bağışlanma için ayet` | Tövbe |
| 43 | `dua etmenin faydaları` | Dua |
| 44 | `kul hakkı ve adalet` | Adalet / hak |
| 45 | `ölüm ve ahiret hakkında` | Ahiret |

### KATEGORİ E — Belirsiz / Edge Case (5 soru)

| # | Sorgu | Beklenen Sonuç |
|---|-------|----------------|
| 46 | `bana bir ayet ver` | Herhangi geçerli ayet (İnşirah dışında test et) |
| 47 | `güzel bir ayet` | Herhangi geçerli ayet |
| 48 | `huzur veren ayet` | Ra'd 28 veya benzeri |
| 49 | `zor zamanlarda okunacak ayet` | Bakara 286, İnşirah veya benzeri |
| 50 | `ilham verici bir ayet` | Herhangi geçerli ayet |

---

## DEĞERLENDİRME KRİTERLERİ

### PASS ✅
- HTTP 200
- `response` alanı boş değil
- Dönen ayet sure + numara içeriyor (ör. "Bakara 2:286")
- Konu bağlamıyla makul ölçüde örtüşüyor (yukarıdaki tabloya göre)

### WARN ⚠️
- HTTP 200 ama ayet referansı belirsiz veya sadece metin var
- Bağlam zayıf ama tamamen yanlış değil
- Yanıt süresi > 8 saniye

### FAIL ❌
- HTTP 4xx veya 5xx
- Boş veya `null` yanıt
- Tamamen alakasız sure/konu
- Her soru için İnşirah 94:5-6 dönüyorsa (genel fallback bug'ı) — bu özellikle test et

### KRİTİK KONTROL
Soru 46 (`bana bir ayet ver`) için özellikle kontrol et:
- Eğer İnşirah 94:5-6 dönüyorsa → bu bilinen bug'ın geri dönmesi demektir → ❌ FAIL

---

## TEST DOSYASI YAPISI

```
server/tests/ayet_50_prelaunch.mjs
```

Şunları içermeli:
- Her sorgu için ayrı test kaydı
- Yanıt süresi ölçümü
- Bağlam kontrolü (keyword matching ile basit)
- JSON rapor çıktısı
- Terminal özet

---

## ÇALIŞTIRMA

```bash
node server/tests/ayet_50_prelaunch.mjs
```

Sonuç dosyası:
```bash
server/tests/ayet_50_report.json
```

---

## BAŞARI KRİTERİ (App Store Öncesi Eşik)

| Metrik | Minimum |
|--------|---------|
| PASS oranı | ≥ 44/50 (%88) |
| FAIL sayısı | ≤ 3 |
| Ortalama yanıt süresi | ≤ 6 saniye |
| Kategori E (edge case) PASS | ≥ 3/5 |
| "bana bir ayet ver" bug yok | ✅ zorunlu |

Eşik sağlanmazsa hangi kategoride sorun var raporla ve root cause öner.

---

## SONRASI

Test tamamlandığında:
1. `ayet_50_report.json` dosyasını `server/tests/` klasörüne kaydet
2. Terminal özeti göster
3. FAIL olan soruları listele, olası nedenleri açıkla
4. Gerekirse `server/agent/index.js` veya `knowledge_router.js` dosyalarında
   hangi satırın düzeltilmesi gerektiğini belirt (değişiklik yapma, sadece raporla)
