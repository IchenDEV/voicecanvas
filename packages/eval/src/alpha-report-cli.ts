import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { alphaFixtureResults, createAlphaEvalReport, renderAlphaEvalMarkdown } from './alpha-report'

const outputDir = join(process.cwd(), '..', '..', 'test-results', 'alpha-eval')
const report = createAlphaEvalReport(alphaFixtureResults())

await mkdir(outputDir, { recursive: true })
await writeFile(join(outputDir, 'alpha-report.json'), `${JSON.stringify(report, null, 2)}\n`)
await writeFile(join(outputDir, 'alpha-report.md'), renderAlphaEvalMarkdown(report))

if (!report.passed) {
  process.exitCode = 1
}
