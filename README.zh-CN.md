# VoiceCanvas

[English README](README.md)

VoiceCanvas 是一个语音优先的图形画布原型。它把自然语音转成经过校验的图形 Patch，让用户保持说话时，流程图也能持续变化。

![VoiceCanvas 工作台](docs/assets/voicecanvas-workbench.png)

核心链路：

```text
麦克风持续开启 -> 语音片段 -> Patch 编译器 -> Validator -> 画布变化 -> Patch 历史
```

## 当前状态

这是一个早期工程原型，已经包含：

- React + Vite 画布工作台
- Hono API 服务
- Mermaid-first 图形渲染
- 无模型 key 也可运行的本地 mock Patch 编译器
- 豆包实时 ASR WebSocket 代理
- Patch history、撤回、低置信候选确认、JSON 导出

## 项目结构

```text
apps/
  web/          React + Vite 前端
  api/          Hono API 与实时 ASR 代理
packages/
  core/         CanvasDoc、Patch 引擎、Validator、Mermaid 导出
  ai/           可选模型 Patch 编译器适配
  eval/         测试任务与指标辅助
docs/
  prd/          产品与技术方案文档
skills/
  voicecanvas-dev-debug-acceptance/
```

## 快速开始

环境要求：

- Node.js 24+
- pnpm 10+

```bash
pnpm install
cp .env.example .env
pnpm dev
```

打开：

```text
http://localhost:5173
```

没有外部模型凭据时也能运行。此时图形编辑会使用内置 mock Patch 编译器。

## 环境变量

豆包实时 ASR 是可选项：

```bash
DOUBAO_API_KEY=
DOUBAO_ASR_RESOURCE_ID=volc.bigasr.sauc.duration
DOUBAO_ASR_MODEL=bigmodel
DOUBAO_ASR_URL=wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async
```

外部 Patch 编译器也是可选项：

```bash
PATCH_COMPILER_API_KEY=
PATCH_COMPILER_BASE_URL=
PATCH_COMPILER_MODEL=
PATCH_COMPILER_PROVIDER=
```

Patch 编译器变量为空时，VoiceCanvas 使用本地 mock 编译器。

## 常用脚本

```bash
pnpm dev        # 同时启动 web 和 api
pnpm dev:web    # 只启动 Vite 前端
pnpm dev:api    # 只启动 Hono API
pnpm test       # 运行单元测试
pnpm lint       # 运行 lint
pnpm build      # 构建和类型检查
pnpm test:e2e   # 运行 Playwright 冒烟测试
```

## API

主要开发接口：

- `GET /api/canvas`
- `POST /api/commands/text-segment`
- `POST /api/patch/compile`
- `POST /api/patch/apply`
- `POST /api/patch/confirm`
- `POST /api/patch/undo`
- `GET /api/realtime/provider`
- `GET /api/export/json`

## 产品文档

产品与技术方案在 [docs/prd](docs/prd/README.md)。

## 贡献

项目还在早期阶段，欢迎提交 issue 和小范围 PR。

提交改动前建议运行：

```bash
pnpm test
pnpm lint
pnpm build
pnpm test:e2e
```

## License

MIT. See [LICENSE](LICENSE).
