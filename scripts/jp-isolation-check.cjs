const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const previewUrl = process.env.JPCUUTS_VERSION_PREVIEW_URL
const productionUrl = process.env.JPCUUTS_PRODUCTION_URL || 'https://jpcuuts.com'
const outputDir = process.env.JPCUUTS_PROOF_DIR || path.resolve('proof/jp-isolation')
const viewports = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]

if (!previewUrl) throw new Error('JPCUUTS_VERSION_PREVIEW_URL is required')

async function inspect(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.chair-site')
    const hero = document.querySelector('.chair-hero')
    const availability = document.querySelector('.chair-availability')
    return {
      previewClass: root?.classList.contains('is-jp-feedback-preview'),
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heroOfferCount: hero?.querySelectorAll('.chair-hero-offer').length,
      heroAddonCount: hero?.querySelectorAll('.chair-hero-addon').length,
      heroText: hero?.textContent.replace(/\s+/g, ' ').trim(),
      heroBookText: hero?.querySelector('.chair-hero-book')?.textContent.trim(),
      heroBookHref: hero?.querySelector('.chair-hero-book')?.href,
      availabilityHeading: availability?.querySelector('h2')?.textContent.trim(),
      availabilitySocialCount: availability?.querySelectorAll('.chair-availability-socials a').length,
      pairPrimaryCount: document.querySelectorAll('.chair-pair-primary').length,
      pairSecondaryCount: document.querySelectorAll('.chair-pair-secondary').length,
      outlineLabelCount: document.querySelectorAll('.chair-outline-label').length,
      verseFont: getComputedStyle(document.querySelector('.chair-about blockquote')).fontFamily,
      servicePriceVisible: [...document.querySelectorAll('.chair-service strong')].some((node) => node.textContent.trim() === '$35'),
      mobileBarVisible: (() => {
        const node = document.querySelector('.chair-mobile-book')
        return Boolean(node && getComputedStyle(node).display !== 'none')
      })(),
      imageFailures: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
    }
  })
}

async function visit(browser, surface, url, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('.chair-hero > img').waitFor({ state: 'visible' })
    await page.evaluate(() => document.querySelectorAll('img').forEach((image) => { image.loading = 'eager' }))
    await page.waitForTimeout(350)
    const metrics = await inspect(page)
    const screenshot = path.join(outputDir, `${surface}-${viewport.name}-full.png`)
    await page.screenshot({ path: screenshot, fullPage: true })
    return { surface, viewport, url, status: response.status(), metrics, screenshot }
  } finally {
    await page.close()
  }
}

function previewFailure({ status, metrics }) {
  return status !== 200
    || !metrics.previewClass
    || metrics.scrollWidth > metrics.width + 1
    || metrics.heroOfferCount !== 0
    || metrics.heroAddonCount !== 0
    || !metrics.heroText.includes('PROFESSIONAL BARBER')
    || !metrics.heroText.includes('Create. Connect. Collaborate.')
    || metrics.heroText.includes('$35')
    || metrics.heroBookText !== 'BOOK NOW'
    || metrics.heroBookHref !== 'https://calendly.com/jpcuts/30mins'
    || metrics.availabilityHeading !== 'Where?'
    || metrics.availabilitySocialCount !== 4
    || metrics.pairPrimaryCount !== 4
    || metrics.pairSecondaryCount !== 4
    || metrics.outlineLabelCount !== 0
    || !metrics.verseFont.includes('Inter')
    || !metrics.servicePriceVisible
    || metrics.mobileBarVisible
    || metrics.imageFailures.length
}

function productionFailure({ status, metrics }) {
  return status !== 200
    || metrics.previewClass
    || metrics.scrollWidth > metrics.width + 1
    || metrics.heroOfferCount !== 1
    || metrics.heroAddonCount !== 1
    || !metrics.heroText.includes('$35')
    || metrics.heroBookText !== 'BOOK NOW'
    || metrics.heroBookHref !== 'https://calendly.com/jpcuts/30mins'
    || metrics.availabilityHeading !== 'Where JP cuts'
    || metrics.availabilitySocialCount !== 0
    || metrics.pairPrimaryCount !== 0
    || metrics.pairSecondaryCount !== 0
    || metrics.outlineLabelCount !== 4
    || !metrics.verseFont.includes('Georgia')
    || !metrics.servicePriceVisible
    || metrics.mobileBarVisible !== (metrics.width < 960)
    || metrics.imageFailures.length
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const report = []
  try {
    for (const viewport of viewports) {
      report.push(await visit(browser, 'preview', previewUrl, viewport))
      report.push(await visit(browser, 'production', productionUrl, viewport))
    }
  } finally {
    await browser.close()
  }

  const failures = report.filter((entry) => entry.surface === 'preview' ? previewFailure(entry) : productionFailure(entry))
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ previewUrl, productionUrl, report, failures }, null, 2))
  if (failures.length) throw new Error(`JP release isolation checks failed: ${JSON.stringify(failures, null, 2)}`)
  console.log('JP preview and production stayed isolated at mobile and desktop viewports.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
