---
name: voicecanvas-dev-debug-acceptance
description: Use this skill whenever working on VoiceCanvas development, debugging, test writing, acceptance, browser validation, Realtime integration, Patch engine changes, or UI changes in this repo. It enforces the mic-always-on product rule, React + Vite / Hono / pnpm workflow, Patch-first architecture, repeatable reset state, and Browser Use acceptance before calling work complete.
---

# VoiceCanvas Development, Debug, and Acceptance

Use this skill for any implementation, bug fix, refactor, or verification work in the VoiceCanvas repo.

## Product Rule

Keep the main experience aligned to:

```text
Mic always on -> VoiceSegment -> Patch compiler -> Validator -> Canvas mutation -> Patch history
```

The product promise is: `麦克风一直开着，边说，图边改`.

Do not introduce a voice Submit/Send workflow. Text simulation may have a demo button, but the product flow must still behave as segmented continuous input.

## Repo Map

- `apps/web`: React + Vite workbench, Mermaid-first canvas, voice capsule, candidate confirmation, Patch history.
- `apps/api`: Hono API, in-memory alpha canvas state, text segment pipeline, Doubao Realtime proxy.
- `packages/core`: `CanvasDoc`, `Patch`, `PatchOp`, `Validator`, rollback, Mermaid conversion, mock compiler.
- `packages/ai`: Vercel AI SDK v6 wrapper for an optional structured Patch compiler.
- `packages/eval`: acceptance case definitions and metric helpers.
- `docs/prd/10-engineering-plan.md`: engineering source of truth.

## Development Workflow

1. Read the relevant code before editing. Start with `packages/core` for graph behavior, `apps/api/src/app.ts` for API behavior, and `apps/web/src/app.tsx` for visible workflow behavior.
2. Preserve the Patch boundary. Models and providers produce draft commands; only `Validator` + Patch execution mutate `CanvasDoc`.
3. Keep changes testable without API keys. Mock/text simulation must still pass if Doubao or optional Patch compiler credentials are absent.
4. Keep `POST /api/dev/reset` working. E2E and Browser Use acceptance depend on repeatable empty-canvas state.
5. Use `pnpm` only. Do not introduce npm/yarn lockfiles.
6. Keep the stack as React + Vite and Hono. 不使用 Next.

## Debug Playbook

Use the smallest layer that can reproduce the bug:

- Core graph bug: run `pnpm --filter @voicecanvas/core test`.
- API pipeline bug: run `pnpm --filter @voicecanvas/api test`.
- UI workflow bug: run `pnpm test:e2e`, then inspect in Browser Use.
- Build/type bug: run `pnpm build`.
- Realtime bug: first check `/api/realtime/provider`, then test `/api/realtime/doubao/ws` with `DOUBAO_API_KEY` after the local mock path is green.

When debugging continuous input:

1. Reset state with `curl -X POST http://localhost:8787/api/dev/reset`.
2. Reproduce with `POST /api/commands/text-segment`.
3. Confirm `history.length`, `canvas.version`, `pendingPatch`, and `patch.status`.
4. Only then inspect the React UI.

## Acceptance Gates

Before calling a task complete, run:

```bash
pnpm test
pnpm lint
pnpm build
pnpm test:e2e
```

Then run Browser Use against `http://localhost:5173`:

1. Reset API state with `POST /api/dev/reset`.
2. Verify there is no visible `Submit` text.
3. Fill `create signup flow... add OTP after phone verification... failure goes back to phone verification...` into `Continuous text stream simulator`.
4. Open version history and verify 3 Patch history items appear.
5. Fill `add a step here...`.
6. Verify `Which node did you mean?` and 3 candidates.
7. Confirm the second candidate.
8. Verify Patch history increases to 4.
9. Click undo.
10. Verify Patch history returns to 3 and `Listening` is visible.

If Browser Use is unavailable, use Playwright as fallback and say why.

## Test Case Policy

Every meaningful behavior change should add or update at least one of:

- `packages/core/src/*.test.ts` for Patch/Validator behavior.
- `apps/api/src/*.test.ts` for Hono endpoints and pipeline behavior.
- `apps/web/e2e/*.spec.ts` for user-visible workflow behavior.
- `packages/eval/src/acceptance-cases.ts` when the acceptance matrix changes.

Prefer tests that assert product outcomes, not implementation trivia:

- Good: “ambiguous here returns candidates and does not mutate canvas.”
- Good: “undo restores previous canvas version.”
- Bad: “function X was called exactly once” unless that is the behavior being protected.

## Realtime Guardrails

- The Realtime mic button starts a Doubao audio session, but realtime events still cannot directly mutate the graph.
- Missing `DOUBAO_API_KEY` is an expected local state and must produce a clear UI/API error.
- Provider-specific code must stay behind an adapter boundary. Do not leak Doubao or model-provider details into `packages/core`.

## Done Definition

A change is done only when:

- All acceptance commands pass.
- The Browser Use check passes or an explicit blocker is reported.
- No new voice Submit/Send path was introduced.
- Patch history and rollback still work.
- Low-confidence commands still ask for confirmation.
