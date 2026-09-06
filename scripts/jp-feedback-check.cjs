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
    const eventsHero = document.querySelector('.chair-events-hero')
    const social = document.querySelector('.chair-social-strip')
    const availability = document.querySelector('.chair-availability')
    const pairs = [...document.querySelectorAll('.chair-section-heading, .chair-about-copy, .chair-events-heading')].map((node) => {
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
      socialBeforeAvailability: Boolean(social && availability && (social.compareDocumentPosition(availability) & Node.DOCUMENT_POSITION_FOLLOWING)),
      socialOutsideAvailability: social?.closest('.chair-availability') === null,
      socialImmediatelyAfterHero: hero?.nextElementSibling === social,
      availabilityHeading: document.querySelector('#chair-availability-heading')?.textContent.trim(),
      aboutSubtitleFontSize: Number.parseFloat(getComputedStyle(document.querySelector('.chair-about .chair-pair-secondary')).fontSize),
      verseFont: getComputedStyle(document.querySelector('.chair-about blockquote')).fontFamily,
      verseStyle: getComputedStyle(document.querySelector('.chair-about blockquote')).fontStyle,
      mobileBarVisible: (() => {
        const node = document.querySelector('.chair-mobile-book')
        return Boolean(node && getComputedStyle(node).display !== 'none')
      })(),
      mobileBar: (() => {
        const node = document.querySelector('.chair-mobile-book')
        const box = node?.getBoundingClientRect()
        return node && box && getComputedStyle(node).display !== 'none' ? {
          text: node.textContent.replace(/\s+/g, ' ').trim(),
          href: node.href,
          bottom: Math.round(box.bottom),
          height: Math.round(box.height),
          position: getComputedStyle(node).position,
          markVisible: (() => {
            const mark = node.querySelector('.chair-mobile-book-mark img')
            const markBox = mark?.getBoundingClientRect()
            return Boolean(markBox && markBox.width > 0 && markBox.height > 0)
          })(),
        } : null
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
      eventsHero: (() => {
        const image = eventsHero?.querySelector('img')
        const imageBox = image?.getBoundingClientRect()
        const heroBox = eventsHero?.getBoundingClientRect()
        const headingBox = eventsHero?.querySelector('.chair-events-heading')?.getBoundingClientRect()
        return image && imageBox && heroBox && headingBox ? {
          count: eventsHero.querySelectorAll(':scope > img').length,
          src: image.getAttribute('src'),
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectPosition: getComputedStyle(image).objectPosition,
          headingInside: headingBox.left >= heroBox.left - 1 && headingBox.right <= heroBox.right + 1
            && headingBox.top >= heroBox.top - 1 && headingBox.bottom <= heroBox.bottom + 1,
        } : null
      })(),
      pairs,
      imageFailures: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
    }
  })
}

