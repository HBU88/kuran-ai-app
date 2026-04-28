# Architecture Next Steps

## 1. Current Core Architecture

The project currently has a Flutter app at the repository root and a local Node/Express backend under `server/`. The chat engine is backend-driven: Flutter sends user input and recent history to `POST /chat`, then renders the normalized JSON response.

Current chat pipeline:

```text
user message
-> intent analysis
-> context resolution
-> sub-intent routing
-> ayah ranking
-> response composition
-> safety guard
-> normalized API response
```

Current responsibility by file:

- `server/index.js`
  - Owns Express setup.
  - Defines `GET /`, `GET /health`, and `POST /chat`.
  - Sanitizes incoming `history`.
  - Calls `buildChatResponse(message, history)`.
  - Normalizes the public `/chat` response shape before `res.json(...)`.

- `server/agent/index.js`
  - Orchestrates the agent pipeline.
  - Loads the canonical ayah dataset from `assets/data/ayahs.json`.
  - Calls intent analysis, sub-intent routing, ranking, response composition, and safety guard.
  - Preserves the current public response fields:
    `intent`, `primary_theme`, `secondary_themes`, `emotion`, `severity`, `response_type`, `context_topic`, `ayah_used`, `top_ayah_ids`, `selected_ayah`, `assistant_text`.

- `server/agent/intent_router.js`
  - Performs AI-assisted analysis when `OPENAI_API_KEY` is configured.
  - Provides deterministic fallback analysis when AI is unavailable.
  - Produces intent, theme, emotion, severity, response type, and context topic.
  - Adds internal sub-intent routing with:
    `emotional_support`, `ayah_request`, `dua_request`, `zikir_request`, `practical_guidance`, `general_information`.

- `server/agent/context_resolver.js`
  - Normalizes text.
  - Sanitizes and summarizes history.
  - Infers context topics from prior user/assistant turns.
  - Resolves context-dependent follow-ups like “bununla ilgili”, “buna uygun”, and “başka ayet var mı”.

- `server/agent/ayah_ranker.js`
  - Scores local curated ayahs.
  - Uses primary theme, secondary themes, emotion, severity, and context topic.
  - Applies repetition penalty from `selected_ayah_id` history metadata.
  - Applies a relevance threshold so weak replacement ayahs do not override a highly relevant repeated ayah.

- `server/agent/response_composer.js`
  - Builds assistant text after routing and optional ayah selection.
  - Handles ayah-centered, general information, worship practice, dua, zikir, practical guidance, and high-risk support responses.
  - Currently keeps response text inline in code.

- `server/agent/safety_guard.js`
  - Applies final response post-processing.
  - Currently acts mostly as a no-op hook, with safety language handled mainly by response composition.

- Flutter chat files:
  - `lib/data/sources/remote/chat_agent_service.dart`: calls `http://10.0.2.2:3000/chat`.
  - `lib/features/chat/chat_controller.dart`: manages messages, loading state, history payload, response parsing, and error state.
  - `lib/data/models/chat_message_model.dart`: stores assistant metadata, selected ayah, top candidate ids, and debug fields.
  - `lib/features/chat/chat_screen.dart`: renders chat bubbles, ayah cards, starter prompts, and debug-only decision metadata.

## 2. Target Short-Term Architecture

The short-term target is to keep the chat engine as the core backend service and stabilize its behavior before expanding features.

Immediate target architecture:

- Keep the chat engine backend-driven. Flutter should remain a thin client that sends messages/history and renders returned JSON.
- Preserve deterministic fallback behavior. The app must keep working when `OPENAI_API_KEY` is missing.
- Improve history/context continuity by making recent turns more structured and useful for follow-up interpretation.
- Normalize ranking weights so primary theme, secondary themes, emotion, context topic, and history continuity are easier to tune.
- Separate response content from business logic. Response text should move out of branching code into content maps/config.
- Add debug/version metadata internally, without breaking the existing public `/chat` response contract.
- Keep the canonical ayah dataset at `assets/data/ayahs.json` and avoid backend/Flutter dataset drift.

## 3. Recommended Module Boundaries

### `server/index.js`

Should remain the HTTP boundary only:

- Express app setup.
- Request validation.
- History sanitation at API boundary.
- Calling the agent orchestrator.
- Normalizing the public response contract.
- Error handling.

It should not contain ranking, intent, content, or business logic.

### `server/agent/index.js`

Should remain the chat engine orchestrator:

- Load the canonical dataset.
- Resolve analysis and routing order.
- Decide whether ayah ranking should run.
- Pass debug options and history metadata to modules.
- Call the safety guard.
- Return one internal response object to `server/index.js`.

It should not directly contain scoring rules or response text.

### `intent_router.js`

Should own:

- Broad intent detection.
- Sub-intent detection.
- Response strategy selection.
- Deterministic fallback analysis.
- AI-assisted structured analysis when configured.

It should not perform ayah ranking or compose final assistant copy.

### `context_resolver.js`

Should own:

- `normalize()`.
- History normalization.
- Context-dependent message detection.
- Context topic inference.
- Topic aliases and topic-to-theme mapping.

This module should become the single source of truth for Turkish normalization and follow-up resolution.

### `ayah_ranker.js`

Should own:

- Ranking weights.
- Theme/tag matching.
- Emotion and severity boosts.
- Context-topic boosts.
- Repetition penalty.
- Relevance threshold.
- Future ranking debug metadata.

It should not decide final prose or HTTP response shape.

### `response_composer.js`

Should own:

- Assistant text generation.
- Response style by strategy.
- Ayah-centered answer formatting.
- Dua/zikir/practical guidance wording.

It should gradually move static text into structured content maps.

### `safety_guard.js`

Should own:

