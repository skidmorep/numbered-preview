import { useEffect, useRef, useState } from 'react'
import {
  FacebookLogo,
  InstagramLogo,
  List,
  TiktokLogo,
  X,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { BeforeAfterSlider } from './BeforeAfterSlider'
import { imageFocusStyle } from './siteContent'

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
        <Availability content={content} />
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
        <span className="chair-mobile-book-copy">
          <span>{content.booking.label}</span>
          <small>{content.services[0].price} · 35 min</small>
        </span>
        <span className="chair-mobile-book-mark" aria-hidden="true">
          <BrandMark content={content} decorative />
        </span>
      </a>
    </div>
  )
}

function SiteHeader({ content }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return undefined
    const escape = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open])

  return (
    <header className="chair-header">
      <a className={`chair-brand ${content.brand.logo?.url ? 'has-logo' : ''}`} href="#top" aria-label="JP Cuts home">
        <BrandMark content={content} decorative />
        <span className="chair-brand-region">{content.facts.mobile}</span>
      </a>
      <nav className="chair-desktop-nav" aria-label="Primary navigation">
        <a href="#work">Work</a>
        <a href="#services">Services</a>
        <a href="#about">About</a>
        <a href={content.contact.instagramUrl} target="_blank" rel="noreferrer">@jpcuuts</a>
      </nav>
      <ExternalButton href={content.booking.url} className="chair-header-book">{content.booking.label}</ExternalButton>
      <button
        ref={triggerRef}
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
        <ExternalButton href={content.booking.url}>{content.booking.label}</ExternalButton>
      </nav>
    </header>
  )
}

function Hero({ content }) {
  return (
    <section className="chair-hero" aria-labelledby="chair-hero-heading">
      <img src={content.media.hero.url} alt={content.media.hero.alt} fetchPriority="high" style={imageFocusStyle(content.media.hero)} />
      <div className="chair-hero-shade" aria-hidden="true" />
      <div className="chair-hero-brand" aria-label={content.brand.publicName}>
        <BrandMark content={content} decorative />
      </div>
      <div className="chair-hero-copy">
        <p className="chair-kicker">{content.hero.eyebrow}</p>
        <h1 id="chair-hero-heading"><HeroHeadline text={content.hero.headline} /></h1>
        <div className="chair-hero-offer" aria-label={`Haircut, ${content.services[0].price}, ${content.services[0].duration}`}>
          <strong>{content.services[0].price}</strong>
          <span>Haircut · {content.services[0].duration}</span>
        </div>
        <a className="chair-hero-book" href={content.booking.url} target="_blank" rel="noreferrer">
          <span>{content.booking.label}</span>
        </a>
        <p className="chair-hero-addon">Optional {content.services[1].name.toLowerCase()} · {content.services[1].price}</p>
      </div>
    </section>
  )
}

function Availability({ content }) {
  const faded = content.locations.fadedUniversity
  const lipscomb = content.locations.lipscomb
  return (
    <section className="chair-availability" aria-labelledby="chair-availability-heading">
      <header>
        <p className="chair-kicker">Locations & availability</p>
        <h2 id="chair-availability-heading">Where JP cuts</h2>
      </header>
      <div className="chair-location-grid">
        <article>
          <p>{faded.availabilityLabel}</p>
          <h3>{faded.name}</h3>
          <address>{faded.address}</address>
          <strong>{faded.hours}</strong>
          <span>{faded.bookingNote}</span>
        </article>
        <article>
          <p>{lipscomb.availabilityLabel}</p>
          <h3>{lipscomb.name}</h3>
          <strong>{lipscomb.businessNote}</strong>
          <span>{lipscomb.locationNote}</span>
        </article>
      </div>
    </section>
  )
}

function Work({ content }) {
  const work = content.media.gallery.slice(0, 3)
  return (
    <section className="chair-section chair-work" id="work">
      <header className="chair-section-heading">
        <p className="chair-outline-label">{content.work.eyebrow}</p>
        <h2><MultilineText text={content.work.heading} /></h2>
      </header>
      {content.media.beforeAfter.enabled && (
        <BeforeAfterSlider before={content.media.beforeAfter.before} after={content.media.beforeAfter.after} heading={content.media.beforeAfter.heading} />
      )}
      <div className="chair-work-grid">
        {work.map((asset, index) => <Photo key={asset.url} asset={asset} className={`work-${index + 1}`} />)}
      </div>
      <FeaturedMedia content={content} />
      <ExternalButton href={content.contact.instagramUrl} className="chair-outline-button">{content.work.instagramLabel}</ExternalButton>
    </section>
  )
}

