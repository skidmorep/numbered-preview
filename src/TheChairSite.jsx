import { useState } from 'react'
import {
  FacebookLogo,
  InstagramLogo,
  List,
  TiktokLogo,
  X,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { BeforeAfterSlider } from './BeforeAfterSlider'
import { imageFocusStyle, instagramEmbedUrl } from './siteContent'

const socialLinks = [
  ['instagramUrl', 'Instagram', InstagramLogo],
  ['facebookUrl', 'Facebook', FacebookLogo],
  ['tiktokUrl', 'TikTok', TiktokLogo],
  ['youtubeUrl', 'YouTube', YoutubeLogo],
]

export function PublicSite({ content, contentStatus }) {
  return (
    <div className="chair-site" id="top">
      {contentStatus === 'fallback' && (
        <p className="chair-fallback" role="status">Showing bundled preview copy while the editor reconnects.</p>
      )}
      <SiteHeader content={content} />
      <main>
        <Hero content={content} />
        <CamoAccent />
        <Work content={content} />
        <CamoAccent compact />
        <Services content={content} />
        <CamoAccent compact />
        <About content={content} />
        {content.events.enabled && <Events content={content} />}
        <CamoAccent compact />
        <Booking content={content} />
      </main>
      <SiteFooter content={content} />
      <a className="chair-mobile-book" href={content.booking.url} target="_blank" rel="noreferrer">
        {content.booking.label}
      </a>
    </div>
  )
}

function SiteHeader({ content }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="chair-header">
      <a className="chair-brand" href="#top" aria-label="JP Cuts home">
        <strong>{content.brand.publicName}</strong>
        <span>{content.facts.mobile}</span>
      </a>
      <nav className="chair-desktop-nav" aria-label="Primary navigation">
        <a href="#work">Work</a>
        <a href="#services">Services</a>
        <a href="#about">About</a>
        <a href={content.contact.instagramUrl} target="_blank" rel="noreferrer">@jpcuuts</a>
      </nav>
      <ExternalButton href={content.booking.url} className="chair-header-book">Book a cut</ExternalButton>
      <button
        type="button"
        className="chair-menu-trigger"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="chair-mobile-menu"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={28} weight="bold" aria-hidden="true" /> : <List size={30} weight="bold" aria-hidden="true" />}
      </button>
      <nav className={`chair-mobile-menu ${open ? 'is-open' : ''}`} id="chair-mobile-menu" aria-label="Mobile navigation">
        <a href="#work" onClick={close}>Work</a>
        <a href="#services" onClick={close}>Services</a>
        <a href="#about" onClick={close}>About</a>
        {content.events.enabled && <a href="#events" onClick={close}>Events</a>}
        <ExternalButton href={content.booking.url}>Book a cut</ExternalButton>
      </nav>
    </header>
  )
}

function Hero({ content }) {
  return (
    <section className="chair-hero" aria-labelledby="chair-hero-heading">
      <img src={content.media.hero.url} alt={content.media.hero.alt} fetchPriority="high" style={imageFocusStyle(content.media.hero)} />
      <div className="chair-hero-shade" aria-hidden="true" />
      <div className="chair-hero-copy">
        <p className="chair-kicker">{content.hero.eyebrow}</p>
        <h1 id="chair-hero-heading"><HeroHeadline text={content.hero.headline} /></h1>
        <p className="chair-price">{content.facts.priceRange} <span>·</span> 35 minutes</p>
      </div>
    </section>
  )
}

function Work({ content }) {
  const work = content.media.gallery.slice(0, 3)
  return (
    <section className="chair-section chair-work" id="work">
      <header className="chair-section-heading">
        <p className="chair-outline-label">Fresh cut</p>
        <h2>Real cuts.<br />Real clients.</h2>
      </header>
      {content.media.beforeAfter.enabled && (
        <BeforeAfterSlider before={content.media.beforeAfter.before} after={content.media.beforeAfter.after} heading={content.media.beforeAfter.heading} />
      )}
      <div className="chair-work-grid">
        {work.map((asset, index) => <Photo key={asset.url} asset={asset} className={`work-${index + 1}`} />)}
      </div>
      <FeaturedMedia content={content} />
      <ExternalButton href={content.contact.instagramUrl} className="chair-outline-button">See more on Instagram</ExternalButton>
    </section>
  )
}

