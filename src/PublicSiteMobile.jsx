import { useEffect, useState } from 'react'
import {
  Armchair,
  CaretDown,
  CurrencyDollar,
  List,
  MapPin,
  Play,
  Scissors,
  Star,
  Tag,
  UserFocus,
  X,
} from '@phosphor-icons/react'

const SKINS = [
  { id: 'cut-record', number: '01', name: 'The Cut Record' },
  { id: 'jp-in-chair', number: '02', name: 'JP in the Chair' },
  { id: 'open-chair', number: '03', name: 'The Open Chair' },
]

function initialSkin(defaultSkin) {
  const query = new URLSearchParams(window.location.search).get('skin')
  if (SKINS.some(({ id }) => id === query)) return query
  const stored = window.localStorage.getItem('numbered-preview-skin')
  if (SKINS.some(({ id }) => id === stored)) return stored
  return defaultSkin || 'cut-record'
}

export function PublicSite({ content, contentStatus }) {
  const [skin, setSkin] = useState(() => initialSkin(content.settings.defaultSkin))

  useEffect(() => {
    document.documentElement.dataset.skin = skin
    window.localStorage.setItem('numbered-preview-skin', skin)
    const url = new URL(window.location.href)
    url.searchParams.set('skin', skin)
    window.history.replaceState({}, '', url)
  }, [skin])

  return (
    <div className="n-preview-shell">
      <PreviewBar skin={skin} onSelect={setSkin} />
      {contentStatus === 'fallback' && (
        <p className="n-fallback-note" role="status">Showing bundled preview copy while the editor reconnects.</p>
      )}
      {skin === 'cut-record' && <CutRecordSkin content={content} />}
      {skin === 'jp-in-chair' && <JpInChairSkin content={content} />}
      {skin === 'open-chair' && <OpenChairSkin content={content} />}
    </div>
  )
}

function PreviewBar({ skin, onSelect }) {
  const [open, setOpen] = useState(false)
  const selected = SKINS.find(({ id }) => id === skin) || SKINS[0]
  const choose = (id) => {
    onSelect(id)
    setOpen(false)
  }

  return (
    <div className="n-preview-bar">
      <span className="n-preview-label">Design preview</span>
      <button
        type="button"
        className="n-preview-current"
        aria-expanded={open}
        aria-controls="design-options"
        onClick={() => setOpen((current) => !current)}
      >
        <span><b>{selected.number} /</b> {selected.name}</span>
        <CaretDown size={18} weight="bold" aria-hidden="true" />
      </button>
      <div className={`skin-tabs n-skin-tabs ${open ? 'is-open' : ''}`} id="design-options" aria-label="Choose a website design">
        {SKINS.map((option) => (
          <button
            type="button"
            key={option.id}
            className={option.id === skin ? 'is-active' : ''}
            aria-pressed={option.id === skin}
            onClick={() => choose(option.id)}
          >
            <b>{option.number} /</b> {option.name}
          </button>
        ))}
        <a className="n-editor-link" href="/admin/">Editor</a>
      </div>
    </div>
  )
}

function SiteHeader({ content, centered = false }) {
  const [open, setOpen] = useState(false)
  return (
    <header className={`n-site-header ${centered ? 'is-centered' : ''}`}>
      <a className="n-brand" href="#top">{content.brand.publicName}</a>
      <nav aria-label="Primary navigation">
        <a href="#work">Work</a>
        <a href="#services">Services</a>
        <a href="#about">Story</a>
        {content.events.enabled && <a href="#events">Events</a>}
      </nav>
      <ExternalButton href={content.booking.url} className="n-header-book">Book</ExternalButton>
      <button
        type="button"
        className="n-site-menu-trigger"
        aria-label={open ? 'Close site menu' : 'Open site menu'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={28} weight="bold" aria-hidden="true" /> : <List size={30} weight="bold" aria-hidden="true" />}
      </button>
      {open && (
        <div className="n-site-menu">
          <a href="#work" onClick={() => setOpen(false)}>Work</a>
          <a href="#services" onClick={() => setOpen(false)}>Services</a>
          <a href="#about" onClick={() => setOpen(false)}>Story</a>
          {content.events.enabled && <a href="#events" onClick={() => setOpen(false)}>Events</a>}
          <ExternalButton href={content.booking.url}>Book with JP</ExternalButton>
        </div>
      )}
    </header>
  )
}