function Services({ content }) {
  return (
    <section className="chair-section chair-services" id="services">
      <header className="chair-section-heading">
        <p className="chair-outline-label">{content.servicesSection.eyebrow}</p>
        <h2><MultilineText text={content.servicesSection.heading} /></h2>
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
      <ExternalButton href={content.booking.url}>{content.booking.label}</ExternalButton>
    </section>
  )
}

function About({ content }) {
  return (
    <section className="chair-section chair-about" id="about">
      <div className="chair-about-copy">
        <p className="chair-outline-label">{content.story.heading}</p>
        <h2>{content.story.subtitle}</h2>
        <p className="chair-about-intro">{content.hero.intro}</p>
        <div className="chair-bio-copy">
          {String(content.story.body || '').split(/\n\s*\n/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </div>
      <div className="chair-about-images">
        <Photo asset={content.media.portrait} className="about-main" />
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
        <p className="chair-outline-label">{content.events.outlineHeading}</p>
        <h2>{content.events.heading}</h2>
        <p>{content.events.body}</p>
        <ContactAccordion label={content.events.actionLabel} />
      </div>
      <div className="chair-event-groups">
        <EventPhotoGroup heading={content.events.weddingHeading} photos={weddingPhotos} group="wedding" />
        <EventPhotoGroup heading={content.events.teamHeading} photos={teamPhotos} group="team" />
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
        <h2>{content.booking.heading}</h2>
        <p className="chair-price">{content.services[0].price} <span>·</span> {content.services[0].duration}</p>
        <ExternalButton href={content.booking.url}>{content.booking.label}</ExternalButton>
        <ExternalButton href={content.contact.instagramUrl} className="chair-outline-button">{content.booking.instagramLabel}</ExternalButton>
      </div>
    </section>
  )
}

function SiteFooter({ content }) {
  return (
    <footer className="chair-footer">
      <div className={`chair-brand ${content.brand.logo?.url ? 'has-logo' : ''}`} aria-label={content.brand.publicName}>
        <BrandMark content={content} decorative />
        <span className="chair-brand-region">{content.facts.mobile}</span>
      </div>
      <p>{content.locations.fadedUniversity.name} · {content.locations.lipscomb.name}</p>
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

function BrandMark({ content, decorative = false }) {
  if (content.brand.logo?.url) {
    return <img src={content.brand.logo.url} alt={decorative ? '' : (content.brand.logo.alt || content.brand.publicName)} />
  }
  return <strong>{content.brand.publicName}</strong>
}

function Photo({ asset, className = '' }) {
  if (!asset?.url) return null
  return <figure className={`chair-photo ${className}`}><img src={asset.url} alt={asset.alt || ''} loading="lazy" style={imageFocusStyle(asset)} /></figure>
}

function FeaturedMedia({ content }) {
  if (!content.featured.enabled || !content.featured.url) return null
  if (content.featured.type === 'instagram') {
    return (
      <a className="chair-featured chair-reel-link" href={content.featured.url} target="_blank" rel="noreferrer">
        <img src={content.featured.posterUrl || content.media.gallery[0]?.url} alt="" loading="lazy" />
        <span>{content.featured.heading || 'Watch JP’s Reel'} · Open on Instagram →</span>
      </a>
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
  const original = String(text || '').trim()
  if (!/\.\s+/.test(original)) return <span>{original}</span>
  const parts = original.replace(/\.$/, '').split(/\.\s+/)
  return parts.filter(Boolean).map((part, index) => (
    <span key={part}>{part}.{index < parts.length - 1 ? ' ' : ''}</span>
  ))
}

function MultilineText({ text }) {
  return String(text || '').split(/\n+/).filter(Boolean).map((line, index) => <span key={`${line}-${index}`}>{line}{index === String(text || '').split(/\n+/).filter(Boolean).length - 1 ? '' : <br />}</span>)
}
