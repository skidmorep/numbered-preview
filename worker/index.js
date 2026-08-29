const SESSION_COOKIE = '__Host-numbered_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const RESET_TTL_SECONDS = 30 * 60
// Cloudflare Workers caps PBKDF2 at 100,000 iterations.
const PASSWORD_ITERATIONS = 100000
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_LOGIN_ATTEMPTS = 5
const RESET_WINDOW_MS = 60 * 60 * 1000
const RESET_COOLDOWN_MS = 60 * 1000
const MAX_RESET_EMAIL_REQUESTS = 3
const MAX_RESET_IP_REQUESTS = 10
const MAX_CONTENT_BYTES = 80_000
const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const MAX_VIDEO_BYTES = 15 * 1024 * 1024

const mediaTypes = {
  'image/jpeg': { extension: 'jpg', kind: 'image', maxBytes: MAX_IMAGE_BYTES },
  'image/png': { extension: 'png', kind: 'image', maxBytes: MAX_IMAGE_BYTES },
  'image/webp': { extension: 'webp', kind: 'image', maxBytes: MAX_IMAGE_BYTES },
  'image/avif': { extension: 'avif', kind: 'image', maxBytes: MAX_IMAGE_BYTES },
  'video/mp4': { extension: 'mp4', kind: 'video', maxBytes: MAX_VIDEO_BYTES },
  'video/webm': { extension: 'webm', kind: 'video', maxBytes: MAX_VIDEO_BYTES },
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context)
  },
}

export async function handleRequest(request, env, context) {
  const url = new URL(request.url)

  try {
    if (request.method === 'OPTIONS') return finalize(new Response(null, { status: 204 }))
    const route = `${request.method} ${url.pathname.replace(/\/$/, '') || '/'}`
    const routes = {
      'GET /login': () => loginPage('', 200, url.searchParams.get('reset') === '1' ? 'Password saved. Sign in with it now.' : ''),
      'POST /login': () => browserLogin(request, env),
      'GET /claim': () => claimPage(),
      'POST /claim': () => claimPassword(request, env, { renderPage: claimPage, invalidMessage: 'That recovery code is invalid or expired' }),
      'GET /forgot-password': () => forgotPasswordPage(),
      'POST /forgot-password': () => requestPasswordReset(request, env, context),
      'GET /reset-password': () => resetPasswordPage(),
      'POST /reset-password': () => claimPassword(request, env, { renderPage: resetPasswordPage, invalidMessage: 'This reset link is no longer valid. Request a new link.' }),
      'GET /reset-password-script.js': () => resetPasswordScript(),
      'GET /api/content': () => getPublicContent(request, env),
      'POST /api/setup': () => setup(request, env),
      'POST /api/login': () => login(request, env),
      'POST /api/change-password': () => changePassword(request, env),
      'POST /api/logout': () => logout(request, env),
      'GET /api/session': () => session(request, env),
      'GET /api/admin/content': () => getAdminContent(request, env),
      'PUT /api/admin/content': () => updateContent(request, env),
      'POST /api/admin/media': () => uploadMedia(request, env),
      'POST /api/admin/users': () => createUser(request, env),
    }

    if (routes[route]) return finalize(await routes[route]())
    if (url.pathname.startsWith('/api/')) return finalize(json({ error: 'Not found' }, 404))
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/uploads/')) {
      await requireSession(request, env)
      return finalize(await serveMedia(request, env, url.pathname.slice('/uploads/'.length)))
    }

    const auth = await sessionOrLoginPage(request, env)
    if (auth instanceof Response) return finalize(auth)
    if (auth.user.force_password_change && !url.pathname.startsWith('/admin')) {
      return finalize(new Response(null, { status: 302, headers: { location: '/admin/' } }))
    }
    const assetRequest = new Request(request)
    assetRequest.headers.delete('authorization')
    return finalize(await env.ASSETS.fetch(assetRequest))
  } catch (error) {
    if (error instanceof Response) return finalize(error)
    console.error('numbered-preview request failed', error?.name || 'Error', error?.message || '', error?.stack || '')
    return finalize(json({ error: 'Internal server error' }, 500))
  }
}

async function sessionOrLoginPage(request, env) {
  try { return await requireSession(request, env, { allowForced: true }) }
  catch (error) {
    if (!(error instanceof Response) || error.status !== 401) throw error
    if (request.method !== 'GET' && request.method !== 'HEAD') return error
    return loginPage()
  }
}

async function getPublicContent(request, env) {
  await requireSession(request, env)
  const state = await readSiteState(env)
  return json({ content: state?.content || null, revision: state?.revision || 0 }, 200, { 'cache-control': 'no-store' })
}

