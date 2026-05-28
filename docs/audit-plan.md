# HAKAI – API/Routing Regression Audit Planı

**Durum:** Aktif  
**Öncelik:** Kritik – yeni özellik eklenmeden önce tamamlanmalı  
**Tarih:** Mayıs 2026

---

## Problem

Son API config, usage limit, premium/free soru limiti ve debug flag değişikliklerinden sonra Dinî Bilgiler (ilmihal) cevapları güvenilmez hale geldi.

### Belirtiler
- "Alkol günah mı?" → Bayram namazı cevabı dönüyor
- "Kurban nasıl kesilir?" → Genel "Kurban nedir?" cevabı dönüyor
- "Kurban kimlere vaciptir?" → Alakasız içerikle eşleşiyordu
- Namaz vakitleri son zamanlarda bozuk görünmüş (şimdi simulator'da çalışıyor)

### Hipotez
API/routing katmanı, usage-limit/premium değişikliklerinden sonra kırılmış olabilir.

### Olası Nedenler
- OpenAI API çağrılması gereken yerde çağrılmıyor
- OpenAI hataları/rate limit sessizce alakasız local knowledge'a düşüyor
- `/chat` vs `/ilmihal-chat` routing değişmiş
- `ChatMode.ilmihal` / `source_screen` mapping değişmiş
- Usage limit gate istek akışını değiştiriyor veya engelliyor
- Backend fallback matcher düşük güvenle bile cevap veriyor
- Render env değişkenleri (OpenAI/Diyanet) eksik veya eski
- Mobil uygulama curl testlerinden farklı endpoint çağırıyor olabilir

---

## Amaç

Yeni özellik eklemeden önce güvenilir API davranışını geri kazanmak.

---

## Audit Görevleri

### 1. Tüm Chat Akışlarını Uçtan Uca Haritalandır

Her mod için dokümante et:

| Mod | Flutter Screen | Service Method | Endpoint | Payload | Backend Route | OpenAI? | Local KB? | Fallback |
|-----|---------------|----------------|----------|---------|---------------|---------|-----------|----------|
| Rehberlik | ? | ? | ? | ? | ? | ? | ? | ? |
| Dinî Bilgiler | ? | ? | ? | ? | ? | ? | ? | ? |
| Ayet | ? | ? | ? | ? | ? | ? | ? | ? |
| Namaz Vakitleri | ? | ? | ? | ? | ? | ? | ? | ? |

Bu tabloyu doldur — her `?` yerine gerçek değerleri yaz.

### 2. Debug Tracing Ekle/Doğrula

Her istek/cevap logu şunları içermeli:

```
endpoint: /ilmihal-chat
source_screen: dini_bilgiler
chat_mode: ilmihal
final_route: knowledge_router
response_source: openai | local_knowledge | fallback_clarification | error
openai_called: true/false
openai_status: 200 | error_type
matched_knowledge_id: alkol_gunah_mi
matched_title: "Alkol günah mı?"
match_score: 0.87
match_reason: "keyword + semantic"
fallback_blocked: false
usage_gate_applied: false
usage_limit_bypassed_for_debug: true
```

**ÖNEMLİ:** API key veya credential loglamayın.

### 3. OpenAI Entegrasyonu Audit

Kontrol listesi:
- [ ] `OPENAI_API_KEY` Render env'de mevcut
- [ ] Backend doğru OpenAI model/config kullanıyor
- [ ] OpenAI hataları sessizce yutulmuyor
- [ ] OpenAI başarısız olursa → güvenli hata/netleştirme dönüyor, alakasız knowledge DEĞİL
- [ ] Health/debug endpoint ekle:
  ```json
  {
    "openai_configured": true,
    "diyanet_configured": true
  }
  ```
  (Secret ifşa etmeden)

### 4. Usage-Limit/Premium Değişiklikleri Audit

- [ ] Auth/ödeme sistemi tamamlanana kadar tüm Dinî Bilgiler usage gate'lerini geçici olarak devre dışı bırak
- [ ] Limitler endpoint değiştirmiyor
- [ ] Limitler beklenmedik şekilde OpenAI'ı atlamıyor
- [ ] Limitler local fallback'e zorlamıyor
- [ ] Limitler isteği engelleyip eski cevap göstermiyor
- [ ] Debug modunda sayaçlar düşmüyor
- [ ] Premium/paywall UI gösterilmiyor

### 5. Dini QA Güvenliği Düzelt

`/ilmihal-chat` için kurallar:
- **Yanlış cevap, cevap vermemekten daha kötüdür**
- Güven düşükse geniş fallback cevapları devre dışı bırak
- Tek başına geniş konu anahtar kelimesi cevap üretmemeli
- Güçlü eşleşme yoksa şu cevabı ver:
  > "Bu konuda güvenilir cevap verebilmem için sorunuzu biraz daha netleştirir misiniz?"
- **Çapraz-konu kontaminasyonunu önle:**
  - alkol sorusu → bayram_namazi ile eşleşMEMELİ
  - kurban sorusu → bayram_namazi ile eşleşMEMELİ
  - abdest sorusu → kurban ile eşleşMEMELİ
  - namaz sorusu → kurban ile eşleşMEMELİ (açıkça alakalı olmadıkça)

### 6. Knowledge Base Kapsamını Doğrula

Şu entry'lerin varlığını kontrol et:
- [ ] `alkol_gunah_mi`
- [ ] `kurban_kime_vaciptir`
- [ ] `kurban_nasil_kesilir`
- [ ] `abdest_nasil_alinir`
- [ ] `abdesti_bozan_seyler`
- [ ] `bayram_namazi_nasil_kilinir`

Eksikse minimal güvenilir entry ekle. Alakasız entry'den cevap üretme.

### 7. Regresyon Testleri Ekle

| Soru | Beklenen Sonuç | Asla Olmamalı |
|------|---------------|---------------|
| "Alkol günah mı?" | Alkol ile ilgili cevap veya netleştirme | Bayram namazı |
| "Kurban kimlere vaciptir?" | Kurban yükümlülük cevabı | Alakasız konu |
| "Kurban nasıl kesilir?" | Kurban kesim/prosedür cevabı | Genel "Kurban nedir?" |
| "Bayram namazı nasıl kılınır?" | Bayram namazı cevabı | Kurban veya abdest |
| "Abdest nasıl alınır?" | Abdest cevabı | Kurban veya namaz vakti |
| "Abdesti bozan şeyler nelerdir?" | Abdest bozanlar listesi | Alakasız |
| OpenAI API hata senaryosu | Güvenli hata/netleştirme | Alakasız local cevap |

### 8. Namaz Vakitleri API Audit

- [ ] Diyanet env credential'ları mevcut
- [ ] Endpoint çalışıyor
- [ ] Simulator/cihaz konum veya seçili şehir akışı çalışıyor
- [ ] Hatalar net UI mesajı gösteriyor
- [ ] Şifre loglanmıyor

Namaz vakitleri zaten çalışıyorsa değiştirme, sadece diagnostik ekle.

### 9. Fix Sonrası Doğrulama

#### Testleri çalıştır
```bash
dart analyze
flutter analyze
npm --prefix server run test:auth
npm --prefix server run test:security
# Dini QA regresyon testleri
# Namaz vakitleri smoke test
```

#### Deploy ve test
```bash
git add -A && git commit -m "fix: ilmihal routing audit düzeltmeleri" && git push
# Render deploy'un tamamlanmasını bekle
```

#### Simulator testi
```bash
flutter run -d F166179B-EA98-46F1-9FEC-61ADDCE09DFE \
  --dart-define=HAKAI_API_BASE_URL=https://hakai-backend.onrender.com \
  --dart-define=DEBUG_CHAT_RAW_LOGS=true \
  --dart-define=DEBUG_DISABLE_USAGE_LIMITS=true
```

Simulator'da test et:
- [ ] Namaz vakitleri açılıyor
- [ ] "Alkol günah mı?" → doğru cevap
- [ ] "Kurban kimlere vaciptir?" → doğru cevap
- [ ] "Kurban nasıl kesilir?" → doğru cevap
- [ ] "Bayram namazı nasıl kılınır?" → doğru cevap
- [ ] "Abdest nasıl alınır?" → doğru cevap

### 10. Final Rapor

Raporda şunlar yer almalı:
- OpenAI API doğru çağrılıyor muydu?
- Herhangi bir API hatası gizleniyor muydu?
- Usage limit logic routing'i etkiliyor muydu?
- Backend fallback çok geniş miydi?
- **Kök neden**
- Değişen dosyalar
- Çalıştırılan testler
- Commit hash
- Render deploy durumu
- Her test sorusu için `response_source` / debug metadata örneği

---

## İş Akışı (Claude Code İçin)

**ÖNEMLİ: Hemen kod yazmaya başlama.**

### Adım 1 — Keşif (Önce Oku)
1. Repo'yu incele
2. Mevcut mimariyi raporla
3. Mevcut chat route'larını listele
4. Dinî Bilgiler'in OpenAI mi yoksa sadece local knowledge mi kullandığını belirle
5. Alakasız eşleşmelerin nerede olabileceğini tespit et
6. Usage limit'lerin akışı hâlâ etkileyip etkilemediğini kontrol et
7. En güvenli düzeltme planını öner

### Adım 2 — Onay
Keşif raporunu paylaş, onay al.

### Adım 3 — Düzeltme
Sadece stabilizasyon görevi için düzeltme yap. Yeni özellik ekleme.

### Adım 4 — Test ve Deploy
Yukarıdaki doğrulama adımlarını uygula.
