# VoiceCanvas Web

React + Vite workbench for VoiceCanvas.

## Run

```bash
pnpm --filter @voicecanvas/web dev
```

Default URL:

```text
http://localhost:5173
```

The Vite dev server proxies `/api` and realtime WebSocket traffic to the API server on port `8787`.

## Main Responsibilities

- Full-screen diagram canvas.
- Floating command bar and voice capsule.
- Mermaid rendering for the first prototype.
- Candidate confirmation UI.
- Version history panel.

## Test

```bash
pnpm --filter @voicecanvas/web test
```