async function setup(request, env) {
  assertMutationOrigin(request)
  const body = await readJson(request, 4_000)
  await requireSetupToken(body.setupToken, env)
  const existing = await env.DB.prepare('select id from admin_users where role = ? limit 1').bind('owner').first()
  if (existing) throw responseError('Owner account is already configured', 409)

  const email = requireEmail(env.INITIAL_ADMIN_EMAIL || 'skidmore@parabolos.com')
  const password = requirePassword(body.tempPassword)
  const passwordHash = await hashPassword(password)
  const now = nowIso()
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `insert into admin_users
      (id, username, email, password_hash, role, force_password_change, disabled, created_at, updated_at)
      values (?, ?, ?, ?, 'owner', 1, 0, ?, ?)`,
  ).bind(id, email, email, passwordHash, now, now).run()
  return json({ ok: true, user: { id, email, username: email, role: 'owner', mustChangePassword: true } })
}

async function login(request, env) {
  assertMutationOrigin(request)
  const body = await readJson(request, 4_000)
  const identifier = String(body.email || body.username || '').trim().toLowerCase()
  const password = String(body.password || '')
  const authenticated = await authenticate(request, env, identifier, password)
  return json({ ok: true, user: publicUser(authenticated.user) }, 200, { 'set-cookie': sessionCookie(authenticated.token, SESSION_TTL_SECONDS) })
}

async function authenticate(request, env, identifier, password) {
  if (!identifier || !password) throw responseError('Email and password are required', 400)
  if (password.length > 128) throw responseError('Invalid credentials', 401)

  const attemptKey = await sha256Base64(`${clientIp(request)}|${identifier}`)
  await enforceLoginThrottle(env, attemptKey)
  const user = await findUser(env, identifier)
  if (!user || user.disabled || !(await verifyPassword(password, user.password_hash))) {
    await recordFailedLogin(env, attemptKey)
    throw responseError('Invalid credentials', 401)
  }

  await env.DB.prepare('delete from login_attempts where key = ?').bind(attemptKey).run()
  return createSession(env, user)
}

