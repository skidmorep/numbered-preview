import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultContent, imageFocusStyle, mergeContent } from '../src/siteContent.js'
import { detectMediaType, handleRequest, parseByteRange, validateContent } from './index.js'

const sessionToken = 'test-session-token-with-enough-entropy'
const sessionCookie = `__Host-numbered_session=${sessionToken}`

test('bundled content passes the Worker validation contract', () => {
  assert.equal(validateContent(structuredClone(defaultContent)), true)
  assert.equal(defaultContent.contact.phone, '')
  assert.equal(defaultContent.contact.email, undefined)
  assert.equal(defaultContent.events.actionUrl, undefined)
  assert.equal(defaultContent.brand.publicName, 'JP CUTS')
  assert.equal(defaultContent.version, 6)
  assert.equal(defaultContent.services[0].duration, '35 minutes')
  assert.equal(defaultContent.locations.fadedUniversity.address, '113 Front Street, Smyrna, TN 37167')
  assert.equal(defaultContent.brand.logo.url, '/media/defaults/jp-cuts-camo-logo.png')
  assert.equal(defaultContent.hero.eyebrow, 'MIDDLE TENNESSEE')
  assert.equal(defaultContent.story.subtitle, 'Clean cuts. Easy conversation. No pretense.')
  assert.equal(defaultContent.events.outlineHeading, 'GROUP CUTS')
  assert.equal(defaultContent.events.heading, 'EVENTS & TEAMS')
  assert.equal(defaultContent.featured.enabled, false)
  assert.equal(defaultContent.booking.url, 'https://calendly.com/jpcuts/30mins')
  assert.deepEqual(defaultContent.services.map(({ name, price }) => ({ name, price })), [
    { name: 'Haircut', price: '$35' },
    { name: 'Shave or beard trim', price: '+$5' },
  ])
  assert.match(defaultContent.facts.mobile, /Middle Tennessee/)
  assert.equal(defaultContent.media.beforeAfter.enabled, true)
  assert.deepEqual(defaultContent.media.hero.focus, { x: 53, y: 43 })
  assert.deepEqual(imageFocusStyle(defaultContent.media.hero), { objectPosition: '53% 43%' })
})

test('legacy content migration preserves the chosen headline while enforcing approved JP Cuts facts and media', () => {
  const legacy = structuredClone(defaultContent)
  legacy.version = 3
  legacy.brand.publicName = 'JP CUSTOM'
  legacy.hero = {
    eyebrow: 'Custom eyebrow',
    intro: 'Custom introduction',
    headlines: {
      cutRecord: 'Owner-authored headline.',
      jpInChair: 'Unused second headline.',
      openChair: 'Unused third headline.',
    },
  }
  legacy.booking.url = 'https://example.com/wrong-booking'
  legacy.proof = { rating: '5', reviewCount: 12, sourceLabel: 'Booksy' }
  legacy.story.body = 'Owner-authored biography.'
  legacy.media.beforeAfter.heading = 'Owner-authored comparison.'
  legacy.media.hero.alt = 'Owner-authored hero alt text'
  legacy.contact.email = 'public@example.com'
  legacy.events.actionUrl = 'mailto:public@example.com'

  const migrated = mergeContent(legacy)
  assert.equal(migrated.version, 6)
  assert.equal(migrated.brand.publicName, 'JP CUTS')
  assert.equal(migrated.hero.eyebrow, 'MIDDLE TENNESSEE')
  assert.match(migrated.hero.intro, /Middle Tennessee/)
  assert.equal(migrated.hero.headline, 'Owner-authored headline.')
  assert.equal(migrated.booking.url, 'https://calendly.com/jpcuts/30mins')
  assert.equal(migrated.story.body, defaultContent.story.body)
  assert.equal(migrated.media.beforeAfter.heading, defaultContent.media.beforeAfter.heading)
  assert.equal(migrated.media.hero.alt, defaultContent.media.hero.alt)
  assert.equal(migrated.contact.email, undefined)
  assert.deepEqual(migrated.proof, defaultContent.proof)
  assert.equal(migrated.events.actionUrl, undefined)
  assert.doesNotMatch(JSON.stringify(migrated), /Unused second headline/)
  assert.deepEqual(migrated.media.hero.focus, defaultContent.media.hero.focus)
})

test('version 4 owner content upgrades merge-safely while applying the requested display changes', () => {
  const stored = structuredClone(defaultContent)
  stored.version = 4
  stored.hero.eyebrow = 'Smyrna barber · Middle Tennessee'
  stored.hero.headline = 'Owner headline'
  stored.hero.intro = 'Owner introduction'
  stored.booking.label = 'Owner booking label'
  delete stored.booking.heading
  delete stored.booking.instagramLabel
  delete stored.work
  delete stored.servicesSection
  stored.services[0].duration = '35 minutes'
  stored.services[0].note = 'Owner haircut note'
  stored.story.heading = 'Owner about heading'
  stored.story.body = 'Owner biography'
  delete stored.story.subtitle
  stored.events.heading = 'Owner former event heading'
  stored.events.body = 'Owner events body'
  stored.events.actionLabel = 'Owner contact label'
  delete stored.events.outlineHeading
  delete stored.events.weddingHeading
  delete stored.events.teamHeading
  stored.featured.enabled = true
  stored.featured.heading = 'Owner Reel label'
  stored.featured.url = 'https://www.instagram.com/reel/OwnerChoice123/'
  stored.contact.facebookUrl = 'https://www.facebook.com/owner-choice'
  stored.media.hero.url = '/uploads/11111111-1111-1111-1111-111111111111.webp'
  stored.media.hero.focus = { x: 45, y: 13 }

  const upgraded = mergeContent(stored)
  assert.equal(upgraded.version, 6)
  assert.equal(upgraded.hero.eyebrow, 'MIDDLE TENNESSEE')
  assert.equal(upgraded.hero.headline, 'Owner headline')
  assert.equal(upgraded.hero.intro, 'Owner introduction')
  assert.equal(upgraded.booking.label, 'Owner booking label')
  assert.equal(upgraded.services[0].duration, '35 minutes')
  assert.equal(upgraded.services[0].note, 'Owner haircut note')
  assert.equal(upgraded.story.heading, 'Owner about heading')
  assert.equal(upgraded.story.subtitle, 'Clean cuts. Easy conversation. No pretense.')
  assert.equal(upgraded.story.body, 'Owner biography')
  assert.equal(upgraded.events.outlineHeading, 'GROUP CUTS')
  assert.equal(upgraded.events.heading, 'EVENTS & TEAMS')
  assert.equal(upgraded.events.body, 'Owner events body')
  assert.equal(upgraded.events.actionLabel, 'Owner contact label')
  assert.equal(upgraded.featured.enabled, false)
  assert.equal(upgraded.featured.heading, 'Owner Reel label')
  assert.equal(upgraded.featured.url, 'https://www.instagram.com/reel/OwnerChoice123/')
  assert.equal(upgraded.contact.facebookUrl, 'https://www.facebook.com/owner-choice')
  assert.equal(upgraded.media.hero.url, stored.media.hero.url)
  assert.deepEqual(upgraded.media.hero.focus, { x: 45, y: 13 })
})

