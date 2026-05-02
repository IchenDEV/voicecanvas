# VoiceCanvas Prototype Check

This file describes what stage 0 must prove before Alpha work starts.

## Current Prototype

VoiceCanvas stage 0 is a Mermaid-first engineering prototype. It must run without external model or voice keys, while still allowing a configured OpenAI Realtime path for real microphone testing.

Core path:

```text
voice or text segment -> patch draft -> validator -> patch engine -> CanvasDoc -> Mermaid view
```

## Manual Check Path

Run the local app and use API-driven checks or the browser tests to exercise the Prototype path. The visible product UI must stay voice-first: no Submit buttons, textareas, or chat-style input should appear on the workbench.

## Required Checks

Run:

```bash
pnpm check:prototype
```

This command runs:

- `pnpm test`
- `pnpm build`
- `pnpm lint`
- `pnpm test:e2e`

The Vite warning about large Mermaid chunks is allowed during Prototype.

## Pass Criteria

- A blank canvas can become an editable signup flow.
- Three ordered segments create three Patch history entries.
- Ambiguous target text returns candidate buttons and highlights those candidates on the canvas.
- Confirming a candidate applies a Patch.
- Undo restores the previous canvas version.
- JSON export returns the current `CanvasDoc`.
- Missing OpenAI credentials show `OpenAI key needed` before a realtime session is opened.

## Alpha Boundary

These are intentionally outside stage 0:

- PNG, PDF, and editable-file export.
- Accounts, sharing, and team spaces.
- Real usage metrics from seed users.
