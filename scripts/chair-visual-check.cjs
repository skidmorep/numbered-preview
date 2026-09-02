const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.JPCUUTS_PREVIEW_URL || 'http://127.0.0.1:8791'
const outputDir = process.env.JPCUUTS_PROOF_DIR || path.resolve('proof/the-chair')
const viewports = [
  { name: 'iphone-320', width: 320, height: 568, touch: true },
  { name: 'iphone', width: 390, height: 844, touch: true },
  { name: 'tablet-portrait', width: 768, height: 1024, touch: true },
  { name: 'macbook-air-13', width: 1280, height: 832 },
  { name: 'desktop', width: 1440, height: 900 },
]

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const { defaultContent } = await import('../src/siteContent.js')
  const editorContent = structuredClone(defaultContent)
  editorContent.hero.headline = 'Create. Connect. Collaborate.'
  editorContent.work.eyebrow = 'Editor work heading'
  editorContent.servicesSection.eyebrow = 'Editor services heading'
  editorContent.services[0].note = 'Editor service note proof'
  editorContent.events.actionLabel = 'Editor contact proof'
  const browser = await chromium.launch({ headless: true })
  const report = []

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: Boolean(viewport.touch),
      })
      await page.route('**/api/content', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: editorContent }),
      }))
      const response = await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.locator('.chair-hero > img').waitFor({ state: 'visible' })
      await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = 'auto'
        document.querySelectorAll('img').forEach((image) => { image.loading = 'eager' })
        window.scrollTo(0, document.documentElement.scrollHeight)
      })
      await page.waitForTimeout(500)
      await page.evaluate(() => window.scrollTo(0, 0))

      await page.evaluate(() => window.scrollTo(0, 520))
      await page.waitForTimeout(100)
      const persistentMetrics = await page.evaluate(() => {
        const header = document.querySelector('.chair-header')?.getBoundingClientRect()
        const mobileBook = document.querySelector('.chair-mobile-book')?.getBoundingClientRect()
        return {
          headerTop: header ? Math.round(header.top) : null,
          mobileBookBottom: mobileBook ? Math.round(mobileBook.bottom) : null,
          viewportHeight: innerHeight,
        }
      })
      await page.evaluate(() => window.scrollTo(0, 0))

      const metrics = await page.evaluate(() => {
        const visible = (selector) => {
          const node = document.querySelector(selector)
          if (!node) return false
          const box = node.getBoundingClientRect()
          return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0
        }
        return {
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          heroVisible: visible('.chair-hero > img'),
          headlineVisible: visible('.chair-hero h1'),
          bookingVisible: visible('.chair-mobile-book') || visible('.chair-header-book'),
          imageFailures: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
          switcherCount: document.querySelectorAll('.n-preview-bar, .n-skin-tabs, [data-skin]').length,
          tan: getComputedStyle(document.querySelector('.chair-work')).backgroundColor,
          camoCount: document.querySelectorAll('.chair-camo').length,
          featuredCount: document.querySelectorAll('.chair-featured').length,
          editorIntroduction: document.querySelector('.chair-about-intro')?.textContent.trim(),
          editorMobileLabel: document.querySelector('.chair-booking .chair-kicker')?.textContent.trim(),
          editorAboutHeading: document.querySelector('.chair-about .chair-outline-label')?.textContent.trim(),
          editorServiceDetails: document.querySelector('.chair-service span')?.textContent.trim(),
          editorEventLabel: document.querySelector('.chair-contact-toggle')?.textContent.trim(),
          editorWorkHeading: document.querySelector('.chair-work .chair-outline-label')?.textContent.trim(),
          editorServicesHeading: document.querySelector('.chair-services .chair-outline-label')?.textContent.trim(),
          eventOutlineHeading: document.querySelector('.chair-events .chair-outline-label')?.textContent.trim(),
          eventFilledHeading: document.querySelector('.chair-events h2')?.textContent.trim(),
          eventGroupCount: document.querySelectorAll('.chair-event-group').length,
          aboutImageCount: document.querySelectorAll('.chair-about-images .chair-photo').length,
          aboutSubtitle: document.querySelector('.chair-about h2')?.textContent.trim(),
          heroBookingHref: document.querySelector('.chair-hero-book')?.href,
          heroBookingHeight: Math.round(document.querySelector('.chair-hero-book')?.getBoundingClientRect().height || 0),
          heroBookingText: document.querySelector('.chair-hero-book')?.textContent.trim(),
          heroOfferText: document.querySelector('.chair-hero-offer')?.textContent.trim(),
          heroAddonText: document.querySelector('.chair-hero-addon')?.textContent.trim(),
          fadedLocationText: document.querySelector('.chair-location-grid article:first-child')?.textContent.trim(),
          lipscombLocationText: document.querySelector('.chair-location-grid article:last-child')?.textContent.trim(),
          headlineLines: [...document.querySelectorAll('.chair-hero h1 span')].map((node) => {
            const box = node.getBoundingClientRect()
            const hero = document.querySelector('.chair-hero').getBoundingClientRect()
            return {
              text: node.textContent.trim(),
              left: Math.round(box.left),
              right: Math.round(box.right),
              top: Math.round(box.top),
              bottom: Math.round(box.bottom),
              insideHero: box.left >= hero.left - 1 && box.right <= hero.right + 1,
              singleLine: box.height <= Number.parseFloat(getComputedStyle(node).lineHeight) + 2,
            }
          }),
          visibleEmailCount: document.querySelectorAll('a[href^="mailto:"]').length + (document.body.innerHTML.includes('jp@jpcuuts.com') ? 1 : 0),
          forbiddenCopy: /Nashville|Booksy|JP Cutz/i.test(document.body.textContent),
          headline: document.querySelector('.chair-hero h1')?.textContent.trim(),
          headerHeight: Math.round(document.querySelector('.chair-header')?.getBoundingClientRect().height || 0),
          headerLogo: (() => {
            const box = document.querySelector('.chair-header .chair-brand img')?.getBoundingClientRect()
            return box ? { visible: box.top < innerHeight && box.bottom > 0, width: Math.round(box.width), height: Math.round(box.height) } : null
          })(),
          heroLogo: (() => {
            const node = document.querySelector('.chair-hero-brand img')
            const box = node?.getBoundingClientRect()
            const shell = node?.parentElement
            return box ? { visible: box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0, width: Math.round(box.width), height: Math.round(box.height), filter: getComputedStyle(node).filter, background: shell ? getComputedStyle(shell).backgroundColor : null } : null
          })(),
          mobileBookLogo: (() => {
            const node = document.querySelector('.chair-mobile-book-mark img')
            const box = node?.getBoundingClientRect()
            const panel = node?.parentElement?.getBoundingClientRect()
            const bar = node?.closest('.chair-mobile-book')?.getBoundingClientRect()
            return box ? { visible: box.width > 0 && box.height > 0, width: Math.round(box.width), height: Math.round(box.height), naturalWidth: node.naturalWidth, panelRatio: panel && bar?.width ? panel.width / bar.width : 0 } : null
          })(),
          mobileBookColors: (() => {
            const copy = document.querySelector('.chair-mobile-book-copy')
            const mark = document.querySelector('.chair-mobile-book-mark')
            return copy && mark ? { copy: getComputedStyle(copy).backgroundColor, mark: getComputedStyle(mark).backgroundColor } : null
          })(),
          mobileBookLabelSingleLine: (() => {
            const node = document.querySelector('.chair-mobile-book-copy > span')
            if (!node) return false
            const range = document.createRange()
            range.selectNodeContents(node)
            return range.getClientRects().length === 1
          })(),
          footerLogoCount: document.querySelectorAll('.chair-footer .chair-brand img').length,
          mobileHeaderBrandVisible: visible('.chair-header .chair-brand'),
          headerBookVisible: visible('.chair-header-book'),
          heroOfferClear: (() => {
            const offer = document.querySelector('.chair-hero-offer')?.getBoundingClientRect()
            const sticky = document.querySelector('.chair-mobile-book')?.getBoundingClientRect()
            return !offer || !sticky || sticky.height === 0 || (offer.top >= 0 && offer.bottom <= sticky.top + 1)
          })(),
        }
      })

      let mobileMenuGeometry = null
      let desktopAnchorGeometry = null
      if (viewport.width < 960) {
        await page.locator('.chair-menu-trigger').click()
        mobileMenuGeometry = await page.evaluate(() => {
          const header = document.querySelector('.chair-header').getBoundingClientRect()
          const menu = document.querySelector('.chair-mobile-menu').getBoundingClientRect()
          return {
            headerBottom: Math.round(header.bottom),
            menuTop: Math.round(menu.top),
            menuVisible: menu.width > 0 && menu.height > 0,
          }
        })
        await page.locator('.chair-menu-trigger').click()
      } else {
        await page.locator('.chair-desktop-nav a[href="#about"]').click()
        await page.waitForTimeout(100)
        desktopAnchorGeometry = await page.evaluate(() => {
          const header = document.querySelector('.chair-header').getBoundingClientRect()
          const heading = document.querySelector('.chair-about .chair-outline-label').getBoundingClientRect()
          return { headerBottom: Math.round(header.bottom), headingTop: Math.round(heading.top) }
        })
        await page.evaluate(() => window.scrollTo(0, 0))
      }

      const heroShot = path.join(outputDir, `${viewport.name}-hero.png`)
      const fullShot = path.join(outputDir, `${viewport.name}-full.png`)
      await page.screenshot({ path: heroShot, fullPage: false })
      await page.screenshot({ path: fullShot, fullPage: true })
      if (viewport.name === 'iphone' || viewport.name === 'desktop') {
        for (const [name, selector] of [
          ['work', '.chair-work'],
          ['services', '.chair-services'],
          ['about', '.chair-about'],
          ['events', '.chair-events'],
          ['booking', '.chair-booking'],
        ]) {
          await page.locator(selector).screenshot({ path: path.join(outputDir, `${viewport.name}-${name}.png`) })
        }
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const bottomClearance = await page.evaluate(() => {
        const footer = document.querySelector('.chair-footer')?.getBoundingClientRect()
        const mobileBook = document.querySelector('.chair-mobile-book')?.getBoundingClientRect()
        return footer && mobileBook ? Math.round(mobileBook.top - footer.bottom) : null
      })
      report.push({ viewport, status: response.status(), ...metrics, persistentMetrics, bottomClearance, mobileMenuGeometry, desktopAnchorGeometry, heroShot, fullShot })
      await page.close()
    }

  } finally {
    await browser.close()
  }

  const failures = report.filter((item) =>
    item.status !== 200 ||
    item.scrollWidth > item.width + 1 ||
    !item.heroVisible ||
    !item.headlineVisible ||
    !item.bookingVisible ||
    item.imageFailures.length ||
    item.switcherCount ||
    item.camoCount < 3 ||
    item.featuredCount !== 0 ||
    !item.editorIntroduction?.includes('Middle Tennessee') ||
    item.editorMobileLabel !== 'Middle Tennessee' ||
    item.editorAboutHeading !== 'About JP' ||
    item.editorServiceDetails !== '35 minutes · Editor service note proof' ||
    !item.editorEventLabel?.includes('Editor contact proof') ||
    item.editorWorkHeading !== 'Editor work heading' ||
    item.editorServicesHeading !== 'Editor services heading' ||
    item.eventOutlineHeading !== 'GROUP CUTS' ||
    item.eventFilledHeading !== 'EVENTS & TEAMS' ||
    item.eventGroupCount !== 2 ||
    item.aboutImageCount !== 1 ||
    item.aboutSubtitle !== 'Clean cuts. Easy conversation. No pretense.' ||
    item.heroBookingHref !== 'https://calendly.com/jpcuts/30mins' ||
    item.heroBookingHeight < 52 ||
    item.heroBookingText !== 'Book a cut' ||
    item.heroOfferText !== '$35 Haircut · 35 minutes' ||
    !item.heroOfferClear ||
    !item.heroAddonText?.includes('Optional shave or beard trim · +$5') ||
    !item.fadedLocationText?.includes('113 Front Street, Smyrna, TN 37167') ||
    !item.fadedLocationText?.includes('Tuesday–Friday, 9:00am–3:00pm; Saturday, 8:00am–2:00pm') ||
    !item.lipscombLocationText?.includes('majority of his business') ||
    item.headlineLines.length !== 3 ||
    item.headlineLines.some((line) => !line.insideHero || !line.singleLine) ||
    item.visibleEmailCount !== 0 ||
    item.forbiddenCopy ||
    !item.heroLogo?.visible ||
    item.heroLogo.width < (item.viewport.height <= 650 ? 60 : 100) ||
    item.heroLogo.height < (item.viewport.height <= 650 ? 64 : 108) ||
    item.heroLogo.background !== 'rgba(0, 0, 0, 0)' ||
    !item.heroLogo.filter?.includes('brightness(0)') ||
    !item.heroLogo.filter?.includes('invert(1)') ||
    item.footerLogoCount !== 1 ||
    (item.viewport.width < 960 && (item.headerLogo?.visible || item.mobileHeaderBrandVisible || !item.mobileBookLogo?.visible || !item.mobileBookLogo.naturalWidth || item.mobileBookLogo.panelRatio < .24 || item.mobileBookLogo.panelRatio > .34 || item.mobileBookColors?.copy === item.mobileBookColors?.mark || !item.mobileBookLabelSingleLine || item.headerHeight > 90 || item.headerBookVisible || !item.mobileMenuGeometry?.menuVisible || item.mobileMenuGeometry.menuTop < item.mobileMenuGeometry.headerBottom - 1 || item.persistentMetrics.mobileBookBottom !== item.persistentMetrics.viewportHeight || item.bottomClearance < -1)) ||
    (item.viewport.width >= 960 && (!item.headerLogo?.visible || item.headerLogo.width < 50 || item.headerLogo.height < 52 || item.persistentMetrics.headerTop !== 0 || !item.headerBookVisible || item.desktopAnchorGeometry?.headingTop < item.desktopAnchorGeometry?.headerBottom)) ||
    item.headline !== 'Create. Connect. Collaborate.'
  )
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ baseUrl, report, failures }, null, 2))
  if (failures.length) {
    throw new Error(`The Chair checks failed: ${JSON.stringify({ failures }, null, 2)}`)
  }
  console.log(`The Chair responsive checks passed at ${report.length} required viewports with exact booking, availability, single-line headline geometry, and the Reel intentionally absent.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