test('current owner media gains safe focus defaults without replacing URLs, alt text, order, or copy', () => {
  const stored = structuredClone(defaultContent)
  stored.media.hero = { type: 'image', url: '/uploads/11111111-1111-1111-1111-111111111111.webp', alt: 'Owner hero' }
  stored.media.gallery = stored.media.gallery.map((asset, index) => ({ ...asset, url: `/uploads/${String(index + 1).padStart(8, '0')}-1111-1111-1111-111111111111.webp` }))
  stored.media.gallery[2] = { ...stored.media.gallery[2], focus: { x: 19, y: 81 } }

  const merged = mergeContent(stored)
  assert.equal(merged.media.hero.url, stored.media.hero.url)
  assert.equal(merged.media.hero.alt, 'Owner hero')
  assert.deepEqual(merged.media.hero.focus, defaultContent.media.hero.focus)
  assert.deepEqual(merged.media.gallery.map((asset) => asset.url), stored.media.gallery.map((asset) => asset.url))
  assert.deepEqual(merged.media.gallery[0].focus, defaultContent.media.gallery[0].focus)
  assert.deepEqual(merged.media.gallery[2].focus, { x: 19, y: 81 })
})

test('stored logo migration preserves approved images and restores the official logo for blank or unsafe paths', () => {
  const approved = structuredClone(defaultContent)
  approved.brand.logo.url = '/uploads/11111111-1111-1111-1111-111111111111.webp'
  approved.brand.logo.alt = 'Owner-authored JP logo alt text'
  assert.equal(mergeContent(approved).brand.logo.url, approved.brand.logo.url)
  assert.equal(mergeContent(approved).brand.logo.alt, approved.brand.logo.alt)

  const blank = structuredClone(defaultContent)
  blank.brand.logo.url = ''
  assert.equal(mergeContent(blank).brand.logo.url, defaultContent.brand.logo.url)

  for (const unsafe of [
    'https://images.example/logo.webp',
    '/uploads/11111111-1111-1111-1111-111111111111.mp4',
    '/media/defaults/../private.webp',
  ]) {
    const stored = structuredClone(defaultContent)
    stored.brand.logo.url = unsafe
    assert.equal(mergeContent(stored).brand.logo.url, defaultContent.brand.logo.url)
  }
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
    content.media.gallery = Array.from({ length: 13 }, () => content.media.hero)
    assertResponseError(() => validateContent(content), 400)
  })

  await t.test('published images need alt text', () => {
    const content = structuredClone(defaultContent)
    content.media.hero.alt = ''
    assertResponseError(() => validateContent(content), 400)
  })

  await t.test('before and after images both need alt text', () => {
    const content = structuredClone(defaultContent)
    content.media.beforeAfter.after.alt = ''
    assertResponseError(() => validateContent(content), 400)
  })

  await t.test('image focus points require finite numeric coordinates from 0 to 100', () => {
    for (const focus of [undefined, null, { x: '50', y: 50 }, { x: -1, y: 50 }, { x: 50, y: 101 }, { x: Number.NaN, y: 50 }]) {
      const content = structuredClone(defaultContent)
      content.media.hero.focus = focus
      assertResponseError(() => validateContent(content), 400)
    }
    const content = structuredClone(defaultContent)
    content.media.hero.focus = { x: 0, y: 100 }
    assert.equal(validateContent(content), true)
  })

  await t.test('social links reject executable protocols', () => {
    const content = structuredClone(defaultContent)
    content.contact.tiktokUrl = 'javascript:alert(1)'
    assertResponseError(() => validateContent(content), 400)
  })

  await t.test('social and local media URLs reject spoofed hosts, credentials, traversal, and SVG', () => {
    for (const facebookUrl of [
      'https://facebook.com.evil.example/jpcuuts',
      'https://owner:secret@www.facebook.com/jpcuuts',
    ]) {
      const content = structuredClone(defaultContent)
      content.contact.facebookUrl = facebookUrl
      assertResponseError(() => validateContent(content), 400)
    }
    for (const mediaUrl of [
      '/media/defaults/../private.webp',
      '/uploads/11111111-1111-1111-1111-111111111111.svg',
      '/uploads/11111111-1111-1111-1111-111111111111.mp4',
      'https://images.example/jp.webp',
    ]) {
      const content = structuredClone(defaultContent)
      content.brand.logo.url = mediaUrl
      assertResponseError(() => validateContent(content), 400)
    }
  })

  await t.test('booking, primary Instagram, and Reel controls reject unapproved destinations', () => {
    const content = structuredClone(defaultContent)
    content.booking.url = 'https://example.com/book'
    assertResponseError(() => validateContent(content), 400)
    content.booking.url = defaultContent.booking.url
    content.contact.instagramUrl = 'https://www.instagram.com/wrongbarber/'
    assertResponseError(() => validateContent(content), 400)
    content.contact.instagramUrl = defaultContent.contact.instagramUrl
    content.featured.url = 'https://evil.example/reel/WrongReel/'
    assertResponseError(() => validateContent(content), 400)
    content.featured.url = defaultContent.featured.url
    content.featured.type = 'video'
    assertResponseError(() => validateContent(content), 400)
    content.featured.type = 'instagram'
    content.featured.enabled = true
    content.featured.url = 'https://www.instagram.com/reel/AnotherOwnerChoice/'
    assert.equal(validateContent(content), true)
  })

  await t.test('additional or repriced services are rejected', () => {
    const content = structuredClone(defaultContent)
    content.services[0].price = '$40'
    assertResponseError(() => validateContent(content), 400)
    content.services = [...defaultContent.services, { id: 'other', name: 'Other', price: '$10', duration: '', note: '', enabled: true }]
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

test('unauthenticated visitors receive only the login shell while APIs and media fail closed', async () => {
  for (const path of ['/', '/assets/index-abc123.js', '/admin/']) {
    const bindings = untouchedBindings()
    const response = await handleRequest(new Request(`https://numbered.test${path}`), bindings.env)
    const html = await response.text()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains')
    assert.match(response.headers.get('content-type'), /^text\/html/)
    assert.match(html, /Private preview/)
    assert.match(html, /Sign in with your email address and password/)
    assert.match(html, /<form[^>]+action="\/login\/"/)
    assert.match(html, new RegExp(`name="next" type="hidden" value="${path === '/admin/' ? '/admin/' : '/'}"`))
    assert.doesNotMatch(html, /email.{0,20}(?:OTP|code)/i)
    assert.deepEqual(bindings.calls, { assets: 0, db: 0, media: 0 })
  }

  for (const path of ['/api/content', '/uploads/11111111-1111-1111-1111-111111111111.jpg']) {
    const bindings = untouchedBindings()
    const response = await handleRequest(new Request(`https://numbered.test${path}`), bindings.env)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(bindings.calls, { assets: 0, db: 0, media: 0 })
  }
})

test('configured production hosts expose only the public site, content, media, and contact entry point', async () => {
  const publishedKey = '11111111-1111-1111-1111-111111111111.jpg'
  const unpublishedKey = '22222222-2222-2222-2222-222222222222.jpg'
  const publishedContent = structuredClone(defaultContent)
  publishedContent.brand.logo.url = `/uploads/${publishedKey}`
  const env = authenticatedEnv(publishedContent, { session: false })
  env.PUBLIC_SITE_HOSTS = 'numbered.test,www.numbered.test'
  const media = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])
  const mediaObject = {
    body: media,
    size: media.byteLength,
    httpMetadata: { contentType: 'image/jpeg' },
    writeHttpMetadata(headers) { headers.set('content-type', 'image/jpeg') },
  }
  env.MEDIA = {
    async head() { return mediaObject },
    async get() { return mediaObject },
    async put() {},
  }

  const homepage = await handleRequest(new Request('https://numbered.test/'), env)
  assert.equal(homepage.status, 200)
  assert.equal(await homepage.text(), 'site')
  assert.equal(homepage.headers.get('x-robots-tag'), null)

  const content = await handleRequest(new Request('https://numbered.test/api/content'), env)
  assert.equal(content.status, 200)
  assert.equal((await content.json()).content.brand.logo.url, `/uploads/${publishedKey}`)

  const publishedMedia = await handleRequest(new Request(`https://numbered.test/uploads/${publishedKey}`), env)
  assert.equal(publishedMedia.status, 200)
  assert.equal(publishedMedia.headers.get('content-type'), 'image/jpeg')
  assert.deepEqual(new Uint8Array(await publishedMedia.arrayBuffer()), media)
  const unpublishedMedia = await handleRequest(new Request(`https://numbered.test/uploads/${unpublishedKey}`), env)
  assert.equal(unpublishedMedia.status, 404)

  for (const path of ['/admin/', '/admin/content']) {
    const adminPage = await handleRequest(new Request(`https://numbered.test${path}`), env)
    assert.equal(adminPage.status, 200)
    assert.match(await adminPage.text(), /Private preview/)
  }
  for (const [path, method] of [
    ['/api/session', 'GET'], ['/api/admin/content', 'GET'], ['/api/admin/content', 'PUT'],
    ['/api/admin/media', 'POST'], ['/api/admin/users', 'POST'], ['/api/change-password', 'POST'],
  ]) {
    const response = await handleRequest(new Request(`https://numbered.test${path}`, {
      method,
      headers: method === 'GET' ? {} : { origin: 'https://numbered.test' },
    }), env)
    assert.equal(response.status, 401, `${method} ${path}`)
  }

  const unlistedHost = await handleRequest(new Request('https://preview.numbered.test/'), env)
  assert.match(await unlistedHost.text(), /Private preview/)
  assert.equal(unlistedHost.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')
  const spoofedHost = await handleRequest(new Request('https://numbered.test.evil/'), env)
  assert.match(await spoofedHost.text(), /Private preview/)
})

test('login exposes an emailed forgot-password flow without account disclosure', async () => {
  const login = await handleRequest(new Request('https://numbered.test/login/'), untouchedBindings().env)
  const loginHtml = await login.text()
  assert.equal(login.status, 200)
  assert.match(loginHtml, /href="\/forgot-password\/"/)
  assert.match(loginHtml, /Forgot password\?/)

  const recovery = await handleRequest(new Request('https://numbered.test/forgot-password/'), untouchedBindings().env)
  const recoveryHtml = await recovery.text()
  assert.equal(recovery.status, 200)
  assert.match(recoveryHtml, /Reset your password/)
  assert.match(recoveryHtml, /name="email"/)
  assert.match(recoveryHtml, /type="email"/)
  assert.doesNotMatch(recoveryHtml, /name="code"/)

  const bindings = resetRequestEnv()
  const pending = []
  const requested = await handleRequest(new Request('https://numbered.test/forgot-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': '203.0.113.7' },
    body: new URLSearchParams({ email: 'skidmore@parabolos.com' }),
  }), bindings.env, { waitUntil(promise) { pending.push(promise) } })
  const requestedHtml = await requested.text()
  assert.equal(requested.status, 200)
  assert.match(requestedHtml, /If an account exists for that address/)
  assert.doesNotMatch(requestedHtml, /skidmore@parabolos\.com/)
  await Promise.all(pending)
  assert.equal(bindings.state.sent.length, 1)
  assert.equal(bindings.state.sent[0].subject, 'Reset your JP Cuts password')
  assert.match(bindings.state.sent[0].text, /\/reset-password\/#token=[A-Za-z0-9_-]{40,}/)
  assert.doesNotMatch(bindings.state.sent[0].text, /\?token=/)
  assert.equal(bindings.state.invites.length, 1)
  assert.doesNotMatch(bindings.state.invites[0].tokenHash, /[./]/)

  const repeatPending = []
  const repeated = await handleRequest(new Request('https://numbered.test/forgot-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': '203.0.113.7' },
    body: new URLSearchParams({ email: 'skidmore@parabolos.com' }),
  }), bindings.env, { waitUntil(promise) { repeatPending.push(promise) } })
  assert.equal(await repeated.text(), requestedHtml)
  await Promise.all(repeatPending)
  assert.equal(bindings.state.sent.length, 1)
  assert.equal(bindings.state.invites.length, 1)

  const missingBindings = resetRequestEnv({ userExists: false })
  const missingPending = []
  const missing = await handleRequest(new Request('https://numbered.test/forgot-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': '203.0.113.8' },
    body: new URLSearchParams({ email: 'missing@example.com' }),
  }), missingBindings.env, { waitUntil(promise) { missingPending.push(promise) } })
  assert.equal(missing.status, requested.status)
  assert.equal(await missing.text(), requestedHtml)
  await Promise.all(missingPending)
  assert.equal(missingBindings.state.sent.length, 0)
})

