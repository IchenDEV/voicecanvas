import { describe, expect, it } from 'vitest'
import { acceptanceCases, requiredStage1Cases } from './acceptance-cases'
import { summarizeEval, type EvalSampleResult } from './index'

describe('VoiceCanvas acceptance cases', () => {
  it('tracks the complete stage-1 acceptance surface', () => {
    expect(requiredStage1Cases()).toHaveLength(6)
    expect(acceptanceCases.map((testCase) => testCase.id)).toEqual([
      'core-blank-to-signup-flow',
      'api-continuous-three-segments',
      'api-ambiguous-here-candidates',
      'api-undo-restores-previous-version',
      'web-no-submit-continuous-flow',
      'realtime-openai-voice-component',
    ])
  })

  it('keeps acceptance cases executable through repo commands', () => {
    for (const testCase of acceptanceCases) {
      expect(testCase.command).toMatch(/^pnpm /)
      expect(testCase.expected.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('summarizes stage-1 threshold metrics from sample results', () => {
    const passingSamples: EvalSampleResult[] = [
      sample({ latencyMs: 1200 }),
      sample({ latencyMs: 1500 }),
      sample({ latencyMs: 1800, correctionUsed: true }),
    ]

    const metrics = summarizeEval(passingSamples)

    expect(metrics.patchExecutableRate).toBe(1)
    expect(metrics.threeRoundSuccessRate).toBe(1)
    expect(metrics.undoRate).toBe(0)
    expect(metrics.averageLatencyMs).toBeLessThan(2500)
  })
})

function sample(overrides: Partial<EvalSampleResult> = {}): EvalSampleResult {
  return {
    patchExecutable: true,
    targetHit: true,
    confirmationCorrect: true,
    latencyMs: 1000,
    undoUsed: false,
    correctionUsed: false,
    threeRoundSuccess: true,
    ...overrides,
  }
}
