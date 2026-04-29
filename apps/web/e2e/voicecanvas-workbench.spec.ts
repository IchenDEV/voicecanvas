import { expect, test } from '@playwright/test'

const apiBaseURL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8787'
const apiUrl = (path: string) => `${apiBaseURL}${path}`

test.beforeEach(async ({ page, request }) => {
  await request.post(apiUrl('/api/dev/reset'))
  await page.goto('/')
})

test('voice-only workbench hides manual text controls', async ({ page, request }) => {
  await expect(page.getByText('Submit')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('Ready')
  await expect(page.getByLabel('Patch history')).toHaveCount(0)
  await expect(page.getByText('Start speaking to grow the graph')).toHaveCount(0)
  await expect(page.getByText('Choose a starting point')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ideas and structure Mind map' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Conversation or handoff Sequence' })).toBeVisible()
  await expect(page.locator('textarea[aria-label="Continuous text stream simulator"]')).toHaveCount(0)
  await expect(page.getByLabel('Continuous text stream simulator')).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByText('Try:')).toHaveCount(0)
  await expect(page.locator('.patch-toast')).toHaveCount(0)
  await expect(page.locator('img.brand-mark[src="/brand/voicecanvas-mark.svg"]')).toHaveCount(1)
  await expect(page.getByText('Demo stream')).toHaveCount(0)
  await expect(page.getByText('Run sample flow')).toHaveCount(0)

  const initialVoiceCapsuleBox = await page.getByLabel('Voice input').boundingBox()
  expect(initialVoiceCapsuleBox).not.toBeNull()
  expect(initialVoiceCapsuleBox!.width).toBeLessThanOrEqual(240)

  await request.post(apiUrl('/api/commands/text-segment'), {
    data: { text: 'create signup flow... add OTP after phone verification... failure goes back to phone verification...' },
  })
  await page.reload()
  await expect(page.locator('.mermaid-canvas svg')).toBeVisible()
  await expect(page.locator('.react-flow')).toHaveCount(0)
  await expect(page.getByText('Enter phone number')).toBeVisible()
  await expect(page.getByLabel('Patch history')).toHaveCount(0)
  await expect(page.locator('.patch-toast')).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)

  await page.getByRole('button', { name: 'Open version history' }).click()
  await expect(page.getByLabel('Patch history')).toBeVisible()
  await expect(page.locator('.history-item')).toHaveCount(3)
  await expect(page.getByText('failure goes back to phone verification')).toBeVisible()

  await page.getByRole('button', { name: 'Close version history' }).click()
  await request.post(apiUrl('/api/commands/text-segment'), {
    data: { text: 'add a step here...' },
  })
  await page.reload()
  await expect(page.getByText('Which node did you mean?')).toBeVisible()
  await expect(page.locator('.candidate-list button')).toHaveCount(3)
  await expect(page.locator('.mermaid-canvas .voicecanvasCandidate')).toHaveCount(3)

  await page.locator('.candidate-list button').nth(1).click()
  await page.getByRole('button', { name: 'Open version history' }).click()
  await expect(page.locator('.history-item')).toHaveCount(4)

  await page.getByLabel('Undo last patch').click()
  await expect(page.locator('.history-item')).toHaveCount(3)
  await expect(page.getByRole('status')).toHaveText('Ready')

  await page.getByRole('button', { name: 'Close version history' }).click()
  await expect(page.getByLabel('Patch history')).toHaveCount(0)
})

test('history panel overlays the canvas without shifting it', async ({ page }) => {
  await page.setViewportSize({ width: 1006, height: 867 })
  await page.reload()

  const beforeBox = await page.locator('.empty-canvas').boundingBox()
  expect(beforeBox).not.toBeNull()

  await page.getByRole('button', { name: 'Open version history' }).click()
  await expect(page.getByLabel('Patch history')).toBeVisible()

  const afterBox = await page.locator('.empty-canvas').boundingBox()
  const panelBox = await page.getByLabel('Patch history').boundingBox()
  expect(afterBox).not.toBeNull()
  expect(panelBox).not.toBeNull()

  const beforeCenter = beforeBox!.x + beforeBox!.width / 2
  const afterCenter = afterBox!.x + afterBox!.width / 2
  expect(Math.abs(afterCenter - beforeCenter)).toBeLessThanOrEqual(1)
  expect(panelBox!.height).toBeLessThanOrEqual(420)
})