test('reset links keep tokens out of requests and response HTML', async () => {
  const page = await handleRequest(new Request('https://numbered.test/reset-password/'), untouchedBindings().env)
  const html = await page.text()
  assert.equal(page.status, 200)
  assert.match(html, /Choose a new password/)
  assert.match(html, /name="code" type="hidden"/)
  assert.match(html, /src="\/reset-password-script\.js"/)
  assert.equal(page.headers.get('referrer-policy'), 'same-origin')

  const script = await handleRequest(new Request('https://numbered.test/reset-password-script.js'), untouchedBindings().env)
  const javascript = await script.text()
  assert.equal(script.status, 200)
  assert.match(javascript, /location\.hash/)
  assert.match(javascript, /history\.replaceState/)
  assert.equal(script.headers.get('cache-control'), 'private, no-store')

  const secret = 'never-echo-this-reset-token-12345678901234567890'
  const invalid = await handleRequest(new Request('https://numbered.test/reset-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: secret, password: 'short', confirmation: 'short' }),
  }), inviteEnv())
  assert.equal(invalid.status, 400)
  assert.doesNotMatch(await invalid.text(), new RegExp(secret))
})

test('public event contact form delivers plain text server-side without exposing the destination address', async () => {
  const bindings = resetRequestEnv()
  bindings.env.PUBLIC_SITE_HOSTS = 'numbered.test'
  const response = await handleRequest(new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: {
      origin: 'https://numbered.test',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.30',
    },
    body: JSON.stringify({
      name: 'Taylor Smith',
      email: 'taylor@example.com',
      organization: 'Lipscomb team',
      eventDate: '2026-10-03',
      details: 'We need cuts for six people before a team event.',
      website: '',
      startedAt: Date.now() - 5_000,
    }),
  }), bindings.env)
  const body = await response.text()

  assert.equal(response.status, 200)
  assert.equal(body, '{"ok":true}')
  assert.doesNotMatch(body, /jp@jpcuuts\.com/)
  assert.equal(bindings.state.sent.length, 1)
  assert.deepEqual(bindings.state.sent[0].to, ['jp@jpcuuts.com'])
  assert.equal(bindings.state.sent[0].reply_to, 'taylor@example.com')
  assert.match(bindings.state.sent[0].text, /Lipscomb team/)
  assert.match(bindings.state.sent[0].text, /six people/)
})

