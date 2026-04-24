# 声图 VoiceCanvas 完整实施 Plan

> 技术路线、实施步骤、模型接入、评测方案与验收标准

- 产品代号：声图 VoiceCanvas
- 文档版本：v1.0
- 文档定位：承接原始 PRD 八件套与 Arc/Framer 方向设计稿，作为进入工程实现前的完整技术实施方案。
- 核心原则：不要做成“录音后提交”的语音工具，而要做成“麦克风一直开着，用户边说，图边改”的实时语音画布。

## 0. 最重要：总体验收标准

项目是否成立，只看一件事：用户能不能“麦克风一直开着，边说，图边改”。

| 验收项 | 必须达到的标准 |
| --- | --- |
| 连续麦克风 | 用户不需要每句话后按停止、Submit、发送。 |
| 自动分段 | 麦克风持续开启，系统按自然停顿自动切分语音片段。 |
| 边说边改 | 图必须随着语音片段逐步变化，而不是等整段说完后一次性生成。 |
| 一句建图 | 用户从空白画布说一句话，系统能生成可继续编辑的流程图。 |
| 连续编辑 | 用户连续说 3 轮修改命令，至少 2 轮能正确命中目标对象并局部修改。 |
| 低置信确认 | 遇到“这里、那个、这一支”不明确时，系统必须高亮候选并追问，不能强行改。 |
| Patch 记录 | 每轮修改都必须形成可追踪 Patch，并且可以撤回到上一轮准确状态。 |
| 延迟 | 简单编辑从语音片段结束到画布变化，目标 2.5 秒内；中等复杂编辑 4 秒内。 |
| 阶段 1 门槛 | 一句建图成功率 >= 70%，连续三轮编辑成功率 >= 60%，撤回率 <= 20%，Patch 可执行率 >= 85%。 |

如果以上标准做不到，模型再强、界面再漂亮，都不能算声图的主体验成立。

## 1. 项目背景

声图要解决的不是“一句话生成一张图”，而是“用户边想边说时，图能跟着持续变”。

现有图工具的问题是手工操作太碎。用户只是想补一个节点、加一条失败分支、把某个分支排紧凑，却经常要拖框、拉线、改名、对齐、撤回。现有 AI 图工具的问题则是一次性生成还行，但第二轮、第三轮连续局部修改很弱，用户很容易失去控制感。

声图的机会在于把语音、画布和结构化 Patch 合在一起：

1. 用户保持表达节奏，不被鼠标操作打断。
2. 系统把自然语言拆成可执行的图补丁。
3. 画布只做局部变化，保住稳定感。
4. 所有修改可追踪、可撤回、可评测。

目标产品形态是一个海外创作型生产力工具：全屏画布、floating command bar、floating voice capsule、轻量 side sheet。它不是聊天框，也不是国内 SaaS 后台。

本方案参考当前已有设计稿：

- `design/imagegen/01-workbench-arc-framer.png`
- `design/imagegen/02-empty-canvas-premium.png`
- `design/imagegen/03-ambiguity-confirmation.png`
- `design/imagegen/04-version-export-panel.png`

## 2. 高层目标

技术上要做成一套“实时语音体验 + 可控图编辑引擎”。

用户感受到的是：

```text
Mic always on -> speak naturally -> graph changes continuously
```

系统内部保持可控：

```text
Audio stream
-> Realtime/ASR provider
-> VoiceSegment
-> Patch compiler
-> Validator
-> Canvas mutation
-> Patch history
```

核心判断：

1. 豆包 Realtime 负责语音交互体验。
2. 内置 mock compiler 保证没有外部模型 key 也能跑通；外部模型编译器只作为增强。
3. Validator 决定是否能改图。
4. 任何模型都不能直接改画布。
5. Mermaid 可以用于早期验证，但长期核心是对象模型和 Patch 引擎。

## 3. 技术选型

| 层级 | 选型 | 决策说明 |
| --- | --- | --- |
| 前端 | React + Vite | 不使用 Next；用成熟 SPA 脚手架，适合早期产品快速迭代。 |
| 后端 | Node.js + Hono | 独立 API 服务，不依赖 Next API Routes。 |
| 包管理 | pnpm workspace | 管理 web、api、core、ai、eval 多包。 |
| AI 接入 | Vercel AI SDK | 外部 Patch 编译器可选；无 key 时使用本地 mock compiler。 |
| 阶段 0 画布 | Mermaid | 快速验证自然语言到图、图到导出。 |
| 阶段 1 画布 | React Flow / XYFlow | 支持对象级节点、边、候选高亮、局部编辑。 |
| 数据校验 | Zod | 校验模型输出、Patch、API 输入输出。 |
| 单元测试 | Vitest | 覆盖 core、ai、patch、validator。 |
| 端到端测试 | Playwright | 覆盖连续输入、确认、撤回、导出。 |

明确不做：

1. 不使用 Next。
2. 不自研脚手架。
3. 不自己造 AI 接入层。
4. 不做“录音后提交”的语音交互。
5. 不让模型绕过 Validator 直接改图。