test('rendered diagram stays centered in the canvas', async ({ page, request }) => {
  await page.setViewportSize({ width: 1006, height: 867 })
  await request.post(apiUrl('/api/commands/text-segment'), {
    data: {
      text: 'create signup flow... change phone number step to collect mobile number... delete verify phone step...',
    },
  })
  await page.reload()

  await expect(page.getByText('Collect mobile number')).toBeVisible()
  await expect(page.getByText('Verify phone')).toHaveCount(0)

  const stageBox = await page.getByLabel('Diagram canvas').boundingBox()
  const diagramBox = await page.locator('.mermaid-canvas svg').boundingBox()
  expect(stageBox).not.toBeNull()
  expect(diagramBox).not.toBeNull()

  const stageCenter = stageBox!.x + stageBox!.width / 2
  const diagramCenter = diagramBox!.x + diagramBox!.width / 2
  expect(Math.abs(diagramCenter - stageCenter)).toBeLessThanOrEqual(24)
})

test('selected object context and PNG export are available in the Alpha workbench', async ({ page, request }) => {
  await request.post(apiUrl('/api/commands/text-segment'), {
    data: { text: 'create signup flow...' },
  })
  await page.reload()

  await page.getByText('Enter phone number').click()
  await expect(page.getByText('Selected: Enter phone number')).toBeVisible()

  await request.post(apiUrl('/api/commands/text-segment'), {
    data: { text: 'add a step here...', selectedObjectIds: ['node_phone'] },
  })
  await page.reload()
  await expect(page.getByText('New step')).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByLabel('Export PNG').click()
  const artifact = await download
  expect(artifact.suggestedFilename()).toBe('voicecanvas.png')
})

test('renders Mermaid-native diagrams beyond flowcharts', async ({ page, request }) => {
  await request.post(apiUrl('/api/commands/text-segment'), {
    data: { text: 'create a mindmap about VoiceCanvas' },
  })
  await page.reload()

  await expect(page.locator('.mermaid-canvas svg')).toBeVisible()
  await expect(page.locator('.react-flow')).toHaveCount(0)
  await expect(page.locator('.mermaid-canvas').getByText('Speech input', { exact: true })).toBeVisible()
  await expect(page.locator('.mermaid-canvas').getByText('Mermaid rendering', { exact: true })).toBeVisible()
})

test('unknown query parameter does not drive the workbench', async ({ page }) => {
  await page.goto('/?preview=stage0')
  await page.waitForTimeout(1500)

  await expect(page.getByText('Submit')).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.locator('.mermaid-canvas svg')).toHaveCount(0)
  await expect(page.locator('.react-flow')).toHaveCount(0)
  await expect(page.getByText('Which node did you mean?')).toHaveCount(0)
  await expect(page.locator('.candidate-list button')).toHaveCount(0)
  await expect(page.getByText('Choose a starting point')).toBeVisible()
})

test('template picker starts a Mermaid-native diagram', async ({ page }) => {
  await page.getByRole('button', { name: 'Ideas and structure Mind map' }).click()

  await expect(page.locator('.mermaid-canvas svg')).toBeVisible()
  await expect(page.locator('.react-flow')).toHaveCount(0)
  await expect(page.locator('.mermaid-canvas').getByText('Speech input', { exact: true })).toBeVisible()
  await expect(page.locator('.mermaid-canvas').getByText('Mermaid rendering', { exact: true })).toBeVisible()
})

test('diagram file library creates, renames, switches, and deletes browser files', async ({ page }) => {
  await page.getByRole('button', { name: 'Open diagram files. Current diagram: Untitled diagram' }).click()
  await expect(page.getByLabel('Diagram files', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'New diagram' }).click()
  await page.getByRole('textbox', { name: 'Diagram name' }).fill('Meeting map')
  await page.getByRole('button', { name: 'Apply diagram name' }).click()
  await expect(page.getByRole('button', { name: 'Open diagram files. Current diagram: Meeting map' })).toBeVisible()
  await expect(page.getByText('Choose a starting point')).toBeVisible()

  await page.getByRole('button', { name: 'Ideas and structure Mind map' }).click()
  await expect(page.locator('.mermaid-canvas svg')).toBeVisible()

  await page.getByRole('button', { name: 'New diagram' }).click()
  await page.getByRole('textbox', { name: 'Diagram name' }).fill('Empty followup')
  await page.getByRole('button', { name: 'Apply diagram name' }).click()
  await expect(page.getByText('Choose a starting point')).toBeVisible()
  await expect(page.locator('.mermaid-canvas svg')).toHaveCount(0)

  await page.getByRole('button', { name: 'Open Meeting map' }).click()
  await expect(page.locator('.mermaid-canvas svg')).toBeVisible()

  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete Empty followup' }).click()
  await expect(page.getByRole('button', { name: 'Open Empty followup' })).toHaveCount(0)
})