async function inspectStickyBooking(page) {
  return page.evaluate(() => {
    const booking = document.querySelector('.chair-mobile-book')
    const footer = document.querySelector('.chair-footer')
    const bookingBox = booking?.getBoundingClientRect()
    const footerBox = footer?.getBoundingClientRect()
    return booking && bookingBox && getComputedStyle(booking).display !== 'none' ? {
      bottom: Math.round(bookingBox.bottom),
      top: Math.round(bookingBox.top),
      position: getComputedStyle(booking).position,
      footerBottom: footerBox ? Math.round(footerBox.bottom) : null,
    } : null
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
      await page.locator('.chair-events-hero > img').evaluate((image) => image.decode())
      await page.waitForTimeout(350)
      const metrics = await inspect(page)
      if (viewport.width < 960) {
        await page.locator('.chair-mobile-book').focus()
        metrics.mobileBarFocus = await page.locator('.chair-mobile-book').evaluate((node) => ({
          color: getComputedStyle(node).outlineColor,
          offset: Number.parseFloat(getComputedStyle(node).outlineOffset),
          style: getComputedStyle(node).outlineStyle,
          width: Number.parseFloat(getComputedStyle(node).outlineWidth),
        }))
        await page.locator('.chair-social-strip .chair-socials a').first().focus()
        metrics.socialFocus = await page.locator('.chair-social-strip .chair-socials a').first().evaluate((node) => ({
          color: getComputedStyle(node).outlineColor,
          style: getComputedStyle(node).outlineStyle,
          width: Number.parseFloat(getComputedStyle(node).outlineWidth),
        }))
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2))
        await page.waitForTimeout(50)
        metrics.mobileBarMidScroll = await inspectStickyBooking(page)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(50)
        metrics.mobileBarPageEnd = await inspectStickyBooking(page)
        await page.evaluate(() => window.scrollTo(0, 0))
      }
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

  const failures = report.filter(({ status, viewport, metrics }) =>
    status !== 200
    || !metrics.previewClass
    || metrics.scrollWidth > metrics.width + 1
    || !metrics.heroLogoVisible
    || metrics.heroOfferCount !== 0
    || metrics.heroAddonCount !== 0
    || metrics.heroOfferLine !== undefined
    || metrics.heroOfferChildCount !== undefined
    || !metrics.heroText.includes('PROFESSIONAL BARBER')
    || !metrics.heroText.includes('Create. Connect. Collaborate.')
    || metrics.heroText.includes('$35')
    || metrics.heroText.includes('35 minutes')
    || metrics.heroText.includes('Optional')
    || metrics.heroBookText !== 'BOOK NOW'
    || metrics.heroBookHref !== 'https://calendly.com/jpcuts/30mins'
    || metrics.socialCount !== 4
    || metrics.socialLabels.join('|') !== 'Instagram|Facebook|TikTok|YouTube'
    || metrics.socialHrefs.join('|') !== expectedSocialHrefs.join('|')
    || !metrics.socialBeforeAvailability
    || !metrics.socialOutsideAvailability
    || !metrics.socialImmediatelyAfterHero
    || metrics.availabilityHeading !== 'Where?'
    || metrics.aboutSubtitleFontSize < (metrics.width < 960 ? 40 : 50)
    || !metrics.verseFont.includes('Inter')
    || metrics.verseFont.includes('Georgia')
    || metrics.verseStyle !== 'normal'
    || (metrics.width < 960 && (!metrics.mobileBarVisible
      || metrics.mobileBar?.text !== 'BOOK NOW'
      || metrics.mobileBar?.href !== 'https://calendly.com/jpcuts/30mins'
      || metrics.mobileBar?.bottom !== viewport.height
      || metrics.mobileBar?.height < 68
      || metrics.mobileBar?.position !== 'fixed'
      || !metrics.mobileBar?.markVisible
      || metrics.mobileBarFocus?.color !== 'rgb(17, 19, 15)'
      || metrics.mobileBarFocus?.offset >= 0
      || metrics.mobileBarFocus?.style !== 'solid'
      || metrics.mobileBarFocus?.width < 3
      || metrics.socialFocus?.color !== 'rgb(17, 19, 15)'
      || metrics.socialFocus?.style !== 'solid'
      || metrics.socialFocus?.width < 3
      || metrics.mobileBarMidScroll?.bottom !== viewport.height
      || metrics.mobileBarMidScroll?.position !== 'fixed'
      || metrics.mobileBarPageEnd?.bottom !== viewport.height
      || metrics.mobileBarPageEnd?.position !== 'fixed'
      || metrics.mobileBarPageEnd?.footerBottom > metrics.mobileBarPageEnd?.top + 1))
    || (metrics.width >= 960 && metrics.mobileBarVisible)
    || (metrics.width >= 960 && (metrics.headerBrandVisible || metrics.headerBookVisible))
    || !metrics.servicePriceVisible
    || metrics.eventsHero?.count !== 1
    || metrics.eventsHero?.src !== '/media/defaults/jp-event-setup-hero.webp'
    || metrics.eventsHero?.naturalWidth !== 2400
    || metrics.eventsHero?.naturalHeight !== 1800
    || metrics.eventsHero?.objectPosition !== '63% 57%'
    || !metrics.eventsHero?.headingInside
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
