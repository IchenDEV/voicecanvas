# 声图 VoiceCanvas 技术实现方案：工程落地版

> 从 PRD 进入工程实现的执行蓝图。`07` 负责高层架构，`09` 负责总实施 Plan，本文件负责把第一阶段工程怎么写、怎么接、怎么验收说清楚。

- 产品代号：声图 VoiceCanvas
- 文档版本：v1.0
- 核心主线：`Mic always on -> VoiceSegment -> Patch compiler -> Validator -> Canvas mutation -> Patch history`
- 阶段目标：先跑通文本流模拟、Mermaid-first 画布、对象模型、Patch 执行与撤回，再接豆包 Realtime。

## 0. 验收红线

项目是否成立，只看用户能不能“麦克风一直开着，边说，图边改”。

| 验收项 | 标准 |
| --- | --- |
| 连续麦克风 | 用户不需要每句话后按停止、Submit、发送。 |
| 自动分段 | 系统按自然停顿或文本模拟分段生成 `VoiceSegment`。 |
| 渐进改图 | 每个 segment 独立进入队列，画布随 segment 逐步变化。 |
| Patch 可追踪 | 每轮变化都有 `Patch`、执行结果和 rollback 数据。 |
| 低置信确认 | “这里、那个、这一支”不明确时返回候选并高亮，不能强行执行。 |
| 撤回 | `undo` 必须恢复到上一轮准确的 `CanvasDoc`。 |
| 延迟目标 | 简单编辑从 segment 结束到画布变化 <= 2.5 秒；中等复杂编辑 <= 4 秒。 |
| Stage 1 指标 | 一句建图成功率 >= 70%，连续三轮编辑成功率 >= 60%，撤回率 <= 20%，Patch 可执行率 >= 85%。 |

任何模型都不能直接改画布。模型只能产出 draft，最终执行权在 `Validator` 和 Patch 引擎。

## 1. 总体架构

```text
Browser mic / text simulator
-> VoiceProvider
-> VoiceSegment queue
-> Hono command API
-> Patch compiler
-> Validator
-> Patch executor
-> CanvasDoc
-> Patch history
-> React canvas
```

关键边界：

1. `VoiceProvider` 只负责语音或文本事件，不触碰画布对象。
2. `Patch compiler` 默认使用本地 mock compiler；可选外部模型编译器只输出 `Patch` draft。
3. `Validator` 检查 Patch 是否能执行，必要时返回 `TargetCandidate[]`。
4. `Patch executor` 是唯一能修改 `CanvasDoc` 的模块。
5. Mermaid 是阶段 0 的渲染与导出格式，不是长期唯一图引擎。

## 2. 工程结构

```text
apps/
  web/                 React + Vite 前端
  api/                 Node.js + Hono 后端
packages/
  core/                CanvasDoc、Patch、Validator、Rollback、Mermaid 转换
  ai/                  Vercel AI SDK v6 provider 封装
  eval/                评测集、指标计算和报告脚本
```

技术选型锁定：

| 层级 | 选型 |
| --- | --- |
| 前端 | React + Vite SPA，不使用 Next |
| 后端 | Node.js + Hono |
| 包管理 | pnpm workspace |
| AI SDK | Vercel AI SDK v6 |
| 结构化输出 | `generateText` + `Output.object()` |
| 外部 Patch 编译器 | 可选；没有 key 时使用本地 mock compiler |
| 实时语音 | 浏览器麦克风接豆包 Realtime |
| 语音备选 | 豆包大模型流式 ASR |
| 画布阶段 0 | Mermaid |
| 画布阶段 1 | React Flow / XYFlow |
| 校验 | Zod + core Validator |
| 测试 | Vitest；后续补 Playwright |

## 3. 核心数据模型

### CanvasDoc

`CanvasDoc` 是画布真相源。前端渲染、导出、Patch 执行和回滚都围绕它做。

```ts
type CanvasDoc = {
  id: string;
  title: string;
  diagramType: "flowchart" | "mindmap";
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: ViewportState;
  version: number;
  appliedPatchIds: string[];
};
```