function Services({ content }) {
  return (
    <section className="chair-section chair-services" id="services">
      <header className="chair-section-heading">
        <p className="chair-outline-label">Services</p>
        <h2>Simple pricing.<br />No surprises.</h2>
      </header>
      <div className="chair-service-grid">
        {content.services.filter((service) => service.enabled).map((service) => (
          <article className="chair-service" key={service.id}>
            <p>{service.name}</p>
            <strong>{service.price}</strong>
            <span>{[service.duration, service.note].filter(Boolean).join(' · ')}</span>
          </article>
        ))}
      </div>
      <ExternalButton href={content.booking.url}>Book your cut</ExternalButton>
    </section>
  )
}

function About({ content }) {
  const support = content.media.gallery.slice(3, 5)
  return (
    <section className="chair-section chair-about" id="about">
      <div className="chair-about-copy">
        <p className="chair-outline-label">{content.story.heading}</p>
        <h2>Clean cuts. Easy conversation. No pretense.</h2>
        <p className="chair-about-intro">{content.hero.intro}</p>
        <div className="chair-bio-copy">
          {String(content.story.body || '').split(/\n\s*\n/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <p className="chair-location">{content.facts.location}</p>
      </div>
      <div className="chair-about-images">
        <Photo asset={content.media.portrait} className="about-main" />
        {support.map((asset, index) => <Photo key={asset.url} asset={asset} className={`about-support-${index + 1}`} />)}
      </div>
      <blockquote>
        “{content.brand.verseQuote}”
        <cite>{content.brand.verseReference}</cite>
      </blockquote>
    </section>
  )
}

function Events({ content }) {
  const weddingPhotos = content.media.gallery.slice(5, 8)
  const teamPhotos = content.media.gallery.slice(8, 11)
  return (
    <section className="chair-section chair-events" id="events">
      <div className="chair-events-copy">
        <p className="chair-outline-label">Events · Groups · Teams</p>
        <h2>{content.events.heading}</h2>
        <p>{content.events.body}</p>
        <ContactAccordion label={content.events.actionLabel} />
      </div>
      <div className="chair-event-groups">
        <EventPhotoGroup heading="Weddings & events" photos={weddingPhotos} group="wedding" />
        <EventPhotoGroup heading="Teams & groups" photos={teamPhotos} group="team" />
      </div>
    </section>
  )
}

function EventPhotoGroup({ heading, photos, group }) {
  if (!photos.some((asset) => asset?.url)) return null
  return (
    <section className="chair-event-group" aria-label={heading}>
      <h3>{heading}</h3>
      <div className="chair-events-grid">
        {photos.map((asset, index) => <Photo key={asset.url} asset={asset} className={`${group}-${index + 1}`} />)}
      </div>
    </section>
  )
}

function ContactAccordion({ label = 'Ask about an event' }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [startedAt, setStartedAt] = useState(0)

  const toggle = () => {
    setOpen((current) => {
      const next = !current
      if (next) setStartedAt(Date.now())
      else setStatus('')
      return next
    })
  }

  const submit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setStatus('Sending…')
    try {
      const fields = Object.fromEntries(new FormData(form))
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ ...fields, startedAt }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Message could not be sent. Try again.')
      form.reset()
      setStatus('Thanks — your message was sent to JP.')
      window.setTimeout(() => {
        setOpen(false)
        setStatus('')
      }, 2500)
    } catch (error) {
      setStatus(error.message)
    }
  }

  return (
    <div className={`chair-contact ${open ? 'is-open' : ''}`}>
      <button type="button" className="chair-contact-toggle" aria-expanded={open} aria-controls="event-contact-form" onClick={toggle}>
        <span>{label}</span><span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <form className="chair-contact-form" id="event-contact-form" onSubmit={submit}>
          <div className="chair-contact-row">
            <label><span>Name</span><input name="name" autoComplete="name" maxLength="80" required /></label>
            <label><span>Email</span><input name="email" type="email" autoComplete="email" maxLength="254" required /></label>
          </div>
          <div className="chair-contact-row">
            <label><span>Group or organization</span><input name="organization" maxLength="120" /></label>
            <label><span>Event date</span><input name="eventDate" type="date" /></label>
          </div>
          <label><span>Tell JP about the event</span><textarea name="details" rows="5" maxLength="1200" required /></label>
          <label className="chair-contact-honeypot" aria-hidden="true"><span>Website</span><input name="website" tabIndex="-1" autoComplete="off" /></label>
          <button type="submit" disabled={status === 'Sending…'}>Send message</button>
          <p className="chair-contact-status" role="status" aria-live="polite">{status}</p>
        </form>
      )}
    </div>
  )
}