async function createSession(env, user) {
  const token = randomToken()
  const tokenHash = await sha256Base64(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
  await env.DB.prepare(
    'insert into admin_sessions (id, user_id, token_hash, expires_at, created_at) values (?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), user.id, tokenHash, expiresAt, nowIso()).run()
  return { token, user }
}

async function browserLogin(request, env) {
  assertMutationOrigin(request)
  try {
    const form = await readForm(request, 4_000)
    const identifier = String(form.get('identifier') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    const authenticated = await authenticate(request, env, identifier, password)
    const destination = authenticated.user.force_password_change ? '/admin/' : '/'
    return new Response(null, {
      status: 303,
      headers: { location: destination, 'set-cookie': sessionCookie(authenticated.token, SESSION_TTL_SECONDS) },
    })
  } catch (error) {
    if (!(error instanceof Response)) throw error
    const message = await error.json().then((body) => body.error).catch(() => 'Sign-in failed')
    return loginPage(message, error.status)
  }
}

async function requestPasswordReset(request, env, context) {
  assertMutationOrigin(request)
  try {
    const form = await readForm(request, 4_000)
    const email = requireEmail(form.get('email'))
    const work = processPasswordResetRequest(request, env, email)
    if (context?.waitUntil) context.waitUntil(work)
    else await work
    return passwordResetRequestedPage()
  } catch (error) {
    if (!(error instanceof Response)) throw error
    const message = await error.json().then((body) => body.error).catch(() => 'Enter a complete email address.')
    return forgotPasswordPage(message === 'A valid email is required' ? 'Enter a complete email address.' : message, error.status)
  }
}

async function processPasswordResetRequest(request, env, email) {
  try {
    if (!(await allowPasswordResetRequest(request, env, email))) return
    if (!env.RESEND_API_KEY && !env.EMAIL_TRANSPORT) {
      console.error('password reset email unavailable', 'mail_configuration_missing')
      return
    }

    const user = await findUser(env, email)
    if (!user || user.disabled) return

    const token = randomToken()
    const tokenHash = await sha256Base64(token)
    const inviteId = crypto.randomUUID()
    const now = nowIso()
    const expiresAt = new Date(Date.now() + RESET_TTL_SECONDS * 1000).toISOString()
    const supersededMarker = `${now}#superseded#${crypto.randomUUID()}`
    await env.DB.batch([
      env.DB.prepare(
        'update password_invites set used_at = ? where user_id = ? and used_at is null',
      ).bind(supersededMarker, user.id),
      env.DB.prepare(
        'insert into password_invites (id, user_id, token_hash, expires_at, used_at, created_at) values (?, ?, ?, ?, null, ?)',
      ).bind(inviteId, user.id, tokenHash, expiresAt, now),
    ])

    const sent = await sendPasswordResetEmail(env, { email: user.email, token, inviteId })
    if (!sent) {
      await env.DB.prepare(
        'update password_invites set used_at = ? where id = ? and used_at is null',
      ).bind(`${nowIso()}#delivery-failed`, inviteId).run()
      console.error('password reset email delivery failed', 'provider_rejected')
    }
  } catch (error) {
    console.error('password reset request failed', error?.name || 'Error')
  }
}

async function allowPasswordResetRequest(request, env, email) {
  const now = Date.now()
  const emailKey = `email:${await sha256Base64(email)}`
  const ipKey = `ip:${await sha256Base64(clientIp(request))}`
  const [emailLimit, ipLimit] = await Promise.all([
    env.DB.prepare('select attempts, window_started, last_requested_at from password_reset_limits where key = ?').bind(emailKey).first(),
    env.DB.prepare('select attempts, window_started, last_requested_at from password_reset_limits where key = ?').bind(ipKey).first(),
  ])
  const emailState = nextResetLimit(emailLimit, now)
  const ipState = nextResetLimit(ipLimit, now)
  const emailCoolingDown = emailLimit?.last_requested_at && Date.parse(emailLimit.last_requested_at) > now - RESET_COOLDOWN_MS
  const allowed = !emailCoolingDown && emailState.attempts <= MAX_RESET_EMAIL_REQUESTS && ipState.attempts <= MAX_RESET_IP_REQUESTS

  await env.DB.batch([
    resetLimitStatement(env, emailKey, emailState),
    resetLimitStatement(env, ipKey, ipState),
  ])
  return allowed
}

function nextResetLimit(row, now) {
  const expired = !row || Date.parse(row.window_started) < now - RESET_WINDOW_MS
  return {
    attempts: expired ? 1 : Number(row.attempts) + 1,
    windowStarted: expired ? new Date(now).toISOString() : row.window_started,
    lastRequestedAt: new Date(now).toISOString(),
  }
}

function resetLimitStatement(env, key, state) {
  return env.DB.prepare(
    `insert into password_reset_limits (key, attempts, window_started, last_requested_at)
      values (?, ?, ?, ?) on conflict(key) do update set
      attempts = excluded.attempts, window_started = excluded.window_started,
      last_requested_at = excluded.last_requested_at`,
  ).bind(key, state.attempts, state.windowStarted, state.lastRequestedAt)
}

async function sendPasswordResetEmail(env, { email, token, inviteId }) {
  const origin = passwordResetOrigin(env)
  const resetUrl = `${origin}/reset-password/#token=${token}`
  const message = {
    from: env.RESET_EMAIL_FROM || 'Numbered <numbered@parabolos.com>',
    to: [email],
    subject: 'Reset your Numbered password',
    text: `Use this link to choose a new Numbered password:\n\n${resetUrl}\n\nThis link expires in 30 minutes and works once. If you did not request this, you can ignore this email.`,
  }
  if (env.EMAIL_TRANSPORT) return Boolean((await env.EMAIL_TRANSPORT.send(message))?.sent)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': `numbered-reset/${inviteId}`,
    },
    body: JSON.stringify(message),
  })
  return response.ok
}

function passwordResetOrigin(env) {
  const origin = new URL(env.PUBLIC_ORIGIN || 'https://numbered-preview-dev.skidmore.workers.dev')
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Invalid password reset origin configuration')
  }
  return origin.origin
}

async function claimPassword(request, env, { renderPage, invalidMessage }) {
  assertMutationOrigin(request)
  try {
    const form = await readForm(request, 5_000)
    const token = String(form.get('code') || '').trim()
    const password = requirePassword(form.get('password'))
    if (password !== String(form.get('confirmation') || '')) throw responseError('Passwords do not match', 400)
    if (token.length < 32 || token.length > 256) throw responseError(invalidMessage, 401)

    const tokenHash = await sha256Base64(token)
    const now = nowIso()
    const invite = await env.DB.prepare(
      `select i.id, i.user_id, u.id as matched_user_id, u.disabled
        from password_invites i join admin_users u on u.id = i.user_id
        where i.token_hash = ? and i.used_at is null and i.expires_at > ? limit 1`,
    ).bind(tokenHash, now).first()
    if (!invite || invite.disabled || invite.user_id !== invite.matched_user_id) {
      throw responseError(invalidMessage, 401)
    }

    const usedMarker = `${now}#${crypto.randomUUID()}`
    const passwordHash = await hashPassword(password)
    const results = await env.DB.batch([
      env.DB.prepare(
        'update password_invites set used_at = ? where id = ? and used_at is null',
      ).bind(usedMarker, invite.id),
      env.DB.prepare(
        `update admin_users set password_hash = ?, force_password_change = 0, updated_at = ?
          where id = ? and disabled = 0 and exists (
            select 1 from password_invites where id = ? and user_id = ? and used_at = ?
          )`,
      ).bind(passwordHash, now, invite.user_id, invite.id, invite.user_id, usedMarker),
      env.DB.prepare(
        `delete from admin_sessions where user_id = ? and exists (
          select 1 from password_invites where id = ? and user_id = ? and used_at = ?
        )`,
      ).bind(invite.user_id, invite.id, invite.user_id, usedMarker),
      env.DB.prepare(
        'update password_invites set used_at = ? where user_id = ? and id != ? and used_at is null',
      ).bind(usedMarker, invite.user_id, invite.id),
    ])
    if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) {
      throw responseError(invalidMessage, 401)
    }
    return new Response(null, {
      status: 303,
      headers: { location: '/login/?reset=1' },
    })
  } catch (error) {
    if (!(error instanceof Response)) throw error
    const message = await error.json().then((body) => body.error).catch(() => 'We could not reset your password. Try again.')
    return renderPage(message, error.status)
  }
}

