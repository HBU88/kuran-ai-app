# Full Quran Source Preparation

Current runtime dataset:
- `assets/data/ayahs.json`
- contains only `40` curated ayahs

This folder is for preparing a full Quran source separately before any runtime switch.

Manual input files required:
- `assets/data/full_quran/source_ar.json`
- `assets/data/full_quran/source_tr.json`

Recommended source policy:
- Arabic text: Tanzil-compatible export
- Turkish translation: Diyanet-compatible export

Turkish source options:
- preferred: official EPUB export from Diyanet
- fallback: controlled extraction from the Diyanet Quran portal pages

Expected preparation flow:
1. Place Arabic source into `assets/data/full_quran/source_ar.json`
2. Place Turkish source into `assets/data/full_quran/source_tr.json`
3. Run the enrichment scripts under `server/tools/quran_enrichment/`
4. Build merged output:
   - `assets/data/full_quran/source.json`

If the EPUB is unavailable, use the portal extraction pipeline to build:
- `assets/data/full_quran/source_tr_diyanet.json`

The portal extractor is conservative:
- it reads the official Diyanet page payloads
- it does not guess missing ayah text
- unresolved combined meal ranges are recorded in stats instead of being fabricated

Important:
- Runtime is NOT switched yet
- Backend and Flutter should continue using `assets/data/ayahs.json`
- `assets/data/full_quran/source.json` is only a preparation artifact for later migration
- Turkish Diyanet fallback data is still a preparation artifact until explicitly merged into the runtime flow
