import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultContent } from '../src/siteContent.js'
import { detectMediaType, handleRequest, parseByteRange, validateContent } from './index.js'

const PREVIEW_PASSWORD = 'test-preview-password'
const basicAuth = (credentials) => `Basic ${globalThis.btoa(credentials)}`
const previewAuth = basicAuth(`preview:${PREVIEW_PASSWORD}`)
const previewEnv = (overrides = {}) => ({
  PREVIEW_USERNAME: 'preview',
  PREVIEW_PASSWORD,
  ...overrides,
})

test('bundled content passes the Worker validation contract', () => {
  assert.equal(validateContent(structuredClone(defaultContent)), true)
})

test('content validation rejects unsafe URLs, markup, excess galleries, and missing alt text', async (t) => {
  await t.test('booking must use https', () => {
    const content = structuredClone(defaultContent)
    content.booking.url = 'http://example.com/book'
    assertResponseError(() => validateContent(content), 400)
  })

  await t.test('plain text cannot carry HTML', () => {
    const content = structuredClone(defaultContent)
    content.hero.intro = '<script>alert(1)</script>'
    assertResponseError(() => validateContent(content), 400)
  })

  await t.test('gallery is bounded', () => {
    const content = structuredClone(defaultContent)
    content.media.gallery = Array.from({ length: 10 }, () => content.media.hero)
    assertResponseError(() => validateContent(content), 400)
  })

  await t.test('published images need alt text', () => {
    const content = structuredClone(defaultContent)
    content.media.hero.alt = ''
    assertResponseError(() => validateContent(content), 400)
  })

  await t.test('Instagram field only accepts reel URLs', () => {
    const content = structuredClone(defaultContent)
    content.featured.url = 'https://www.instagram.com/cutzby.jp/'
    assertResponseError(() => validateContent(content), 400)
  })
})

test('media magic-byte validation detects allowed types and rejects disguised content', async () => {
  const jpeg = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' })
  const png = new Blob([Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], { type: 'image/png' })
  const webp = new Blob([new TextEncoder().encode('RIFF0000WEBP')], { type: 'image/webp' })
  const html = new Blob([new TextEncoder().encode('<!doctype html>')], { type: 'image/jpeg' })

  assert.equal(await detectMediaType(jpeg), 'image/jpeg')
  assert.equal(await detectMediaType(png), 'image/png')
  assert.equal(await detectMediaType(webp), 'image/webp')
  assert.equal(await detectMediaType(html), '')
})

test('single byte ranges support full, open-ended, and suffix requests', () => {
  assert.deepEqual(parseByteRange('bytes=0-9', 100), { offset: 0, length: 10 })
  assert.deepEqual(parseByteRange('bytes=90-', 100), { offset: 90, length: 10 })
  assert.deepEqual(parseByteRange('bytes=-12', 100), { offset: 88, length: 12 })
  assert.equal(parseByteRange('bytes=100-110', 100), null)
  assert.equal(parseByteRange('bytes=4-2', 100), null)
  assert.equal(parseByteRange('items=0-3', 100), null)
})

test('preview gate fails closed across pages, assets, APIs, and media before routing', async () => {
  const paths = ['/', '/assets/index-abc123.js', '/api/content', '/uploads/example.jpg', '/admin/']
  const rejectedCredentials = [
    { name: 'no header', authorization: null },
    { name: 'malformed header', authorization: 'Basic !!!' },
    { name: 'wrong username', authorization: basicAuth(`someone:${PREVIEW_PASSWORD}`) },
    { name: 'wrong password', authorization: basicAuth('preview:wrong') },
  ]

  for (const path of paths) {
    const unconfiguredBindings = untouchedBindings()
    const unconfigured = await handleRequest(new Request(`https://numbered.test${path}`, {
      headers: { authorization: previewAuth },
    }), unconfiguredBindings.env)
    assert.equal(unconfigured.status, 503, `${path} must fail closed without a secret`)
    assert.equal(unconfigured.headers.get('cache-control'), 'no-store')
    assert.deepEqual(unconfiguredBindings.calls, { assets: 0, db: 0, media: 0 })

    for (const scenario of rejectedCredentials) {
      const bindings = untouchedBindings()
      const headers = scenario.authorization ? { authorization: scenario.authorization } : {}
      const response = await handleRequest(new Request(`https://numbered.test${path}`, { headers }), {
        ...bindings.env,
        PREVIEW_USERNAME: 'preview',
        PREVIEW_PASSWORD,
      })
      assert.equal(response.status, 401, `${path} must reject ${scenario.name}`)
      assert.match(response.headers.get('www-authenticate'), /^Basic /)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.deepEqual(bindings.calls, { assets: 0, db: 0, media: 0 })
    }
  }

  const allowedBindings = untouchedBindings()
  const allowed = await handleRequest(new Request('https://numbered.test/', {
    headers: { authorization: previewAuth },
  }), previewEnv(allowedBindings.env))
  assert.equal(allowed.status, 200)
  assert.deepEqual(allowedBindings.calls, { assets: 1, db: 0, media: 0 })
})

test('authorized content endpoint safely returns bundled-fallback state and security headers', async () => {
  const env = previewEnv({ DB: { prepare: () => ({ first: async () => null }) } })
  const response = await handleRequest(new Request('https://numbered.test/api/content', {
    headers: { authorization: previewAuth },
  }), env)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.content, null)
  assert.equal(body.revision, 0)
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')
  assert.match(response.headers.get('content-security-policy'), /frame-src https:\/\/www\.instagram\.com/)
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('admin routes reject missing sessions and cross-origin mutations before parsing bodies', async () => {
  const unauthorized = await handleRequest(new Request('https://numbered.test/api/admin/content', {
    headers: { authorization: previewAuth },
  }), previewEnv())
  assert.equal(unauthorized.status, 401)

  const crossOrigin = await handleRequest(new Request('https://numbered.test/api/setup', {
    method: 'POST',
    headers: { authorization: previewAuth, origin: 'https://evil.example', 'content-type': 'application/json' },
    body: '{not-json',
  }), previewEnv())
  assert.equal(crossOrigin.status, 403)

  const upload = await handleRequest(new Request('https://numbered.test/api/admin/media', {
    method: 'POST',
    headers: { authorization: previewAuth, origin: 'https://numbered.test' },
  }), previewEnv())
  assert.equal(upload.status, 401)
})

function untouchedBindings() {
  const calls = { assets: 0, db: 0, media: 0 }
  return {
    calls,
    env: {
      ASSETS: { fetch: async () => { calls.assets += 1; return new Response('site') } },
      DB: { prepare: () => { calls.db += 1; throw new Error('DB binding must not be touched') } },
      MEDIA: {
        head: async () => { calls.media += 1; throw new Error('MEDIA binding must not be touched') },
        get: async () => { calls.media += 1; throw new Error('MEDIA binding must not be touched') },
      },
    },
  }
}

function assertResponseError(action, status) {
  assert.throws(action, (error) => error instanceof Response && error.status === status)
}
