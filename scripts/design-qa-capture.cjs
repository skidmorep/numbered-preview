const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.NUMBERED_PREVIEW_URL || 'http://127.0.0.1:8791'
const outputDir = process.env.NUMBERED_DESIGN_QA_DIR || path.resolve('proof/design-qa')
const previewUsername = process.env.NUMBERED_PREVIEW_USERNAME || 'preview'
const previewPassword = process.env.NUMBERED_PREVIEW_PASSWORD
const httpCredentials = previewPassword ? { username: previewUsername, password: previewPassword } : undefined
const skins = ['cut-record', 'jp-in-chair', 'open-chair']

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const results = []

  try {
    for (const skin of skins) {
      const page = await browser.newPage({ viewport: { width: 426, height: 923 }, httpCredentials })
      const response = await page.goto(`${baseUrl}/?skin=${skin}`, { waitUntil: 'networkidle' })
      await page.locator('.n-photo img').first().waitFor({ state: 'visible' })
      await page.waitForTimeout(350)

      const metrics = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        phoneLinks: document.querySelectorAll('a[href^="tel:"], a[href^="sms:"]').length,
        iframes: document.querySelectorAll('iframe').length,
        reelPosters: document.querySelectorAll('.n-reel-poster[href*="instagram.com/reel/"]').length,
        activeSkin: new URL(window.location.href).searchParams.get('skin'),
      }))

      await page.locator('.n-preview-current').click()
      const mobileChoices = await page.locator('.n-skin-tabs button').count()
      await page.locator('.n-preview-current').click()
      const screenshot = path.join(outputDir, `implementation-${skin}.png`)
      await page.screenshot({ path: screenshot, fullPage: false })
      results.push({ skin, status: response.status(), mobileChoices, ...metrics, screenshot })
      await page.close()
    }
  } finally {
    await browser.close()
  }

  const failures = results.filter((item) =>
    item.status !== 200 ||
    item.scrollWidth > item.innerWidth + 1 ||
    item.phoneLinks !== 0 ||
    item.iframes !== 0 ||
    item.reelPosters !== 1 ||
    item.mobileChoices !== 3 ||
    item.activeSkin !== item.skin
  )
  fs.writeFileSync(path.join(outputDir, 'capture-report.json'), JSON.stringify({ baseUrl, results, failures }, null, 2))
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2))
    process.exitCode = 1
  } else {
    console.log('Design QA captures passed for all three 426x923 mobile states.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
