export type EvalMetrics = {
  total: number
  patchExecutableRate: number
  targetHitRate: number
  confirmationAccuracy: number
  averageLatencyMs: number
  undoRate: number
  correctionRate: number
  threeRoundSuccessRate: number
}

export type EvalSampleResult = {
  patchExecutable: boolean
  targetHit: boolean
  confirmationCorrect: boolean
  latencyMs: number
  undoUsed: boolean
  correctionUsed: boolean
  threeRoundSuccess: boolean
}

export function summarizeEval(results: EvalSampleResult[]): EvalMetrics {
  const total = results.length || 1
  return {
    total: results.length,
    patchExecutableRate: ratio(results, (result) => result.patchExecutable, total),
    targetHitRate: ratio(results, (result) => result.targetHit, total),
    confirmationAccuracy: ratio(results, (result) => result.confirmationCorrect, total),
    averageLatencyMs: Math.round(results.reduce((sum, result) => sum + result.latencyMs, 0) / total),
    undoRate: ratio(results, (result) => result.undoUsed, total),
    correctionRate: ratio(results, (result) => result.correctionUsed, total),
    threeRoundSuccessRate: ratio(results, (result) => result.threeRoundSuccess, total),
  }
}

function ratio(results: EvalSampleResult[], predicate: (result: EvalSampleResult) => boolean, total: number): number {
  return Number((results.filter(predicate).length / total).toFixed(4))
}
