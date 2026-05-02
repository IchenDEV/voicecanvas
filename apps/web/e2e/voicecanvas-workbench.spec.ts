import { expect, test } from '@playwright/test'

const apiBaseURL = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8787'

test.beforeEach(async ({ page, request }) => {
  await request.post(`${apiBaseURL}/api/dev/reset`)
  await page.goto('/')
})

test('voice-only workbench hides manual text controls', async ({ page, request }) => {
  await expect(page.getByText('Submit')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('Ready')
  await expect(page.getByLabel('Patch history')).toHaveCount(0)
  await expect(page.getByText('Start speaking to grow the graph')).toHaveCount(0)
  await expect(page.getByText('Start speaking. The graph will grow here.')).toBeVisible()
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

  await request.post(`${apiBaseURL}/api/commands/text-segment`, {
    data: { text: 'create signup flow... add OTP after phone verification... failure goes back to phone verification...' },
  })
  await page.reload()
  await expect(page.locator('.mermaid-canvas svg')).toBeVisible()
  await expect(page.getByLabel('Patch history')).toHaveCount(0)
  await expect(page.locator('.patch-toast')).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)

  await page.getByRole('button', { name: 'Open version history' }).click()
  await expect(page.getByLabel('Patch history')).toBeVisible()
  await expect(page.locator('.history-item')).toHaveCount(3)
  await expect(page.getByText('failure goes back to phone verification')).toBeVisible()

  await page.getByRole('button', { name: 'Close version history' }).click()
  await request.post(`${apiBaseURL}/api/commands/text-segment`, {
    data: { text: 'add a step here...' },
  })
  await page.reload()
  await expect(page.getByText('Which node did you mean?')).toBeVisible()
  await expect(page.locator('.candidate-list button')).toHaveCount(3)

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
  await request.post(`${apiBaseURL}/api/commands/text-segment`, {
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
