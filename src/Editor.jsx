import { useEffect, useMemo, useRef, useState } from 'react'
import { imageFocusStyle, mergeContent } from './siteContent'

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body instanceof FormData
      ? { accept: 'application/json' }
      : { accept: 'application/json', 'content-type': 'application/json' },
    ...options,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Request failed')
  return body
}

export function Editor({ defaults }) {
  const [view, setView] = useState('loading')
  const [user, setUser] = useState(null)
  const [content, setContent] = useState(mergeContent(defaults))
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api('/api/session')
      .then((payload) => {
        setUser(payload.user)
        setView(payload.user.mustChangePassword ? 'password' : 'editor')
      })
      .catch(() => setView('login'))
  }, [])

  useEffect(() => {
    if (view !== 'editor') return
    api('/api/admin/content')
      .then((payload) => {
        setContent(mergeContent(payload.content))
        setRevision(payload.revision)
        setDirty(false)
      })
      .catch((error) => setStatus(error.message))
  }, [view])

  useEffect(() => {
    const warn = (event) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (view === 'loading') return <EditorFrame><p>Loading editor…</p></EditorFrame>
  if (view === 'login') return <Login onSuccess={(nextUser) => { setUser(nextUser); setView(nextUser.mustChangePassword ? 'password' : 'editor') }} />
  if (view === 'password') return <PasswordChange user={user} onSuccess={(nextUser) => { setUser(nextUser); setView('editor') }} />

  const update = (path, value) => {
    setContent((current) => {
      const next = structuredClone(current)
      const parts = path.split('.')
      let cursor = next
      parts.slice(0, -1).forEach((part) => { cursor = cursor[part] })
      cursor[parts.at(-1)] = value
      return next
    })
    setDirty(true)
  }

  const save = async () => {
    setStatus('Publishing preview…')
    try {
      const payload = await api('/api/admin/content', {
        method: 'PUT',
        body: JSON.stringify({ content, revision }),
      })
      setRevision(payload.revision)
      setDirty(false)
      setStatus(`Published revision ${payload.revision}.`)
    } catch (error) {
      setStatus(error.message)
    }
  }

  const logout = async () => {
    setStatus('Signing out…')
    try {
      await api('/api/logout', { method: 'POST', body: '{}' })
      setView('login')
      setUser(null)
      setStatus('')
    } catch (error) {
      setStatus(`Could not sign out. ${error.message}`)
    }
  }

  return (
    <div className="editor-app">
      <header className="editor-header">
        <div><span className="editor-mark">JP</span><div><p>JP Cuts preview</p><h1>Content editor</h1></div></div>
        <div className="editor-account"><span>{user?.email}</span><button type="button" className="link-button" onClick={logout}>Log out</button></div>
      </header>
      <div className="editor-layout">
        <aside>
          <p className="editor-kicker">Current preview</p>
          <a href="/" target="_blank" rel="noreferrer">Open The Chair ↗</a>
          <p className="editor-help">This content publishes directly into the selected JP Cuts design. Empty optional sections stay hidden.</p>
        </aside>
        <main className="editor-main">
          <EditorSection title="Basics" description="The approved JP Cuts profile, location, and booking destination are locked. Update the main headline or button label.">
            <Field label="Hero headline" value={content.hero.headline} onChange={(value) => update('hero.headline', value)} maxLength={90} />
            <Field label="Booking button" value={content.booking.label} onChange={(value) => update('booking.label', value)} maxLength={50} />
            <p className="editor-help">Bookings use the approved Calendly page.</p>
          </EditorSection>

          <EditorSection title="Services" description="Pricing and availability are fixed. Update the supporting notes only.">
            <div className="service-editor">
              {content.services.map((service, index) => (
                <div className="service-edit-row" key={service.id}>
                  <p><strong>{service.name}</strong><br />{service.price}{service.duration ? ` · ${service.duration}` : ''}</p>
                  <Field label="Note" value={service.note} onChange={(value) => update(`services.${index}.note`, value)} maxLength={140} />
                </div>
              ))}
            </div>
          </EditorSection>

          <EditorSection title="Photos" description="Replace the hero, JP portrait, before/after pair, or gallery with approved JP Cuts images. The Instagram Reel is fixed.">
            <MediaUploader content={content} update={update} setStatus={setStatus} />
            <MediaFocusManager content={content} update={update} />
            <label className="check-field"><input type="checkbox" checked={content.media.beforeAfter.enabled} onChange={(event) => update('media.beforeAfter.enabled', event.target.checked)} /> Show before/after slider</label>
            <Field label="Before/after heading" value={content.media.beforeAfter.heading} onChange={(value) => update('media.beforeAfter.heading', value)} maxLength={120} />
            <p className="editor-help">The approved @jpcuuts Reel stays embedded on the homepage.</p>
          </EditorSection>

          <EditorSection title="About JP & events" description="The approved biography, Matthew 10:30 detail, Middle Tennessee language, event copy, and social destinations are locked.">
            <Field label="Contact form button" value={content.events.actionLabel} onChange={(value) => update('events.actionLabel', value)} maxLength={60} />
            <p className="editor-help">Event messages use the private website form. JP’s email address is never published in the page or content API.</p>
          </EditorSection>
          {user?.role === 'owner' && <OwnerAccess setStatus={setStatus} />}
        </main>
      </div>
      <div className="publish-bar">
        <p role="status">{status || (dirty ? 'Unsaved changes' : `Published revision ${revision}`)}</p>
        <button type="button" className="publish-button" onClick={save} disabled={!dirty}>Save and publish preview</button>
      </div>
    </div>
  )
}

function Login({ onSuccess }) {
  const [status, setStatus] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setStatus('Signing in…')
    try {
      const payload = await api('/api/login', { method: 'POST', body: JSON.stringify({ email: event.currentTarget.email.value, password: event.currentTarget.password.value }) })
      onSuccess(payload.user)
    } catch (error) { setStatus(error.message) }
  }
  return <EditorFrame><form className="auth-card" onSubmit={submit}><p className="editor-kicker">JP Cuts preview</p><h1>Sign in to edit</h1><Field name="email" label="Email" type="email" autoComplete="username" required /><Field name="password" label="Password" type="password" autoComplete="current-password" required /><a href="/forgot-password/">Forgot password?</a><button className="publish-button" type="submit">Sign in</button><p role="status">{status}</p><a href="/">Return to preview</a></form></EditorFrame>
}