test('event contact form reports provider failure without claiming delivery', async () => {
  const bindings = resetRequestEnv()
  bindings.env.EMAIL_TRANSPORT.send = async (message) => {
    bindings.state.sent.push(message)
    return { sent: false }
  }
  const response = await handleRequest(new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: {
      origin: 'https://numbered.test',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.32',
      cookie: sessionCookie,
    },
    body: JSON.stringify({
      name: 'Taylor Smith',
      email: 'taylor@example.com',
      organization: '',
      eventDate: '',
      details: 'A complete event inquiry.',
      website: '',
      startedAt: Date.now() - 5_000,
    }),
  }), bindings.env)

  assert.equal(response.status, 502)
  assert.match(await response.text(), /Message could not be sent/)
  assert.equal(bindings.state.sent.length, 1)
})

test('event contact form rejects cross-origin, rushed, hostile, and repeated submissions while silently accepting the honeypot', async () => {
  const payload = {
    name: 'Taylor Smith', email: 'taylor@example.com', organization: '', eventDate: '',
    details: 'A complete event inquiry.', website: '', startedAt: Date.now() - 5_000,
  }

  const crossOrigin = await handleRequest(new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }), untouchedBindings().env)
  assert.equal(crossOrigin.status, 403)

  const unauthenticated = await handleRequest(new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }), untouchedBindings().env)
  assert.equal(unauthenticated.status, 401)

  const rushedBindings = resetRequestEnv()
  const rushed = await handleRequest(new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ ...payload, startedAt: Date.now() }),
  }), rushedBindings.env)
  assert.equal(rushed.status, 400)
  assert.equal(rushedBindings.state.sent.length, 0)

  const hostileBindings = resetRequestEnv()
  const hostile = await handleRequest(new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ ...payload, name: '<script>alert(1)</script>' }),
  }), hostileBindings.env)
  assert.equal(hostile.status, 400)
  assert.equal(hostileBindings.state.sent.length, 0)

  for (const poisoned of [
    { name: 'Taylor\r\nBcc: attacker@example.com' },
    { organization: 'Team\nBcc: attacker@example.com' },
  ]) {
    const headerBindings = resetRequestEnv()
    const response = await handleRequest(new Request('https://numbered.test/api/contact', {
      method: 'POST',
      headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
      body: JSON.stringify({ ...payload, ...poisoned }),
    }), headerBindings.env)
    assert.equal(response.status, 400)
    assert.equal(headerBindings.state.sent.length, 0)
  }

  const honeypotBindings = resetRequestEnv()
  const honeypot = await handleRequest(new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ ...payload, website: 'https://spam.example' }),
  }), honeypotBindings.env)
  assert.equal(honeypot.status, 200)

  const repeatedBindings = resetRequestEnv()
  const request = () => new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.31', cookie: sessionCookie },
    body: JSON.stringify(payload),
  })
  assert.equal((await handleRequest(request(), repeatedBindings.env)).status, 200)
  assert.equal((await handleRequest(request(), repeatedBindings.env)).status, 429)
  assert.equal(repeatedBindings.state.sent.length, 1)
})