- High-risk response guardrails.
- Non-authoritative wording checks.
- Future filters for fatwa-like certainty.
- Final response validation before API normalization.

### Flutter Chat Controller / Service / Model / Screen

- `chat_agent_service.dart`
  - Only HTTP transport and response decoding.
- `chat_controller.dart`
  - UI state, local in-memory history, request payload, and parsing into models.
- `chat_message_model.dart`
  - Typed representation of backend response fields and debug metadata.
- `chat_screen.dart`
  - Rendering only: bubbles, ayah cards, starter prompts, composer, debug-only metadata.

Flutter should not reproduce backend intent/ranking logic.

## 4. Immediate Refactor Phases

### Phase 1: Chat Core Stabilization

Goals:

- Expand the history payload with richer metadata while preserving the current `/chat` response contract.
- Improve `normalize()` so Turkish characters and mojibake-prone strings are handled consistently.
- Add an internal `engine_version`.
- Add internal `ranking_debug` metadata.
- Preserve the current public response fields.

Recommended work:

- Add internal debug object from `server/agent/index.js`, but strip it in `server/index.js` unless a debug flag is enabled.
- Include recent `context_topic`, `ayah_used`, `selected_ayah_id`, and `response_type` consistently in Flutter history.
- Make failed assistant messages permanently excluded from history.
- Add tests or smoke scripts for:
  - “zikir çekmek sevap mı”
  - “bununla ilgili ayet var mı”
  - “buna uygun dua var mı”
  - “çok yalnızım”

### Phase 2: Ranking Quality Upgrade

Goals:

- Add weighted emotion scores.
- Reduce context-topic dominance where it overpowers actual user wording.
- Add a history continuity bonus for related but non-repetitive ayahs.
- Prepare `assets/data/ayahs.json` for richer tags.

Recommended work:

- Move scoring constants into one object, for example `RANKING_WEIGHTS`.
- Add separate score buckets:
  - primary theme
  - secondary themes
  - emotion
  - severity
  - context topic
  - history continuity
  - repetition penalty
- Return internal score explanations for debug mode.
- Review ayah tags for zikir, dua, tövbe, yalnızlık, kaygı, hastalık, and nefs mücadelesi.

### Phase 3: Content and Response Layer Cleanup

Goals:

- Move intro/response text into config/content maps.
- Support multiple response variants.
- Standardize ayah-centered response format.

Recommended work:

- Create a future `server/agent/content/` area.
- Move intro text by theme into content maps.
- Move dua and zikir suggestions into content maps.
- Add response variants to reduce repetitive assistant output.
- Standardize ayah-centered format:
  - empathy or framing sentence
  - ayah reference
  - Turkish meaning
  - short explanation
  - optional dua/follow-up question

### Phase 4: Product Feature Expansion Preparation

Goals:

- Add daily ayah endpoint design.
- Define future prayer-times and qibla feature boundaries.
- Reserve a future event/news-to-ayah mapping layer.

Recommended work:

- Design `GET /daily-ayah` but do not implement until chat quality is stable.
- Keep prayer-time logic separate from chat core.
- Create a future `Prayer Utilities` boundary for prayer times and qibla.
- Reserve an event-aware recommendation module for later:
  - input: event/news/topic
  - output: themes
  - selection: local curated ayah dataset only

## 5. Future Product Architecture

Future features should be separated into these product domains:

### Chat Core

The central conversational engine:

- Intent and sub-intent analysis.
- Context resolution.
- Ayah ranking.
- Safe response composition.
- Chat history continuity.

### Daily Ayah

A lightweight recommendation surface:

- Daily selected ayah.
- Optional theme of the day.
- Uses the same canonical dataset.
- Should not depend on chat history.

### Prayer Utilities

Separate utility domain:

- Prayer times.
- Location selection.
- Timezone handling.
- Future qibla direction.

This should stay independent from chat ranking and response composition.

### Future Event-Aware Ayah Recommendation

A later layer for mapping external events or user-selected topics to themes:

- Event/topic ingestion.
- Theme extraction.
- Local ayah ranking.
- No invented ayahs.

This should reuse the chat ranking engine but remain separate from live chat conversation state.

## 6. Recommended Folder Evolution

Proposed future structure. This is a planning target only; do not move files until the chat engine is stable.

```text
server/
  index.js
  agent/
    index.js
    intent/
      router.js
      fallback.js
      ai_analyzer.js
    context/
      resolver.js
      normalize.js
      history.js
    ranking/
      ayah_ranker.js
      weights.js
      debug.js
    response/
      composer.js
      formatter.js
      variants.js
    safety/
      guard.js
    content/
      intros.js
      duas.js
      zikir.js
      explanations.js
    debug/
      engine_version.js
      trace.js
```

```text
lib/
  features/
    chat/
    home/
    daily_ayah/
    prayer_times/
    qibla/
  data/
    models/
    sources/
      local/
      remote/
    repositories/
```

## 7. Execution Priority

### What to do now

1. Stabilize chat core behavior.
2. Fix Turkish normalization and remaining mojibake-prone matcher strings.
3. Add `engine_version` and internal `ranking_debug`.
4. Keep `/chat` public response unchanged unless a deliberate versioned API change is planned.
5. Add repeatable smoke tests for the main Turkish chat scenarios.

### What to do after chat quality is acceptable

1. Normalize ranking weights into a configurable object.
2. Move response text into content maps.
3. Expand and audit ayah tags in `assets/data/ayahs.json`.
4. Add daily ayah endpoint design and then implementation.
5. Add qibla as a separate prayer utility feature.

### What to postpone

1. Vector database or embeddings.
2. News/event-aware ayah recommendations.
3. Large folder moves before tests exist.
4. Flutter-side intent or ranking logic.
5. Public API contract changes that require Flutter migration.
