const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.JPCUUTS_PREVIEW_URL || 'http://127.0.0.1:8791'
const outputDir = process.env.JPCUUTS_PROOF_DIR || path.resolve('proof/jp-feedback')
const live = process.env.JPCUUTS_LIVE === '1'
const expectedSocialHrefs = [
  'https://www.instagram.com/jpcuuts/',
  'https://www.facebook.com/jpcuuts',
  'https://www.tiktok.com/@jpcuuts',
  'https://www.youtube.com/@jpcuuts',
]
const viewports = [
  { name: 'iphone-320', width: 320, height: 568, touch: true },
  { name: 'iphone', width: 390, height: 844, touch: true },
  { name: 'tablet', width: 768, height: 1024, touch: true },
  { name: 'macbook-air', width: 1280, height: 832 },
  { name: 'desktop', width: 1440, height: 900 },
]

async function inspect(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.chair-site')
    const hero = document.querySelector('.chair-hero')
    const social = document.querySelector('.chair-availability-socials')
    const availability = document.querySelector('.chair-availability')
    const pairs = [...document.querySelectorAll('.chair-section-heading, .chair-about-copy, .chair-events-copy')].map((node) => {
      const first = node.querySelector('.chair-pair-primary')
      const second = node.querySelector('.chair-pair-secondary')
      return {
        first: first?.textContent.trim(),
        firstColor: first ? getComputedStyle(first).color : null,
        firstStroke: first ? getComputedStyle(first).webkitTextStrokeWidth : null,
        second: second?.textContent.trim(),
        secondColor: second ? getComputedStyle(second).color : null,
        secondColorAlpha: second ? Number(getComputedStyle(second).color.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1] || 1) : null,
        secondStroke: second ? getComputedStyle(second).webkitTextStrokeWidth : null,
      }
    })
    return {
      previewClass: root?.classList.contains('is-jp-feedback-preview'),
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heroText: hero?.textContent.replace(/\s+/g, ' ').trim(),
      heroOfferCount: hero?.querySelectorAll('.chair-hero-offer').length,
      heroAddonCount: hero?.querySelectorAll('.chair-hero-addon').length,
      heroOfferLine: hero?.querySelector('.chair-hero-offer')?.textContent.trim(),
      heroOfferChildCount: hero?.querySelector('.chair-hero-offer')?.children.length,
      heroLogoVisible: (() => {
        const box = hero?.querySelector('.chair-hero-brand img')?.getBoundingClientRect()
        return Boolean(box && box.width > 0 && box.height > 0 && box.top >= 0 && box.bottom <= innerHeight)
      })(),
      heroBookText: hero?.querySelector('.chair-hero-book')?.textContent.trim(),
      heroBookHref: hero?.querySelector('.chair-hero-book')?.href,
      socialCount: social?.querySelectorAll('a').length,
      socialLabels: [...(social?.querySelectorAll('a') || [])].map((node) => node.getAttribute('aria-label')),
      socialHrefs: [...(social?.querySelectorAll('a') || [])].map((node) => node.href),
      socialWithinAvailability: social?.closest('.chair-availability') === availability,
      socialWithinHeading: social?.parentElement === availability?.querySelector('header'),
      availabilityHeading: document.querySelector('#chair-availability-heading')?.textContent.trim(),
      verseFont: getComputedStyle(document.querySelector('.chair-about blockquote')).fontFamily,
      verseStyle: getComputedStyle(document.querySelector('.chair-about blockquote')).fontStyle,
      mobileBarVisible: (() => {
        const node = document.querySelector('.chair-mobile-book')
        return Boolean(node && getComputedStyle(node).display !== 'none')
      })(),
      headerBrandVisible: (() => {
        const node = document.querySelector('.chair-header .chair-brand')
        return Boolean(node && getComputedStyle(node).display !== 'none')
      })(),
      headerBookVisible: (() => {
        const node = document.querySelector('.chair-header .chair-header-book')
        return Boolean(node && getComputedStyle(node).display !== 'none')
      })(),
      servicePriceVisible: [...document.querySelectorAll('.chair-service strong')].some((node) => node.textContent.trim() === '$35'),
      pairs,
      imageFailures: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
    }
  })
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const { defaultContent } = await import('../src/siteContent.js')
  const content = structuredClone(defaultContent)
  content.hero.eyebrow = 'PROFESSIONAL BARBER'
  content.hero.headline = 'Create. Connect. Collaborate.'
  content.booking.label = 'BOOK NOW'

  const browser = await chromium.launch({ headless: true })
  const report = []
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: Boolean(viewport.touch) })
      if (!live) await page.route('**/api/content', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content }) }))
      const url = new URL(baseUrl)
      url.searchParams.set('jp-feedback', '1')
      const response = await page.goto(url.toString(), { waitUntil: 'networkidle' })
      await page.locator('.chair-hero > img').waitFor({ state: 'visible' })
      await page.evaluate(() => document.querySelectorAll('img').forEach((image) => { image.loading = 'eager' }))
      await page.waitForTimeout(350)
      const metrics = await inspect(page)
      const screenshot = path.join(outputDir, `${viewport.name}-full.png`)
      const heroScreenshot = path.join(outputDir, `${viewport.name}-hero.png`)
      await page.screenshot({ path: screenshot, fullPage: true })
      await page.screenshot({ path: heroScreenshot, fullPage: false })
      report.push({ viewport, status: response.status(), metrics, screenshot, heroScreenshot })
      await page.close()
    }
  } finally {
    await browser.close()
  }

  const failures = report.filter(({ status, metrics }) =>
    status !== 200
    || !metrics.previewClass
    || metrics.scrollWidth > metrics.width + 1
    || !metrics.heroLogoVisible
    || metrics.heroOfferCount !== 1
    || metrics.heroAddonCount !== 1
    || metrics.heroOfferLine !== '$35 Haircut · 35 minutes'
    || metrics.heroOfferChildCount !== 1
    || !metrics.heroText.includes('PROFESSIONAL BARBER')
    || !metrics.heroText.includes('Create. Connect. Collaborate.')
    || !metrics.heroText.includes('$35 Haircut · 35 minutes')
    || metrics.heroBookText !== 'BOOK NOW'
    || metrics.heroBookHref !== 'https://calendly.com/jpcuts/30mins'
    || metrics.socialCount !== 4
    || metrics.socialLabels.join('|') !== 'Instagram|Facebook|TikTok|YouTube'
    || metrics.socialHrefs.join('|') !== expectedSocialHrefs.join('|')
    || !metrics.socialWithinAvailability
    || !metrics.socialWithinHeading
    || metrics.availabilityHeading !== 'Where?'
    || !metrics.verseFont.includes('Inter')
    || metrics.verseFont.includes('Georgia')
    || metrics.verseStyle !== 'normal'
    || metrics.mobileBarVisible
    || (metrics.width >= 960 && (metrics.headerBrandVisible || metrics.headerBookVisible))
    || !metrics.servicePriceVisible
    || metrics.pairs.length !== 4
    || metrics.pairs.some((pair) => pair.firstColor === 'rgba(0, 0, 0, 0)' || Number.parseFloat(pair.firstStroke) !== 0 || pair.secondColorAlpha <= 0 || pair.secondColorAlpha > .2 || Number.parseFloat(pair.secondStroke) < 1)
    || metrics.imageFailures.length
  )

  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ baseUrl, report, failures }, null, 2))
  if (failures.length) throw new Error(`JP feedback checks failed: ${JSON.stringify(failures, null, 2)}`)
  console.log(`JP feedback presentation passed at ${report.length} responsive viewports.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
