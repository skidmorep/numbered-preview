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
        'Hero eyebrow',
        'Booking button label',
        'Outline heading',
        'About subtitle',
        'Short location label',
        'Filled heading',
        'Instagram Reel URL',
        'Publish Reel link card on the homepage',
        'Facebook URL',
        'Before/after heading',
      ]) {
        if (!(await page.getByLabel(label, { exact: true }).count())) throw new Error(`${label} control is missing`)
      }
      if (!(await page.getByLabel('Booking URL · approved').evaluate((input) => input.readOnly))) {
        throw new Error('Approved booking URL is not read-only')
      }
      if (await page.getByLabel('Publish Reel link card on the homepage').isChecked()) throw new Error('Reel publish control should default off')

      const metrics = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        sectionCount: document.querySelectorAll('.editor-section').length,
        publishHeight: Math.round(document.querySelector('.publish-bar')?.getBoundingClientRect().height || 0),
      }))
      if (metrics.scrollWidth > metrics.width + 1) throw new Error(`${viewport.name} editor overflows horizontally`)
      if (metrics.sectionCount < 8) throw new Error(`${viewport.name} editor is missing grouped controls`)

      if (viewport.name === 'macbook-air') {
        const field = page.getByLabel('First photo-group heading')
        const original = await field.inputValue()
        await field.fill(`${original} · local check`)
        const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/content') && response.request().method() === 'PUT')
        await page.getByRole('button', { name: 'Save and publish preview' }).click()
        if ((await responsePromise).status() !== 200) throw new Error('Mock admin save failed')
        await page.reload({ waitUntil: 'networkidle' })
        await page.getByRole('heading', { name: 'Content editor' }).waitFor()
        if (!(await page.getByLabel('First photo-group heading').inputValue()).endsWith('local check')) throw new Error('Saved admin copy did not persist after reload')
        await page.getByLabel('First photo-group heading').fill(original)
        const restorePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/content') && response.request().method() === 'PUT')
        await page.getByRole('button', { name: 'Save and publish preview' }).click()
        if ((await restorePromise).status() !== 200) throw new Error('Mock admin restore failed')
      }

      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-top.png`), fullPage: false })
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-full.png`), fullPage: true })
      report.push({ viewport, ...metrics, controls: 'passed', saveReloadRestore: viewport.name === 'macbook-air' ? 'passed' : 'not-run' })
      await page.close()
    }
  } finally {
    await browser.close()
  }

  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ baseUrl, report }, null, 2))
  console.log('Admin copy controls and save/reload layout passed at iPhone and MacBook Air sizes.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
