const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.JPCUUTS_PREVIEW_URL || 'http://127.0.0.1:8791'
const outputDir = process.env.JPCUUTS_PROOF_DIR || path.resolve('proof/foundation')

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const { defaultContent } = await import('../src/siteContent.js')
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
    await page.route('**/api/content', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: defaultContent }),
    }))
    await page.goto(baseUrl, { waitUntil: 'networkidle' })

    const booking = page.locator('a[href="https://calendly.com/jpcuts/30mins"]')
    const visibleBooking = await booking.evaluateAll((nodes) => nodes.some((node) => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden'
    }))
    if (!visibleBooking) throw new Error('Calendly booking action is not visible on mobile')

    const comparison = page.locator('.before-after')
    await comparison.scrollIntoViewIfNeeded()
    const range = comparison.locator('input[type="range"]')
    const frame = comparison.locator('.before-after-frame')
    const box = await frame.boundingBox()
    if (!box) throw new Error('Before/after control has no interactive bounds')

    const touch = await page.context().newCDPSession(page)
    const start = { x: box.x + box.width * 0.2, y: box.y + box.height / 2 }
    const end = { x: box.x + box.width * 0.82, y: box.y + box.height / 2 }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    for (let step = 1; step <= 8; step += 1) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: start.x + ((end.x - start.x) * step) / 8, y: start.y }],
      })
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const pointerValue = Number(await range.inputValue())
    if (pointerValue < 75) throw new Error(`Before/after finger drag stopped at ${pointerValue}`)

    await range.focus()
    await page.keyboard.press('ArrowLeft')
    const keyboardValue = Number(await range.inputValue())
    if (keyboardValue !== pointerValue - 1) throw new Error('Before/after keyboard control did not move one step')

    await comparison.screenshot({ path: path.join(outputDir, 'before-after-mobile.png') })

    const publicState = await page.evaluate(() => ({
      title: document.title,
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      publicName: document.querySelector('.chair-brand strong')?.textContent.trim(),
      hasVisibleEmail: document.body.innerHTML.includes('jp@jpcuuts.com') || Boolean(document.querySelector('a[href^="mailto:"]')),
      bodyText: document.body.textContent,
      verse: document.querySelector('.chair-about blockquote')?.textContent.trim(),
      reelSource: document.querySelector('.chair-reel iframe')?.getAttribute('src'),
      eventGroupCount: document.querySelectorAll('.chair-event-group').length,
      bioParagraphs: document.querySelectorAll('.chair-bio-copy p').length,
    }))
    if (publicState.scrollWidth > publicState.width + 1) throw new Error('Public page overflows horizontally')
    if (publicState.publicName !== 'JP CUTS') throw new Error('JP Cuts public name is missing')
    if (publicState.hasVisibleEmail) throw new Error('Public email or mailto link is exposed')
    if (!publicState.bodyText.includes('Middle Tennessee') || /Nashville|Booksy|JP Cutz/i.test(publicState.bodyText)) throw new Error('Public location or identity copy is stale')
    if ((publicState.bodyText.match(/\bnumbered\b/gi) || []).length !== 1) throw new Error('Numbered language appears outside the single Matthew 10:30 quotation')
    if (!publicState.bodyText.includes('Haircut$3535 minutes') || !publicState.bodyText.includes('Shave or beard trim+$5')) throw new Error('The approved service pricing is not rendered exactly')
    if (!publicState.verse?.includes('Matthew 10:30')) throw new Error('Verse detail is missing')
    if (publicState.reelSource !== 'https://www.instagram.com/reel/DX1nfUogdFn/embed/') throw new Error('Approved Instagram Reel is not embedded')
    if (publicState.eventGroupCount !== 2) throw new Error('Both event photo sets are not rendered')
    if (publicState.bioParagraphs !== 3) throw new Error('The supplied three-paragraph bio is not rendered')

    await page.route('**/api/contact', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }))
    const contact = page.locator('.chair-contact')
    await contact.scrollIntoViewIfNeeded()
    await contact.locator('.chair-contact-toggle').click()
    await contact.locator('input[name="name"]').fill('Mobile proof')
    await contact.locator('input[name="email"]').fill('proof@example.com')
    await contact.locator('textarea[name="details"]').fill('Six team haircuts before an event.')
    await contact.getByRole('button', { name: 'Send message' }).click()
    await contact.getByText('Thanks — your message was sent to JP.').waitFor()
    await page.waitForTimeout(2_700)
    if (await contact.locator('form').count()) throw new Error('Contact form did not collapse after its thank-you')

    const editor = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await editor.goto(`${baseUrl}/admin/`, { waitUntil: 'networkidle' })
    await editor.getByRole('heading', { name: 'Sign in to edit' }).waitFor()
    const editorState = await editor.evaluate(() => ({
      title: document.title,
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brand: document.querySelector('.editor-auth-brand b')?.textContent.trim(),
    }))
    if (editorState.scrollWidth > editorState.width + 1) throw new Error('Editor login overflows horizontally')
    if (editorState.brand !== 'JP CUTS') throw new Error('Editor login branding is stale')

    fs.writeFileSync(path.join(outputDir, 'foundation-e2e.json'), JSON.stringify({
      baseUrl,
      pointerValue,
      keyboardValue,
      publicState,
      editorState,
    }, null, 2))
    console.log('JP Cuts foundation path passed on a 390x844 touch viewport.')
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
