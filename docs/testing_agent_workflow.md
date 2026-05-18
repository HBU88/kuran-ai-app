# HAKAI Testing Agent Workflow

This repo uses two levels of ilmihal verification:

- Backend-focused regression tests for fast text and routing checks.
- Visual regression tests for focused emulator verification of the UI.

## When To Run Backend-Focused Tests

Run the backend regression command when you change:

- `server/data/ilmihal/*.json`
- `assets/data/knowledge/ilmihal_knowledge_base.json`
- `server/agent/*` routing or composer logic
- any case wording that affects the returned `assistant_text`

Command:

```bash
npm --prefix server run test:ilmihal-regression -- --tag kurban
```

Use a different tag when the change is scoped to another topic family.

This command:

- runs only the tagged regression cases from `server/tests/ilmihal_regression_cases.json`
- validates `knowledge_hit_id`
- validates that `assistant_text` contains the expected phrases
- exits with code `1` on any failure

## When To Run Visual Regression Tests

Run the visual regression command when you change:

- Flutter UI layout
- widget copy
- chat screen behavior
- rendering of ilmihal responses on device

Command:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_ilmihal_visual_regression.ps1 -Tag kurban
```

This command:

- opens only `İlmihal Rehberi`
- runs only the selected tagged cases
- checks that expected text appears on screen
- captures screenshots only on failure
- keeps the run short

## Real-Device Android Builds

Use a LAN IP when building an APK for a physical phone on the same Wi-Fi network:

```powershell
flutter build apk --release --dart-define=HAKAI_API_BASE_URL=http://192.168.x.x:3000
```

For emulator or local desktop testing, you can keep a local address:

```powershell
flutter build apk --release --dart-define=HAKAI_API_BASE_URL=http://127.0.0.1:3000
```

## When To Run Full Release Check

Run the full release check only before a Play Store release.

Command:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release_check.ps1
```

The release check is the broad gate. It should include backend validation, chat regression, visual smoke coverage, analysis, and release build verification.

## How To Add A New Regression Case

1. Add a new case to `server/tests/ilmihal_regression_cases.json`.
2. Add one or more `tags` such as `kurban`, `namaz`, or `oruc`.
3. Set the exact `query`.
4. Set the expected `knowledge_hit_id`.
5. Add short `expected_text_contains` phrases that should appear in the reply.
6. Run the backend-focused command for the matching tag.
7. If the case affects the UI, run the visual regression command too.

Example:

```json
{
  "id": "kurban_hisse",
  "query": "büyükbaş kurbana kaç kişi ortak olabilir",
  "expected_knowledge_hit_id": "kurban_hisse_olur_mu",
  "expected_text_contains": ["Hanefî", "yedi kişi"],
  "tags": ["kurban"]
}
```

## Practical Rule

If a change can be verified by a tagged backend case, run the backend command first.
If the change also affects the rendered app, run the visual command next.
Reserve `scripts/run_visual_smoke.ps1` for `release_check.ps1` only.