async function changePassword(request, env) {
  assertMutationOrigin(request)
  const auth = await requireSession(request, env, { allowForced: true })
  const body = await readJson(request, 4_000)
  const currentPassword = String(body.currentPassword || '')
  const newPassword = requirePassword(body.newPassword)
  if (!(await verifyPassword(currentPassword, auth.user.password_hash))) throw responseError('Current password is incorrect', 401)

  await env.DB.prepare(
    'update admin_users set password_hash = ?, force_password_change = 0, updated_at = ? where id = ?',
  ).bind(await hashPassword(newPassword), nowIso(), auth.user.id).run()
  await env.DB.prepare('delete from admin_sessions where user_id = ? and token_hash != ?')
    .bind(auth.user.id, auth.tokenHash).run()
  return json({ ok: true, user: { ...publicUser(auth.user), mustChangePassword: false } })
}

async function logout(request, env) {
  assertMutationOrigin(request)
  const token = getSessionToken(request)
  if (token) await env.DB.prepare('delete from admin_sessions where token_hash = ?').bind(await sha256Base64(token)).run()
  return json({ ok: true }, 200, { 'set-cookie': expiredSessionCookie() })
}

async function session(request, env) {
  const auth = await requireSession(request, env, { allowForced: true })
  return json({ ok: true, user: publicUser(auth.user) })
}

async function getAdminContent(request, env) {
  await requireSession(request, env)
  const state = await readSiteState(env)
  return json({ content: state?.content || null, revision: state?.revision || 0 })
}

async function updateContent(request, env) {
  assertMutationOrigin(request)
  const auth = await requireSession(request, env)
  const body = await readJson(request, MAX_CONTENT_BYTES + 2_000)
  const expectedRevision = Number(body.revision)
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw responseError('A valid revision is required', 400)
  validateContent(body.content)
  const contentJson = JSON.stringify(body.content)
  if (new TextEncoder().encode(contentJson).byteLength > MAX_CONTENT_BYTES) throw responseError('Content is too large', 413)

  const state = await readSiteState(env)
  const currentRevision = state?.revision || 0
  if (currentRevision !== expectedRevision) throw responseError('This preview changed on another device. Refresh before saving again.', 409)
  const nextRevision = currentRevision + 1
  const now = nowIso()
  if (!state) {
    await env.DB.prepare(
      'insert into site_state (id, content_json, revision, updated_by, updated_at) values (1, ?, ?, ?, ?)',
    ).bind(contentJson, nextRevision, auth.user.id, now).run()
  } else {
    const result = await env.DB.prepare(
      'update site_state set content_json = ?, revision = ?, updated_by = ?, updated_at = ? where id = 1 and revision = ?',
    ).bind(contentJson, nextRevision, auth.user.id, now, currentRevision).run()
    if (result.meta?.changes !== 1) throw responseError('This preview changed on another device. Refresh before saving again.', 409)
  }
  await env.DB.prepare(
    'insert into site_revisions (revision, content_json, created_by, created_at) values (?, ?, ?, ?)',
  ).bind(nextRevision, contentJson, auth.user.id, now).run()
  return json({ ok: true, revision: nextRevision })
}

