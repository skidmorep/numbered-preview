const { chromium } = require('playwright')

const baseUrl = process.env.NUMBERED_PREVIEW_URL
const email = process.env.NUMBERED_OWNER_EMAIL
const password = process.env.NUMBERED_OWNER_PASSWORD

if (!baseUrl || !email || !password) throw new Error('Missing editor test environment')

async function main() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  let isolatedContext

  try {
    await loginFromRoot(page)
    await page.goto(`${baseUrl}/admin/`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Content editor' }).waitFor()

    await page.getByRole('button', { name: 'Log out' }).click()
    await page.getByRole('heading', { name: 'Sign in to edit' }).waitFor()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('heading', { name: 'Content editor' }).waitFor()

    isolatedContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const isolatedPage = await isolatedContext.newPage()
    await loginFromRoot(isolatedPage)
    await isolatedPage.goto(`${baseUrl}/admin/`, { waitUntil: 'domcontentloaded' })
    await isolatedPage.getByRole('heading', { name: 'Content editor' }).waitFor()
    await page.getByRole('button', { name: 'Log out' }).click()
    await isolatedPage.reload({ waitUntil: 'domcontentloaded' })
    await isolatedPage.getByRole('heading', { name: 'Content editor' }).waitFor()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('heading', { name: 'Content editor' }).waitFor()

    const headline = page.getByLabel('Hero headline')
    const observedHeadline = await headline.inputValue()
    const originalHeadline = observedHeadline.replace(/ · editor check/g, '')
    if (observedHeadline !== originalHeadline) {
      await headline.fill(originalHeadline)
      await saveAndWait(page)
    }
    await headline.fill(`${originalHeadline} · editor check`)
    await saveAndWait(page)
    let live = await readJson(page, '/api/content')
    if (!live.content.hero.headline.endsWith('editor check')) throw new Error('Text edit did not publish')

    await headline.fill(originalHeadline)
    await saveAndWait(page)
    const baseline = await readJson(page, '/api/admin/content')

    const focusEditor = page.locator('.focus-editor')
    await focusEditor.getByLabel('Horizontal').fill('37')
    await focusEditor.getByLabel('Vertical').fill('28')
    await saveAndWait(page)
    live = await readJson(page, '/api/content')
    if (live.content.media.hero.focus.x !== 37 || live.content.media.hero.focus.y !== 28) throw new Error('Focus point did not publish')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Content editor' }).waitFor()
    if (await page.locator('.focus-editor input[type="range"]').first().inputValue() !== '37') throw new Error('Focus point did not persist after reload')
    const publicPage = await context.newPage()
    await publicPage.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    const objectPosition = await publicPage.locator('.chair-hero > img').evaluate((image) => getComputedStyle(image).objectPosition)
    if (objectPosition !== '37% 28%') throw new Error(`Published focus rendered as ${objectPosition}`)
    await publicPage.close()
    await restore(page, baseline.content, live.revision)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Content editor' }).waitFor()

    const disguisedStatus = await page.evaluate(async () => {
      const form = new FormData()
      form.append('file', new File(['<!doctype html><script>bad()</script>'], 'bad.jpg', { type: 'image/jpeg' }))
      form.append('alt', 'Disguised file')
      return (await fetch('/api/admin/media', { method: 'POST', body: form })).status
    })
    if (disguisedStatus !== 415) throw new Error(`Disguised upload returned ${disguisedStatus}`)

    console.log(JSON.stringify({
      repeatedLoginAndIsolatedContext: 'passed',
      textPublishAndRestore: 'passed',
      focusPublishReloadRenderAndRestore: 'passed',
      disguisedUploadRejection: 'passed',
      finalRevision: (await readJson(page, '/api/content')).revision,
    }))
  } finally {
    await page.close()
    await context.close()
    if (isolatedContext) await isolatedContext.close()
    await browser.close()
  }
}

async function loginFromRoot(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email or username').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('link', { name: 'BOOK A CUT' }).waitFor()
}

async function readJson(page, url) {
  return page.evaluate(async (pathName) => {
    const response = await fetch(pathName, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`GET ${pathName} returned ${response.status}`)
    return response.json()
  }, url)
}

async function restore(page, content, revision) {
  const result = await page.evaluate(async ({ content, revision }) => {
    const response = await fetch('/api/admin/content', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, revision }),
    })
    return { status: response.status, body: await response.json() }
  }, { content, revision })
  if (result.status !== 200) throw new Error(`Restore failed: ${result.body.error || result.status}`)
}

async function saveAndWait(page) {
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/content') && response.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Save and publish preview' }).click()
  const response = await responsePromise
  const body = await response.json()
  if (response.status() !== 200) throw new Error(`Publish failed: ${body.error || response.status()}`)
  return body
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
