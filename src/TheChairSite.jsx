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
        <span>Nashville</span>
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
      <img src={content.media.hero.url} alt={content.media.hero.alt} fetchPriority="high" />
      <div className="chair-hero-shade" aria-hidden="true" />
      <div className="chair-hero-copy">
        <p className="chair-kicker">{content.hero.eyebrow}</p>
        <h1 id="chair-hero-heading"><HeroHeadline text={content.hero.headline} /></h1>
        <p className="chair-price">{content.facts.priceRange} <span>·</span> About 35 minutes</p>
      </div>
      <p className="chair-verse-mark">{content.brand.verseReference}</p>
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
            <span>{service.duration || service.note}</span>
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
        <p>{content.story.body}</p>
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
  const eventPhotos = content.media.gallery.slice(5, 8)
  return (
    <section className="chair-section chair-events" id="events">
      <div className="chair-events-copy">
        <p className="chair-outline-label">Bring the chair to you</p>
        <h2>{content.events.heading}</h2>
        <p>{content.events.body}</p>
        <ExternalButton href={safeEventUrl(content)} className="chair-outline-button">{content.events.actionLabel}</ExternalButton>
      </div>
      <div className="chair-events-grid">
        {eventPhotos.map((asset, index) => <Photo key={asset.url} asset={asset} className={`event-${index + 1}`} />)}
      </div>
    </section>
  )
}

function Booking({ content }) {
  return (
    <section className="chair-booking" id="booking">
      <Photo asset={content.media.hero} />
      <div>
        <p className="chair-kicker">{content.facts.mobile}</p>
        <h2>Ready for your next cut?</h2>
        <p className="chair-price">{content.facts.priceRange} <span>·</span> About 35 minutes</p>
        <ExternalButton href={content.booking.url}>{content.booking.label}</ExternalButton>
        <ExternalButton href={content.contact.instagramUrl} className="chair-outline-button">Follow @jpcuuts</ExternalButton>
      </div>
    </section>
  )
}

function SiteFooter({ content }) {
  return (
    <footer className="chair-footer">
      <div className="chair-brand"><strong>{content.brand.publicName}</strong><span>Nashville</span></div>
      <p>{content.facts.location}</p>
      <a href={`mailto:${content.contact.email}`}>{content.contact.email}</a>
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
  return <figure className={`chair-photo ${className}`}><img src={asset.url} alt={asset.alt || ''} loading="lazy" /></figure>
}

function FeaturedMedia({ content }) {
  if (!content.featured.enabled || !content.featured.url) return null
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

function safeEventUrl(content) {
  return /^(?:sms|tel):/i.test(content.events.actionUrl || '') ? content.contact.instagramUrl : content.events.actionUrl
}
