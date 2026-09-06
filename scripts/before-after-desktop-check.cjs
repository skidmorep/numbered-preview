const { chromium, webkit } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.JPCUUTS_PREVIEW_URL || 'http://127.0.0.1:8791'
const outputDir = process.env.JPCUUTS_PROOF_DIR || path.resolve('proof/before-after-desktop')
const live = process.env.JPCUUTS_LIVE === '1'

async function runWebkitDesktop(url, defaultContent) {
  const browser = await webkit.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    if (!live) {
      await page.route('**/api/content', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: defaultContent }),
      }))
    }
    const response = await page.goto(url.toString(), { waitUntil: 'networkidle' })
    const comparison = page.locator('.before-after')
    await comparison.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      window.__comparisonDragStarts = 0
      window.__comparisonPointerId = null
      window.__comparisonLostCaptures = 0
      const frame = document.querySelector('.before-after-frame')
      frame.addEventListener('dragstart', () => {
        window.__comparisonDragStarts += 1
      })
      frame.addEventListener('pointerdown', (event) => {
        window.__comparisonPointerId = event.pointerId
      })
      frame.addEventListener('lostpointercapture', () => {
        window.__comparisonLostCaptures += 1
      })
    })

    const frame = comparison.locator('.before-after-frame')
    const handle = comparison.locator('.before-after-divider span')
    const range = comparison.locator('input[type="range"]')
    const frameBox = await frame.boundingBox()
    const handleBox = await handle.boundingBox()
    if (!frameBox || !handleBox) throw new Error('WebKit comparison handle has no desktop bounds')

    const start = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 }
    const end = { x: frameBox.x + frameBox.width * .82, y: start.y }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 12 })
    await page.mouse.up()
    const releasedValue = Number(await range.inputValue())
    await page.mouse.move(frameBox.x + frameBox.width * .2, start.y, { steps: 8 })
    await page.waitForTimeout(50)
    const passiveValue = Number(await range.inputValue())

    const state = await page.evaluate(() => ({
      dragStarts: window.__comparisonDragStarts,
      nativeDraggableImages: [...document.querySelectorAll('.before-after-image')].filter((image) => image.draggable).length,
    }))
    await comparison.screenshot({ path: path.join(outputDir, 'released-desktop-webkit.png') })
    return { status: response.status(), releasedValue, passiveValue, ...state }
  } finally {
    await browser.close()
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const { defaultContent } = await import('../src/siteContent.js')
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    if (!live) {
      await page.route('**/api/content', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: defaultContent }),
      }))
    }
    const url = new URL(baseUrl)
    if (!live) url.searchParams.set('jp-feedback', '1')
    const response = await page.goto(url.toString(), { waitUntil: 'networkidle' })
    const comparison = page.locator('.before-after')
    await comparison.scrollIntoViewIfNeeded()
    await page.waitForTimeout(100)

    await page.evaluate(() => {
      window.__comparisonDragStarts = 0
      window.__comparisonPointerId = null
      window.__comparisonLostCaptures = 0
      const frame = document.querySelector('.before-after-frame')
      frame.addEventListener('dragstart', () => {
        window.__comparisonDragStarts += 1
      })
      frame.addEventListener('pointerdown', (event) => {
        window.__comparisonPointerId = event.pointerId
      })
      frame.addEventListener('lostpointercapture', () => {
        window.__comparisonLostCaptures += 1
      })
    })

    const frame = comparison.locator('.before-after-frame')
    const handle = comparison.locator('.before-after-divider span')
    const range = comparison.locator('input[type="range"]')
    const frameBox = await frame.boundingBox()
    const handleBox = await handle.boundingBox()
    if (!frameBox || !handleBox) throw new Error('Comparison handle has no desktop bounds')

    const start = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 }
    const end = { x: frameBox.x + frameBox.width * .82, y: start.y }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 12 })
    await page.mouse.up()
    const releasedValue = Number(await range.inputValue())

    await page.mouse.move(frameBox.x + frameBox.width * .2, start.y, { steps: 8 })
    await page.waitForTimeout(50)
    const passiveValue = Number(await range.inputValue())

    const captureStart = { x: frameBox.x + frameBox.width * .82, y: start.y }
    const captureMiddle = { x: frameBox.x + frameBox.width * .65, y: start.y }
    const captureEnd = { x: frameBox.x + frameBox.width * .25, y: start.y }
    await page.mouse.move(captureStart.x, captureStart.y)
    await page.mouse.down()
    await page.mouse.move(captureMiddle.x, captureMiddle.y, { steps: 6 })
    const captureStateBeforeLoss = await frame.evaluate((node) => ({
      active: node.hasPointerCapture(window.__comparisonPointerId),
      lostEvents: window.__comparisonLostCaptures,
    }))
    const valueBeforeCaptureLoss = Number(await range.inputValue())
    await frame.evaluate((node) => node.releasePointerCapture(window.__comparisonPointerId))
    await page.waitForTimeout(20)
    const captureStateAfterLoss = await frame.evaluate((node) => ({
      active: node.hasPointerCapture(window.__comparisonPointerId),
      lostEvents: window.__comparisonLostCaptures,
    }))
    await page.mouse.move(captureEnd.x, captureEnd.y, { steps: 8 })
    const valueAfterCaptureLoss = Number(await range.inputValue())
    await page.mouse.up()

    const state = await page.evaluate(() => ({
      dragStarts: window.__comparisonDragStarts,
      nativeDraggableImages: [...document.querySelectorAll('.before-after-image')].filter((image) => image.draggable).length,
    }))

    await comparison.screenshot({ path: path.join(outputDir, 'released-desktop.png') })
    const report = {
      baseUrl,
      status: response.status(),
      desktop: {
        releasedValue,
        passiveValue,
        captureStateBeforeLoss,
        captureStateAfterLoss,
        valueBeforeCaptureLoss,
        valueAfterCaptureLoss,
        ...state,
      },
    }

    if (response.status() !== 200) throw new Error(`Preview returned ${response.status()}`)
    if (state.nativeDraggableImages !== 0) throw new Error(`Comparison exposes ${state.nativeDraggableImages} natively draggable images`)
    if (state.dragStarts !== 0) throw new Error(`Comparison started ${state.dragStarts} browser image drag`)
    if (releasedValue < 78 || releasedValue > 86) throw new Error(`Desktop drag stopped at ${releasedValue}`)
    if (passiveValue !== releasedValue) throw new Error(`Slider kept moving after release: ${releasedValue} -> ${passiveValue}`)
    if (!captureStateBeforeLoss.active) throw new Error('Comparison did not capture the desktop pointer')
    if (captureStateAfterLoss.active || captureStateAfterLoss.lostEvents <= captureStateBeforeLoss.lostEvents) throw new Error('Comparison did not observe forced pointer-capture loss')
    if (valueAfterCaptureLoss !== valueBeforeCaptureLoss) throw new Error(`Slider kept moving after pointer-capture loss: ${valueBeforeCaptureLoss} -> ${valueAfterCaptureLoss}`)

    const webkitState = await runWebkitDesktop(url, defaultContent)
    report.webkitDesktop = webkitState
    if (webkitState.status !== 200) throw new Error(`WebKit preview returned ${webkitState.status}`)
    if (webkitState.nativeDraggableImages !== 0 || webkitState.dragStarts !== 0) throw new Error('WebKit started a native comparison-image drag')
    if (webkitState.releasedValue < 78 || webkitState.releasedValue > 86) throw new Error(`WebKit desktop drag stopped at ${webkitState.releasedValue}`)
    if (webkitState.passiveValue !== webkitState.releasedValue) throw new Error(`WebKit slider kept moving after release: ${webkitState.releasedValue} -> ${webkitState.passiveValue}`)

    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
    if (!live) {
      await mobilePage.route('**/api/content', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: defaultContent }),
      }))
    }
    const mobileResponse = await mobilePage.goto(url.toString(), { waitUntil: 'networkidle' })
    const mobileComparison = mobilePage.locator('.before-after')
    await mobileComparison.scrollIntoViewIfNeeded()
    const mobileRange = mobileComparison.locator('input[type="range"]')
    const mobileFrame = mobileComparison.locator('.before-after-frame')
    const mobileBox = await mobileFrame.boundingBox()
    if (!mobileBox) throw new Error('Comparison has no mobile bounds')

    const touch = await mobilePage.context().newCDPSession(mobilePage)
    const touchStart = { x: mobileBox.x + mobileBox.width * .2, y: mobileBox.y + mobileBox.height / 2 }
    const touchEnd = { x: mobileBox.x + mobileBox.width * .82, y: touchStart.y }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchStart] })
    for (let step = 1; step <= 8; step += 1) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: touchStart.x + ((touchEnd.x - touchStart.x) * step) / 8, y: touchStart.y }],
      })
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const touchValue = Number(await mobileRange.inputValue())

    const scrollBeforeSwipe = await mobilePage.evaluate(() => window.scrollY)
    const swipeStart = { x: mobileBox.x + mobileBox.width / 2, y: Math.min(mobileBox.y + mobileBox.height * .78, 760) }
    const swipeEnd = { x: swipeStart.x, y: Math.max(90, swipeStart.y - 220) }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [swipeStart] })
    for (let step = 1; step <= 8; step += 1) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: swipeStart.x, y: swipeStart.y + ((swipeEnd.y - swipeStart.y) * step) / 8 }],
      })
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await mobilePage.waitForTimeout(250)
    const scrollAfterSwipe = await mobilePage.evaluate(() => window.scrollY)
    const swipeValue = Number(await mobileRange.inputValue())

    await mobileRange.focus()
    await mobilePage.keyboard.press('ArrowLeft')
    const keyboardValue = Number(await mobileRange.inputValue())
    await mobileComparison.screenshot({ path: path.join(outputDir, 'released-mobile.png') })
    report.mobile = { status: mobileResponse.status(), touchValue, swipeValue, keyboardValue, scrollBeforeSwipe, scrollAfterSwipe }
    fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))

    if (mobileResponse.status() !== 200) throw new Error(`Mobile preview returned ${mobileResponse.status()}`)
    if (touchValue < 78 || touchValue > 86) throw new Error(`Mobile finger drag stopped at ${touchValue}`)
    if (Math.abs(swipeValue - touchValue) > 2) throw new Error(`Vertical swipe moved the comparison from ${touchValue} to ${swipeValue}`)
    if (scrollAfterSwipe < scrollBeforeSwipe + 60) throw new Error('Comparison blocked vertical mobile scrolling')
    if (keyboardValue !== swipeValue - 1) throw new Error(`Keyboard step moved the comparison from ${swipeValue} to ${keyboardValue}`)
    console.log(`Comparison released at ${releasedValue}% in Chromium, ${webkitState.releasedValue}% in WebKit, and ${touchValue}% on mobile; native drag, post-release movement, capture-loss tracking, and blocked touch scrolling are absent.`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
