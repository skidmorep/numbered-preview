const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.JPCUUTS_PREVIEW_URL || 'http://127.0.0.1:8791'
const outputDir = process.env.JPCUUTS_PROOF_DIR || path.resolve('proof/admin-layout')

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const { defaultContent } = await import('../src/siteContent.js')
  let stored = structuredClone(defaultContent)
  stored.hero.headline = 'Create. Connect. Collaborate.'
  stored.booking.label = 'See times & book'
  let revision = 34
  const browser = await chromium.launch({ headless: true })
  const report = []

  try {
    for (const viewport of [
      { name: 'iphone', width: 390, height: 844 },
      { name: 'macbook-air', width: 1440, height: 900 },
    ]) {
      const page = await browser.newPage({ viewport })
      await page.route('**/api/session', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { email: 'owner@example.com', role: 'owner', mustChangePassword: false } }),
      }))
      await page.route('**/api/admin/content', async (route) => {
        if (route.request().method() === 'PUT') {
          const payload = route.request().postDataJSON()
          if (payload.revision !== revision) return route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"Revision conflict"}' })
          stored = payload.content
          revision += 1
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: stored, revision }),
        })
      })

      await page.goto(`${baseUrl}/admin/`, { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Content editor' }).waitFor()
      for (const label of [
        'JP logo — upload authentic file',
        'Hero eyebrow',
        'Booking button label',
        'Faded University street address',
        'JP’s school hours at Faded University',
        'Lipscomb appointment note',
        'Outline heading',
        'About subtitle',
        'Filled heading',
        'Instagram Reel URL',
        'Publish Reel link card on the homepage',
        'Facebook URL',
        'Before/after heading',
      ]) {
        if (!(await page.getByText(label, { exact: true }).count())) throw new Error(`${label} control is missing`)
      }
      if (!(await page.getByLabel('Booking URL · approved').evaluate((input) => input.readOnly))) {
        throw new Error('Approved booking URL is not read-only')
      }
      if (await page.getByLabel('Publish Reel link card on the homepage').isChecked()) throw new Error('Reel publish control should default off')
      if (!(await page.getByText('Authentic logo ready in this draft.').count())) throw new Error('Official-logo status is missing')

      const photosSection = page.locator('.editor-section').filter({ has: page.getByRole('heading', { name: 'Photos', exact: true }) })
      for (const heading of ['Site essentials', 'Portfolio', 'Weddings & events', 'Teams & groups', 'Photo library']) {
        if (!(await photosSection.getByRole('heading', { name: heading, exact: true }).count())) throw new Error(`${heading} media group is missing`)
      }
      if (await photosSection.getByText(/^Gallery \d+$/).count()) throw new Error('Anonymous Gallery N labels remain in the photo manager')
      const replacementOptions = await photosSection.getByLabel('Replace').locator('option').allTextContents()
      for (const option of ['Portfolio · position 3 · wide', 'Weddings & events · position 1 · wide', 'Teams & groups · position 2 · portrait']) {
        if (!replacementOptions.includes(option)) throw new Error(`${option} upload target is missing`)
      }

      const portfolioGroup = photosSection.locator('.media-group').filter({ has: page.getByRole('heading', { name: 'Portfolio', exact: true }) })
      const portfolioShapes = await portfolioGroup.locator('.media-frame-badge').allTextContents()
      if (portfolioShapes.join(',') !== 'Portrait,Portrait,Wide') throw new Error(`Portfolio frame sequence is wrong: ${portfolioShapes.join(',')}`)

      const weddingsGroup = photosSection.locator('.media-group').filter({ has: page.getByRole('heading', { name: 'Weddings & events', exact: true }) })
      const initialWeddingAlt = stored.media.gallery[5].alt
      await weddingsGroup.locator('.media-preview').nth(0).getByRole('button', { name: 'Move later' }).click()
      if (!(await weddingsGroup.locator('.media-preview').nth(1).getByText(initialWeddingAlt, { exact: true }).count())) throw new Error('Move later did not reorder the Weddings & events section')
      const weddingSaveResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/content') && response.request().method() === 'PUT')
      await page.getByRole('button', { name: 'Save changes to preview' }).click()
      if ((await weddingSaveResponse).status() !== 200) throw new Error('Reordered photo save failed')
      await page.reload({ waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Content editor' }).waitFor()
      const reloadedPhotos = page.locator('.editor-section').filter({ has: page.getByRole('heading', { name: 'Photos', exact: true }) })
      const reloadedWeddings = reloadedPhotos.locator('.media-group').filter({ has: page.getByRole('heading', { name: 'Weddings & events', exact: true }) })
      if (!(await reloadedWeddings.locator('.media-preview').nth(1).getByText(initialWeddingAlt, { exact: true }).count())) throw new Error('Reordered photo did not persist after save and reload')
      await reloadedWeddings.locator('.media-preview').nth(1).getByRole('button', { name: 'Move earlier' }).click()
      const weddingRestoreResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/content') && response.request().method() === 'PUT')
      await page.getByRole('button', { name: 'Save changes to preview' }).click()
      if ((await weddingRestoreResponse).status() !== 200) throw new Error('Reordered photo restore failed')
      if (stored.media.gallery[5].alt !== initialWeddingAlt) throw new Error('Weddings & events order was not restored')

      const teamsGroup = reloadedPhotos.locator('.media-group').filter({ has: page.getByRole('heading', { name: 'Teams & groups', exact: true }) })
      const initialTeamAlt = stored.media.gallery[8].alt
      await teamsGroup.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 24))
      const dragHandle = teamsGroup.locator('.media-preview').nth(0).getByRole('button', { name: /Drag Teams & groups photo 1/ })
      const secondTeamCard = teamsGroup.locator('.media-preview').nth(1)
      const dragBox = await dragHandle.boundingBox()
      const targetBox = await secondTeamCard.boundingBox()
      if (!dragBox || !targetBox) throw new Error('Drag targets are not visible')
      await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2)
      await page.mouse.down()
      const dragTarget = { x: Math.min(viewport.width - 8, targetBox.x + targetBox.width / 2), y: targetBox.y + Math.min(40, targetBox.height / 3) }
      await page.mouse.move(dragTarget.x, dragTarget.y, { steps: 8 })
      await page.mouse.up()
      if (!(await teamsGroup.locator('.media-preview').nth(1).getByText(initialTeamAlt, { exact: true }).count())) {
        const targetDetails = await page.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y)
          const card = element?.closest('[data-media-position]')
          return { tag: element?.tagName, className: element?.className, section: card?.dataset.mediaSection, position: card?.dataset.mediaPosition }
        }, dragTarget)
        throw new Error(`Pointer drag did not reorder the Teams & groups section: ${JSON.stringify({ dragBox, targetBox, dragTarget, targetDetails })}`)
      }
      await teamsGroup.locator('.media-preview').nth(1).getByRole('button', { name: 'Move earlier' }).click()
      if (stored.media.gallery[8].alt !== initialTeamAlt) throw new Error('Teams & groups order was not restored in the draft')

      const metrics = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        sectionCount: document.querySelectorAll('.editor-section').length,
        publishHeight: Math.round(document.querySelector('.publish-bar')?.getBoundingClientRect().height || 0),
      }))
      if (metrics.scrollWidth > metrics.width + 1) throw new Error(`${viewport.name} editor overflows horizontally`)
      if (metrics.sectionCount < 10) throw new Error(`${viewport.name} editor is missing grouped controls`)

      {
        const field = page.getByLabel('Faded University street address')
        const original = await field.inputValue()
        await field.fill(`${original} · ${viewport.name} save check`)
        const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/content') && response.request().method() === 'PUT')
        await page.getByRole('button', { name: 'Save changes to preview' }).click()
        if ((await responsePromise).status() !== 200) throw new Error('Mock admin save failed')
        await page.reload({ waitUntil: 'networkidle' })
        await page.getByRole('heading', { name: 'Content editor' }).waitFor()
        if (!(await page.getByLabel('Faded University street address').inputValue()).endsWith(`${viewport.name} save check`)) throw new Error('Saved location data did not persist after reload')
        if (!(await page.getByText('Authentic logo ready in this draft.').count())) throw new Error('Official-logo status did not survive reload')
        await page.getByLabel('Faded University street address').fill(original)
        const restorePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/content') && response.request().method() === 'PUT')
        await page.getByRole('button', { name: 'Save changes to preview' }).click()
        if ((await restorePromise).status() !== 200) throw new Error('Mock admin restore failed')
      }

      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-top.png`), fullPage: false })
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-full.png`), fullPage: true })
      await photosSection.scrollIntoViewIfNeeded()
      await photosSection.screenshot({ path: path.join(outputDir, `${viewport.name}-photos.png`) })
      report.push({ viewport, ...metrics, controls: 'passed', mediaSections: 'passed', moveButtonSaveReloadRestore: 'passed', pointerDragRestore: 'passed', saveReloadRestore: 'passed', officialLogoReload: 'passed' })
      await page.close()
    }
  } finally {
    await browser.close()
  }

  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ baseUrl, report }, null, 2))
  console.log('Section-aware photo controls, pointer/button reordering, save/reload, and layout passed at iPhone and MacBook Air sizes.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
