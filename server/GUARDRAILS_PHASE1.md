# HAKAI İslami Modül — Guardrails Faz 1

**Tarih:** 2026-06-01
**Kapsam:** 3 kritik guardrail + Quran validator
**Test sonucu:** 66/66 yeni test geçti, regression breakage yok

---

## Eklenen 4 modül

| Modül | Dosya | Test |
|---|---|---|
| Negation Detector | `server/agent/negation_detector.js` | 12/12 |
| Entry Type/Purpose Schema | `server/agent/entry_type_schema.js` | 19/19 |
| Atomic KB Updater | `server/agent/atomic_kb_updater.js` | 13/13 |
| Quran Validator | `server/agent/quran_validator.js` | 22/22 |

### Pre-flight + Post-flight regression
| Suite | Pre | Post |
|---|---|---|
| `ayet_full_audit` | 56/56 | 56/56 |
| `test:auth` | PASS | PASS |
| `test-semantic-matcher` | 8/8 | 8/8 |

---

## Guardrail #1 — Sentence-Level Weighted Negation

**Sorun:** "namaz nedir?" sorgusu, "nifas_nedir.json"'da geçen *"Bu dönemde namaz kılınmaz"* cümlesi nedeniyle eskiden nifas entry'sini yüksek skorlayabiliyordu.

**Çözüm:** `NegationDetector` cümle düzeyinde çalışır. Bir entry'nin keyword'ü yalnızca yasaklama bağlamında (`prohibition` / `impermissible`) geçiyorsa entry hard-exclude edilir; pozitif cümleyle birlikte geçiyorsa sadece soft-penalty alır (-0.25 ile -0.60 aralığında, clamped).

**Pattern ağırlıkları:**
| Tür | Örnek pattern | Ağırlık |
|---|---|---|
| `prohibition` | `kılınmaz`, `tutulmaz`, `yapılamaz` | -0.40 |
| `impermissible` | `caiz değildir` | -0.45 |
| `impermissible` | `haram`, `yasaktır` | -0.30 |
| `negation` | `olmaz`, `yoktur`, `değildir` | -0.25 ile -0.30 |
| `contextual` | `dışında`, `haricinde` | -0.35 |

**Entegrasyon:** `semantic_topic_matcher.hasConflictingKeywords()` artık NegationDetector'a delegate ediyor. `getNegationPenalty()` da exposed — gelecekteki TF-IDF tier'ının soft-blend kullanması için.

**Unicode word-boundary:** JS'in `\b`'si `ç`,`ş`,`ğ` gibi Türkçe karakterlerde kırılır (ASCII-only). Çözüm: `(?:^|[^\p{L}\p{N}])token(?:[^\p{L}\p{N}]|$)` ile Unicode property class kullanıldı.

---

## Guardrail #2 — Entry Type / Purpose Markers

**Sorun:** Auto-fix pipeline bir entry'nin *amacını* bilmediği için aslında dokunulmaması gereken alanları değiştirebiliyordu.

**Şema (her alanı opsiyonel, incremental migration için):**
```json
{
  "entry_type": "definition",       // controlled vocabulary
  "semantic_domain": "worship",     // controlled vocabulary
  "entry_purpose": {
    "primary_objective": "...",
    "target_queries": [...],
    "must_include": [...],
    "must_NOT_include": [...],
    "authorized_modifiers": [...],
    "forbidden_modifications": [...]
  },
  "NOT_for_queries": [...],
  "conflicting_entries": [...]
}
```

**ENTRY_TYPES:** `definition`, `instruction`, `biography`, `condition`, `ruling`, `event`, `practice`, `ethics`, `relationship`, `finance`
**SEMANTIC_DOMAINS:** `worship`, `purification`, `people_and_prophets`, `family_and_relations`, `ethics_and_character`, `finance_and_trade`, `daily_life_and_rulings`, `sacred_times_and_events`, `sacred_texts`, `physiological_states`

**Validator (`validateClassification`):**
- Eksik field'lar valid sayılır (incremental migration için).
- Var olan field'lar vocab'a göre kontrol edilir.

**Purpose enforcer (`checkUpdateAgainstPurpose`):**
- `forbidden_modifications` listesinde field adı geçiyorsa o field'a write engellenir.
- "core definition silmek" gibi ifade varsa `summary` replacement reddedilir (extension allowed).
- `quran_references` / `hadis_references` ancak `authorized_modifiers` açıkça izin verdiyse kabul edilir.

