const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.NUMBERED_PREVIEW_URL || 'http://127.0.0.1:8791'
const outputDir = process.env.NUMBERED_PROOF_DIR || path.resolve('proof')
const previewUsername = process.env.NUMBERED_PREVIEW_USERNAME || 'preview'
const previewPassword = process.env.NUMBERED_PREVIEW_PASSWORD
const httpCredentials = previewPassword ? { username: previewUsername, password: previewPassword } : undefined
const skins = ['cut-record', 'jp-in-chair', 'open-chair']
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 900 },
  { name: 'desktop', width: 1440, height: 1000 },
]

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const report = []

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, httpCredentials })
      for (const skin of skins) {
        const response = await page.goto(`${baseUrl}/?skin=${skin}`, { waitUntil: 'domcontentloaded' })
        await page.locator('.photo img').first().waitFor({ state: 'visible' })
        await page.evaluate(() => {
          document.querySelectorAll('img').forEach((image) => { image.loading = 'eager' })
          window.scrollTo(0, document.documentElement.scrollHeight)
        })
        await page.waitForTimeout(900)
        await page.evaluate(() => window.scrollTo(0, 0))
        const metrics = await page.evaluate(() => ({
          title: document.title,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          switcherLabels: [...document.querySelectorAll('.skin-tabs button')].map((node) => node.textContent.trim()),
          bookingLinks: [...document.querySelectorAll('a')].filter((node) => /book|availability|times/i.test(node.textContent)).length,
          imageCount: document.querySelectorAll('.photo img').length,
          imageFailures: [...document.querySelectorAll('.photo img')].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
          noindex: document.querySelector('meta[name="robots"]')?.content || '',
        }))
        const screenshot = path.join(outputDir, `${skin}-${viewport.name}.png`)
        await page.screenshot({ path: screenshot, fullPage: true })
        report.push({ skin, viewport, status: response.status(), ...metrics, screenshot })
      }
      await page.close()
    }

    const admin = await browser.newPage({ viewport: { width: 390, height: 844 }, httpCredentials })
    const adminResponse = await admin.goto(`${baseUrl}/admin/`, { waitUntil: 'domcontentloaded' })
    await admin.getByRole('heading', { name: 'Sign in to edit' }).waitFor()
    const adminText = await admin.locator('body').innerText()
    await admin.screenshot({ path: path.join(outputDir, 'admin-login-mobile.png'), fullPage: true })
    report.push({ admin: true, status: adminResponse.status(), hasLogin: adminText.includes('Sign in to edit') })
    await admin.close()
  } finally {
    await browser.close()
  }

  const failures = report.filter((item) =>
    item.status !== 200 ||
    (item.skin && (item.scrollWidth > item.innerWidth + 1 || item.switcherLabels.length !== 3 || item.bookingLinks < 1 || item.imageCount < 3 || item.imageFailures.length > 0 || !item.noindex.includes('noindex'))) ||
    (item.admin && !item.hasLogin)
  )
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ baseUrl, report, failures }, null, 2))
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2))
    process.exitCode = 1
  } else {
    console.log(`Visual checks passed: ${report.length - 1} skin/viewports plus admin login.`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