async function uploadMedia(request, env) {
  assertMutationOrigin(request)
  const auth = await requireSession(request, env)
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > MAX_VIDEO_BYTES + 1_000_000) throw responseError('Upload is too large', 413)

  const form = await request.formData()
  const file = form.get('file')
  const alt = plainText(form.get('alt') || '', 'Alt text', 180, true)
  if (!(file instanceof File)) throw responseError('Choose a media file', 400)
  const detectedType = await detectMediaType(file)
  const config = mediaTypes[detectedType]
  if (!config || detectedType !== file.type.toLowerCase()) throw responseError('File contents do not match an allowed media type', 415)
  if (file.size <= 0 || file.size > config.maxBytes) {
    throw responseError(config.kind === 'image' ? 'Images must be 6 MB or smaller' : 'Videos must be 15 MB or smaller', 413)
  }
  if (config.kind === 'image' && !alt) throw responseError('Alt text is required for images', 400)

  const key = `${crypto.randomUUID()}.${config.extension}`
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: detectedType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { alt, uploadedBy: auth.user.id },
  })
  await env.DB.prepare(
    'insert into site_media (id, object_key, media_type, byte_size, alt_text, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), key, detectedType, file.size, alt, auth.user.id, nowIso()).run()
  return json({ ok: true, asset: { type: config.kind, url: `/uploads/${key}`, alt } }, 201)
}

async function createUser(request, env) {
  assertMutationOrigin(request)
  const auth = await requireSession(request, env)
  if (auth.user.role !== 'owner') throw responseError('Owner access required', 403)
  const body = await readJson(request, 4_000)
  const email = requireEmail(body.email)
  const password = requirePassword(body.tempPassword)
  const role = body.role === 'owner' ? 'owner' : 'editor'
  if (await findUser(env, email)) throw responseError('That editor already exists', 409)
  const id = crypto.randomUUID()
  const now = nowIso()
  await env.DB.prepare(
    `insert into admin_users
      (id, username, email, password_hash, role, force_password_change, disabled, created_at, updated_at)
      values (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
  ).bind(id, email, email, await hashPassword(password), role, now, now).run()
  return json({ ok: true, user: { id, email, username: email, role, mustChangePassword: true } }, 201)
}

async function serveMedia(request, env, key) {
  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp|avif|mp4|webm)$/.test(key)) return json({ error: 'Not found' }, 404)
  const head = await env.MEDIA.head(key)
  if (!head) return json({ error: 'Not found' }, 404)
  const rangeHeader = request.headers.get('range')
  let range = null
  if (rangeHeader) {
    range = parseByteRange(rangeHeader, head.size)
    if (!range) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${head.size}` } })
  }
  if (request.method === 'HEAD') return new Response(null, { headers: mediaHeaders(head, range) })
  const object = await env.MEDIA.get(key, range ? { range } : undefined)
  if (!object) return json({ error: 'Not found' }, 404)
  return new Response(object.body, { status: range ? 206 : 200, headers: mediaHeaders(object, range) })
}