function PasswordChange({ user, onSuccess }) {
  const [status, setStatus] = useState('Choose a private password before editing.')
  const submit = async (event) => {
    event.preventDefault()
    try {
      const payload = await api('/api/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: event.currentTarget.currentPassword.value, newPassword: event.currentTarget.newPassword.value }) })
      onSuccess(payload.user)
    } catch (error) { setStatus(error.message) }
  }
  return <EditorFrame><form className="auth-card" onSubmit={submit}><p className="editor-kicker">First sign-in</p><h1>Set your password</h1><p>{user.email}</p><Field name="currentPassword" label="Temporary password" type="password" required /><Field name="newPassword" label="New password (12–128 characters)" type="password" minLength={12} maxLength={128} required /><button className="publish-button" type="submit">Set password</button><p role="status">{status}</p></form></EditorFrame>
}

function MediaUploader({ content, update, setStatus }) {
  const [target, setTarget] = useState('hero')
  const [alt, setAlt] = useState('')
  const [file, setFile] = useState(null)
  const targets = useMemo(() => [
    ['hero', 'Hero image'],
    ['portrait', 'JP portrait'],
    ['before', 'Before image'],
    ['after', 'After image'],
    ...content.media.gallery.map((_, index) => [`gallery-${index}`, `Gallery ${index + 1}`]),
  ], [content.media.gallery])

  const upload = async (event) => {
    event.preventDefault()
    if (!file) return setStatus('Choose a file first.')
    if (file.type.startsWith('image/') && !alt.trim()) return setStatus('Add alt text before uploading an image.')
    setStatus('Uploading media…')
    const form = new FormData()
    form.append('file', file)
    form.append('alt', alt.trim())
    try {
      const payload = await api('/api/admin/media', { method: 'POST', body: form })
      const asset = payload.asset
      if (target === 'hero') update('media.hero', asset)
      else if (target === 'portrait') update('media.portrait', asset)
      else if (target === 'before') update('media.beforeAfter.before', asset)
      else if (target === 'after') update('media.beforeAfter.after', asset)
      else update(`media.gallery.${Number(target.split('-')[1])}`, asset)
      setStatus('Media uploaded. Save and publish when the preview looks right.')
      setFile(null)
      setAlt('')
      event.currentTarget.reset()
    } catch (error) { setStatus(error.message) }
  }

  return <form className="media-uploader" onSubmit={upload}><label className="field"><span>Replace</span><select value={target} onChange={(event) => setTarget(event.target.value)}>{targets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>File</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><Field label="Image alt text" value={alt} onChange={setAlt} maxLength={180} /><button type="submit">Upload</button><p>Images: 6 MB max. JPEG, PNG, WebP, or AVIF.</p></form>
}

function mediaEntries(content) {
  return [
    { id: 'hero', label: 'Hero', path: 'media.hero', asset: content.media.hero },
    { id: 'portrait', label: 'JP portrait', path: 'media.portrait', asset: content.media.portrait },
    { id: 'before', label: 'Before', path: 'media.beforeAfter.before', asset: content.media.beforeAfter.before },
    { id: 'after', label: 'After', path: 'media.beforeAfter.after', asset: content.media.beforeAfter.after },
    ...content.media.gallery.map((asset, index) => ({ id: `gallery-${index}`, label: `Gallery ${index + 1}`, path: `media.gallery.${index}`, asset })),
  ]
}

function MediaFocusManager({ content, update }) {
  const entries = mediaEntries(content)
  const [selectedId, setSelectedId] = useState('hero')
  const selected = entries.find((entry) => entry.id === selectedId) || entries[0]

  return <div className="media-focus-manager">
    <div className="media-preview-grid">
      {entries.map((entry) => <MediaPreview key={entry.id} {...entry} selected={entry.id === selected.id} onEdit={() => setSelectedId(entry.id)} />)}
    </div>
    <FocusPointEditor label={selected.label} path={selected.path} asset={selected.asset} update={update} />
  </div>
}

function MediaPreview({ label, asset, selected, onEdit }) {
  return <figure className={`media-preview ${selected ? 'is-selected' : ''}`}>{asset?.type === 'video' ? <video src={asset.url} preload="metadata" /> : <img src={asset?.url} alt="" loading="lazy" style={imageFocusStyle(asset)} />}<figcaption><b>{label}</b><span>{asset?.alt || 'No alt text'}</span><button type="button" aria-pressed={selected} onClick={onEdit}>{selected ? 'Editing focus' : 'Edit focus'}</button></figcaption></figure>
}

function FocusPointEditor({ label, path, asset, update }) {
  const frameRef = useRef(null)
  const activePointer = useRef(null)
  const focus = asset?.focus || { x: 50, y: 50 }
  const descriptionId = `focus-help-${path.replace(/[^a-z0-9]+/gi, '-')}`
  const setPoint = (x, y) => update(`${path}.focus`, {
    x: Math.min(100, Math.max(0, Math.round(x))),
    y: Math.min(100, Math.max(0, Math.round(y))),
  })
  const setFromPointer = (event) => {
    const bounds = frameRef.current?.getBoundingClientRect()
    if (!bounds) return
    setPoint(((event.clientX - bounds.left) / bounds.width) * 100, ((event.clientY - bounds.top) / bounds.height) * 100)
  }
  const startPointer = (event) => {
    activePointer.current = event.pointerId
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setFromPointer(event)
  }
  const movePointer = (event) => {
    if (activePointer.current !== event.pointerId) return
    setFromPointer(event)
  }
  const endPointer = (event) => {
    if (activePointer.current !== event.pointerId) return
    activePointer.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const moveFromKeyboard = (event) => {
    const step = event.shiftKey ? 5 : 1
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setPoint(focus.x + move[0], focus.y + move[1])
  }

  return <section className="focus-editor" aria-labelledby={`${descriptionId}-title`}>
    <header><div><p className="editor-kicker">Image focus</p><h3 id={`${descriptionId}-title`}>{label}</h3></div><p>{focus.x}% across · {focus.y}% down</p></header>
    <p id={descriptionId} className="editor-help">Tap or drag the target. Arrow keys move one point; hold Shift for five.</p>
    <button
      ref={frameRef}
      type="button"
      className="focus-canvas"
      aria-label={`${label} focus point, ${focus.x}% across and ${focus.y}% down`}
      aria-describedby={descriptionId}
      onPointerDown={startPointer}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onKeyDown={moveFromKeyboard}
    >
      <img src={asset?.url} alt="" style={imageFocusStyle(asset)} />
      <span className="focus-target" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} aria-hidden="true" />
    </button>
    <div className="focus-ranges">
      <label><span>Horizontal <output>{focus.x}%</output></span><input type="range" min="0" max="100" value={focus.x} onChange={(event) => setPoint(Number(event.target.value), focus.y)} /></label>
      <label><span>Vertical <output>{focus.y}%</output></span><input type="range" min="0" max="100" value={focus.y} onChange={(event) => setPoint(focus.x, Number(event.target.value))} /></label>
      <button type="button" onClick={() => setPoint(50, 50)}>Reset to center</button>
    </div>
    <div className="focus-crops" aria-label="Crop previews">
      <figure><div className="is-phone"><img src={asset?.url} alt="" style={imageFocusStyle(asset)} /></div><figcaption>iPhone hero</figcaption></figure>
      <figure><div className="is-laptop"><img src={asset?.url} alt="" style={imageFocusStyle(asset)} /></div><figcaption>MacBook crop</figcaption></figure>
    </div>
  </section>
}

function OwnerAccess({ setStatus }) {
  const createOwner = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setStatus('Creating owner account…')
    try {
      const payload = await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.value,
          tempPassword: form.tempPassword.value,
          role: 'owner',
        }),
      })
      setStatus(`Owner account created for ${payload.user.email}. Share the temporary password privately.`)
      form.reset()
    } catch (error) { setStatus(error.message) }
  }

  return <EditorSection title="Owner access" description="JP receives the same access as paul. New owners must change their temporary password before they can view or publish the preview."><form className="owner-access" onSubmit={createOwner}><Field name="email" label="JP's email" type="email" autoComplete="off" required /><Field name="tempPassword" label="Temporary password (12–128 characters)" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /><button type="submit">Create owner account</button></form></EditorSection>
}

function EditorFrame({ children }) { return <main className="editor-auth"><div className="editor-auth-brand"><span className="editor-mark">JP</span><b>JP CUTS</b></div>{children}</main> }
function EditorSection({ title, description, children }) { return <section className="editor-section"><header><h2>{title}</h2><p>{description}</p></header><div className="editor-fields">{children}</div></section> }

function Field({ label, onChange, textarea = false, value, ...props }) {
  const Element = textarea ? 'textarea' : 'input'
  const controlled = value !== undefined
  return <label className="field"><span>{label}</span><Element {...props} {...(controlled ? { value, onChange: (event) => onChange(event.target.value) } : {})} /></label>
}
