# VoiceCanvas

VoiceCanvas is an experimental voice-first diagram canvas. It turns natural speech into validated graph patches so a diagram can change while the user keeps speaking.

The core pipeline is:

```text
mic always on -> voice segment -> patch compiler -> validator -> canvas mutation -> patch history
```

## Current Status

This repo is an early engineering prototype. It includes:

- A React + Vite canvas workbench.
- A Hono API server.
- A Mermaid-first diagram renderer.
- A local mock patch compiler that works without model keys.
- A Doubao realtime ASR WebSocket bridge.
- Patch history, undo, low-confidence candidate confirmation, and JSON export.

## Repository Layout

```text
apps/
  web/          React + Vite app
  api/          Hono API and realtime ASR bridge
packages/
  core/         CanvasDoc, Patch engine, validator, Mermaid export
  ai/           Optional model patch compiler adapter
  eval/         Acceptance cases and metric helpers
docs/
  prd/          Product and technical planning docs
skills/
  voicecanvas-dev-debug-acceptance/
```

## Quick Start

Requirements:

- Node.js 24+
- pnpm 10+

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open:

```text
http://localhost:5173
```

The app can run without external model credentials. In that mode, graph edits use the built-in mock patch compiler.

## Environment Variables

Doubao realtime ASR is optional:

```bash
DOUBAO_API_KEY=
DOUBAO_ASR_RESOURCE_ID=volc.bigasr.sauc.duration
DOUBAO_ASR_MODEL=bigmodel
DOUBAO_ASR_URL=wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async
```

External patch compilation is optional:

```bash
PATCH_COMPILER_API_KEY=
PATCH_COMPILER_BASE_URL=
PATCH_COMPILER_MODEL=
PATCH_COMPILER_PROVIDER=
```

When the patch compiler variables are empty, VoiceCanvas uses the local mock compiler.

## Scripts

```bash
pnpm dev        # start web and api together
pnpm dev:web    # start only the Vite app
pnpm dev:api    # start only the Hono API
pnpm test       # run unit tests
pnpm lint       # run lint checks
pnpm build      # build all packages and apps
pnpm test:e2e   # run Playwright smoke tests
```

## API Surface

Important development endpoints:

- `GET /api/canvas`
- `POST /api/commands/text-segment`
- `POST /api/patch/compile`
- `POST /api/patch/apply`
- `POST /api/patch/confirm`
- `POST /api/patch/undo`
- `GET /api/realtime/provider`
- `GET /api/export/json`

## Product Docs

The product and technical planning docs are in [docs/prd](docs/prd/README.md).

## Contributing

This project is still early. Issues and small focused pull requests are welcome.

Before sending a change, run:

```bash
pnpm test
pnpm lint
pnpm build
pnpm test:e2e
```

## Naming Rules

- Source file names use `kebab-case`.
- React component exports use `PascalCase`.
- React hooks live in `apps/web/src/hooks` and use `use-*.ts`.
- Tests use `*.test.ts` or `*.spec.ts`.
- Build and test output stays out of source control.

## Development Notes

- The long-term asset is the object model and patch engine, not Mermaid syntax.
- Models only produce patch drafts. The validator and patch engine own graph changes.
- Realtime providers should stay replaceable behind unified voice events.

## License

MIT. See [LICENSE](LICENSE).
