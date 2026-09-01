import { mergeContent } from '../src/siteContent.js'

const SESSION_COOKIE = '__Host-numbered_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const RESET_TTL_SECONDS = 30 * 60
// Cloudflare Workers caps PBKDF2 at 100,000 iterations.
const PASSWORD_ITERATIONS = 100000
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_LOGIN_ATTEMPTS = 5
const MAX_LOGIN_IP_ATTEMPTS = 20
const RESET_WINDOW_MS = 60 * 60 * 1000
const RESET_COOLDOWN_MS = 60 * 1000
const MAX_RESET_EMAIL_REQUESTS = 3
const MAX_RESET_IP_REQUESTS = 10
const CONTACT_WINDOW_MS = 60 * 60 * 1000
const CONTACT_COOLDOWN_MS = 30 * 1000
const MAX_CONTACT_EMAIL_REQUESTS = 3
const MAX_CONTACT_IP_REQUESTS = 5
const MAX_CONTENT_BYTES = 80_000
const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const MAX_VIDEO_BYTES = 15 * 1024 * 1024
const DUMMY_PASSWORD_HASH = 'pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$jMPkjSokTG0Hd8pMdYFB8+druIz+7VIq/BBF/coTPAY='

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
  const publicSite = isPublicSiteRequest(request, env)
  const finish = (response) => finalize(response, request, env)

  try {
    if (request.method === 'OPTIONS') return finish(new Response(null, { status: 204 }))
    const route = `${request.method} ${url.pathname.replace(/\/$/, '') || '/'}`
    const routes = {
      'GET /login': () => loginPage('', 200, url.searchParams.get('reset') === '1' ? 'Password saved. Sign in with it now.' : '', loginDestination(url.searchParams.get('next'))),
      'POST /login': () => browserLogin(request, env),
      'GET /claim': () => claimPage(),
      'POST /claim': () => claimPassword(request, env, { renderPage: claimPage, invalidMessage: 'That recovery code is invalid or expired' }),
      'GET /forgot-password': () => forgotPasswordPage(),
      'POST /forgot-password': () => requestPasswordReset(request, env, context),
      'GET /reset-password': () => resetPasswordPage(),
      'POST /reset-password': () => claimPassword(request, env, { renderPage: resetPasswordPage, invalidMessage: 'This reset link is no longer valid. Request a new link.' }),
      'GET /reset-password-script.js': () => resetPasswordScript(),
      'GET /api/content': () => getPublicContent(request, env),
      'POST /api/contact': () => submitContact(request, env),
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

    if (routes[route]) return finish(await routes[route]())
    if (url.pathname.startsWith('/api/')) return finish(json({ error: 'Not found' }, 404))
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/uploads/')) {
      const key = url.pathname.slice('/uploads/'.length)
      if (!publicSite) await requireSession(request, env)
      else if (!(await isPublishedMediaKey(env, key))) return finish(json({ error: 'Not found' }, 404))
      return finish(await serveMedia(request, env, key))
    }

    if (!publicSite || isAdminPath(url.pathname)) {
      const auth = await sessionOrLoginPage(request, env)
      if (auth instanceof Response) return finish(auth)
      if (auth.user.force_password_change && !url.pathname.startsWith('/admin')) {
        return finish(new Response(null, { status: 302, headers: { location: '/admin/' } }))
      }
    }
    const assetRequest = new Request(request)
    assetRequest.headers.delete('authorization')
    return finish(await env.ASSETS.fetch(assetRequest))
  } catch (error) {
    if (error instanceof Response) return finish(error)
    console.error('jpcuuts-preview request failed', error?.name || 'Error', error?.message || '', error?.stack || '')
    return finish(json({ error: 'Internal server error' }, 500))
  }
}

function isVersionPreviewRequest(request, env) {
  const hostname = new URL(request.url).hostname.toLowerCase().replace(/\.$/, '')
  return env.JPCUUTS_VERSION_PREVIEW === '1' && hostname.endsWith('.workers.dev')
}

function isPublicSiteRequest(request, env) {
  const hostname = new URL(request.url).hostname.toLowerCase().replace(/\.$/, '')
  if (isVersionPreviewRequest(request, env)) return true
  return String(env.PUBLIC_SITE_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase().replace(/\.$/, ''))
    .filter(Boolean)
    .includes(hostname)
}

