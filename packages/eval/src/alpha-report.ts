import type { EvalMetrics, EvalSampleResult } from './index'

export type AlphaThresholds = {
  patchExecutableRate: number
  threeRoundSuccessRate: number
  averageLatencyMs: number
}

export type AlphaEvalReport = {
  generatedAt: string
  metrics: EvalMetrics
  thresholds: AlphaThresholds
  passed: boolean
}

export const alphaThresholds: AlphaThresholds = {
  patchExecutableRate: 0.85,
  threeRoundSuccessRate: 0.6,
  averageLatencyMs: 2500,
}

export function createAlphaEvalReport(results: EvalSampleResult[], generatedAt = new Date().toISOString()): AlphaEvalReport {
  const metrics = summarizeAlphaResults(results)
  return {
    generatedAt,
    metrics,
    thresholds: alphaThresholds,
    passed:
      metrics.patchExecutableRate >= alphaThresholds.patchExecutableRate &&
      metrics.threeRoundSuccessRate >= alphaThresholds.threeRoundSuccessRate &&
      metrics.averageLatencyMs <= alphaThresholds.averageLatencyMs,
  }
}

export function renderAlphaEvalMarkdown(report: AlphaEvalReport): string {
  return [
    '# VoiceCanvas Alpha Eval Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '| Metric | Actual | Target | Status |',
    '| --- | ---: | ---: | --- |',
    metricRow('Patch executable rate', report.metrics.patchExecutableRate, `>= ${report.thresholds.patchExecutableRate}`),
    metricRow('Three round success rate', report.metrics.threeRoundSuccessRate, `>= ${report.thresholds.threeRoundSuccessRate}`),
    metricRow('Average latency ms', report.metrics.averageLatencyMs, `<= ${report.thresholds.averageLatencyMs}`),
    metricRow('Target hit rate', report.metrics.targetHitRate, 'tracked'),
    metricRow('Confirmation accuracy', report.metrics.confirmationAccuracy, 'tracked'),
    metricRow('Undo rate', report.metrics.undoRate, 'tracked'),
    metricRow('Correction rate', report.metrics.correctionRate, 'tracked'),
    '',
    `Overall: ${report.passed ? 'Pass' : 'Fail'}`,
    '',
  ].join('\n')
}

export function alphaFixtureResults(): EvalSampleResult[] {
  return [
    sample({ latencyMs: 1100 }),
    sample({ latencyMs: 1300 }),
    sample({ latencyMs: 1600 }),
    sample({ latencyMs: 2100, confirmationCorrect: true }),
    sample({ latencyMs: 1900, targetHit: true }),
  ]
}

function metricRow(label: string, actual: number, target: string) {
  return `| ${label} | ${actual} | ${target} | ${statusFor(label, actual)} |`
}

function statusFor(label: string, actual: number) {
  if (label === 'Patch executable rate') {
    return actual >= alphaThresholds.patchExecutableRate ? 'Pass' : 'Fail'
  }
  if (label === 'Three round success rate') {
    return actual >= alphaThresholds.threeRoundSuccessRate ? 'Pass' : 'Fail'
  }
  if (label === 'Average latency ms') {
    return actual <= alphaThresholds.averageLatencyMs ? 'Pass' : 'Fail'
  }
  return 'Tracked'
}

function sample(overrides: Partial<EvalSampleResult> = {}): EvalSampleResult {
  return {
    patchExecutable: true,
    targetHit: true,
    confirmationCorrect: true,
    latencyMs: 1200,
    undoUsed: false,
    correctionUsed: false,
    threeRoundSuccess: true,
    ...overrides,
  }
}

function summarizeAlphaResults(results: EvalSampleResult[]): EvalMetrics {
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