test('atomic admission bounds concurrent login, reset, and contact fan-out', async () => {
  const sameLoginEnv = resetRequestEnv({ userExists: false })
  const sameLogin = await Promise.all(Array.from({ length: 20 }, () => handleRequest(new Request('https://numbered.test/api/login', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.70' },
    body: JSON.stringify({ email: 'missing@example.com', password: 'wrong-password-123' }),
  }), sameLoginEnv.env)))
  assert.equal(sameLogin.filter((response) => response.status === 401).length, 5)
  assert.equal(sameLogin.filter((response) => response.status === 429).length, 15)

  const rotatingLoginEnv = resetRequestEnv({ userExists: false })
  const rotatingLogin = await Promise.all(Array.from({ length: 30 }, (_, index) => handleRequest(new Request('https://numbered.test/api/login', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.71' },
    body: JSON.stringify({ email: `missing-${index}@example.com`, password: 'wrong-password-123' }),
  }), rotatingLoginEnv.env)))
  assert.equal(rotatingLogin.filter((response) => response.status === 401).length, 20)
  assert.equal(rotatingLogin.filter((response) => response.status === 429).length, 10)

  const resetBindings = resetRequestEnv()
  const pending = []
  const resetResponses = await Promise.all(Array.from({ length: 50 }, () => handleRequest(new Request('https://numbered.test/forgot-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': '203.0.113.72' },
    body: new URLSearchParams({ email: 'skidmore@parabolos.com' }),
  }), resetBindings.env, { waitUntil(promise) { pending.push(promise) } })))
  await Promise.all(pending)
  assert.equal(resetResponses.every((response) => response.status === 200), true)
  assert.equal(new Set(await Promise.all(resetResponses.map((response) => response.text()))).size, 1)
  assert.equal(resetBindings.state.sent.length, 1)

  const contactBindings = resetRequestEnv()
  const contactPayload = {
    name: 'Concurrent proof', email: 'concurrent@example.com', organization: '', eventDate: '',
    details: 'One canonical submission must produce at most one delivery.', website: '', startedAt: Date.now() - 5_000,
  }
  const contactResponses = await Promise.all(Array.from({ length: 50 }, () => handleRequest(new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.73', cookie: sessionCookie },
    body: JSON.stringify(contactPayload),
  }), contactBindings.env)))
  assert.equal(contactResponses.filter((response) => response.status === 200).length, 1)
  assert.equal(contactResponses.filter((response) => response.status === 429).length, 49)
  assert.equal(contactBindings.state.sent.length, 1)
})

test('authenticated content endpoint safely returns bundled-fallback state and security headers', async () => {
  const env = authenticatedEnv()
  const response = await handleRequest(new Request('https://numbered.test/api/content', {
    headers: { cookie: sessionCookie },
  }), env)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.content, null)
  assert.equal(body.revision, 0)
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')
  assert.match(response.headers.get('content-security-policy'), /frame-src 'none'/)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains')
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('authenticated content endpoint removes forbidden fields from stored legacy content', async () => {
  const legacy = structuredClone(defaultContent)
  legacy.version = 3
  legacy.contact.email = 'jp@jpcuuts.com'
  legacy.events.actionUrl = 'mailto:jp@jpcuuts.com'
  legacy.booking.url = 'https://wrong.example/booksy'
  legacy.facts.location = 'Nashville'
  legacy.featured.url = 'https://evil.example/reel/wrong/'
  const env = authenticatedEnv(legacy)
  const response = await handleRequest(new Request('https://numbered.test/api/content', {
    headers: { cookie: sessionCookie },
  }), env)
  const body = await response.json()
  const serialized = JSON.stringify(body)

  assert.equal(response.status, 200)
  assert.equal(body.content.version, 6)
  assert.equal(body.content.booking.url, 'https://calendly.com/jpcuts/30mins')
  assert.equal(body.content.featured.url, 'https://www.instagram.com/reel/DX1nfUogdFn/')
  assert.equal(body.content.featured.enabled, false)
  assert.doesNotMatch(serialized, /jp@jpcuuts\.com|mailto:|booksy|nashville|reel\/wrong/i)
})

test('content state and revision history commit together under racing saves', async () => {
  const baseline = structuredClone(defaultContent)
  const racing = contentStateEnv({ content: baseline, revision: 9 })
  const first = structuredClone(defaultContent)
  const second = structuredClone(defaultContent)
  first.hero.headline = 'First racing save.'
  second.hero.headline = 'Second racing save.'
  const save = (content, revision = 9) => handleRequest(new Request('https://numbered.test/api/admin/content', {
    method: 'PUT',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ content, revision }),
  }), racing.env)
  const responses = await Promise.all([save(first), save(second)])
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409])
  assert.equal(racing.state.revision, 10)
  assert.equal(racing.state.history.length, 1)
  assert.equal(racing.state.history[0].revision, 10)
  const committed = JSON.parse(racing.state.contentJson)
  assert.deepEqual(committed.media.gallery.map((asset) => asset.url), baseline.media.gallery.map((asset) => asset.url))
  assert.deepEqual(committed.media.gallery.map((asset) => asset.alt), baseline.media.gallery.map((asset) => asset.alt))
  assert.deepEqual(committed.media.gallery.map((asset) => asset.focus), baseline.media.gallery.map((asset) => asset.focus))

  const failed = contentStateEnv({ content: baseline, revision: 9, failHistory: true })
  const failedResponse = await handleRequest(new Request('https://numbered.test/api/admin/content', {
    method: 'PUT',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ content: first, revision: 9 }),
  }), failed.env)
  assert.equal(failedResponse.status, 500)
  assert.equal(failed.state.revision, 9)
  assert.equal(failed.state.contentJson, JSON.stringify(baseline))
  assert.equal(failed.state.history.length, 0)

  const initial = contentStateEnv({ content: null, revision: 0 })
  const initialSave = (content) => handleRequest(new Request('https://numbered.test/api/admin/content', {
    method: 'PUT',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ content, revision: 0 }),
  }), initial.env)
  const initialResponses = await Promise.all([initialSave(first), initialSave(second)])
  assert.deepEqual(initialResponses.map((response) => response.status).sort(), [200, 409])
  assert.equal(initial.state.revision, 1)
  assert.equal(initial.state.history.length, 1)

  for (const invalidRevision of ['9', 9.5, -1, true, null]) {
    const invalid = contentStateEnv({ content: baseline, revision: 9 })
    const response = await handleRequest(new Request('https://numbered.test/api/admin/content', {
      method: 'PUT',
      headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
      body: JSON.stringify({ content: first, revision: invalidRevision }),
    }), invalid.env)
    assert.equal(response.status, 400, `revision ${JSON.stringify(invalidRevision)}`)
    assert.equal(invalid.state.revision, 9)
    assert.equal(invalid.state.history.length, 0)
  }
})