function isAdminPath(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

async function sessionOrLoginPage(request, env) {
  try { return await requireSession(request, env, { allowForced: true }) }
  catch (error) {
    if (!(error instanceof Response) || error.status !== 401) throw error
    if (request.method !== 'GET' && request.method !== 'HEAD') return error
    return loginPage('', 200, '', loginDestination(new URL(request.url).pathname))
  }
}

async function getPublicContent(request, env) {
  if (!isPublicSiteRequest(request, env)) await requireSession(request, env)
  const state = await readSiteState(env)
  return json({ content: state?.content ? mergeContent(state.content) : null, revision: state?.revision || 0 }, 200, { 'cache-control': 'no-store' })
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

  const admission = await reserveLoginAttempt(request, env, identifier)
  if (!admission.allowed) throw responseError('Too many sign-in attempts. Try again in 15 minutes.', 429)
  const user = await findUser(env, identifier)
  const passwordMatches = await verifyPassword(password, user?.password_hash || DUMMY_PASSWORD_HASH)
  if (!user || user.disabled || !passwordMatches) {
    throw responseError('Invalid credentials', 401)
  }

  await env.DB.prepare('delete from password_reset_limits where key = ?').bind(admission.pairKey).run()
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
  let next = '/'
  try {
    const form = await readForm(request, 4_000)
    next = loginDestination(form.get('next'))
    const identifier = String(form.get('identifier') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    const authenticated = await authenticate(request, env, identifier, password)
    const destination = authenticated.user.force_password_change ? '/admin/' : next
    return new Response(null, {
      status: 303,
      headers: { location: destination, 'set-cookie': sessionCookie(authenticated.token, SESSION_TTL_SECONDS) },
    })
  } catch (error) {
    if (!(error instanceof Response)) throw error
    const message = await error.json().then((body) => body.error).catch(() => 'Sign-in failed')
    return loginPage(message, error.status, '', next)
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

async function submitContact(request, env) {
  assertMutationOrigin(request)
  if (!isPublicSiteRequest(request, env)) await requireSession(request, env)
  const body = await readJson(request, 5_000)
  const website = String(body.website || '').trim()
  const startedAt = Number(body.startedAt)
  const elapsed = Date.now() - startedAt

  if (website) return json({ ok: true })
  if (!Number.isFinite(startedAt) || elapsed < 1_500 || elapsed > 2 * 60 * 60 * 1000) {
    throw responseError('Please reopen the form and try again.', 400)
  }

  const submission = {
    name: contactText(body.name, 'Name', 80),
    email: requireEmail(body.email),
    organization: contactText(body.organization, 'Group or organization', 120, true),
    eventDate: requireEventDate(body.eventDate),
    details: contactText(body.details, 'Event details', 1_200),
  }
  const admission = await allowContactRequest(request, env, submission)
  if (!admission.allowed) {
    throw responseError('Too many messages were sent. Please try again later.', 429)
  }
  if (!env.CONTACT_EMAIL_TO || (!env.RESEND_API_KEY && !env.EMAIL_TRANSPORT)) {
    await releaseRateLimit(env, admission.replayKey)
    throw responseError('The contact form is temporarily unavailable. Please try again later.', 503)
  }
  if (!(await sendContactEmail(env, submission, admission.replayKey))) {
    await releaseRateLimit(env, admission.replayKey)
    throw responseError('Message could not be sent. Please try again.', 502)
  }
  return json({ ok: true })
}

async function allowContactRequest(request, env, submission) {
  const now = Date.now()
  const emailKey = `contact:email:${await sha256Base64(submission.email)}`
  const ipKey = `contact:ip:${await sha256Base64(clientIp(request))}`
  const replayFingerprint = await sha256Base64(JSON.stringify([
    submission.name, submission.email, submission.organization, submission.eventDate, submission.details,
    Math.floor(now / CONTACT_WINDOW_MS),
  ]))
  const replayKey = `contact:replay:${replayFingerprint}`
  const [emailAllowed, ipAllowed, replayAllowed] = await Promise.all([
    reserveRateLimit(env, emailKey, { now, windowMs: CONTACT_WINDOW_MS, maxAttempts: MAX_CONTACT_EMAIL_REQUESTS }),
    reserveRateLimit(env, ipKey, { now, windowMs: CONTACT_WINDOW_MS, maxAttempts: MAX_CONTACT_IP_REQUESTS, cooldownMs: CONTACT_COOLDOWN_MS }),
    reserveRateLimit(env, replayKey, { now, windowMs: CONTACT_WINDOW_MS, maxAttempts: 1 }),
  ])
  return { allowed: emailAllowed && ipAllowed && replayAllowed, replayKey }
}

async function sendContactEmail(env, submission, replayKey) {
  const message = {
    from: env.CONTACT_EMAIL_FROM || env.RESET_EMAIL_FROM || 'JP Cuts website <jpcuuts@parabolos.com>',
    to: [requireEmail(env.CONTACT_EMAIL_TO)],
    reply_to: submission.email,
    subject: `JP Cuts event inquiry from ${submission.name}`,
    text: [
      `Name: ${submission.name}`,
      `Email: ${submission.email}`,
      `Group or organization: ${submission.organization || 'Not provided'}`,
      `Event date: ${submission.eventDate || 'Not provided'}`,
      '',
      'Event details:',
      submission.details,
    ].join('\n'),
    idempotency_key: replayKey,
  }
  if (env.EMAIL_TRANSPORT) return Boolean((await env.EMAIL_TRANSPORT.send(message))?.sent)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': `jpcuuts-contact/${replayKey.slice('contact:replay:'.length)}`,
    },
    body: JSON.stringify(message),
  })
  return response.ok
}

async function allowPasswordResetRequest(request, env, email) {
  const now = Date.now()
  const emailKey = `email:${await sha256Base64(email)}`
  const ipKey = `ip:${await sha256Base64(clientIp(request))}`
  const [emailAllowed, ipAllowed] = await Promise.all([
    reserveRateLimit(env, emailKey, { now, windowMs: RESET_WINDOW_MS, maxAttempts: MAX_RESET_EMAIL_REQUESTS, cooldownMs: RESET_COOLDOWN_MS }),
    reserveRateLimit(env, ipKey, { now, windowMs: RESET_WINDOW_MS, maxAttempts: MAX_RESET_IP_REQUESTS }),
  ])
  return emailAllowed && ipAllowed
}

async function reserveLoginAttempt(request, env, identifier) {
  const now = Date.now()
  const ip = clientIp(request)
  const normalizedIdentifier = String(identifier || '').trim().toLowerCase()
  const pairKey = `login:pair:${await sha256Base64(`${ip}|${normalizedIdentifier}`)}`
  const ipKey = `login:ip:${await sha256Base64(ip)}`
  const allowed = await Promise.all([
    reserveRateLimit(env, pairKey, { now, windowMs: LOGIN_WINDOW_MS, maxAttempts: MAX_LOGIN_ATTEMPTS }),
    reserveRateLimit(env, ipKey, { now, windowMs: LOGIN_WINDOW_MS, maxAttempts: MAX_LOGIN_IP_ATTEMPTS }),
  ])
  return { allowed: allowed.every(Boolean), pairKey, ipKey }
}

async function reserveRateLimit(env, key, { now, windowMs, maxAttempts, cooldownMs = 0 }) {
  const timestamp = new Date(now).toISOString()
  const resetBefore = new Date(now - windowMs).toISOString()
  const cooldownBefore = new Date(now - cooldownMs).toISOString()
  const row = await env.DB.prepare(
    `insert into password_reset_limits (key, attempts, window_started, last_requested_at)
      values (?, 1, ?, ?) on conflict(key) do update set
      attempts = case when password_reset_limits.window_started < ? then 1 else password_reset_limits.attempts + 1 end,
      window_started = case when password_reset_limits.window_started < ? then excluded.window_started else password_reset_limits.window_started end,
      last_requested_at = excluded.last_requested_at
      where password_reset_limits.window_started < ?
        or (password_reset_limits.attempts < ? and password_reset_limits.last_requested_at <= ?)
      returning attempts`,
  ).bind(key, timestamp, timestamp, resetBefore, resetBefore, resetBefore, maxAttempts, cooldownBefore).first()
  return Boolean(row)
}

async function releaseRateLimit(env, key) {
  if (key) await env.DB.prepare('delete from password_reset_limits where key = ?').bind(key).run()
}

async function sendPasswordResetEmail(env, { email, token, inviteId }) {
  const origin = passwordResetOrigin(env)
  const resetUrl = `${origin}/reset-password/#token=${token}`
  const message = {
    from: env.RESET_EMAIL_FROM || 'JP Cuts <jpcuuts@parabolos.com>',
    to: [email],
    subject: 'Reset your JP Cuts password',
    text: `Use this link to choose a new JP Cuts password:\n\n${resetUrl}\n\nThis link expires in 30 minutes and works once. If you did not request this, you can ignore this email.`,
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
  const origin = new URL(env.PUBLIC_ORIGIN || 'https://dev.jpcuuts.com')
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
  return json({ content: state?.content ? mergeContent(state.content) : null, revision: state?.revision || 0 })
}

async function updateContent(request, env) {
  assertMutationOrigin(request)
  const auth = await requireSession(request, env)
  const body = await readJson(request, MAX_CONTENT_BYTES + 2_000)
  const expectedRevision = body.revision
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw responseError('A valid revision is required', 400)
  const content = mergeContent(body.content)
  validateContent(content)
  const contentJson = JSON.stringify(content)
  if (new TextEncoder().encode(contentJson).byteLength > MAX_CONTENT_BYTES) throw responseError('Content is too large', 413)

  const nextRevision = expectedRevision + 1
  const now = nowIso()
  const stateStatement = expectedRevision === 0
    ? env.DB.prepare(
      `insert into site_state (id, content_json, revision, updated_by, updated_at)
        values (1, ?, ?, ?, ?) on conflict(id) do nothing`,
    ).bind(contentJson, nextRevision, auth.user.id, now)
    : env.DB.prepare(
      'update site_state set content_json = ?, revision = ?, updated_by = ?, updated_at = ? where id = 1 and revision = ?',
    ).bind(contentJson, nextRevision, auth.user.id, now, expectedRevision)
  const results = await env.DB.batch([
    stateStatement,
    env.DB.prepare(
      `insert into site_revisions (revision, content_json, created_by, created_at)
        select ?, ?, ?, ? where changes() = 1`,
    ).bind(nextRevision, contentJson, auth.user.id, now),
  ])
  if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) {
    throw responseError('This preview changed on another device. Your edits are still here; reload only after copying anything you need.', 409)
  }
  return json({ ok: true, revision: nextRevision })
}

async function uploadMedia(request, env) {
  assertMutationOrigin(request)
  const auth = await requireSession(request, env)
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > MAX_VIDEO_BYTES + 1_000_000) throw responseError('Upload is too large', 413)

  const form = await request.formData()
  const file = form.get('file')
  const purpose = String(form.get('purpose') || 'media')
  const alt = plainText(form.get('alt') || '', 'Alt text', 180, true)
  if (!(file instanceof File)) throw responseError('Choose a media file', 400)
  const detectedType = await detectMediaType(file)
  const config = mediaTypes[detectedType]
  if (!config || detectedType !== file.type.toLowerCase()) throw responseError('File contents do not match an allowed media type', 415)
  if (purpose === 'logo' && config.kind !== 'image') throw responseError('Logo files must be PNG, JPEG, WebP, or AVIF images', 415)
  if (!['media', 'logo'].includes(purpose)) throw responseError('Invalid upload purpose', 400)
  if (file.size <= 0 || file.size > config.maxBytes) {
    throw responseError(config.kind === 'image' ? 'Images must be 6 MB or smaller' : 'Videos must be 15 MB or smaller', 413)
  }
  if (config.kind === 'image' && !alt) throw responseError('Alt text is required for images', 400)

  const key = `${crypto.randomUUID()}.${config.extension}`
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: detectedType, cacheControl: 'private, no-store' },
    customMetadata: { alt, purpose, uploadedBy: auth.user.id },
  })
  await env.DB.prepare(
    'insert into site_media (id, object_key, media_type, byte_size, alt_text, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), key, detectedType, file.size, alt, auth.user.id, nowIso()).run()
  return json({ ok: true, asset: { type: config.kind, url: `/uploads/${key}`, alt, focus: { x: 50, y: 50 } } }, 201)
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

async function isPublishedMediaKey(env, key) {
  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp|avif|mp4|webm)$/.test(key)) return false
  const state = await readSiteState(env)
  if (!state?.content) return false
  const target = `/uploads/${key}`
  const pending = [mergeContent(state.content)]
  while (pending.length) {
    const value = pending.pop()
    if (value === target) return true
    if (Array.isArray(value)) pending.push(...value)
    else if (value && typeof value === 'object') pending.push(...Object.values(value))
  }
  return false
}