## 4. 工程结构

```text
apps/
  web/
  api/
packages/
  core/
  ai/
  eval/
```

### apps/web

React + Vite 前端。

职责：

- 全屏画布。
- 持续麦克风状态。
- floating voice capsule。
- floating command bar。
- 低置信候选高亮。
- Patch history。
- 导出入口。
- 开发期文本流模拟器。

### apps/api

Hono Node 后端。

职责：

- 命令接口。
- 模型调用。
- Realtime/ASR Provider 适配。
- Patch 编译。
- Validator 调用。
- 导出接口。
- 评测接口。

### packages/core

产品核心逻辑。

职责：

- `CanvasDoc`
- `GraphNode`
- `GraphEdge`
- `Patch`
- `PatchOp`
- `Validator`
- `Rollback`
- 局部布局策略
- MermaidPatch 转换

### packages/ai

基于 Vercel AI SDK 的模型封装层。

职责：

- 豆包 Realtime provider。
- 可选外部 Patch compiler provider。
- Prompt 模板。
- Patch JSON 输出解析。
- 模型错误归一化。

### packages/eval

评测包。

职责：

- 评测集。
- 模型对比脚本。
- 指标计算。
- 失败样本记录。
- 阶段验收报告生成。

## 5. 模型与实时语音路线

### 第一主线

```text
豆包 Realtime
-> transcript event
-> Hono API
-> Patch compiler
-> Validator
-> Canvas
```

豆包 Realtime 负责中文端到端实时语音体验。Patch compiler 可以是本地 mock，也可以接外部模型；没有外部模型 key 时仍然可以使用文本流和 Demo 工作流。

### 模型职责

| 模型/服务 | 职责 | 不负责 |
| --- | --- | --- |
| 豆包 Realtime | 中文实时语音体验实验 | 直接修改画布 |
| 本地 mock compiler | 无 key 时跑通建图、编辑、确认、撤回 | 真实语义泛化 |
| 可选外部 Patch compiler | 自然语言命令转 Patch / MermaidPatch | 实时语音层 |
| Validator | 判断 Patch 是否可执行、是否需要确认 | 语义创作 |

## 6. 核心技术决策

1. 麦克风是连续 session，不是一次性 input。
2. 前端主流程不提供“Submit 语音”。
3. 所有语音片段进入队列，不能丢、不能乱序。
4. 同一画布同一时间只执行一个 Patch。
5. 撤回命令优先级高于普通编辑命令。
6. 低置信确认不中断麦克风，用户可以直接说 “the second one”。
7. Realtime provider 必须可替换，不能和产品逻辑耦死。
8. Mermaid 是阶段 0 验证和导出格式，不是最终唯一图引擎。
9. 长期资产是对象模型、Patch、Validator、局部布局、历史回滚。
10. 模型输出必须是 draft，最终执行权在 Validator 和图引擎。

## 7. 核心数据结构

### VoiceSegment

```ts
type VoiceSegment = {
  id: string;
  provider: "doubao-asr" | "text-sim";
  partialTranscript?: string;
  finalTranscript: string;
  confidence?: number;
  startedAt: number;
  endedAt: number;
  status: "captured" | "queued" | "planning" | "done" | "failed";
};
```

### CanvasDoc

```ts
type CanvasDoc = {
  id: string;
  diagramType: "flowchart" | "mindmap";
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: ViewportState;
  currentVersionId: string;
};
```

### Patch

```ts
type Patch = {
  id: string;
  sourceSegmentIds: string[];
  sourceText: string;
  ops: PatchOp[];
  targetCandidates: TargetCandidate[];
  confidence: number;
  status: "draft" | "needs_confirm" | "applied" | "failed" | "rolled_back";
  rollback: RollbackRecord;
  createdAt: number;
};
```

### PatchOp

```ts
type PatchOp =
  | { type: "addNode"; node: GraphNode; afterNodeId?: string }
  | { type: "updateNode"; nodeId: string; text?: string; status?: string }
  | { type: "deleteNode"; nodeId: string }
  | { type: "addEdge"; edge: GraphEdge }
  | { type: "deleteEdge"; edgeId: string }
  | { type: "changeLayout"; scope: "local" | "subtree"; rootNodeId: string };
```

### VoiceCommandEvent

```ts
type VoiceCommandEvent = {
  segmentId: string;
  transcript: string;
  intentType: "create" | "edit" | "confirm" | "undo" | "cancel" | "unknown";
  canvasId: string;
  selectedObjectIds: string[];
  recentPatchIds: string[];
};
```

## 8. 实施步骤

### Step 1：搭建工程

用 pnpm workspace 创建 `apps/web`、`apps/api`、`packages/core`、`packages/ai`、`packages/eval`。跑通 React + Vite、Hono、Vitest。

验收：

- `pnpm install` 成功。
- `pnpm dev` 能同时启动 web 和 api。
- `pnpm test` 能跑通至少一个 core 单测。