### GraphNode / GraphEdge

```ts
type GraphNode = {
  id: string;
  type: "start" | "process" | "decision" | "end" | "note";
  label: string;
  position: { x: number; y: number };
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: "default" | "success" | "failure";
};
```

### VoiceSegment / VoiceCommandEvent

```ts
type VoiceSegment = {
  id: string;
  provider: "text-sim" | "doubao-asr";
  finalTranscript: string;
  confidence?: number;
  startedAt: number;
  endedAt: number;
  status: "captured" | "queued" | "planning" | "done" | "failed";
};

type VoiceCommandEvent = {
  segmentId: string;
  transcript: string;
  intentType: "create" | "edit" | "confirm" | "undo" | "cancel" | "unknown";
  canvasId: string;
  selectedObjectIds: string[];
  recentPatchIds: string[];
};
```

### Patch / PatchOp / RollbackRecord

```ts
type Patch = {
  id: string;
  sourceSegmentIds: string[];
  sourceText: string;
  ops: PatchOp[];
  targetCandidates: TargetCandidate[];
  confidence: number;
  status: "draft" | "needs_confirm" | "applied" | "failed" | "rolled_back";
  rollback?: RollbackRecord;
  createdAt: number;
};

type PatchOp =
  | { type: "addNode"; node: GraphNode; afterNodeId?: string }
  | { type: "updateNode"; nodeId: string; label?: string }
  | { type: "deleteNode"; nodeId: string }
  | { type: "addEdge"; edge: GraphEdge }
  | { type: "deleteEdge"; edgeId: string }
  | { type: "changeLayout"; scope: "local" | "subtree"; rootNodeId: string };

type RollbackRecord = {
  before: CanvasDoc;
  appliedAt: number;
};
```

## 4. API 设计

所有接口都以 `CanvasDoc` 和 `Patch` 为中心，不返回自由文本作为执行结果。

| Method | Endpoint | 职责 |
| --- | --- | --- |
| `GET` | `/health` | API 健康检查 |
| `GET` | `/api/canvas` | 读取当前 in-memory 画布 |
| `POST` | `/api/commands/text-segment` | 开发期文本流模拟入口 |
| `POST` | `/api/patch/compile` | 自然语言命令转 Patch draft |
| `POST` | `/api/patch/apply` | Validator + Patch 执行 |
| `POST` | `/api/patch/confirm` | 低置信候选确认 |
| `POST` | `/api/patch/undo` | 撤回上一轮 Patch |
| `GET` | `/api/realtime/provider` | 读取当前 Realtime provider 配置状态 |
| `WS` | `/api/realtime/doubao/ws` | 豆包 Realtime WebSocket 代理 |
| `GET` | `/api/export/json` | 导出当前 `CanvasDoc` |
| `GET` | `/api/export/png` | Stage 1 先占位，Alpha 再实现 |

开发期 `POST /api/commands/text-segment` 请求：

```json
{
  "text": "create signup flow... add OTP after phone verification...",
  "selectedObjectIds": []
}
```

响应：

```json
{
  "segment": {},
  "patch": {},
  "canvas": {},
  "history": [],
  "status": "applied"
}
```

## 5. Realtime / ASR 接入

### 豆包 Realtime 主线

浏览器采集麦克风音频，经 Hono 代理接豆包 Realtime。后端负责密钥保护和 WebSocket 转发：

```text
web microphone
-> local VAD
-> WS /api/realtime/doubao/ws
-> Doubao Realtime
-> transcript event
-> Hono Patch pipeline
```

实现原则：

1. 麦克风持续开启，音频按片段提交。
2. Realtime provider 只产生 transcript / command event。
3. transcript 只把用户命令送入 Hono API，不能直接改图。
4. 低置信确认不关闭麦克风，用户可以继续说 “the second one”。

统一抽象：

```ts
interface VoiceProvider {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onSegment(handler: (segment: VoiceSegment) => void): void;
}
```

所有 provider 最终都只输出 `VoiceSegment` 或 `VoiceCommandEvent`。