### Migration: 7 critical entry marked
| Entry | entry_type | semantic_domain |
|---|---|---|
| `namaz_nedir` | definition | worship |
| `oruc_nedir` | definition | worship |
| `zekat_nedir` | definition | finance_and_trade |
| `nifas_nedir` | condition | physiological_states |
| `hayiz_nedir` | condition | physiological_states |
| `istihaze_nedir` | condition | physiological_states |
| `hz_ibrahim_kimdir` | biography | people_and_prophets |

Migration script idempotent (`server/scripts/migrate_entry_markers.mjs`). Her dosyanın `.bak.<timestamp>` yedeği `data/ilmihal/` altında. KB-genelinde 209 dosya scan edildi, hiç schema hatası yok.

---

## Guardrail #3 — Atomic KB Updater + Rollback

**Sorun:** Auto-fix yarıda kalırsa KB tutarsız hale gelebiliyordu; bozuk JSON disk'te kalabiliyordu.

**Pipeline (`updateEntry`):**
1. **load** — entry oku (yoksa abort)
2. **purpose** — `checkUpdateAgainstPurpose` (Guardrail #2)
3. **backup** — `data/_kb_backups/` altına timestamp+random ile kopya
4. **validate** — merge sonucu required fields + schema
5. **write** — tmpfile + `rename` (POSIX-atomic)
6. **verify** — disk'ten tekrar oku, parseable + valid mi?
7. **rollback** — herhangi bir aşama failse backup geri yüklenir

**Public API:**
- `updateEntry(id, updates) → { success, stage, reason, backupPath }`
- `rollback(id, backupPath) → { success, reason }`
- `verifyAll() → { ok, scanned, errors[] }` — deployment gate için

**`stage` değerleri:** `load` | `purpose` | `validate` | `write` | `verify` | `done`. Auto-fix orchestrator hangi gate'te durulduğunu bu alandan anlayabilir.

---

## Sacred Content — Quran Validator

**Veri kaynağı:** `assets/data/full_quran/source_ar.json` (Arapça) + `source_tr_diyanet.json` (Diyanet meali).

**API:**
```js
const v = new QuranValidator();
v.resolveSurah('İnşirâh')          // → 94
v.exists('Bakara', 286)            // → true
v.getVerse('Bakara', 183)          // → { text_ar, text_tr, source }
v.validateVerse({ surah:2, ayah:183, text_tr:'...' })
  // → { valid, action:'ACCEPT'|'REJECT'|'CORRECTION_REQUIRED', correction? }
```

**Surah resolution:** 114 sure için Türkçe alias tablosu + Arabic source'tan transliteration'lar. Capital İ → i için Turkish locale-aware lowercase + combining-dot stripping.

**Validation politikası:**
- Reference canon'da yoksa → `REJECT` (correction null).
- Arabic provided ve normalised farklıysa → `CORRECTION_REQUIRED` (canon text döner).
- Turkish provided için token-overlap (Jaccard) ≥ 0.6 ise kabul (çeviri varyansı toleransı), aksi `CORRECTION_REQUIRED`.

---

## NPM Scripts

```bash
npm --prefix server run test:guardrails       # 4 modülün hepsini koştur (66 test)
npm --prefix server run migrate:entry-markers # entry_type/purpose ekle (idempotent)
npm --prefix server run migrate:entry-markers -- --dry-run
```

---

## Henüz Yapılmadı (Sonraki Sprintler)

Faz 1 dışında bırakılan kısımlar (orijinal spec'te var, kararla ertelendi):
- **Query Intent Classifier** — şu an matcher zaten `_nedir` / `_nasil` heuristic'i kullanıyor; daha güçlü intent ayrımı isteğe bağlı.
- **Sacred Content Validator (Hadis)** — Diyanet seviyesinde verified hadis veri seti elimizde yok; iskelet için ayrı task.
- **Deployment Pipeline + Monitoring Layer** — CI gate'leri ve canlı metric'ler ayrı bir iş.
- **2400+ kapsamlı test suite** — şu an 66 yeni unit + 56 ayet + 8 matcher entegrasyon. Genişletme iteratif.

---

## CLAUDE.md uyumu
- ✅ "Önce oku, sonra yaz" — her modül öncesi mevcut yapıyı okuduk.
- ✅ "Test et" — pre-flight + post-flight regression çalıştırıldı, kırılma yok.
- ✅ "API key loglamayın" — yeni modüllerden hiçbiri credential görmüyor / loglamıyor.
- ✅ Türkçe commit mesajları için hazır (bu doc'taki başlıklar Türkçe).
- ✅ Auth/premium/IAP'a dokunulmadı.