### Step 2：做文本流模拟

先不用真实语音，用文本模拟连续语音片段。输入多句内容时，系统自动切成 segment，不出现 Submit 按钮。

示例输入：

```text
create signup flow...
add OTP after phone verification...
failure goes back to phone verification...
```

验收：

- 每个片段自动进入队列。
- 画布分步变化。
- UI 能看到 Listening / Planning / Editing / Done 状态。

### Step 3：实现 Mermaid-first Demo

先用本地 mock compiler 输出 Mermaid 或 MermaidPatch，前端渲染图。外部模型编译器作为后续增强。

验收：

- 从空白生成注册流程图。
- 能追加验证码节点。
- 能追加失败分支。
- Mermaid 语法错误时不更新画布，并给出失败状态。

### Step 4：实现对象模型和 Patch 引擎

定义 CanvasDoc、GraphNode、GraphEdge、Patch、PatchOp。支持新增、改名、加边、删除、局部布局、撤回。

验收：

- 每轮变化都有 Patch。
- Patch 执行前有 rollback 数据。
- 撤回后画布准确恢复。
- Patch 单测覆盖新增、改名、加边、撤回。

### Step 5：实现 Validator 和低置信确认

模型输出 Patch draft 后先校验。目标不明确时生成 candidate list，前端高亮候选，等待语音或点击确认。

验收：

- 用户说 “add a step here” 且目标不明确时，系统进入确认态。
- 系统高亮 2 到 3 个候选。
- 用户直接说 “the second one” 可以继续，不需要重新开麦。

### Step 6：接入豆包 Realtime

前端建立 WebSocket session。Realtime provider 只输出语音片段，后端继续通过 Patch compiler 和 Validator 执行。

验收：

- 用户持续说话时，系统按自然停顿触发多次局部图变化。
- 用户不需要停止或发送。
- Realtime provider 只输出 VoiceSegment / VoiceCommandEvent，不直接修改画布。

### Step 7：接入豆包 ASR 备选

实现统一 `VoiceProvider`，接入豆包 Realtime 和豆包流式 ASR。所有 provider 输出统一 VoiceSegment / VoiceCommandEvent。

验收：

- 切换 provider 后，Patch 编译和画布执行逻辑不用改。
- Provider 失败时能回退到文本模拟或其他 provider。
- 错误信息能进入 eval 记录。

### Step 8：做 Alpha 工作台

实现全屏画布、floating command bar、floating voice capsule、轻量 side sheet、Patch history、候选高亮、PNG/JSON 导出。

验收：

- 用户能从开麦到导出，全程不按 Submit。
- 能完成建图、三轮修改、确认、撤回。
- UI 不出现长聊天流。
- 导出 PNG/JSON 与当前画布一致。

## 9. 评测方案

评测不能只看 ASR 字错率，要看“语音是否最终正确改图”。

### 评测集

- 80 条真实连续语音任务。
- 中文 40 条，英文 20 条，中英混合 20 条。
- 覆盖建图、加节点、改名、加分支、删除、撤回、改口、低置信确认。

### 对比路线

1. 豆包端到端实时语音 + 本地 mock compiler。
2. 豆包流式 ASR + 本地 mock compiler。
3. 豆包端到端实时语音 + 可选外部 Patch compiler。
4. 豆包流式 ASR + 可选外部 Patch compiler。

### 指标

| 指标 | 说明 |
| --- | --- |
| Patch 可执行率 | 模型输出能否通过 Validator 并执行。 |
| 目标对象命中率 | 是否改到了正确节点、边或分支。 |
| 低置信确认准确率 | 不确定时是否正确停住并给候选。 |
| 平均端到端延迟 | 从语音片段结束到画布变更完成。 |
| 撤回率 | 用户是否频繁撤回，反映误改程度。 |
| 二次纠正率 | 用户是否需要补一句修正模型错误。 |
| 连续三轮成功率 | 三轮连续编辑中至少两轮无需人工纠正。 |

### 评测输出

每轮评测生成一份 Markdown/JSON 报告：

- provider 名称。
- 样本总数。
- 成功样本。
- 失败样本。
- 失败原因分类。
- 延迟统计。
- 是否达到阶段门槛。

## 10. 不通过条件

出现以下任一情况，不能进入下一阶段：

1. 需要用户每句话后按停止、发送、Submit。
2. 用户连续说话时系统丢失后续命令。
3. 图只在整段语音结束后才变化。
4. 模型能生成图，但不能连续局部修改。
5. 低置信时模型强行执行。
6. Patch 无法撤回。
7. 画布每轮大幅重排。
8. Provider 被写死，无法替换。
9. 没有评测数据，只靠主观体验判断模型好坏。

## 11. 参考资料

- 豆包端到端实时语音: [火山引擎文档](https://www.volcengine.com/docs/6561/1594360)
- 豆包流式 ASR: [火山引擎文档](https://www.volcengine.com/docs/6561/1354869)
