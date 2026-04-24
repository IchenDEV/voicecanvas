export type AcceptanceCase = {
  id: string
  title: string
  layer: 'core' | 'api' | 'web' | 'realtime'
  command: string
  expected: string[]
  requiredForStage1: boolean
}

export const acceptanceCases: AcceptanceCase[] = [
  {
    id: 'core-blank-to-signup-flow',
    title: 'Blank canvas creates editable signup flow',
    layer: 'core',
    command: 'pnpm --filter @voicecanvas/core test',
    expected: [
      'A blank CanvasDoc becomes a flowchart with nodes and edges.',
      'The applied Patch includes rollback data.',
      'The generated Mermaid string contains flowchart TD.',
    ],
    requiredForStage1: true,
  },
  {
    id: 'api-continuous-three-segments',
    title: 'Continuous text segments apply ordered patches',
    layer: 'api',
    command: 'pnpm --filter @voicecanvas/api test',
    expected: [
      'create signup flow, add OTP, and failure branch produce three ordered results.',
      'Patch history length is 3.',
      'Canvas contains the OTP node and a failure edge.',
    ],
    requiredForStage1: true,
  },
  {
    id: 'api-ambiguous-here-candidates',
    title: 'Ambiguous here command asks for confirmation',
    layer: 'api',
    command: 'pnpm --filter @voicecanvas/api test',
    expected: [
      'add a step here returns needs_confirm.',
      'Exactly three target candidates are returned.',
      'Confirming a candidate applies the pending patch and clears pendingPatch.',
    ],
    requiredForStage1: true,
  },
  {
    id: 'api-undo-restores-previous-version',
    title: 'Undo restores previous canvas version',
    layer: 'api',
    command: 'pnpm --filter @voicecanvas/api test',
    expected: [
      'Undo returns status undone.',
      'Canvas version decreases by one.',
      'Patch history length decreases by one.',
    ],
    requiredForStage1: true,
  },
  {
    id: 'web-no-submit-continuous-flow',
    title: 'Workbench has no Submit and supports continuous simulation',
    layer: 'web',
    command: 'pnpm test:e2e',
    expected: [
      'No visible Submit text exists.',
      'Continuous text input creates three Patch history items.',
      'Ambiguous input shows candidate confirmation.',
      'Undo returns history from four items to three.',
    ],
    requiredForStage1: true,
  },
  {
    id: 'realtime-doubao-provider-only',
    title: 'Realtime provider is Doubao only',
    layer: 'realtime',
    command: 'pnpm --filter @voicecanvas/api test',
    expected: [
      'GET /api/realtime/provider returns provider doubao-asr.',
      'The legacy realtime session route returns 404.',
      'The local text simulation path remains usable without credentials.',
    ],
    requiredForStage1: true,
  },
]

export function requiredStage1Cases() {
  return acceptanceCases.filter((testCase) => testCase.requiredForStage1)
}
