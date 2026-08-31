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
      report.push({ viewport, ...metrics, controls: 'passed', saveReloadRestore: 'passed', officialLogoReload: 'passed' })
      await page.close()
    }
  } finally {
    await browser.close()
  }

  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ baseUrl, report }, null, 2))
  console.log('Admin location/logo controls and save/reload layout passed at iPhone and MacBook Air sizes.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