test('admin routes reject missing sessions and cross-origin mutations before parsing bodies', async () => {
  const unauthorized = await handleRequest(new Request('https://numbered.test/api/admin/content'), untouchedBindings().env)
  assert.equal(unauthorized.status, 401)

  const crossOrigin = await handleRequest(new Request('https://numbered.test/api/setup', {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: '{not-json',
  }), untouchedBindings().env)
  assert.equal(crossOrigin.status, 403)

  const crossOriginRecovery = await handleRequest(new Request('https://numbered.test/reset-password/', {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/x-www-form-urlencoded' },
    body: 'code=not-a-real-code',
  }), untouchedBindings().env)
  assert.equal(crossOriginRecovery.status, 403)

  const opaqueOriginRecovery = await handleRequest(new Request('https://numbered.test/reset-password/', {
    method: 'POST',
    headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded' },
    body: 'code=not-a-real-code',
  }), untouchedBindings().env)
  assert.equal(opaqueOriginRecovery.status, 403)

  const missingOriginRecovery = await handleRequest(new Request('https://numbered.test/reset-password/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'code=not-a-real-code',
  }), untouchedBindings().env)
  assert.equal(missingOriginRecovery.status, 403)

  const upload = await handleRequest(new Request('https://numbered.test/api/admin/media', {
    method: 'POST',
    headers: { origin: 'https://numbered.test' },
  }), untouchedBindings().env)
  assert.equal(upload.status, 401)
})

test('authorization matrix enforces revoked, forced-change, editor, and owner boundaries', async () => {
  const noSession = authenticatedEnv(null, { session: false })
  for (const [path, method] of [
    ['/api/session', 'GET'], ['/api/admin/content', 'GET'], ['/api/admin/content', 'PUT'],
    ['/api/admin/media', 'POST'], ['/api/admin/users', 'POST'], ['/uploads/11111111-1111-1111-1111-111111111111.jpg', 'GET'],
  ]) {
    const response = await handleRequest(new Request(`https://numbered.test${path}`, {
      method,
      headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
      body: ['GET', 'HEAD'].includes(method) ? undefined : '{}',
    }), noSession)
    assert.equal(response.status, 401, `${method} ${path}`)
  }

  const forced = authenticatedEnv(null, { forced: true })
  assert.equal((await handleRequest(new Request('https://numbered.test/api/session', { headers: { cookie: sessionCookie } }), forced)).status, 200)
  assert.equal((await handleRequest(new Request('https://numbered.test/api/admin/content', { headers: { cookie: sessionCookie } }), forced)).status, 403)
  assert.equal((await handleRequest(new Request('https://numbered.test/api/admin/users', {
    method: 'POST', headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie }, body: '{}',
  }), forced)).status, 403)

  const editor = authenticatedEnv(null, { role: 'editor' })
  assert.equal((await handleRequest(new Request('https://numbered.test/api/admin/content', { headers: { cookie: sessionCookie } }), editor)).status, 200)
  assert.equal((await handleRequest(new Request('https://numbered.test/api/admin/users', {
    method: 'POST', headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ email: 'new@example.com', tempPassword: 'temporary-password-123', role: 'editor' }),
  }), editor)).status, 403)

  const owner = authenticatedEnv()
  const created = await handleRequest(new Request('https://numbered.test/api/admin/users', {
    method: 'POST', headers: { origin: 'https://numbered.test', 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ email: 'new@example.com', tempPassword: 'temporary-password-123', role: 'editor' }),
  }), owner)
  assert.equal(created.status, 201)
})

test('accepted image uploads receive a centered focus point', async () => {
  const form = new FormData()
  form.append('file', new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], 'approved.jpg', { type: 'image/jpeg' }))
  form.append('alt', 'Approved image')

  const response = await handleRequest(new Request('https://numbered.test/api/admin/media', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', cookie: sessionCookie },
    body: form,
  }), authenticatedEnv())

  assert.equal(response.status, 201)
  assert.deepEqual((await response.json()).asset.focus, { x: 50, y: 50 })
})

test('authentic logo uploads accept safe raster images and reject video or disguised markup', async () => {
  const safeForm = new FormData()
  safeForm.append('file', new File([Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], 'jp-logo.png', { type: 'image/png' }))
  safeForm.append('alt', 'JP Cuts logo')
  safeForm.append('purpose', 'logo')
  const safe = await handleRequest(new Request('https://numbered.test/api/admin/media', {
    method: 'POST', headers: { origin: 'https://numbered.test', cookie: sessionCookie }, body: safeForm,
  }), authenticatedEnv())
  assert.equal(safe.status, 201)
  assert.match((await safe.json()).asset.url, /^\/uploads\/[0-9a-f-]{36}\.png$/)

  const videoForm = new FormData()
  videoForm.append('file', new File([new TextEncoder().encode('\0\0\0\0ftypisom')], 'not-a-logo.mp4', { type: 'video/mp4' }))
  videoForm.append('alt', 'JP Cuts logo')
  videoForm.append('purpose', 'logo')
  const video = await handleRequest(new Request('https://numbered.test/api/admin/media', {
    method: 'POST', headers: { origin: 'https://numbered.test', cookie: sessionCookie }, body: videoForm,
  }), authenticatedEnv())
  assert.equal(video.status, 415)

  const markupForm = new FormData()
  markupForm.append('file', new File([new TextEncoder().encode('<svg onload="alert(1)"></svg>')], 'fake.jpg', { type: 'image/jpeg' }))
  markupForm.append('alt', 'JP Cuts logo')
  markupForm.append('purpose', 'logo')
  const markup = await handleRequest(new Request('https://numbered.test/api/admin/media', {
    method: 'POST', headers: { origin: 'https://numbered.test', cookie: sessionCookie }, body: markupForm,
  }), authenticatedEnv())
  assert.equal(markup.status, 415)

  const unknownForm = new FormData()
  unknownForm.append('file', new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], 'unknown.jpg', { type: 'image/jpeg' }))
  unknownForm.append('alt', 'Unknown purpose')
  unknownForm.append('purpose', 'avatar')
  const unknown = await handleRequest(new Request('https://numbered.test/api/admin/media', {
    method: 'POST', headers: { origin: 'https://numbered.test', cookie: sessionCookie }, body: unknownForm,
  }), authenticatedEnv())
  assert.equal(unknown.status, 400)
})

