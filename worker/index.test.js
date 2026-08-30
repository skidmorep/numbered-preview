import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultContent, mergeContent } from '../src/siteContent.js'
import { detectMediaType, handleRequest, parseByteRange, validateContent } from './index.js'

const sessionToken = 'test-session-token-with-enough-entropy'
const sessionCookie = `__Host-numbered_session=${sessionToken}`

test('bundled content passes the Worker validation contract', () => {
  assert.equal(validateContent(structuredClone(defaultContent)), true)
  assert.equal(defaultContent.contact.phone, '')
  assert.equal(defaultContent.contact.email, undefined)
  assert.equal(defaultContent.events.actionUrl, undefined)
  assert.equal(defaultContent.brand.publicName, 'JP CUTS')
  assert.equal(defaultContent.booking.url, 'https://calendly.com/jpcuts/30mins')
  assert.deepEqual(defaultContent.services.map(({ name, price }) => ({ name, price })), [
    { name: 'Haircut', price: '$35' },
    { name: 'Shave or beard trim', price: '+$5' },
  ])
  assert.match(defaultContent.facts.mobile, /Middle Tennessee/)
  assert.equal(defaultContent.media.beforeAfter.enabled, true)
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
  legacy.story.body = 'Owner-authored biography.'
  legacy.media.beforeAfter.heading = 'Owner-authored comparison.'
  legacy.media.hero.alt = 'Owner-authored hero alt text'
  legacy.contact.email = 'public@example.com'
  legacy.events.actionUrl = 'mailto:public@example.com'

  const migrated = mergeContent(legacy)
  assert.equal(migrated.version, 4)
  assert.equal(migrated.brand.publicName, 'JP CUTS')
  assert.match(migrated.hero.eyebrow, /Middle Tennessee/)
  assert.match(migrated.hero.intro, /Middle Tennessee/)
  assert.equal(migrated.hero.headline, 'Owner-authored headline.')
  assert.equal(migrated.booking.url, 'https://calendly.com/jpcuts/30mins')
  assert.equal(migrated.story.body, defaultContent.story.body)
  assert.equal(migrated.media.beforeAfter.heading, defaultContent.media.beforeAfter.heading)
  assert.equal(migrated.media.hero.alt, defaultContent.media.hero.alt)
  assert.equal(migrated.contact.email, undefined)
  assert.equal(migrated.events.actionUrl, undefined)
  assert.doesNotMatch(JSON.stringify(migrated), /Unused second headline/)
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

  await t.test('social links reject executable protocols', () => {
    const content = structuredClone(defaultContent)
    content.contact.tiktokUrl = 'javascript:alert(1)'
    assertResponseError(() => validateContent(content), 400)
  })

  await t.test('booking and Instagram reject unapproved destinations', () => {
    const content = structuredClone(defaultContent)
    content.booking.url = 'https://example.com/book'
    assertResponseError(() => validateContent(content), 400)
    content.booking.url = defaultContent.booking.url
    content.contact.instagramUrl = 'https://www.instagram.com/wrongbarber/'
    assertResponseError(() => validateContent(content), 400)
    content.contact.instagramUrl = defaultContent.contact.instagramUrl
    content.featured.url = 'https://www.instagram.com/reel/WrongReel/'
    assertResponseError(() => validateContent(content), 400)
    content.featured.url = defaultContent.featured.url
    content.featured.type = 'video'
    assertResponseError(() => validateContent(content), 400)
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
    assert.match(response.headers.get('content-type'), /^text\/html/)
    assert.match(html, /Private preview/)
    assert.match(html, /Sign in with your email address and password/)
    assert.doesNotMatch(html, /email.{0,20}(?:OTP|code)/i)
    assert.deepEqual(bindings.calls, { assets: 0, db: 0, media: 0 })
  }

  for (const path of ['/api/content', '/uploads/11111111-1111-1111-1111-111111111111.jpg']) {
    const bindings = untouchedBindings()
    const response = await handleRequest(new Request(`https://numbered.test${path}`), bindings.env)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(bindings.calls, { assets: 0, db: 0, media: 0 })
  }
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
  assert.equal(script.headers.get('cache-control'), 'no-store')

  const secret = 'never-echo-this-reset-token-12345678901234567890'
  const invalid = await handleRequest(new Request('https://numbered.test/reset-password/', {
    method: 'POST',
    headers: { origin: 'https://numbered.test', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: secret, password: 'short', confirmation: 'short' }),
  }), inviteEnv())
  assert.equal(invalid.status, 400)
  assert.doesNotMatch(await invalid.text(), new RegExp(secret))
})

