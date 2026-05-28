# HAKAI – Kuran AI App

## Proje Özeti
Türkçe dini rehberlik uygulaması. Kullanıcılar ilmihal soruları sorabilir, Kuran ayetleri isteyebilir, namaz vakitlerini görebilir.

## Teknoloji
- **Frontend:** Flutter (iOS/Android) — `lib/`
- **Backend:** Node.js + Express — `server/`
- **AI:** OpenAI API (ilmihal ve rehberlik modları)
- **Namaz vakitleri:** Diyanet API
- **Hosting:** Render (auto-deploy from `main` branch)
- **Repo:** https://github.com/HBU88/kuran-ai-app (branch: `main`)

## Klasör Yapısı
```
lib/
  main.dart, app.dart
  core/                          # App-wide config, theme, constants
  data/sources/remote/
    chat_agent_service.dart      # Backend API calls
    auth_service.dart            # Auth
  features/
    chat/
      chat_controller.dart       # Chat state & logic
      chat_mode.dart             # ChatMode enum (ilmihal, rehberlik, ayet, namaz)
      chat_screen.dart           # Chat UI
    auth/, settings/, ...
  utils/
    chat_logger.dart             # Debug logging

assets/data/knowledge/
  ilmihal_knowledge_base.json    # Local knowledge fallback (Flutter side)

server/
  index.js                       # Express entry, route definitions
  auth.js                        # Auth middleware
  security.js                    # Security middleware
  agent/
    index.js                     # Agent orchestrator
    knowledge_router.js          # Question → knowledge matching logic
    knowledge_base.js            # Knowledge base loader/search
  data/ilmihal/                  # Server-side ilmihal data
  tests/
    auth_regression.mjs
    chat_response_validator.mjs
```

## Chat Modları
| Mod | Açıklama | OpenAI | Local KB |
|-----|----------|--------|----------|
| `ilmihal` | Dinî Bilgiler (fıkıh, ibadet) | Evet | Fallback |
| `rehberlik` | Kuran rehberliği | Evet | Hayır |
| `ayet` | Ayet istekleri | Evet | Hayır |
| `namaz` | Namaz vakitleri | Hayır | Diyanet API |

## Kritik Endpointler
- `POST /chat` — Genel sohbet (rehberlik)
- `POST /ilmihal-chat` — Dinî bilgiler modu
- `GET /health` — Backend sağlık kontrolü
- Namaz vakitleri — Diyanet API üzerinden

## Çalıştırma Komutları

### Backend health check
```bash
curl -s https://hakai-backend.onrender.com/health
```

### iOS Simulator
```bash
flutter run -d F166179B-EA98-46F1-9FEC-61ADDCE09DFE \
  --dart-define=HAKAI_API_BASE_URL=https://hakai-backend.onrender.com \
  --dart-define=DEBUG_CHAT_RAW_LOGS=true \
  --dart-define=DEBUG_DISABLE_USAGE_LIMITS=true
```

### Gerçek iPhone
```bash
flutter run -d 00008150-001824C82141401C \
  --dart-define=HAKAI_API_BASE_URL=https://hakai-backend.onrender.com \
  --dart-define=DEBUG_CHAT_RAW_LOGS=true \
  --dart-define=DEBUG_DISABLE_USAGE_LIMITS=true
```

### Test komutları
```bash
dart analyze
flutter analyze
npm --prefix server run test:auth
npm --prefix server run test:security
```

## Bilinen Sorunlar (Mayıs 2026)
- **İlmihal routing bozuk:** "Alkol günah mı?" sorusu Bayram namazı cevabı döndürebiliyor.
- **Kök neden (tahmini):** Usage limit / premium değişiklikleri, /chat vs /ilmihal-chat routing, ChatMode.ilmihal / source_screen mapping değişiklikleri sonrası regresyon.
- Detaylı audit planı: `docs/audit-plan.md`

## Çalışma Kuralları
1. **Önce oku, sonra yaz.** Değişiklik yapmadan önce ilgili dosyaları tam oku.
2. **Küçük commitler.** Her mantıksal değişiklik ayrı commit.
3. **Test et.** Her değişiklik sonrası `dart analyze` + backend testleri çalıştır.
4. **Dini içerik hassasiyeti.** Yanlış cevap, cevap vermemekten daha kötüdür. Emin olunmayan durumlarda netleştirme iste.
5. **API key loglamayın.** Debug loglarında asla credential basılmamalı.
6. **Türkçe commit mesajları** tercih edilir.