test('one-time emailed recovery chooses a password, revokes sessions, and requires a fresh login', async () => {
  const env = inviteEnv()
  const body = new URLSearchParams({
    code: 'one-time-private-setup-code-with-entropy-1234567890',
    password: 'a-private-password-123',
    confirmation: 'a-private-password-123',
  })
  const claimed = await handleRequest(new Request('https://numbered.test/reset-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded' },
    body,
  }), env)

  assert.equal(claimed.status, 303)
  assert.equal(claimed.headers.get('location'), '/login/?reset=1')
  assert.equal(claimed.headers.get('set-cookie'), null)
  assert.equal(env.state.inviteUsed, true)
  assert.match(env.state.passwordHash, /^pbkdf2-sha256\$100000\$/)
  assert.equal(env.state.sessions.size, 0)

  const freshLoginPage = await handleRequest(new Request('https://numbered.test/login/?reset=1'), untouchedBindings().env)
  assert.match(await freshLoginPage.text(), /Password saved\. Sign in with it now\./)

  const replayed = await handleRequest(new Request('https://numbered.test/claim/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: 'one-time-private-setup-code-with-entropy-1234567890',
      password: 'another-private-password',
      confirmation: 'another-private-password',
    }),
  }), env)
  assert.equal(replayed.status, 401)
  assert.match(await replayed.text(), /invalid or expired/)

  const loginResponse = await handleRequest(new Request('https://numbered.test/api/login', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'skidmore@parabolos.com', password: 'a-private-password-123' }),
  }), env)
  assert.equal(loginResponse.status, 200)
  assert.equal((await loginResponse.json()).user.role, 'owner')
  assert.match(loginResponse.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/)
  assert.equal(env.state.sessions.size, 1)
})

test('the same password supports logout, repeat login, and an isolated concurrent context', async () => {
  const env = inviteEnv()
  const password = 'same-existing-password-123'
  const reset = await handleRequest(new Request('https://numbered.test/reset-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: 'one-time-private-setup-code-with-entropy-1234567890', password, confirmation: password }),
  }), env)
  assert.equal(reset.status, 303)

  const signIn = () => handleRequest(new Request('https://numbered.test/login/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': '203.0.113.50' },
    body: new URLSearchParams({ identifier: 'skidmore@parabolos.com', password }),
  }), env)
  const sessionRequest = (cookie) => handleRequest(new Request('https://numbered.test/api/session', { headers: { cookie } }), env)

  const firstLogin = await signIn()
  assert.equal(firstLogin.status, 303)
  const firstCookie = firstLogin.headers.get('set-cookie').split(';')[0]
  assert.equal((await sessionRequest(firstCookie)).status, 200)

  const logout = await handleRequest(new Request('https://numbered.test/api/logout', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', cookie: firstCookie },
  }), env)
  assert.equal(logout.status, 200)
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal((await sessionRequest(firstCookie)).status, 401)

  const secondLogin = await signIn()
  const secondCookie = secondLogin.headers.get('set-cookie').split(';')[0]
  assert.equal(secondLogin.status, 303)
  assert.notEqual(secondCookie, firstCookie)
  assert.equal((await sessionRequest(secondCookie)).status, 200)

  const isolatedLogin = await signIn()
  const isolatedCookie = isolatedLogin.headers.get('set-cookie').split(';')[0]
  assert.equal(isolatedLogin.status, 303)
  assert.notEqual(isolatedCookie, secondCookie)
  assert.equal((await sessionRequest(isolatedCookie)).status, 200)

  await handleRequest(new Request('https://numbered.test/api/logout', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', cookie: secondCookie },
  }), env)
  assert.equal((await sessionRequest(secondCookie)).status, 401)
  assert.equal((await sessionRequest(isolatedCookie)).status, 200)
})

test('successful and case-rotated logins cannot reset or evade the global IP ceiling', async () => {
  const env = inviteEnv()
  const password = 'rate-limit-password-123'
  const reset = await handleRequest(new Request('https://numbered.test/reset-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: 'one-time-private-setup-code-with-entropy-1234567890', password, confirmation: password }),
  }), env)
  assert.equal(reset.status, 303)

  const ip = '203.0.113.81'
  const login = (email, candidate) => handleRequest(new Request('https://numbered.test/api/login', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ email, password: candidate }),
  }), env)
  const rotated = ['SKIDMORE@PARABOLOS.COM', 'Skidmore@Parabolos.com', 'skidmore@parabolos.com']
  const firstSix = []
  for (let index = 0; index < 6; index += 1) firstSix.push(await login(rotated[index % rotated.length], 'wrong-password-123'))
  assert.equal(firstSix.filter((response) => response.status === 401).length, 5)
  assert.equal(firstSix.at(-1).status, 429)

  const globalEnv = inviteEnv()
  const globalReset = await handleRequest(new Request('https://numbered.test/reset-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: 'one-time-private-setup-code-with-entropy-1234567890', password, confirmation: password }),
  }), globalEnv)
  assert.equal(globalReset.status, 303)
  const globalLogin = (email, candidate) => handleRequest(new Request('https://numbered.test/api/login', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ email, password: candidate }),
  }), globalEnv)
  for (let index = 0; index < 19; index += 1) {
    assert.equal((await globalLogin(`missing-${index}@example.com`, 'wrong-password-123')).status, 401)
  }
  assert.equal((await globalLogin('skidmore@parabolos.com', password)).status, 200)
  assert.equal((await globalLogin('another-missing@example.com', 'wrong-password-123')).status, 429)
})

function authenticatedEnv(siteContent = null, { role = 'owner', forced = false, disabled = false, session = true } = {}) {
  return {
    ASSETS: { fetch: async () => new Response('site') },
    MEDIA: { head: async () => null, get: async () => null, put: async () => {} },
    DB: {
      prepare(sql) {
        return {
          bind() { return this },
          async first() {
            if (sql.includes('from admin_sessions')) {
              if (!session) return null
              return {
                token_hash: 'hash', id: 'owner-1', username: 'skidmore@parabolos.com',
                email: 'skidmore@parabolos.com', password_hash: 'unused', role,
                force_password_change: forced ? 1 : 0, disabled: disabled ? 1 : 0,
              }
            }
            if (sql.includes('from admin_users where lower')) return null
            if (sql.includes('from site_state')) return siteContent ? { content_json: JSON.stringify(siteContent), revision: 9 } : null
            throw new Error(`Unexpected query: ${sql}`)
          },
          async run() { return { meta: { changes: 1 } } },
        }
      },
    },
  }
}

