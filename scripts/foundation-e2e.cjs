const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.JPCUUTS_PREVIEW_URL || 'http://127.0.0.1:8791'
const outputDir = process.env.JPCUUTS_PROOF_DIR || path.resolve('proof/foundation')

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
    await page.goto(`${baseUrl}/?skin=cut-record`, { waitUntil: 'networkidle' })

    const booking = page.locator('a[href="https://calendly.com/jpcuts/30mins"]')
    const visibleBooking = await booking.evaluateAll((nodes) => nodes.some((node) => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden'
    }))
    if (!visibleBooking) throw new Error('Calendly booking action is not visible on mobile')

    const comparison = page.locator('.before-after')
    await comparison.scrollIntoViewIfNeeded()
    const range = comparison.locator('input[type="range"]')
    const box = await range.boundingBox()
    if (!box) throw new Error('Before/after control has no interactive bounds')

    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.78, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()
    const pointerValue = Number(await range.inputValue())
    if (pointerValue < 70) throw new Error(`Before/after pointer drag stopped at ${pointerValue}`)

    await range.focus()
    await page.keyboard.press('ArrowLeft')
    const keyboardValue = Number(await range.inputValue())
    if (keyboardValue !== pointerValue - 1) throw new Error('Before/after keyboard control did not move one step')

    await comparison.screenshot({ path: path.join(outputDir, 'before-after-mobile.png') })

    const publicState = await page.evaluate(() => ({
      title: document.title,
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      publicName: document.querySelector('.n-brand')?.textContent.trim(),
      emailLink: document.querySelector('a[href="mailto:jp@jpcuuts.com"]')?.textContent.trim(),
      verse: document.querySelector('.n-story blockquote')?.textContent.trim(),
    }))
    if (publicState.scrollWidth > publicState.width + 1) throw new Error('Public page overflows horizontally')
    if (publicState.publicName !== 'JP CUTS') throw new Error('JP Cuts public name is missing')
    if (publicState.emailLink !== 'jp@jpcuuts.com') throw new Error('Public email link is missing')
    if (!publicState.verse?.includes('Matthew 10:30')) throw new Error('Verse detail is missing')

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
