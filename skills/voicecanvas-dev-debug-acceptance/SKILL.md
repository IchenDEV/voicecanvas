---
name: voicecanvas-dev-debug-acceptance
description: Use this skill when working on VoiceCanvas development, debugging, acceptance, browser validation, OpenAI Realtime voice integration, Mermaid rendering, Patch engine changes, or UI changes in this repo.
---

# VoiceCanvas Development, Debug, and Acceptance

Use this skill for implementation, bug fixes, refactors, and verification in the VoiceCanvas repo.

## Current Framework

The current product path is:

```text
OpenAI Realtime voice or text command -> VoiceSegment -> Patch compiler -> Validator -> Canvas mutation -> Mermaid view -> Patch history
```

The workbench is Mermaid-first. Voice input goes through OpenAI Realtime, then through the same Patch pipeline as text commands.

## Repo Map

- `apps/web`: React + Vite workbench, Mermaid canvas, OpenAI Realtime voice hook, file library, candidate confirmation, Patch history.
- `apps/api`: Hono API, workspace state, OpenAI Realtime session proxy, text command pipeline.
- `packages/core`: `CanvasDoc`, `Patch`, `PatchOp`, Validator, rollback, Mermaid conversion, templates, mock compiler.
- `packages/ai`: optional OpenAI-compatible Patch compiler adapter.
- `packages/eval`: acceptance cases and metric helpers.

## Development Workflow

1. Read the relevant code before editing. Start with `packages/core` for graph behavior, `apps/api/src/app.ts` for API behavior, and `apps/web/src/app.tsx` for visible workflow behavior.
2. Preserve the Patch boundary. Voice and model layers produce commands or draft patches; only Validator plus Patch execution mutates `CanvasDoc`.
3. Keep changes testable without API keys. Text command and mock compiler paths must pass without `OPENAI_API_KEY`.
4. Keep `POST /api/dev/reset` working. E2E and browser checks depend on repeatable empty-canvas state.
5. Use `pnpm` only. Do not introduce npm/yarn lockfiles.
6. Keep the stack as React + Vite and Hono.

## Debug Playbook

Use the smallest layer that can reproduce the bug:

- Core graph bug: run `pnpm --filter @voicecanvas/core test`.
- API pipeline bug: run `pnpm --filter @voicecanvas/api test`.
- UI workflow bug: run `pnpm test:e2e`, then inspect the app in a browser.
- Build/type bug: run `pnpm build`.
- Realtime bug: first check `/api/realtime/provider`, then test `/api/realtime/openai/session` with `OPENAI_API_KEY`.

When debugging commands:

1. Reset state with `curl -X POST http://localhost:8787/api/dev/reset`.
2. Reproduce with `POST /api/commands/text-segment`.
3. Confirm `history.length`, `canvas.version`, `pendingPatch`, and `patch.status`.
4. Inspect browser console groups for realtime voice event, realtime tool call, speech result, and action result.

## Acceptance Gates

Before calling a task complete, run:

```bash
pnpm test
pnpm lint
pnpm build
pnpm test:e2e
```

If another local app occupies `5173`, run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5177 PLAYWRIGHT_WEB_PORT=5177 pnpm test:e2e
```

## Test Case Policy

Every meaningful behavior change should add or update at least one of:

- `packages/core/src/*.test.ts` for Patch/Validator behavior.
- `apps/api/src/*.test.ts` for Hono endpoints and pipeline behavior.
- `apps/web/e2e/*.spec.ts` for user-visible workflow behavior.
- `packages/eval/src/acceptance-cases.ts` when the acceptance matrix changes.

Prefer tests that assert product outcomes:

- Good: ambiguous local commands return candidates and do not mutate canvas.
- Good: undo restores the previous canvas version.
- Good: OpenAI Realtime tool calls send the inferred command into the same Patch pipeline as text commands.

## Realtime Guardrails

- The browser uses `realtime-voice-component`.
- The API proxies Realtime session offers at `/api/realtime/openai/session`.
- Missing `OPENAI_API_KEY` must produce a clear UI/API error.
- Provider-specific details must stay outside `packages/core`.

## Done Definition

A change is done only when:

- All relevant acceptance commands pass.
- Browser verification passes or a clear blocker is reported.
- No voice Submit/Send path was introduced.
- Patch history and rollback still work.
- Low-confidence commands still ask for confirmation.