function contentStateEnv({ content, revision, failHistory = false }) {
  const state = {
    contentJson: content ? JSON.stringify(content) : null,
    revision,
    history: [],
  }
  const env = {
    ASSETS: { fetch: async () => new Response('site') },
    MEDIA: { head: async () => null, get: async () => null, put: async () => {} },
    DB: {
      async batch(statements) {
        const staged = {
          contentJson: state.contentJson,
          revision: state.revision,
          history: structuredClone(state.history),
        }
        const results = []
        let priorChanges = 0
        for (const statement of statements) {
          const { sql, values } = statement
          let changes = 0
          if (sql.startsWith('insert into site_state')) {
            if (staged.contentJson === null) {
              staged.contentJson = values[0]
              staged.revision = values[1]
              changes = 1
            }
          } else if (sql.startsWith('update site_state')) {
            if (staged.contentJson !== null && staged.revision === values[4]) {
              staged.contentJson = values[0]
              staged.revision = values[1]
              changes = 1
            }
          } else if (sql.startsWith('insert into site_revisions')) {
            if (priorChanges === 1) {
              if (failHistory) throw new Error('Injected history failure')
              staged.history.push({ revision: values[0], contentJson: values[1] })
              changes = 1
            }
          } else {
            throw new Error(`Unexpected batch query: ${sql}`)
          }
          results.push({ meta: { changes } })
          priorChanges = changes
        }
        state.contentJson = staged.contentJson
        state.revision = staged.revision
        state.history = staged.history
        return results
      },
      prepare(sql) {
        const statement = {
          sql,
          values: [],
          bind(...values) { this.values = values; return this },
          async first() {
            if (sql.includes('from admin_sessions')) {
              return {
                token_hash: 'hash', id: 'owner-1', username: 'skidmore@parabolos.com',
                email: 'skidmore@parabolos.com', password_hash: 'unused', role: 'owner',
                force_password_change: 0, disabled: 0,
              }
            }
            if (sql.includes('from site_state')) return state.contentJson === null ? null : { content_json: state.contentJson, revision: state.revision }
            throw new Error(`Unexpected query: ${sql}`)
          },
          async run() { throw new Error(`Unexpected direct run: ${sql}`) },
        }
        return statement
      },
    },
  }
  return { env, state }
}

function resetRequestEnv({ userExists = true } = {}) {
  const state = { sent: [], invites: [], limits: new Map() }
  const user = {
    id: 'owner-1', username: 'skidmore@parabolos.com', email: 'skidmore@parabolos.com',
    password_hash: 'unused', role: 'owner', force_password_change: 1, disabled: 0,
  }
  const env = {
    PUBLIC_ORIGIN: 'https://numbered.test',
    RESET_EMAIL_FROM: 'JP Cuts <jpcuuts@parabolos.com>',
    CONTACT_EMAIL_TO: 'jp@jpcuuts.com',
    EMAIL_TRANSPORT: {
      async send(message) { state.sent.push(message); return { sent: true, id: 'email-1' } },
    },
    ASSETS: { fetch: async () => new Response('site') },
    MEDIA: { head: async () => null, get: async () => null },
    DB: {
      async batch(statements) { return Promise.all(statements.map((statement) => statement.run())) },
      prepare(sql) {
        let values = []
        return {
          bind(...nextValues) { values = nextValues; return this },
          async first() {
            if (sql.startsWith('insert into password_reset_limits')) return reserveLimit(state.limits, values)
            if (sql.includes('from admin_sessions')) return { ...user, force_password_change: 0, token_hash: 'hash' }
            if (sql.includes('from admin_users where lower')) return userExists ? user : null
            throw new Error(`Unexpected query: ${sql}`)
          },
          async run() {
            if (sql.startsWith('delete from password_reset_limits')) state.limits.delete(values[0])
            if (sql.startsWith('insert into password_invites')) {
              state.invites.push({ id: values[0], userId: values[1], tokenHash: values[2], expiresAt: values[3] })
            }
            return { meta: { changes: 1 } }
          },
        }
      },
    },
  }
  return { env, state }
}

function inviteEnv() {
  const state = { inviteUsed: false, passwordHash: '', sessions: new Map(), limits: new Map() }
  const user = {
    id: 'owner-1', username: 'skidmore@parabolos.com', email: 'skidmore@parabolos.com',
    password_hash: '', role: 'owner', force_password_change: 1, disabled: 0,
  }
  return {
    state,
    ASSETS: { fetch: async () => new Response('site') },
    MEDIA: { head: async () => null, get: async () => null },
    DB: {
      async batch(statements) {
        return Promise.all(statements.map((statement) => statement.run()))
      },
      prepare(sql) {
        let values = []
        return {
          bind(...nextValues) { values = nextValues; return this },
          async first() {
            if (sql.includes('from password_invites')) {
              return state.inviteUsed ? null : { id: 'invite-1', user_id: user.id, matched_user_id: user.id, disabled: 0 }
            }
            if (sql.startsWith('insert into password_reset_limits')) return reserveLimit(state.limits, values)
            if (sql.includes('from admin_sessions')) {
              return state.sessions.has(values[0]) ? { ...user, password_hash: state.passwordHash, force_password_change: 0, token_hash: values[0] } : null
            }
            if (sql.includes('from admin_users where lower')) return { ...user, password_hash: state.passwordHash }
            if (sql.includes('from admin_users where id')) return { ...user, password_hash: state.passwordHash, force_password_change: 0 }
            throw new Error(`Unexpected query: ${sql}`)
          },
          async run() {
            if (sql.startsWith('update password_invites')) {
              if (sql.includes('where id = ? and used_at is null')) {
                if (state.inviteUsed) return { meta: { changes: 0 } }
                state.inviteUsed = true
              }
              return { meta: { changes: 1 } }
            }
            if (sql.startsWith('update admin_users set password_hash')) state.passwordHash = values[0]
            if (sql.startsWith('delete from admin_sessions')) {
              if (sql.includes('where token_hash = ?')) state.sessions.delete(values[0])
              else if (sql.includes('token_hash != ?')) {
                for (const tokenHash of state.sessions.keys()) if (tokenHash !== values[1]) state.sessions.delete(tokenHash)
              } else state.sessions.clear()
            }
            if (sql.startsWith('insert into admin_sessions')) state.sessions.set(values[2], { userId: values[1], expiresAt: values[3] })
            if (sql.startsWith('delete from password_reset_limits')) state.limits.delete(values[0])
            return { meta: { changes: 1 } }
          },
        }
      },
    },
  }
}

function reserveLimit(limits, values) {
  const [key, timestamp, , resetBefore, , , maxAttempts, cooldownBefore] = values
  const current = limits.get(key)
  const expired = !current || current.window_started < resetBefore
  if (!expired && (current.attempts >= maxAttempts || current.last_requested_at > cooldownBefore)) return null
  const next = {
    attempts: expired ? 1 : current.attempts + 1,
    window_started: expired ? timestamp : current.window_started,
    last_requested_at: timestamp,
  }
  limits.set(key, next)
  return { attempts: next.attempts }
}

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