function mediaHeaders(object, range) {
  const headers = new Headers()
  object.writeHttpMetadata?.(headers)
  headers.set('content-type', object.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  headers.set('accept-ranges', 'bytes')
  headers.set('x-content-type-options', 'nosniff')
  headers.set('content-disposition', 'inline')
  if (range) {
    headers.set('content-length', String(range.length))
    headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`)
  } else if (object.size != null) headers.set('content-length', String(object.size))
  return headers
}

async function requireSession(request, env, { allowForced = false } = {}) {
  const token = getSessionToken(request)
  if (!token) throw responseError('Not authenticated', 401)
  const tokenHash = await sha256Base64(token)
  const row = await env.DB.prepare(
    `select s.token_hash, u.id, u.username, u.email, u.password_hash, u.role,
      u.force_password_change, u.disabled
    from admin_sessions s join admin_users u on u.id = s.user_id
    where s.token_hash = ? and s.expires_at > ? and u.disabled = 0 limit 1`,
  ).bind(tokenHash, nowIso()).first()
  if (!row) throw responseError('Not authenticated', 401)
  if (row.force_password_change && !allowForced) throw responseError('Change the temporary password before editing', 403)
  return { tokenHash, user: row }
}

async function findUser(env, identifier) {
  return env.DB.prepare(
    `select id, username, email, password_hash, role, force_password_change, disabled
      from admin_users where lower(email) = ? or lower(username) = ? limit 1`,
  ).bind(identifier, identifier).first()
}

async function readSiteState(env) {
  const row = await env.DB.prepare('select content_json, revision from site_state where id = 1').first()
  if (!row) return null
  try { return { content: JSON.parse(row.content_json), revision: row.revision } }
  catch { throw new Error('Invalid stored content') }
}

async function enforceLoginThrottle(env, key) {
  const row = await env.DB.prepare('select attempts, window_started, blocked_until from login_attempts where key = ?').bind(key).first()
  if (row?.blocked_until && Date.parse(row.blocked_until) > Date.now()) {
    throw responseError('Too many sign-in attempts. Try again in 15 minutes.', 429)
  }
}

async function recordFailedLogin(env, key) {
  const row = await env.DB.prepare('select attempts, window_started from login_attempts where key = ?').bind(key).first()
  const now = Date.now()
  const expired = !row || Date.parse(row.window_started) < now - LOGIN_WINDOW_MS
  const attempts = expired ? 1 : Number(row.attempts) + 1
  const windowStarted = expired ? new Date(now).toISOString() : row.window_started
  const blockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(now + LOGIN_WINDOW_MS).toISOString() : null
  await env.DB.prepare(
    `insert into login_attempts (key, attempts, window_started, blocked_until)
      values (?, ?, ?, ?) on conflict(key) do update set
      attempts = excluded.attempts, window_started = excluded.window_started, blocked_until = excluded.blocked_until`,
  ).bind(key, attempts, windowStarted, blockedUntil).run()
}

function validateContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw responseError('Content must be an object', 400)
  const required = [
    ['brand.publicName', 80], ['hero.eyebrow', 120], ['hero.headlines.cutRecord', 90],
    ['hero.headlines.jpInChair', 90], ['hero.headlines.openChair', 90], ['hero.intro', 360],
    ['booking.label', 50], ['story.heading', 120], ['story.body', 700],
  ]
  required.forEach(([path, max]) => plainText(readPath(content, path), path, max))
  requireUrl(readPath(content, 'booking.url'), ['https:'], 'Booking URL')
  optionalUrl(readPath(content, 'contact.instagramUrl'), ['https:'], 'Instagram URL')
  optionalUrl(readPath(content, 'events.actionUrl'), ['https:', 'sms:', 'tel:', 'mailto:'], 'Event URL')
  if (readPath(content, 'featured.type') === 'instagram') {
    const url = String(readPath(content, 'featured.url') || '')
    if (!/^https:\/\/(?:www\.)?instagram\.com\/reel\/[A-Za-z0-9_-]+\/?(?:\?.*)?$/.test(url)) {
      throw responseError('Featured reel must be an Instagram reel URL', 400)
    }
  } else optionalMediaUrl(readPath(content, 'featured.url'), 'Featured URL')
  if (!Array.isArray(content.services) || content.services.length > 8) throw responseError('Use no more than eight services', 400)
  content.services.forEach((service, index) => {
    plainText(service.name, `Service ${index + 1} name`, 80)
    plainText(service.price, `Service ${index + 1} price`, 30)
    plainText(service.note || '', `Service ${index + 1} note`, 140, true)
  })
  const gallery = readPath(content, 'media.gallery')
  if (!Array.isArray(gallery) || gallery.length > 9) throw responseError('Use no more than nine gallery items', 400)
  ;[readPath(content, 'media.hero'), readPath(content, 'media.portrait'), ...gallery].forEach((asset, index) => {
    if (!asset?.url) return
    optionalMediaUrl(asset.url, `Media ${index + 1}`)
    if (asset.type === 'image') plainText(asset.alt, `Media ${index + 1} alt text`, 180)
  })
  return true
}

function readPath(object, path) { return path.split('.').reduce((value, key) => value?.[key], object) }
function plainText(value, label, max, optional = false) {
  const text = String(value ?? '').trim()
  if (!optional && !text) throw responseError(`${label} is required`, 400)
  if (text.length > max) throw responseError(`${label} is too long`, 400)
  const hasUnsupported = [...text].some((character) => {
    const code = character.codePointAt(0)
    return character === '<' || character === '>' || code < 9 || (code > 10 && code < 32)
  })
  if (hasUnsupported) throw responseError(`${label} contains unsupported characters`, 400)
  return text
}
function requireUrl(value, protocols, label) {
  try {
    const url = new URL(String(value || ''))
    if (!protocols.includes(url.protocol) || (url.protocol === 'https:' && !url.hostname)) throw new Error()
    return url.toString()
  } catch { throw responseError(`${label} is invalid`, 400) }
}
function optionalUrl(value, protocols, label) { if (value) requireUrl(value, protocols, label) }
function optionalMediaUrl(value, label) {
  if (!value) return
  if (/^\/(?:uploads|media\/defaults)\/[A-Za-z0-9._/-]+$/.test(value)) return
  requireUrl(value, ['https:'], label)
}

export async function detectMediaType(file) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const ascii = String.fromCharCode(...bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.slice(0, 8).every((value, index) => value === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index])) return 'image/png'
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp'
  if (ascii.slice(4, 12) === 'ftypavif' || ascii.slice(4, 12) === 'ftypavis') return 'image/avif'
  if (ascii.slice(4, 8) === 'ftyp') return 'video/mp4'
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm'
  return ''
}

export function parseByteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || ''))
  if (!match || (!match[1] && !match[2]) || size <= 0) return null
  let start
  let end
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isInteger(suffix) || suffix <= 0) return null
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) return null
    end = Math.min(end, size - 1)
  }
  return { offset: start, length: end - start + 1 }
}

async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > maxBytes) throw responseError('Request is too large', 413)
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw responseError('Request is too large', 413)
  try { return JSON.parse(text) }
  catch { throw responseError('Invalid JSON body', 400) }
}

async function readForm(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > maxBytes) throw responseError('Request is too large', 413)
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    throw responseError('Invalid form submission', 415)
  }
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw responseError('Request is too large', 413)
  return new URLSearchParams(text)
}

async function requireSetupToken(candidate, env) {
  if (!env.SETUP_TOKEN) throw responseError('Setup is disabled', 503)
  if (!candidate || !(await constantTimeEqual(String(candidate), String(env.SETUP_TOKEN)))) throw responseError('Invalid setup token', 401)
}
function requirePassword(value) {
  const password = String(value || '')
  if (password.length < 12 || password.length > 128) throw responseError('Password must be 12–128 characters', 400)
  return password
}
function requireEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw responseError('A valid email is required', 400)
  return email
}
function assertMutationOrigin(request) { if (request.headers.get('origin') !== new URL(request.url).origin) throw responseError('Invalid request origin', 403) }
function clientIp(request) { return request.headers.get('cf-connecting-ip') || 'unknown' }
function publicUser(user) { return { id: user.id, username: user.username, email: user.email, role: user.role, mustChangePassword: Boolean(user.force_password_change) } }
function getSessionToken(request) {
  const match = request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}
function sessionCookie(token, maxAge) { return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict` }
function expiredSessionCookie() { return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return toBase64(bytes) }
function nowIso() { return new Date().toISOString() }

async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_ITERATIONS }, key, 256)
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`
}
async function verifyPassword(password, encoded) {
  const [scheme, iterationsText, saltText, hashText] = String(encoded || '').split('$')
  if (scheme !== 'pbkdf2-sha256' || Number(iterationsText) !== PASSWORD_ITERATIONS) return false
  try {
    const candidate = await hashPassword(password, fromBase64(saltText))
    return constantTimeEqual(candidate, `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${saltText}$${hashText}`)
  } catch { return false }
}
async function sha256Base64(value) { return toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))) }
async function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  const length = Math.max(a.length, b.length)
  let difference = a.length ^ b.length
  for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0)
  return difference === 0
}
function toBase64(bytes) { let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte) }); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function fromBase64(value) { const normalized = value.replace(/-/g, '+').replace(/_/g, '/'); const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')); return Uint8Array.from(binary, (char) => char.charCodeAt(0)) }

function responseError(message, status) { return json({ error: message }, status) }
function json(body, status = 200, extraHeaders = {}) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders } }) }
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]) }
function authPage({ eyebrow, title, intro, action = '', fields = '', error = '', notice = '', status = 200, footer = '', formAttributes = '', script = '' }) {
  const errorBlock = error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''
  const noticeBlock = notice ? `<p class="notice" role="status">${escapeHtml(notice)}</p>` : ''
  const actionBlock = action ? `<button type="submit">${escapeHtml(action)}</button>` : ''
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} — Numbered</title>
<style>:root{color-scheme:light}*{box-sizing:border-box}body{min-height:100svh;margin:0;display:grid;place-items:center;padding:22px;background:#eee8dd;color:#171513;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.shell{width:min(100%,430px)}.brand{display:flex;align-items:center;gap:12px;margin:0 0 22px;font-size:.76rem;font-weight:850;letter-spacing:.08em}.mark{width:44px;height:44px;display:grid;place-items:center;border:2px solid #c61f27;color:#c61f27;font-weight:900}.card{display:grid;gap:17px;padding:28px;border:1px solid #cec4b7;background:#fffaf2;box-shadow:0 18px 60px rgba(35,26,18,.1)}.eyebrow{margin:0;color:#c61f27;font-size:.7rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}h1{margin:0;font-size:clamp(2rem,10vw,3rem);line-height:.95}p{margin:0;color:#665c52;line-height:1.5}.field{display:grid;gap:7px;font-size:.875rem;font-weight:800}.field input{width:100%;min-height:48px;padding:11px;border:1px solid #bdb1a4;border-radius:0;background:white;color:#171513;font:inherit}.field input[type=hidden]{display:none}button{min-height:50px;border:0;padding:12px 18px;background:#c61f27;color:white;font:inherit;font-weight:900;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.6}.error,.notice{padding:11px 12px;font-weight:750}.error{border-left:3px solid #c61f27;background:#f8e5e3;color:#7b1015}.notice{border-left:3px solid #31704a;background:#e7f3ea;color:#205235}.footer{font-size:.875rem}.footer a{min-height:44px;display:inline-flex;align-items:center;color:#40372f;font-weight:800}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #2474c6;outline-offset:3px}@media(max-height:680px){body{place-items:start center}}@media(max-width:420px){body{padding:16px}.card{padding:22px}}</style></head><body><main class="shell"><div class="brand"><span class="mark">JP</span><b>JPCUTS / NUMBERED</b></div><form class="card" method="post" ${formAttributes}><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p>${errorBlock}${noticeBlock}${fields}${actionBlock}${footer ? `<p class="footer">${footer}</p>` : ''}</form></main>${script}</body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'same-origin' },
  })
}
function loginPage(error = '', status = 200, notice = '') {
  return authPage({
    eyebrow: 'Private preview', title: 'Sign in', intro: 'Sign in with your email address and password.', action: 'Sign in', error, notice, status,
    fields: '<label class="field"><span>Email or username</span><input name="identifier" autocomplete="username" autocapitalize="none" spellcheck="false" required></label><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" maxlength="128" required></label>',
    footer: '<a href="/forgot-password/">Forgot password?</a>',
  })
}
function claimPage(error = '', status = 200) {
  return authPage({
    eyebrow: 'Private recovery', title: 'Reset your password', intro: 'This preview uses private recovery codes instead of email. Ask the site administrator for a one-time code, then enter it below.', action: 'Save password', error, status,
    fields: '<label class="field"><span>One-time recovery code</span><input name="code" autocomplete="one-time-code" autocapitalize="none" spellcheck="false" minlength="32" maxlength="256" required></label><label class="field"><span>New password (12–128 characters)</span><input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label class="field"><span>Confirm password</span><input name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>',
    footer: '<a href="/login/">Return to sign in</a>.',
  })
}
function forgotPasswordPage(error = '', status = 200) {
  return authPage({
    eyebrow: 'Private recovery', title: 'Reset your password', intro: 'Enter the email address you use for Numbered. We’ll send you a link to choose a new password.', action: 'Send reset link', error, status,
    fields: '<label class="field"><span>Email address</span><input name="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="254" required></label>',
    footer: '<a href="/login/">Return to sign in</a>',
  })
}
function passwordResetRequestedPage() {
  return authPage({
    eyebrow: 'Private recovery', title: 'Check your email', intro: 'If an account exists for that address, we sent a password reset link. It expires in 30 minutes and may take a few minutes to arrive.',
    footer: '<a href="/forgot-password/">Send another link</a> · <a href="/login/">Return to sign in</a>',
  })
}
function resetPasswordPage(error = '', status = 200) {
  return authPage({
    eyebrow: 'Private recovery', title: 'Choose a new password', intro: 'Use 12–128 characters. This reset link works once.', action: 'Save password', error, status,
    fields: '<input name="code" type="hidden"><label class="field"><span>New password</span><input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" aria-describedby="password-help" required></label><p id="password-help">Use 12–128 characters.</p><label class="field"><span>Confirm new password</span><input name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><noscript><p class="error" role="alert">Open this reset link in a browser with JavaScript enabled.</p></noscript>',
    footer: '<a href="/forgot-password/">Request a new link</a> · <a href="/login/">Return to sign in</a>',
    formAttributes: 'data-reset-form',
    script: '<script src="/reset-password-script.js" defer></script>',
  })
}
function resetPasswordScript() {
  return new Response(`(() => {
  const form = document.querySelector('[data-reset-form]')
  const tokenField = form?.querySelector('input[name="code"]')
  if (!form || !tokenField) return
  const fragmentToken = new URLSearchParams(location.hash.slice(1)).get('token')
  if (fragmentToken) sessionStorage.setItem('numberedResetToken', fragmentToken)
  if (location.hash) history.replaceState(null, '', location.pathname)
  tokenField.value = fragmentToken || sessionStorage.getItem('numberedResetToken') || ''
  const submit = form.querySelector('button[type="submit"]')
  if (!tokenField.value) {
    submit.disabled = true
    const error = document.createElement('p')
    error.className = 'error'
    error.setAttribute('role', 'alert')
    error.textContent = 'This reset link is no longer valid. Request a new link.'
    form.insertBefore(error, form.querySelector('.footer'))
  }
  form.addEventListener('submit', () => {
    submit.disabled = true
    submit.textContent = 'Saving password…'
  })
})()`, {
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  })
}
function finalize(response) {
  const headers = new Headers(response.headers)
  if (response.status === 401 || response.status === 403) headers.set('cache-control', 'no-store')
  headers.set('x-content-type-options', 'nosniff')
  if (!headers.has('referrer-policy')) headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  headers.set('x-frame-options', 'DENY')
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive')
  headers.set('content-security-policy', "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; frame-src https://www.instagram.com; connect-src 'self'")
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export { validateContent }
