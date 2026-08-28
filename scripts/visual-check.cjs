const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.NUMBERED_PREVIEW_URL || 'http://127.0.0.1:8791'
const outputDir = process.env.NUMBERED_PROOF_DIR || path.resolve('proof')
const sessionToken = process.env.NUMBERED_SESSION_TOKEN || ''
const skins = ['cut-record', 'jp-in-chair', 'open-chair']
const viewports = [
  { name: 'iphone', width: 390, height: 844, fold: 'critical' },
  { name: 'tablet-portrait', width: 768, height: 1024, fold: 'regression' },
  { name: 'tablet-landscape', width: 1024, height: 768, fold: 'regression' },
  { name: 'macbook-air', width: 1440, height: 900, fold: 'desired' },
]

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const report = []

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
      if (sessionToken) {
        await context.addCookies([{
          name: '__Host-numbered_session', value: sessionToken,
          domain: new URL(baseUrl).hostname, path: '/', secure: baseUrl.startsWith('https:'), httpOnly: true, sameSite: 'Strict',
        }])
      }
      for (const skin of skins) {
        const page = await context.newPage()
        const response = await page.goto(`${baseUrl}/?skin=${skin}`, { waitUntil: 'networkidle' })
        await page.locator('.n-photo img').first().waitFor({ state: 'visible' })
        await page.evaluate(() => {
          document.documentElement.style.scrollBehavior = 'auto'
          document.querySelectorAll('img').forEach((image) => { image.loading = 'eager' })
          window.scrollTo(0, document.documentElement.scrollHeight)
        })
        await page.waitForTimeout(900)
        await page.evaluate(() => window.scrollTo(0, 0))
        const metrics = await page.evaluate(() => {
          const rect = (selector) => {
            const node = document.querySelector(selector)
            if (!node) return null
            const box = node.getBoundingClientRect()
            if (box.width === 0 || box.height === 0) return null
            return { top: Math.round(box.top), bottom: Math.round(box.bottom), width: Math.round(box.width), height: Math.round(box.height) }
          }
          const inFold = (box, minimumVisible = 24) => Boolean(box && box.top < window.innerHeight - minimumVisible && box.bottom > minimumVisible)
          const hero = rect('.n-cr-hero-photo, .n-jc-hero-photo, .n-oc-hero-photo')
          const headline = rect('.n-skin h1')
          const context = rect('.n-fact-grid, .n-jc-facts, .n-oc-title > p:last-child, .n-oc-booking .n-service-list')
          const inlineBooking = rect('.n-primary-book')
          const mobileBooking = rect('.n-mobile-book')
          return {
            title: document.title,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            switcherLabels: [...document.querySelectorAll('.n-skin-tabs button')].map((node) => node.textContent.trim()),
            bookingLinks: [...document.querySelectorAll('a')].filter((node) => /book|availability|times/i.test(node.textContent)).length,
            imageCount: document.querySelectorAll('.n-photo img').length,
            imageFailures: [...document.querySelectorAll('.n-photo img')].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
            noindex: document.querySelector('meta[name="robots"]')?.content || '',
            fold: {
              hero, headline, context, inlineBooking, mobileBooking,
              heroVisible: inFold(hero, 80),
              headlineVisible: inFold(headline),
              contextVisible: inFold(context),
              bookingVisible: inFold(mobileBooking || inlineBooking),
            },
          }
        })
        const screenshot = path.join(outputDir, `${skin}-${viewport.name}.png`)
        await page.screenshot({ path: screenshot, fullPage: false })
        report.push({ skin, viewport, status: response.status(), ...metrics, screenshot })
        await page.close()
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }

  const failures = report.filter((item) =>
    item.status !== 200 ||
    item.scrollWidth > item.innerWidth + 1 ||
    item.switcherLabels.length !== 3 ||
    item.bookingLinks < 1 ||
    item.imageCount < 3 ||
    item.imageFailures.length > 0 ||
    !item.noindex.includes('noindex') ||
    !item.fold.heroVisible ||
    !item.fold.headlineVisible ||
    !item.fold.contextVisible ||
    ((item.viewport.fold === 'critical' || item.viewport.fold === 'desired') && !item.fold.bookingVisible)
  )
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ baseUrl, report, failures }, null, 2))
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2))
    process.exitCode = 1
  } else {
    console.log(`Responsive checks passed: ${report.length} skin/viewports.`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
