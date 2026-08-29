import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultContent } from '../src/siteContent.js'
import { detectMediaType, handleRequest, parseByteRange, validateContent } from './index.js'

const sessionToken = 'test-session-token-with-enough-entropy'
const sessionCookie = `__Host-numbered_session=${sessionToken}`

test('bundled content passes the Worker validation contract', () => {
  assert.equal(validateContent(structuredClone(defaultContent)), true)
  assert.equal(defaultContent.contact.phone, '')
  assert.match(defaultContent.events.actionUrl, /^https:\/\//)
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

function authenticatedEnv() {
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
            if (sql.includes('from site_state')) return null
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
    RESET_EMAIL_FROM: 'Numbered <numbered@parabolos.com>',
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