## 6. Patch 编译链路

阶段 1 有两条编译路径：

1. `mock-compiler`：用于本地可跑 Demo 和测试，不依赖 API key。
2. `modelPatchCompiler`：可选外部模型编译器，输出 `Output.object()` 结构化 Patch draft。

编译后流程固定：

```text
Patch draft
-> validatePatch()
-> needs_confirm ? return candidates : applyPatch()
-> append Patch history
-> return CanvasDoc
```

低置信规则：

1. 文本含 “here / that / this branch / 这里 / 那个 / 这一支” 且没有明确 `selectedObjectIds`，进入 `needs_confirm`。
2. 候选取当前选中对象、最近修改对象、视口中心附近对象，最多 3 个。
3. 用户确认后只替换目标引用，不重新生成整张图。

## 7. 前端工作台

阶段 1 前端先做一个可用 Alpha 工作台：

1. 全屏画布为主。
2. 顶部 floating command bar。
3. 底部 floating voice capsule。
4. 右侧轻量 Patch history side sheet。
5. 文本流模拟器自动按换行、省略号、句号切 segment，不出现 Submit 按钮。
6. Mermaid-first 渲染当前 `CanvasDoc`。
7. 候选确认以贴近画布对象的浮层表达。
8. Undo 优先级高于普通编辑。

视觉方向沿用现有 Arc/Framer 风格设计稿：

- `design/imagegen/01-workbench-arc-framer.png`
- `design/imagegen/02-empty-canvas-premium.png`
- `design/imagegen/03-ambiguity-confirmation.png`
- `design/imagegen/04-version-export-panel.png`

## 8. 评测与测试

### 单元测试

`packages/core` 必须先覆盖：

1. 空白画布一句建图。
2. addNode + addEdge。
3. updateNode。
4. deleteNode 自动删除相关边。
5. invalid edge 不污染画布。
6. rollback 恢复上一版。
7. ambiguous command 返回候选。

### 集成测试

`apps/api` 覆盖：

1. `text-segment` 连续三轮后画布有三轮变化。
2. `undo` 后画布回到上一版。
3. `confirm` 能把 pending patch 应用到选中的候选节点。
4. `/api/realtime/provider` 在缺少豆包 key 时返回明确配置状态。

### 后续 Playwright

Alpha 前补浏览器测试：

1. 页面不出现 Submit 按钮。
2. 连续粘贴三句文本后 Mermaid 图逐步变化。
3. 低置信候选可见。
4. Undo 按钮恢复画布。

## 9. 实施顺序

1. 建 pnpm workspace。
2. 用 Vite React 脚手架生成 `apps/web`。
3. 用 Hono Node 脚手架生成 `apps/api`。
4. 新建 `packages/core`，实现对象模型、Patch apply/rollback、Validator、Mermaid 转换和 mock compiler。
5. 新建 `packages/ai`，提供 Vercel AI SDK v6 的可选结构化 Patch 编译器封装。
6. 新建 `packages/eval`，先放评测指标骨架。
7. API 接 `text-segment -> compile -> validate -> apply`。
8. Web 接全屏工作台、文本流模拟、Mermaid 渲染、Patch history、Undo、候选确认。
9. 跑 `pnpm install`、`pnpm test`、`pnpm build`。
10. 启动 `pnpm dev`，浏览器验收核心工作流。

## 10. 不通过条件

出现任一情况，不能进入下一阶段：

1. 需要用户每句话后按 Stop、Submit、Send。
2. 语音或文本连续输入时丢 segment。
3. 模型直接改画布。
4. Patch 无法回滚。
5. 低置信时强行执行。
6. Mermaid 语法错误污染当前画布。
7. Provider 和业务逻辑耦死。
8. 没有可重复测试，只靠主观体验判断。

## 11. 外部参考

- Vercel AI SDK structured data: <https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data>
- 豆包端到端实时语音: <https://www.volcengine.com/docs/6561/1594360>
- 豆包大模型流式 ASR: <https://www.volcengine.com/docs/6561/1354869>
