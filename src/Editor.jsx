import { useEffect, useMemo, useState } from 'react'
import { mergeContent } from './siteContent'

const previewSkins = [
  ['cut-record', '01 — The Cut Record'],
  ['jp-in-chair', '02 — JP in the Chair'],
  ['open-chair', '03 — The Open Chair'],
]

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
    await api('/api/logout', { method: 'POST', body: '{}' }).catch(() => {})
    setView('login')
    setUser(null)
  }

  return (
    <div className="editor-app">
      <header className="editor-header">
        <div><span className="editor-mark">JP</span><div><p>JP Cuts preview</p><h1>Content editor</h1></div></div>
        <div className="editor-account"><span>{user?.email}</span><button type="button" className="link-button" onClick={logout}>Log out</button></div>
      </header>
      <div className="editor-layout">
        <aside>
          <p className="editor-kicker">Current working layouts</p>
          {previewSkins.map(([id, label]) => <a key={id} href={`/?skin=${id}`} target="_blank" rel="noreferrer">{label} ↗</a>)}
          <p className="editor-help">One shared content record will carry into the selected JP Cuts design. Empty optional sections stay hidden.</p>
        </aside>
        <main className="editor-main">
          <EditorSection title="Basics" description="Name, booking, positioning, and temporary preview headlines.">
            <div className="field-grid two">
              <Field label="Public name" value={content.brand.publicName} onChange={(value) => update('brand.publicName', value)} maxLength={80} />
              <Field label="Hero eyebrow" value={content.hero.eyebrow} onChange={(value) => update('hero.eyebrow', value)} maxLength={120} />
            </div>
            <Field label="Shared introduction" value={content.hero.intro} onChange={(value) => update('hero.intro', value)} textarea maxLength={360} />
            <div className="field-grid three">
              <Field label="01 headline" value={content.hero.headlines.cutRecord} onChange={(value) => update('hero.headlines.cutRecord', value)} maxLength={90} />
              <Field label="02 headline" value={content.hero.headlines.jpInChair} onChange={(value) => update('hero.headlines.jpInChair', value)} maxLength={90} />
              <Field label="03 headline" value={content.hero.headlines.openChair} onChange={(value) => update('hero.headlines.openChair', value)} maxLength={90} />
            </div>
            <div className="field-grid two">
              <Field label="Booking button" value={content.booking.label} onChange={(value) => update('booking.label', value)} maxLength={50} />
              <Field label="Booking URL" type="url" value={content.booking.url} onChange={(value) => update('booking.url', value)} maxLength={500} />
            </div>
            <div className="field-grid three">
              <Field label="Price range" value={content.facts.priceRange} onChange={(value) => update('facts.priceRange', value)} maxLength={30} />
              <Field label="Location" value={content.facts.location} onChange={(value) => update('facts.location', value)} maxLength={60} />
              <Field label="Mobile label" value={content.facts.mobile} onChange={(value) => update('facts.mobile', value)} maxLength={60} />
            </div>
          </EditorSection>

          <EditorSection title="Services" description="These facts stay identical in every design.">
            <div className="service-editor">
              {content.services.map((service, index) => (
                <div className="service-edit-row" key={service.id}>
                  <label className="check-field"><input type="checkbox" checked={service.enabled} onChange={(event) => update(`services.${index}.enabled`, event.target.checked)} /> Show</label>
                  <Field label="Service" value={service.name} onChange={(value) => update(`services.${index}.name`, value)} maxLength={80} />
                  <Field label="Price" value={service.price} onChange={(value) => update(`services.${index}.price`, value)} maxLength={30} />
                  <Field label="Note" value={service.note} onChange={(value) => update(`services.${index}.note`, value)} maxLength={140} />
                </div>
              ))}
            </div>
          </EditorSection>

          <EditorSection title="Photos & video" description="Replace the hero, JP portrait, before/after pair, gallery, or featured video. Images require useful alt text.">
            <MediaUploader content={content} update={update} setStatus={setStatus} />
            <div className="media-preview-grid">
              <MediaPreview label="Hero" asset={content.media.hero} />
              <MediaPreview label="JP portrait" asset={content.media.portrait} />
              <MediaPreview label="Before" asset={content.media.beforeAfter.before} />
              <MediaPreview label="After" asset={content.media.beforeAfter.after} />
              {content.media.gallery.map((asset, index) => <MediaPreview key={`${asset.url}-${index}`} label={`Gallery ${index + 1}`} asset={asset} />)}
            </div>
            <label className="check-field"><input type="checkbox" checked={content.media.beforeAfter.enabled} onChange={(event) => update('media.beforeAfter.enabled', event.target.checked)} /> Show before/after slider</label>
            <Field label="Before/after heading" value={content.media.beforeAfter.heading} onChange={(value) => update('media.beforeAfter.heading', value)} maxLength={120} />
            <div className="field-grid two">
              <label className="field"><span>Featured media</span><select value={content.featured.type} onChange={(event) => update('featured.type', event.target.value)}><option value="instagram">Instagram reel</option><option value="video">Uploaded video</option><option value="image">Image URL</option></select></label>
              <Field label="Featured URL" value={content.featured.url} onChange={(value) => update('featured.url', value)} maxLength={500} />
            </div>
          </EditorSection>

          <EditorSection title="About JP, events & contact" description="JP can replace the temporary bio, keep the verse as a small detail, and update every public contact link.">
            <div className="field-grid two">
              <Field label="Verse reference" value={content.brand.verseReference} onChange={(value) => update('brand.verseReference', value)} maxLength={80} />
              <Field label="Verse quote" value={content.brand.verseQuote} onChange={(value) => update('brand.verseQuote', value)} maxLength={180} />
            </div>
            <Field label="About heading" value={content.story.heading} onChange={(value) => update('story.heading', value)} maxLength={120} />
            <Field label="About JP bio" value={content.story.body} onChange={(value) => update('story.body', value)} textarea maxLength={700} />
            <label className="check-field"><input type="checkbox" checked={content.events.enabled} onChange={(event) => update('events.enabled', event.target.checked)} /> Show group and event section</label>
            <Field label="Event heading" value={content.events.heading} onChange={(value) => update('events.heading', value)} maxLength={120} />
            <Field label="Event description" value={content.events.body} onChange={(value) => update('events.body', value)} textarea maxLength={700} />
            <div className="field-grid two">
              <Field label="Event button" value={content.events.actionLabel} onChange={(value) => update('events.actionLabel', value)} maxLength={60} />
              <Field label="Event link (https, sms, tel, or mailto)" value={content.events.actionUrl} onChange={(value) => update('events.actionUrl', value)} maxLength={500} />
              <Field label="Public email" type="email" value={content.contact.email} onChange={(value) => update('contact.email', value)} maxLength={254} />
              <Field label="Instagram URL" type="url" value={content.contact.instagramUrl} onChange={(value) => update('contact.instagramUrl', value)} maxLength={500} />
              <Field label="Facebook URL" type="url" value={content.contact.facebookUrl} onChange={(value) => update('contact.facebookUrl', value)} maxLength={500} />
              <Field label="TikTok URL" type="url" value={content.contact.tiktokUrl} onChange={(value) => update('contact.tiktokUrl', value)} maxLength={500} />
              <Field label="YouTube URL" type="url" value={content.contact.youtubeUrl} onChange={(value) => update('contact.youtubeUrl', value)} maxLength={500} />
            </div>
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
    ['featured-video', 'Featured video'],
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
      else if (target === 'featured-video') {
        update('featured.type', 'video')
        update('featured.url', asset.url)
      } else update(`media.gallery.${Number(target.split('-')[1])}`, asset)
      setStatus('Media uploaded. Save and publish when the preview looks right.')
      setFile(null)
      setAlt('')
      event.currentTarget.reset()
    } catch (error) { setStatus(error.message) }
  }

  return <form className="media-uploader" onSubmit={upload}><label className="field"><span>Replace</span><select value={target} onChange={(event) => setTarget(event.target.value)}>{targets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>File</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><Field label="Image alt text" value={alt} onChange={setAlt} maxLength={180} /><button type="submit">Upload</button><p>Images: 6 MB max. Video: 15 MB max. JPEG, PNG, WebP, AVIF, MP4, or WebM.</p></form>
}

function MediaPreview({ label, asset }) {
  return <figure className="media-preview">{asset?.type === 'video' ? <video src={asset.url} preload="metadata" /> : <img src={asset?.url} alt="" loading="lazy" />}<figcaption><b>{label}</b><span>{asset?.alt || 'No alt text'}</span></figcaption></figure>
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