test('event contact form delivers plain text server-side without exposing the destination address', async () => {
  const bindings = resetRequestEnv()
  const response = await handleRequest(new Request('https://numbered.test/api/contact', {
    method: 'POST',
    headers: {
      origin: 'https://numbered.test',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.30',
      cookie: sessionCookie,
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
  assert.match(response.headers.get('content-security-policy'), /frame-src https:\/\/www\.instagram\.com/)
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('authenticated content endpoint removes forbidden fields from stored legacy content', async () => {
  const legacy = structuredClone(defaultContent)
  legacy.version = 3
  legacy.contact.email = 'jp@jpcuuts.com'
  legacy.events.actionUrl = 'mailto:jp@jpcuuts.com'
  legacy.booking.url = 'https://wrong.example/booksy'
  legacy.facts.location = 'Nashville'
  legacy.featured.url = 'https://www.instagram.com/reel/wrong/'
  const env = authenticatedEnv(legacy)
  const response = await handleRequest(new Request('https://numbered.test/api/content', {
    headers: { cookie: sessionCookie },
  }), env)
  const body = await response.json()
  const serialized = JSON.stringify(body)

  assert.equal(response.status, 200)
  assert.equal(body.content.version, 4)
  assert.equal(body.content.booking.url, 'https://calendly.com/jpcuts/30mins')
  assert.equal(body.content.featured.url, 'https://www.instagram.com/reel/DX1nfUogdFn/')
  assert.doesNotMatch(serialized, /jp@jpcuuts\.com|mailto:|booksy|nashville|reel\/wrong/i)
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
  assert.equal(env.state.sessionCount, 0)

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
  assert.equal(env.state.sessionCount, 1)
})

function authenticatedEnv(siteContent = null) {
  return {
    ASSETS: { fetch: async () => new Response('site') },
    MEDIA: { head: async () => null, get: async () => null },
    DB: {
      prepare(sql) {
        return {
          bind() { return this },
          async first() {
            if (sql.includes('from admin_sessions')) {
              return {
                token_hash: 'hash', id: 'owner-1', username: 'skidmore@parabolos.com',
                email: 'skidmore@parabolos.com', password_hash: 'unused', role: 'owner',
                force_password_change: 0, disabled: 0,
              }
            }
            if (sql.includes('from site_state')) return siteContent ? { content_json: JSON.stringify(siteContent), revision: 9 } : null
            throw new Error(`Unexpected query: ${sql}`)
          },
        }
      },
    },
  }
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
            if (sql.includes('from password_reset_limits')) return state.limits.get(values[0]) || null
            if (sql.includes('from admin_sessions')) return { ...user, force_password_change: 0, token_hash: 'hash' }
            if (sql.includes('from admin_users where lower')) return userExists ? user : null
            throw new Error(`Unexpected query: ${sql}`)
          },
          async run() {
            if (sql.startsWith('insert into password_reset_limits')) {
              state.limits.set(values[0], { attempts: values[1], window_started: values[2], last_requested_at: values[3] })
            }
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
  const state = { inviteUsed: false, passwordHash: '', sessionCount: 0 }
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
            if (sql.includes('from login_attempts')) return null
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
            if (sql.startsWith('delete from admin_sessions')) state.sessionCount = 0
            if (sql.startsWith('insert into admin_sessions')) state.sessionCount += 1
            return { meta: { changes: 1 } }
          },
        }
      },
    },
  }
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
