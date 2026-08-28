const { chromium } = require('playwright')
const path = require('node:path')

const baseUrl = process.env.NUMBERED_PREVIEW_URL
const email = process.env.NUMBERED_OWNER_EMAIL
const password = process.env.NUMBERED_OWNER_PASSWORD
const videoPath = process.env.NUMBERED_TEST_VIDEO
const previewUsername = process.env.NUMBERED_PREVIEW_USERNAME || 'preview'
const previewPassword = process.env.NUMBERED_PREVIEW_PASSWORD

if (!baseUrl || !email || !password || !videoPath || !previewPassword) throw new Error('Missing editor test environment')

async function main() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    httpCredentials: { username: previewUsername, password: previewPassword },
  })

  try {
    await page.goto(`${baseUrl}/admin/`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    const initialContentResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/content'))
    await page.getByRole('button', { name: 'Sign in' }).click()
    await initialContentResponse
    await page.getByRole('heading', { name: 'Content editor' }).waitFor()

    const eyebrow = page.getByLabel('Hero eyebrow')
    const observedEyebrow = await eyebrow.inputValue()
    const originalEyebrow = observedEyebrow.replace(/ · editor check/g, '')
    if (observedEyebrow !== originalEyebrow) {
      await eyebrow.fill(originalEyebrow)
      await saveAndWait(page)
    }
    await eyebrow.fill(`${originalEyebrow} · editor check`)
    await saveAndWait(page)
    let live = await readJson(page, '/api/content')
    if (!live.content.hero.eyebrow.endsWith('editor check')) throw new Error('Text edit did not publish')

    await eyebrow.fill(originalEyebrow)
    await saveAndWait(page)
    const baseline = await readJson(page, '/api/admin/content')

    const uploader = page.locator('.media-uploader')
    await uploader.locator('select').selectOption('hero')
    await uploader.locator('input[type="file"]').setInputFiles(path.resolve('public/media/defaults/jp-hero-03.webp'))
    await uploader.getByLabel('Image alt text').fill('Temporary upload-path verification image')
    const imageUploadResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/media') && response.request().method() === 'POST')
    await uploader.getByRole('button', { name: 'Upload' }).click()
    if ((await imageUploadResponse).status() !== 201) throw new Error('Image upload was rejected')
    await page.getByRole('button', { name: 'Save and publish preview' }).waitFor({ state: 'visible' })
    await saveAndWait(page)
    live = await readJson(page, '/api/content')
    if (!live.content.media.hero.url.startsWith('/uploads/')) throw new Error('Image did not publish')
    const imageResponse = await page.request.get(`${baseUrl}${live.content.media.hero.url}`)
    if (imageResponse.status() !== 200 || imageResponse.headers()['content-type'] !== 'image/webp') throw new Error('Published image did not render')
    await restore(page, baseline.content, live.revision)

    const reloadedContentResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/content'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await reloadedContentResponse
    await page.getByRole('heading', { name: 'Content editor' }).waitFor()
    const videoUploader = page.locator('.media-uploader')
    await videoUploader.locator('select').selectOption('featured-video')
    await videoUploader.locator('input[type="file"]').setInputFiles(videoPath)
    const videoUploadResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/media') && response.request().method() === 'POST')
    await videoUploader.getByRole('button', { name: 'Upload' }).click()
    if ((await videoUploadResponse).status() !== 201) throw new Error('Video upload was rejected')
    await page.getByRole('button', { name: 'Save and publish preview' }).waitFor({ state: 'visible' })
    await saveAndWait(page)
    live = await readJson(page, '/api/content')
    if (live.content.featured.type !== 'video' || !live.content.featured.url.startsWith('/uploads/')) throw new Error('Video did not publish')
    const rangeStatus = await page.evaluate(async (url) => (await fetch(url, { headers: { Range: 'bytes=0-31' } })).status, live.content.featured.url)
    if (rangeStatus !== 206) throw new Error(`Video range request returned ${rangeStatus}`)
    await restore(page, baseline.content, live.revision)

    const disguisedStatus = await page.evaluate(async () => {
      const form = new FormData()
      form.append('file', new File(['<!doctype html><script>bad()</script>'], 'bad.jpg', { type: 'image/jpeg' }))
      form.append('alt', 'Disguised file')
      return (await fetch('/api/admin/media', { method: 'POST', body: form })).status
    })
    if (disguisedStatus !== 415) throw new Error(`Disguised upload returned ${disguisedStatus}`)

    console.log(JSON.stringify({
      login: 'passed',
      textPublishAndRestore: 'passed',
      imageUploadRenderAndRestore: 'passed',
      videoUploadRangeAndRestore: 'passed',
      disguisedUploadRejection: 'passed',
      finalRevision: (await readJson(page, '/api/content')).revision,
    }))
  } finally {
    await page.close()
    await browser.close()
  }
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