function ExternalButton({ href, className = '', children }) {
  if (!href) return null
  const external = /^https?:/.test(href)
  return (
    <a
      className={`n-button ${className}`}
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

function Photo({ asset, className = '', loading = 'lazy' }) {
  if (!asset?.url) return null
  if (asset.type === 'video') {
    return (
      <figure className={`photo n-photo ${className}`}>
        <video src={asset.url} controls playsInline preload="metadata" aria-label={asset.alt || 'Video by JP'} />
      </figure>
    )
  }
  return (
    <figure className={`photo n-photo ${className}`}>
      <img src={asset.url} alt={asset.alt || ''} loading={loading} />
    </figure>
  )
}

function Fact({ icon: Icon, value, label }) {
  return (
    <div className="n-fact">
      <Icon size={28} weight="bold" aria-hidden="true" />
      <div><b>{value}</b><span>{label}</span></div>
    </div>
  )
}

function ReviewSummary({ content, light = false }) {
  return (
    <div className={`n-review ${light ? 'is-light' : ''}`} aria-label={`${content.proof.rating} out of 5 from ${content.proof.reviewCount} Booksy reviews`}>
      <div className="n-stars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => <Star key={index} size={20} weight="fill" />)}
      </div>
      <strong>{content.proof.rating}</strong>
      <span>·</span>
      <b>{content.proof.reviewCount} reviews</b>
    </div>
  )
}

function safeEventUrl(content) {
  return /^(?:sms|tel):/i.test(content.events.actionUrl || '')
    ? content.contact.instagramUrl
    : content.events.actionUrl
}

function EventsSection({ content, light = false }) {
  if (!content.events.enabled) return null
  const href = safeEventUrl(content)
  return (
    <section className={`n-events ${light ? 'is-light' : ''}`} id="events">
      <p className="n-micro">Groups · events · mobile</p>
      <h2>{content.events.heading}</h2>
      <p>{content.events.body}</p>
      <ExternalButton href={href} className="n-button-outline">{content.events.actionLabel} →</ExternalButton>
    </section>
  )
}

function FeaturedMedia({ content, light = false }) {
  if (!content.featured.enabled || !content.featured.url) return null
  if (content.featured.type === 'video') {
    return (
      <div className={`n-featured ${light ? 'is-light' : ''}`}>
        <video src={content.featured.url} poster={content.featured.posterUrl} controls playsInline preload="metadata" />
      </div>
    )
  }

  const poster = content.featured.posterUrl || content.media.hero?.url
  return (
    <a
      className={`n-featured n-reel-poster ${light ? 'is-light' : ''}`}
      href={content.featured.url}
      target="_blank"
      rel="noreferrer"
      aria-label="Watch JP's featured reel on Instagram"
    >
      <img src={poster} alt="Featured work by JP" loading="lazy" />
      <span><Play size={22} weight="fill" aria-hidden="true" /> Watch featured reel</span>
    </a>
  )
}

function ConceptBand({ number, name, light = true }) {
  return <div className={`n-concept-band ${light ? 'is-light' : ''}`}><b>{number} /</b><span>{name}</span></div>
}

function SentenceBreak({ children }) {
  const text = String(children || '')
  const breakAt = text.indexOf('. ')
  if (breakAt < 0) return text
  return <>{text.slice(0, breakAt + 1)}<br />{text.slice(breakAt + 2)}</>
}

function WorkGrid({ content, light = false }) {
  const gallery = content.media.gallery.filter((item) => item?.url).slice(3, 7)
  return (
    <section className={`n-work ${light ? 'is-light' : ''}`} id="work">
      <header><p className="n-micro">Selected work</p><h2>The work speaks.</h2></header>
      <div>{gallery.map((asset) => <Photo key={asset.url} asset={asset} />)}</div>
    </section>
  )
}

function StorySection({ content, light = false }) {
  return (
    <section className={`n-story ${light ? 'is-light' : ''}`} id="about">
      <div>
        <p className="n-micro">{content.brand.verseReference}</p>
        <h2>{content.story.heading}</h2>
        <p>{content.story.body}</p>
      </div>
      <FeaturedMedia content={content} light={light} />
    </section>
  )
}

const servicePriority = ['line-up', 'adult-cut', 'cut-beard', 'kids-cut', 'after-hours']

function ServiceList({ content, graphic = false, limit }) {
  const services = content.services
    .filter((service) => service.enabled)
    .slice()
    .sort((left, right) => {
      const leftIndex = servicePriority.indexOf(left.id)
      const rightIndex = servicePriority.indexOf(right.id)
      return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
    })
    .slice(0, limit || undefined)

  return (
    <div className={`n-service-list ${graphic ? 'is-graphic' : ''}`}>
      {services.map((service) => {
        const Icon = service.id === 'line-up' ? Armchair : service.id === 'cut-beard' ? UserFocus : Scissors
        return (
          <div className="n-service-row" key={service.id}>
            {graphic && <Icon size={34} weight="fill" aria-hidden="true" />}
            <div><b>{service.name}</b>{!graphic && service.note && <span>{service.note}</span>}</div>
            <strong>{service.price}</strong>
          </div>
        )
      })}
    </div>
  )
}

function ServicesSection({ content, light = false }) {
  return (
    <section className={`n-services ${light ? 'is-light' : ''}`} id="services">
      <header><p className="n-micro">Current public menu</p><h2>Choose the cut.</h2></header>
      <ServiceList content={content} />
    </section>
  )
}

function SiteFooter({ content, light = false }) {
  return (
    <footer className={`n-footer ${light ? 'is-light' : ''}`}>
      <b>{content.brand.publicName}</b>
      {content.contact.instagramUrl && <ExternalButton href={content.contact.instagramUrl} className="n-footer-link">Instagram ↗</ExternalButton>}
      <small>Preview · Password protected · Not indexed</small>
    </footer>
  )
}

function CutRecordSkin({ content }) {
  const gallery = content.media.gallery.filter((item) => item?.url)
  const hero = content.media.hero || gallery[2]
  return (
    <main className="n-skin n-cut-record" id="top">
      <div className="n-page-frame">
        <SiteHeader content={content} />
        <section className="n-cr-hero">
          <Photo asset={hero} className="n-cr-hero-photo" loading="eager" />
          <div className="n-record-label"><b>001</b><span>Finished cut</span></div>
          <div className="n-cr-copy">
            <h1><SentenceBreak>{content.hero.headlines.cutRecord}</SentenceBreak></h1>
            <p className="n-eyebrow">{content.hero.eyebrow}</p>
          </div>
          <div className="n-fact-grid">
            <Fact icon={CurrencyDollar} value={content.facts.priceRange} label="Current public price range" />
            <Fact icon={MapPin} value={content.facts.location} label="Current public location" />
          </div>
          <ExternalButton href={content.booking.url} className="n-primary-book">Book with JP</ExternalButton>
          <Photo asset={gallery[1] || content.media.hero} className="n-cr-second-photo" />
        </section>
        <ConceptBand number="01" name="The Cut Record" />
      </div>
      <WorkGrid content={content} />
      <ServicesSection content={content} />
      <StorySection content={content} />
      <EventsSection content={content} />
      <SiteFooter content={content} />
    </main>
  )
}

function JpInChairSkin({ content }) {
  const gallery = content.media.gallery.filter((item) => item?.url)
  return (
    <main className="n-skin n-jp-chair" id="top">
      <div className="n-page-frame is-light">
        <SiteHeader content={content} />
        <section className="n-jc-hero">
          <Photo asset={gallery[1] || content.media.hero} className="n-jc-hero-photo" loading="eager" />
          <div className="n-jc-card">
            <h1>{content.hero.headlines.jpInChair}</h1>
            <p className="n-jc-promise">{content.story.heading}</p>
            <div className="n-jc-facts">
              <Fact icon={MapPin} value={`${content.facts.location} · ${content.facts.mobile}`} label="Current availability" />
              <Fact icon={Tag} value={content.facts.priceRange} label="Current public range" />
            </div>
            <ReviewSummary content={content} light />
            <ExternalButton href={content.booking.url} className="n-primary-book">Book with JP</ExternalButton>
          </div>
        </section>
        <ConceptBand number="02" name="JP in the Chair" />
      </div>
      <WorkGrid content={content} light />
      <ServicesSection content={content} light />
      <StorySection content={content} light />
      <EventsSection content={content} light />
      <SiteFooter content={content} light />
    </main>
  )
}

function OpenChairSkin({ content }) {
  const gallery = content.media.gallery.filter((item) => item?.url)
  return (
    <main className="n-skin n-open-chair" id="top">
      <div className="n-page-frame">
        <SiteHeader content={content} centered />
        <section className="n-oc-hero">
          <div className="n-oc-title">
            <p className="n-oc-brand">{content.brand.publicName}</p>
            <h1>{content.hero.headlines.openChair}</h1>
            <p>{content.facts.location} <span>·</span> {content.facts.mobile} available</p>
          </div>
          <Photo asset={gallery[2] || content.media.hero} className="n-oc-hero-photo" loading="eager" />
          <div className="n-oc-booking" id="services">
            <ServiceList content={content} graphic limit={3} />
            <ReviewSummary content={content} />
            <ExternalButton href={content.booking.url} className="n-primary-book">{content.booking.label}</ExternalButton>
            {content.events.enabled && <ExternalButton href={safeEventUrl(content)} className="n-button-outline">Event inquiry</ExternalButton>}
          </div>
        </section>
        <ConceptBand number="03" name="The Open Chair" />
      </div>
      <WorkGrid content={content} />
      <StorySection content={content} />
      <EventsSection content={content} />
      <SiteFooter content={content} />
    </main>
  )
}
