# HAKAI Agent Guide

## Product
HAKAI
Hakikate yönlendiren yapay zekâ

## Project Overview
This repository contains a Quran-based AI guidance app with a Flutter frontend and a Node.js backend. The backend handles chat routing, Quran guidance, ilmihal knowledge, logging, and validation. The app is designed to keep Quran guidance, practical Islamic knowledge, and casual conversation in separate, controlled paths.

## Stack
- Flutter frontend
- Node.js backend
- GitHub repo: `HBU88/kuran-ai-app`

## Paths
- Flutter root: `C:\kuran_app`
- Backend: `C:\kuran_app\server`

## Main Endpoints
- `/chat`
- `/debug/resolve` when `DEBUG_CHAT_ENGINE=true`

## Core Architecture
1. Quran guidance mode
2. Ilmihal knowledge mode
3. Casual mode

## Important Files
- `server/index.js`
- `server/agent/index.js`
- `server/agent/ayah_ranker.js`
- `server/agent/context_resolver.js`
- `server/agent/knowledge_router.js`
- `server/agent/response_composer.js`
- `server/tests/chat_response_validator.mjs`
- `assets/data/full_quran/source_enriched.json`
- `assets/data/knowledge/ilmihal_knowledge_base.json`

## Agent Roles
- Backend Chat Agent
- Flutter UI Agent
- Dataset/Enrichment Agent
- QA/Test Agent
- Repo Hygiene Agent

## Working Rules
- Keep tasks small and scoped.
- Do not do broad refactors unless explicitly requested.
- Do not change `/chat` behavior without tests.
- Prefer local deterministic routing before the LLM planner where safe.
- Do not add third-party packages unless necessary.
- Do not expose secrets or API keys.
- Preserve Turkish UX quality.
- Treat Codex prompts as English engineering tasks unless the user asks otherwise.

## Required Validation
- Backend changes: `npm run test:chat`
- Flutter changes: `flutter analyze`
- UI changes: emulator smoke test

## Git Workflow
1. `git status`
2. `git add` relevant files only
3. `git commit -m "..."`
4. `git push`
