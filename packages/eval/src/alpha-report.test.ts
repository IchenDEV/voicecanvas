import { describe, expect, it } from 'vitest'
import { createAlphaEvalReport, renderAlphaEvalMarkdown } from './alpha-report'

describe('alpha eval report', () => {
  it('summarizes alpha threshold metrics and renders markdown', () => {
    const report = createAlphaEvalReport([
      {
        patchExecutable: true,
        targetHit: true,
        confirmationCorrect: true,
        latencyMs: 1200,
        undoUsed: false,
        correctionUsed: false,
        threeRoundSuccess: true,
      },
      {
        patchExecutable: true,
        targetHit: true,
        confirmationCorrect: true,
        latencyMs: 1800,
        undoUsed: false,
        correctionUsed: false,
        threeRoundSuccess: true,
      },
    ])

    expect(report.passed).toBe(true)
    expect(report.metrics.patchExecutableRate).toBe(1)
    expect(report.thresholds.threeRoundSuccessRate).toBe(0.6)
    expect(renderAlphaEvalMarkdown(report)).toContain('| Patch executable rate | 1 | >= 0.85 | Pass |')
  })
})