function Booking({ content }) {
  return (
    <section className="chair-booking" id="booking">
      <Photo asset={content.media.hero} />
      <div>
        <p className="chair-kicker">{content.facts.mobile}</p>
        <h2>Ready for your next cut?</h2>
        <p className="chair-price">{content.facts.priceRange} <span>·</span> 35 minutes</p>
        <ExternalButton href={content.booking.url}>{content.booking.label}</ExternalButton>
        <ExternalButton href={content.contact.instagramUrl} className="chair-outline-button">Follow @jpcuuts</ExternalButton>
      </div>
    </section>
  )
}

function SiteFooter({ content }) {
  return (
    <footer className="chair-footer">
      <div className="chair-brand"><strong>{content.brand.publicName}</strong><span>{content.facts.mobile}</span></div>
      <p>{content.facts.location}</p>
      <div className="chair-socials" aria-label="JP Cuts on social media">
        {socialLinks.map(([key, label, Icon]) => content.contact[key] && (
          <a key={key} href={content.contact[key]} target="_blank" rel="noreferrer" aria-label={label}>
            <Icon size={24} weight="bold" aria-hidden="true" />
          </a>
        ))}
      </div>
      <small>© {new Date().getFullYear()} JP Cuts</small>
    </footer>
  )
}

function CamoAccent({ compact = false }) {
  return <div className={`chair-camo ${compact ? 'is-compact' : ''}`} aria-hidden="true" />
}

function Photo({ asset, className = '' }) {
  if (!asset?.url) return null
  return <figure className={`chair-photo ${className}`}><img src={asset.url} alt={asset.alt || ''} loading="lazy" style={imageFocusStyle(asset)} /></figure>
}

function FeaturedMedia({ content }) {
  if (!content.featured.enabled || !content.featured.url) return null
  if (content.featured.type === 'instagram') {
    const embedUrl = instagramEmbedUrl(content.featured.url)
    if (!embedUrl) return null
    return (
      <figure className="chair-featured chair-reel">
        <iframe
          src={embedUrl}
          title={content.featured.heading || 'Featured Instagram Reel from JP'}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
        <figcaption>{content.featured.heading || 'Featured Reel'} · <a href={content.featured.url} target="_blank" rel="noreferrer">Open on Instagram</a></figcaption>
      </figure>
    )
  }
  if (content.featured.type === 'video') {
    return (
      <figure className="chair-featured">
        <video src={content.featured.url} poster={content.featured.posterUrl} controls playsInline preload="metadata" />
        <figcaption>{content.featured.heading}</figcaption>
      </figure>
    )
  }
  if (content.featured.type === 'image') {
    return (
      <figure className="chair-featured">
        <img src={content.featured.url} alt={content.featured.heading || 'Featured work by JP'} loading="lazy" />
        <figcaption>{content.featured.heading}</figcaption>
      </figure>
    )
  }
  return (
    <a className="chair-featured" href={content.featured.url} target="_blank" rel="noreferrer">
      <img src={content.featured.posterUrl || content.media.gallery[0]?.url} alt="Featured work by JP" loading="lazy" />
      <span>Watch {content.featured.heading || 'JP’s latest reel'} →</span>
    </a>
  )
}

function ExternalButton({ href, className = '', children }) {
  if (!href) return null
  const external = /^https?:/.test(href)
  return <a className={`chair-button ${className}`} href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</a>
}

function HeroHeadline({ text }) {
  const parts = String(text || '').trim().replace(/\.$/, '').split(/\.\s+/)
  if (parts.length < 2) return text
  return parts.filter(Boolean).map((part, index) => (
    <span key={part}>{part}.{index < parts.length - 1 ? ' ' : ''}</span>
  ))
}
