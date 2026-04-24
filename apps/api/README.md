# VoiceCanvas API

Hono API server for VoiceCanvas.

## Run

```bash
pnpm --filter @voicecanvas/api dev
```

Default URL:

```text
http://localhost:8787
```

## Main Responsibilities

- Command endpoints for text segments and patch execution.
- In-memory `CanvasDoc` workspace state for the prototype.
- Doubao realtime ASR WebSocket proxy.
- JSON export.

## Test

```bash
pnpm --filter @voicecanvas/api test
```