function mediaHeaders(object, range) {
  const headers = new Headers()
  object.writeHttpMetadata?.(headers)
  headers.set('content-type', object.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('cache-control', 'private, no-store')
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

function validateContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw responseError('Content must be an object', 400)
  const required = [
    ['brand.publicName', 80], ['brand.verseQuote', 180], ['brand.verseReference', 80],
    ['hero.eyebrow', 120], ['hero.headline', 90], ['hero.intro', 360],
    ['work.eyebrow', 120], ['work.heading', 160], ['work.instagramLabel', 60],
    ['booking.label', 50], ['booking.heading', 120], ['booking.instagramLabel', 60],
    ['servicesSection.eyebrow', 120], ['servicesSection.heading', 160],
    ['story.heading', 120], ['story.subtitle', 160], ['story.body', 1400],
    ['facts.priceRange', 30], ['facts.location', 120], ['facts.mobile', 60],
    ['locations.fadedUniversity.name', 80], ['locations.fadedUniversity.address', 160],
    ['locations.fadedUniversity.availabilityLabel', 80], ['locations.fadedUniversity.hours', 180],
    ['locations.fadedUniversity.bookingNote', 180], ['locations.lipscomb.name', 80],
    ['locations.lipscomb.availabilityLabel', 80], ['locations.lipscomb.businessNote', 260],
    ['locations.lipscomb.locationNote', 180],
    ['events.outlineHeading', 120], ['events.heading', 120], ['events.body', 700], ['events.actionLabel', 60],
    ['events.weddingHeading', 100], ['events.teamHeading', 100],
    ['featured.heading', 120],
  ]
  required.forEach(([path, max]) => plainText(readPath(content, path), path, max))
  if (readPath(content, 'brand.publicName') !== 'JP CUTS' || readPath(content, 'brand.bridgeName') !== '@jpcuuts') {
    throw responseError('Brand identity must remain JP CUTS and @jpcuuts', 400)
  }
  const logo = readPath(content, 'brand.logo')
  if (!logo || typeof logo !== 'object' || Array.isArray(logo) || logo.type !== 'image') {
    throw responseError('Brand logo must use the supported image slot', 400)
  }
  plainText(logo.alt, 'Brand logo alt text', 180)
  if (logo.url) optionalImageMediaUrl(logo.url, 'Brand logo')
  if (readPath(content, 'locations.fadedUniversity.name') !== 'Faded University'
    || readPath(content, 'locations.fadedUniversity.availabilityLabel') !== 'JP’s school availability'
    || readPath(content, 'locations.lipscomb.name') !== 'Lipscomb'
    || readPath(content, 'locations.lipscomb.availabilityLabel') !== 'By appointment') {
    throw responseError('Location names and availability labels are protected', 400)
  }
  const bookingUrl = requireUrl(readPath(content, 'booking.url'), ['https:'], 'Booking URL')
  if (bookingUrl !== 'https://calendly.com/jpcuts/30mins') throw responseError('Booking must use the approved Calendly page', 400)
  const instagramUrl = requireUrl(readPath(content, 'contact.instagramUrl'), ['https:'], 'Instagram URL')
  if (instagramUrl !== 'https://www.instagram.com/jpcuuts/') throw responseError('Instagram must use the approved @jpcuuts profile', 400)
  optionalSocialUrl(readPath(content, 'contact.facebookUrl'), ['facebook.com', 'www.facebook.com'], 'Facebook URL')
  optionalSocialUrl(readPath(content, 'contact.tiktokUrl'), ['tiktok.com', 'www.tiktok.com'], 'TikTok URL')
  optionalSocialUrl(readPath(content, 'contact.youtubeUrl'), ['youtube.com', 'www.youtube.com', 'youtu.be'], 'YouTube URL')
  if (typeof readPath(content, 'featured.enabled') !== 'boolean' || readPath(content, 'featured.type') !== 'instagram') {
    throw responseError('Featured media must be an optional Instagram Reel link', 400)
  }
  const reelUrl = requireUrl(readPath(content, 'featured.url'), ['https:'], 'Instagram Reel URL')
  if (!/^https:\/\/www\.instagram\.com\/reel\/[A-Za-z0-9_-]+\/$/.test(reelUrl)) throw responseError('Use a direct instagram.com Reel URL', 400)
  if (!Array.isArray(content.services) || content.services.length !== 2) throw responseError('Use only the haircut and beard add-on services', 400)
  const requiredServices = [
    { id: 'haircut', name: 'Haircut', price: '$35', duration: '35 minutes' },
    { id: 'beard-add-on', name: 'Shave or beard trim', price: '+$5', duration: '' },
  ]
  content.services.forEach((service, index) => {
    const expected = requiredServices[index]
    if (service.id !== expected.id || service.name !== expected.name || service.price !== expected.price || String(service.duration || '') !== expected.duration || !service.enabled) {
      throw responseError('Services must remain the $35 haircut and $5 beard trim or shave add-on', 400)
    }
    plainText(service.name, `Service ${index + 1} name`, 80)
    plainText(service.price, `Service ${index + 1} price`, 30)
    plainText(service.note || '', `Service ${index + 1} note`, 140, true)
  })
  const gallery = readPath(content, 'media.gallery')
  if (!Array.isArray(gallery) || gallery.length > 12) throw responseError('Use no more than twelve gallery items', 400)
  const beforeAfter = readPath(content, 'media.beforeAfter')
  if (beforeAfter?.enabled) plainText(beforeAfter.heading, 'Before/after heading', 120)
  const media = [
    readPath(content, 'media.hero'),
    readPath(content, 'media.portrait'),
    beforeAfter?.before,
    beforeAfter?.after,
    ...gallery,
  ]
  media.forEach((asset, index) => {
    if (!asset?.url) return
    optionalMediaUrl(asset.url, `Media ${index + 1}`)
    if (asset.type === 'image') {
      plainText(asset.alt, `Media ${index + 1} alt text`, 180)
      focusPoint(asset.focus, `Media ${index + 1} focus point`)
    }
  })
  if (beforeAfter?.enabled && (!beforeAfter.before?.url || !beforeAfter.after?.url)) {
    throw responseError('Before and after images are required when the slider is enabled', 400)
  }
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
    if (!protocols.includes(url.protocol) || (url.protocol === 'https:' && !url.hostname) || url.username || url.password) throw new Error()
    return url.toString()
  } catch { throw responseError(`${label} is invalid`, 400) }
}
function optionalSocialUrl(value, allowedHosts, label) {
  if (!value) return
  const normalized = requireUrl(value, ['https:'], label)
  if (!allowedHosts.includes(new URL(normalized).hostname)) throw responseError(`${label} must use the official service`, 400)
}
function optionalMediaUrl(value, label) {
  if (!value) return
  if (/^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp|avif|mp4|webm)$/.test(value)) return
  if (/^\/media\/defaults\/[A-Za-z0-9_-]+\.(?:jpg|png|webp|avif|mp4|webm)$/.test(value)) return
  throw responseError(`${label} must use approved site media`, 400)
}
function optionalImageMediaUrl(value, label) {
  if (!value) return
  if (/^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp|avif)$/.test(value)) return
  if (/^\/media\/defaults\/[A-Za-z0-9_-]+\.(?:jpg|png|webp|avif)$/.test(value)) return
  throw responseError(`${label} must use an approved site image`, 400)
}
function focusPoint(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw responseError(`${label} is required`, 400)
  for (const axis of ['x', 'y']) {
    if (typeof value[axis] !== 'number' || !Number.isFinite(value[axis]) || value[axis] < 0 || value[axis] > 100) {
      throw responseError(`${label} must use numeric coordinates from 0 to 100`, 400)
    }
  }
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
function contactText(value, label, max, optional = false) {
  const text = plainText(value, label, max, optional)
  if (/\r|\n/.test(text) && label !== 'Event details') throw responseError(`${label} must be one line`, 400)
  return text
}
function requireEventDate(value) {
  const date = String(value || '').trim()
  if (!date) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw responseError('Event date is invalid', 400)
  }
  return date
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
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} — JP Cuts</title>
<style>:root{color-scheme:light}*{box-sizing:border-box}body{min-height:100svh;margin:0;display:grid;place-items:center;padding:22px;background:#eee8dd;color:#171513;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.shell{width:min(100%,430px)}.brand{display:flex;align-items:center;margin:0 0 22px;color:#c61f27;font-size:1.15rem;font-weight:950;letter-spacing:.04em}.mark{display:block}.card{display:grid;gap:17px;padding:28px;border:1px solid #cec4b7;background:#fffaf2;box-shadow:0 18px 60px rgba(35,26,18,.1)}.eyebrow{margin:0;color:#c61f27;font-size:.7rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}h1{margin:0;font-size:clamp(2rem,10vw,3rem);line-height:.95}p{margin:0;color:#665c52;line-height:1.5}.field{display:grid;gap:7px;font-size:.875rem;font-weight:800}.field input{width:100%;min-height:48px;padding:11px;border:1px solid #bdb1a4;border-radius:0;background:white;color:#171513;font:inherit}.field input[type=hidden]{display:none}button{min-height:50px;border:0;padding:12px 18px;background:#c61f27;color:white;font:inherit;font-weight:900;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.6}.error,.notice{padding:11px 12px;font-weight:750}.error{border-left:3px solid #c61f27;background:#f8e5e3;color:#7b1015}.notice{border-left:3px solid #31704a;background:#e7f3ea;color:#205235}.footer{font-size:.875rem}.footer a{min-height:44px;display:inline-flex;align-items:center;color:#40372f;font-weight:800}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #2474c6;outline-offset:3px}@media(max-height:680px){body{place-items:start center}}@media(max-width:420px){body{padding:16px}.card{padding:22px}}</style></head><body><main class="shell"><div class="brand"><span class="mark">JP CUTS</span></div><form class="card" method="post" ${formAttributes}><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p>${errorBlock}${noticeBlock}${fields}${actionBlock}${footer ? `<p class="footer">${footer}</p>` : ''}</form></main>${script}</body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'same-origin' },
  })
}
function loginDestination(value) { return value === '/admin' || value === '/admin/' ? '/admin/' : '/' }
function loginPage(error = '', status = 200, notice = '', next = '/') {
  return authPage({
    eyebrow: 'Private preview', title: 'Sign in', intro: 'Sign in with your email address and password.', action: 'Sign in', error, notice, status,
    fields: `<input name="next" type="hidden" value="${loginDestination(next)}"><label class="field"><span>Email or username</span><input name="identifier" autocomplete="username" autocapitalize="none" spellcheck="false" required></label><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" maxlength="128" required></label>`,
    formAttributes: 'action="/login/"',
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
    eyebrow: 'Private recovery', title: 'Reset your password', intro: 'Enter the email address you use for JP Cuts. We’ll send you a link to choose a new password.', action: 'Send reset link', error, status,
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
function finalize(response, request, env) {
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'private, no-store')
  headers.set('x-content-type-options', 'nosniff')
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains')
  if (!headers.has('referrer-policy')) headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  headers.set('x-frame-options', 'DENY')
  const pathname = new URL(request.url).pathname
  const privateSurface = !isPublicSiteRequest(request, env) || isAdminPath(pathname) || pathname.startsWith('/api/') || pathname.startsWith('/uploads/') || [
    '/login', '/claim', '/forgot-password', '/reset-password', '/reset-password-script.js',
  ].includes(pathname.replace(/\/$/, '') || '/')
  if (privateSurface || isVersionPreviewRequest(request, env)) headers.set('x-robots-tag', 'noindex, nofollow, noarchive')
  else headers.delete('x-robots-tag')
  headers.set('content-security-policy', "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; frame-src 'none'; connect-src 'self'")
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export { validateContent }
