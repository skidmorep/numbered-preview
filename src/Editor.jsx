import { useEffect, useMemo, useRef, useState } from 'react'
import { imageFocusStyle, mergeContent, officialLogoUrl } from './siteContent'

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
    setStatus('Saving changes…')
    try {
      const payload = await api('/api/admin/content', {
        method: 'PUT',
        body: JSON.stringify({ content, revision }),
      })
      setRevision(payload.revision)
      setDirty(false)
      setStatus(`Saved — preview updated (revision ${payload.revision}).`)
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
        <div><span className="editor-wordmark">JP CUTS</span><div><p>Private preview</p><h1>Content editor</h1></div></div>
        <div className="editor-account"><span>{user?.email}</span><button type="button" className="link-button" onClick={logout}>Log out</button></div>
      </header>
      <div className="editor-layout">
        <aside>
          <p className="editor-kicker">Current preview</p>
          <a href="/" target="_blank" rel="noreferrer">Open The Chair ↗</a>
          <p className="editor-help">This content publishes directly into the selected JP Cuts design. Empty optional sections stay hidden.</p>
        </aside>
        <main className="editor-main">
          <EditorSection title="Brand & logo" description="JP’s official camo logo is active. Upload a replacement here only when JP approves a new source file.">
            <LogoUploader logo={content.brand.logo} update={update} setStatus={setStatus} />
          </EditorSection>

          <EditorSection title="Hero & booking" description="Update the first-screen message and booking label. The approved Calendly destination stays protected.">
            <Field label="Hero eyebrow" value={content.hero.eyebrow} onChange={(value) => update('hero.eyebrow', value)} maxLength={120} />
            <Field label="Hero headline" value={content.hero.headline} onChange={(value) => update('hero.headline', value)} maxLength={90} />
            <Field label="Booking button label" value={content.booking.label} onChange={(value) => update('booking.label', value)} maxLength={50} />
            <Field label="Final booking heading" value={content.booking.heading} onChange={(value) => update('booking.heading', value)} maxLength={120} />
            <LockedField label="Booking URL · approved" value={content.booking.url} />
            <p className="editor-help">Every booking button uses this label and the protected Calendly page. Pricing remains the approved $35 haircut, 35 minutes, with an optional $5 beard trim or shave.</p>
          </EditorSection>

          <EditorSection title="Locations & availability" description="Keep Faded University and Lipscomb separate so clients understand where and when JP cuts.">
            <fieldset className="location-fields"><legend>Faded University</legend>
              <LockedField label="Location name" value={content.locations.fadedUniversity.name} />
              <Field label="Faded University street address" value={content.locations.fadedUniversity.address} onChange={(value) => update('locations.fadedUniversity.address', value)} maxLength={160} />
              <Field label="JP’s school hours at Faded University" value={content.locations.fadedUniversity.hours} onChange={(value) => update('locations.fadedUniversity.hours', value)} maxLength={180} />
              <Field label="Faded University booking note" value={content.locations.fadedUniversity.bookingNote} onChange={(value) => update('locations.fadedUniversity.bookingNote', value)} maxLength={180} />
            </fieldset>
            <fieldset className="location-fields"><legend>Lipscomb</legend>
              <LockedField label="Location name" value={content.locations.lipscomb.name} />
              <Field label="Lipscomb appointment note" value={content.locations.lipscomb.businessNote} onChange={(value) => update('locations.lipscomb.businessNote', value)} textarea rows={3} maxLength={260} />
              <Field label="Lipscomb location note" value={content.locations.lipscomb.locationNote} onChange={(value) => update('locations.lipscomb.locationNote', value)} maxLength={180} />
            </fieldset>
            <p className="editor-help">These are JP’s school hours, not Faded University business hours or walk-in availability. Clients should use Calendly to book.</p>
          </EditorSection>

          <EditorSection title="Work section" description="These fields control the title and Instagram call to action above JP’s haircut portfolio.">
            <Field label="Outline heading" value={content.work.eyebrow} onChange={(value) => update('work.eyebrow', value)} maxLength={120} />
            <Field label="Main heading" value={content.work.heading} onChange={(value) => update('work.heading', value)} textarea rows={2} maxLength={160} />
            <Field label="Instagram button label" value={content.work.instagramLabel} onChange={(value) => update('work.instagramLabel', value)} maxLength={60} />
          </EditorSection>

          <EditorSection title="Services" description="Update the section headings and supporting notes. The approved service facts stay protected.">
            <Field label="Outline heading" value={content.servicesSection.eyebrow} onChange={(value) => update('servicesSection.eyebrow', value)} maxLength={120} />
            <Field label="Main heading" value={content.servicesSection.heading} onChange={(value) => update('servicesSection.heading', value)} textarea rows={2} maxLength={160} />
            <div className="service-editor">
              {content.services.map((service, index) => (
                <div className="service-edit-row" key={service.id}>
                  <p><strong>{service.name}</strong><br />{service.price}{service.duration ? ` · ${service.duration}` : ''}</p>
                  <Field label="Note" value={service.note} onChange={(value) => update(`services.${index}.note`, value)} maxLength={140} />
                </div>
              ))}
            </div>
          </EditorSection>

          <EditorSection title="About JP" description="Update JP’s introduction, biography, subtitle, and Matthew 10:30 detail.">
            <Field label="Outline heading" value={content.story.heading} onChange={(value) => update('story.heading', value)} maxLength={120} />
            <Field label="About subtitle" value={content.story.subtitle} onChange={(value) => update('story.subtitle', value)} maxLength={160} />
            <Field label="About introduction" value={content.hero.intro} onChange={(value) => update('hero.intro', value)} textarea rows={3} maxLength={360} />
            <Field label="Biography" value={content.story.body} onChange={(value) => update('story.body', value)} textarea rows={12} maxLength={1400} />
            <div className="field-grid two">
              <Field label="Verse quote" value={content.brand.verseQuote} onChange={(value) => update('brand.verseQuote', value)} maxLength={180} />
              <Field label="Verse reference" value={content.brand.verseReference} onChange={(value) => update('brand.verseReference', value)} maxLength={80} />
            </div>
          </EditorSection>

          <EditorSection title="Events, groups & teams" description="The two large display headings are independent. Event messages still use the private contact form.">
            <label className="check-field"><input type="checkbox" checked={content.events.enabled} onChange={(event) => update('events.enabled', event.target.checked)} /> Show events section</label>
            <div className="field-grid two">
              <Field label="Outline heading" value={content.events.outlineHeading} onChange={(value) => update('events.outlineHeading', value)} maxLength={120} />
              <Field label="Filled heading" value={content.events.heading} onChange={(value) => update('events.heading', value)} maxLength={120} />
            </div>
            <Field label="Events body copy" value={content.events.body} onChange={(value) => update('events.body', value)} textarea rows={5} maxLength={700} />
            <Field label="Contact form button" value={content.events.actionLabel} onChange={(value) => update('events.actionLabel', value)} maxLength={60} />
            <div className="field-grid two">
              <Field label="First photo-group heading" value={content.events.weddingHeading} onChange={(value) => update('events.weddingHeading', value)} maxLength={100} />
              <Field label="Second photo-group heading" value={content.events.teamHeading} onChange={(value) => update('events.teamHeading', value)} maxLength={100} />
            </div>
            <p className="editor-help">Form field labels and send/error messages stay structural so the contact path remains understandable and accessible. JP’s email address is never published in the page or content API.</p>
          </EditorSection>

          <EditorSection title="Instagram Reel & social links" description="Choose the Reel and decide whether a clean outbound Reel card appears. The site never embeds Instagram’s scrolling mini-page.">
            <label className="check-field"><input type="checkbox" checked={content.featured.enabled} onChange={(event) => update('featured.enabled', event.target.checked)} /> Publish Reel link card on the homepage</label>
            <Field label="Instagram Reel URL" value={content.featured.url} onChange={(value) => update('featured.url', value)} type="url" maxLength={240} />
            <Field label="Reel card label" value={content.featured.heading} onChange={(value) => update('featured.heading', value)} maxLength={120} />
            <LockedField label="Primary Instagram · approved" value={content.contact.instagramUrl} />
            <Field label="Final Instagram button label" value={content.booking.instagramLabel} onChange={(value) => update('booking.instagramLabel', value)} maxLength={60} />
            <div className="field-grid three">
              <Field label="Facebook URL" value={content.contact.facebookUrl} onChange={(value) => update('contact.facebookUrl', value)} type="url" maxLength={240} />
              <Field label="TikTok URL" value={content.contact.tiktokUrl} onChange={(value) => update('contact.tiktokUrl', value)} type="url" maxLength={240} />
              <Field label="YouTube URL" value={content.contact.youtubeUrl} onChange={(value) => update('contact.youtubeUrl', value)} type="url" maxLength={240} />
            </div>
            <p className="editor-help">When published, the card opens this exact Reel on instagram.com. When off, the Reel stays selected here but is absent from the public layout.</p>
          </EditorSection>

          <EditorSection title="Photos" description="Replace the hero, JP portrait, before/after pair, or gallery with approved JP Cuts images.">
            <MediaUploader content={content} update={update} setStatus={setStatus} />
            <MediaFocusManager content={content} update={update} />
            <label className="check-field"><input type="checkbox" checked={content.media.beforeAfter.enabled} onChange={(event) => update('media.beforeAfter.enabled', event.target.checked)} /> Show before/after slider</label>
            <Field label="Before/after heading" value={content.media.beforeAfter.heading} onChange={(value) => update('media.beforeAfter.heading', value)} maxLength={120} />
          </EditorSection>
          {user?.role === 'owner' && <OwnerAccess setStatus={setStatus} />}
        </main>
      </div>
      <div className="publish-bar">
        <p role="status">{status || (dirty ? 'Unsaved changes' : 'Saved — preview is up to date')}</p>
        <button type="button" className="publish-button" onClick={save} disabled={!dirty}>Save changes to preview</button>
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

function LogoUploader({ logo, update, setStatus }) {
  const [file, setFile] = useState(null)
  const upload = async (event) => {
    event.preventDefault()
    const uploader = event.currentTarget
    if (!file) return setStatus('Choose the authentic JP logo file first.')
    setStatus('Uploading logo…')
    const form = new FormData()
    form.append('file', file)
    form.append('alt', 'JP Cuts logo')
    form.append('purpose', 'logo')
    try {
      const payload = await api('/api/admin/media', { method: 'POST', body: form })
      update('brand.logo', { ...payload.asset, alt: 'JP Cuts logo' })
      setStatus('Logo uploaded. Save changes to update the preview.')
      setFile(null)
      uploader.reset()
    } catch (error) { setStatus(error.message) }
  }

  return <div className="logo-editor">
    <div className="logo-preview">
      {logo?.url ? <img src={logo.url} alt="Current JP Cuts logo" /> : <strong>JP CUTS</strong>}
      <p>{logo?.url ? 'Authentic logo ready in this draft.' : 'No authentic logo uploaded. The public site is using the JP CUTS text wordmark.'}</p>
    </div>
    <form className="logo-uploader" onSubmit={upload}>
      <label className="field"><span>JP logo — upload authentic file</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      <button type="submit">{logo?.url ? 'Replace logo' : 'Upload logo'}</button>
      {logo?.url !== officialLogoUrl && <button type="button" className="secondary-button" onClick={() => { update('brand.logo', { type: 'image', url: officialLogoUrl, alt: 'JP Cuts logo' }); setStatus('Official JP Cuts logo restored in this draft. Save changes to publish it.') }}>Use official logo</button>}
      <p>PNG, JPEG, WebP, or AVIF; 6 MB max. SVG files are not accepted.</p>
    </form>
  </div>
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
    const uploader = event.currentTarget
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
      setStatus('Media uploaded. Save changes when the preview looks right.')
      setFile(null)
      setAlt('')
      uploader.reset()
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
  return <figure className={`media-preview ${selected ? 'is-selected' : ''}`}>{asset?.type === 'video' ? <video src={asset.url} preload="metadata" /> : <img src={asset?.url} alt="" loading="lazy" style={imageFocusStyle(asset)} />}<figcaption><b>{label}</b><span>{asset?.alt || 'No alt text'}</span><button type="button" aria-pressed={selected} onClick={onEdit}>{selected ? 'Adjusting visible area' : 'Adjust visible area'}</button></figcaption></figure>
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
    if (event.pointerType === 'touch') return
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
    <header><div><p className="editor-kicker">Photo crop</p><h3 id={`${descriptionId}-title`}>{label}</h3></div><p>{focus.x}% across · {focus.y}% down</p></header>
    <p id={descriptionId} className="editor-help">Choose what stays visible when this photo is cropped. Tap the person or detail to keep in frame. Arrow keys move one point; hold Shift for five.</p>
    <button
      ref={frameRef}
      type="button"
      className="focus-canvas"
      aria-label={`${label} visible area, ${focus.x}% across and ${focus.y}% down`}
      aria-describedby={descriptionId}
      onPointerDown={startPointer}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onClick={setFromPointer}
      onKeyDown={moveFromKeyboard}
    >
      <img src={asset?.url} alt="" style={imageFocusStyle(asset)} />
      <span className="focus-target" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} aria-hidden="true" />
    </button>
    <div className="focus-ranges">
      <label><span>Move focus left ↔ right <output>{focus.x}%</output></span><input type="range" min="0" max="100" value={focus.x} onChange={(event) => setPoint(Number(event.target.value), focus.y)} /></label>
      <label><span>Move focus up ↕ down <output>{focus.y}%</output></span><input type="range" min="0" max="100" value={focus.y} onChange={(event) => setPoint(focus.x, Number(event.target.value))} /></label>
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

function EditorFrame({ children }) { return <main className="editor-auth"><div className="editor-auth-brand"><span className="editor-wordmark">JP CUTS</span></div>{children}</main> }
function EditorSection({ title, description, children }) { return <section className="editor-section"><header><h2>{title}</h2><p>{description}</p></header><div className="editor-fields">{children}</div></section> }
function LockedField({ label, value }) { return <label className="field is-locked"><span>{label}</span><input value={value} readOnly aria-readonly="true" /></label> }

function Field({ label, onChange, textarea = false, value, ...props }) {
  const Element = textarea ? 'textarea' : 'input'
  const controlled = value !== undefined
  return <label className="field"><span>{label}</span><Element {...props} {...(controlled ? { value, onChange: (event) => onChange(event.target.value) } : {})} /></label>
}
