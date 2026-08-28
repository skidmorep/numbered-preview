import { useEffect, useState } from 'react'
import { instagramEmbedUrl } from './siteContent'

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
    <div className="preview-shell">
      <PreviewBar skin={skin} onSelect={setSkin} />
      {contentStatus === 'fallback' && (
        <p className="fallback-note" role="status">Showing bundled preview copy while the editor service reconnects.</p>
      )}
      {skin === 'cut-record' && <CutRecordSkin content={content} />}
      {skin === 'jp-in-chair' && <JpInChairSkin content={content} />}
      {skin === 'open-chair' && <OpenChairSkin content={content} />}
    </div>
  )
}

function PreviewBar({ skin, onSelect }) {
  return (
    <div className="preview-bar">
      <span className="preview-label">Design preview</span>
      <div className="skin-tabs" aria-label="Choose a website design">
        {SKINS.map((option) => (
          <button
            type="button"
            key={option.id}
            className={option.id === skin ? 'is-active' : ''}
            aria-pressed={option.id === skin}
            onClick={() => onSelect(option.id)}
          >
            <b>{option.number}</b> {option.name}
          </button>
        ))}
      </div>
      <a className="editor-link" href="/admin/">Editor</a>
    </div>
  )
}

function SiteHeader({ content, light = false, compact = false }) {
  return (
    <header className={`site-header ${light ? 'is-light' : ''} ${compact ? 'is-compact' : ''}`}>
      <a className="brand" href="#top" aria-label={`${content.brand.publicName} home`}>
        <span className="brand-mark">JP</span>
        <span>{content.brand.publicName}</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#work">Work</a>
        <a href="#services">Services</a>
        <a href="#about">Meet JP</a>
        {content.events.enabled && <a href="#events">Events</a>}
      </nav>
      <ExternalButton href={content.booking.url} className="header-book">
        {content.booking.label}
      </ExternalButton>
    </header>
  )
}

function ExternalButton({ href, className = '', children }) {
  if (!href) return null
  const external = /^https?:/.test(href)
  return (
    <a
      className={`button ${className}`}
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

function Photo({ asset, className = '', label = '', number = '', loading = 'lazy' }) {
  if (!asset?.url) return null
  if (asset.type === 'video') {
    return (
      <figure className={`photo ${className}`}>
        <video src={asset.url} controls playsInline preload="metadata" aria-label={asset.alt || label} />
        {(label || number) && <figcaption><span>{label}</span><b>{number}</b></figcaption>}
      </figure>
    )
  }
  return (
    <figure className={`photo ${className}`}>
      <img src={asset.url} alt={asset.alt || ''} loading={loading} />
      {(label || number) && <figcaption><span>{label}</span><b>{number}</b></figcaption>}
    </figure>
  )
}

function RatingBand({ content, dark = false }) {
  return (
    <section className={`rating-band ${dark ? 'is-dark' : ''}`} aria-label="Public review rating">
      <strong>{content.proof.rating}</strong>
      <p>{content.proof.reviewCount} public Booksy reviews. Real customers carry the claim.</p>
      <span>{content.proof.sourceLabel}</span>
    </section>
  )
}

function EventsSection({ content, className }) {
  if (!content.events.enabled) return null
  return (
    <section className={className} id="events">
      <div>
        <p className="micro">Groups · events · mobile</p>
        <h2>{content.events.heading}</h2>
      </div>
      <p>{content.events.body}</p>
      <ExternalButton href={content.events.actionUrl}>{content.events.actionLabel} →</ExternalButton>
    </section>
  )
}

function FeaturedMedia({ content }) {
  const embedUrl = instagramEmbedUrl(content.featured.url)
  if (!content.featured.enabled || !content.featured.url) return null

  return (
    <div className="featured-media">
      {content.featured.type === 'instagram' && embedUrl ? (
        <iframe
          title={content.featured.heading || 'Featured Instagram reel'}
          src={embedUrl}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        />
      ) : content.featured.type === 'video' ? (
        <video src={content.featured.url} poster={content.featured.posterUrl} controls playsInline preload="metadata" />
      ) : (
        <img src={content.featured.url} alt={content.featured.heading || ''} loading="lazy" />
      )}
      <ExternalButton href={content.featured.url} className="featured-fallback">Open featured reel ↗</ExternalButton>
    </div>
  )
}

function CutRecordSkin({ content }) {
  const gallery = content.media.gallery.filter((item) => item?.url)
  const heroPhotos = [content.media.hero, gallery[1], gallery[2]].filter(Boolean)
  return (
    <main className="skin skin-cut-record" id="top">
      <SiteHeader content={content} />
      <section className="cr-hero">
        <div className="cr-copy">
          <p className="micro">{content.hero.eyebrow}</p>
          <h1>{content.hero.headlines.cutRecord}</h1>
          <p className="lede">{content.hero.intro}</p>
          <div className="fact-line"><span>● {content.facts.location}</span><span>↗ {content.facts.mobile}</span></div>
          <div className="actions">
            <ExternalButton href={content.booking.url}>Book with JP</ExternalButton>
            {content.events.enabled && <ExternalButton href={content.events.actionUrl} className="button-ghost">Event inquiry</ExternalButton>}
          </div>
        </div>
        <div className="cr-contact-sheet">
          {heroPhotos.map((asset, index) => (
            <Photo key={`${asset.url}-${index}`} asset={asset} className={`cr-photo cr-photo-${index + 1}`} label={index === 0 ? 'Finished cut / JP Cutz' : 'Detail'} number={`00${index + 1}`} loading={index === 0 ? 'eager' : 'lazy'} />
          ))}
        </div>
      </section>
      <section className="cr-ledger" id="services">
        <div><b>{content.facts.priceRange}</b><span>Current public price range</span></div>
        <div><b>{content.facts.location}</b><span>Current public location</span></div>
        <div><b>{content.facts.mobile}</b><span>Available by request</span></div>
        <div><b>{content.facts.bookingTruth}</b><span>One booking truth</span></div>
      </section>
      <RatingBand content={content} dark />
      <section className="cr-work" id="work">
        <div className="cr-work-copy">
          <p className="micro">The cut record</p>
          <h2>The work speaks first.</h2>
          <p>Each cut gets a number and a clear caption. Number the work—not the customer.</p>
        </div>
        {gallery.slice(3, 6).map((asset, index) => (
          <Photo key={asset.url} asset={asset} label="Work sample" number={`00${index + 4}`} />
        ))}
      </section>
      <section className="cr-about" id="about">
        <div>
          <p className="micro">{content.brand.verseReference}</p>
          <h2>{content.story.heading}</h2>
          <p>{content.story.body}</p>
        </div>
        <FeaturedMedia content={content} />
      </section>
      <EventsSection content={content} className="cr-event" />
      <SiteFooter content={content} />
    </main>
  )
}

function JpInChairSkin({ content }) {
  const gallery = content.media.gallery.filter((item) => item?.url)
  return (
    <main className="skin skin-jp-chair" id="top">
      <SiteHeader content={content} light />
      <section className="jc-hero">
        <Photo asset={gallery[0] || content.media.hero} className="jc-main-photo" label="Recent work / Nashville" number="A finished cut by JP." loading="eager" />
        <div className="jc-copy">
          <p className="micro">One chair. One clear plan.</p>
          <h1>{content.hero.headlines.jpInChair}</h1>
          <p className="lede">{content.hero.intro}</p>
          <div className="jc-facts">
            <div><b>{content.facts.priceRange}</b><span>Current public range</span></div>
            <div><b>{content.facts.location}</b><span>{content.facts.mobile} available</span></div>
          </div>
          <ExternalButton href={content.booking.url}>{content.booking.label} →</ExternalButton>
        </div>
      </section>
      <section className="jc-gallery" id="work">
        {gallery.slice(1, 4).map((asset, index) => (
          <Photo key={asset.url} asset={asset} label={['Clean lines', 'Ready to go', 'Finished work'][index]} number={`0${index + 1}`} />
        ))}
      </section>
      <section className="jc-story" id="about">
        <div className="jc-rating"><strong>{content.proof.rating}</strong><p>{content.proof.reviewCount} public Booksy reviews. Let real customers carry the claim.</p><span>{content.proof.sourceLabel}</span></div>
        <div className="jc-meet"><Photo asset={content.media.portrait} /><div><p className="micro">Meet your barber</p><h2>JP makes it simple.</h2><p>{content.hero.intro}</p></div></div>
        <div className="jc-origin"><p className="micro">{content.brand.verseReference}</p><h2>{content.story.heading}</h2><p>{content.story.body}</p></div>
      </section>
      <section className="jc-services" id="services">
        <div><p className="micro">Current public menu</p><h2>Choose the cut.</h2></div>
        <ServiceList content={content} />
      </section>
      <section className="jc-featured"><FeaturedMedia content={content} /></section>
      <EventsSection content={content} className="jc-event" />
      <SiteFooter content={content} light />
    </main>
  )
}

function OpenChairSkin({ content }) {
  const gallery = content.media.gallery.filter((item) => item?.url)
  const sequence = [gallery[1], gallery[0], gallery[6]].filter(Boolean)
  return (
    <main className="skin skin-open-chair" id="top">
      <SiteHeader content={content} compact />
      <section className="oc-hero">
        <div className="oc-sequence">
          {sequence.map((asset, index) => (
            <Photo key={asset.url} asset={asset} className={`oc-photo oc-photo-${index + 1}`} label={['01 / Finish', '02 / Detail', '03 / Ready'][index]} number={index === 0 ? 'JP' : index === 1 ? '✓' : '→'} loading={index === 0 ? 'eager' : 'lazy'} />
          ))}
        </div>
        <div className="oc-booking" id="services">
          <p className="micro">{content.hero.eyebrow}</p>
          <h1>{content.hero.headlines.openChair}</h1>
          <p className="lede">Proof, price, location, and the next opening—without making people hunt.</p>
          <ServiceList content={content} compact />
          <div className="oc-facts"><span><b>{content.facts.priceRange}</b> public price range</span><span><b>{content.facts.location}</b> current listing</span></div>
          <ExternalButton href={content.booking.url} className="oc-book">{content.booking.label} with JP →</ExternalButton>
        </div>
      </section>
      <RatingBand content={content} />
      <section className="oc-work" id="work">
        {gallery.slice(2, 5).map((asset, index) => <Photo key={asset.url} asset={asset} label="Recent work" number={`0${index + 4}`} />)}
        <div className="oc-work-copy"><p className="micro">No placeholder promises</p><h2>See the cut. Then book the chair.</h2><p>The gallery becomes the sales argument. New work can replace old work without redesigning the page.</p></div>
      </section>
      <section className="oc-about" id="about"><div><p className="micro">{content.brand.verseReference}</p><h2>{content.story.heading}</h2><p>{content.story.body}</p></div><FeaturedMedia content={content} /></section>
      <EventsSection content={content} className="oc-event" />
      <SiteFooter content={content} />
    </main>
  )
}

function ServiceList({ content, compact = false }) {
  const services = content.services.filter((service) => service.enabled)
  return (
    <div className={`service-list ${compact ? 'is-compact' : ''}`}>
      {services.map((service) => (
        <div className="service-row" key={service.id}>
          <div><b>{service.name}</b>{!compact && service.note && <span>{service.note}</span>}</div>
          <strong>{service.price}</strong>
        </div>
      ))}
    </div>
  )
}

function SiteFooter({ content, light = false }) {
  return (
    <footer className={light ? 'is-light' : ''}>
      <span>{content.brand.publicName}</span>
      <div>
        {content.contact.instagramUrl && <ExternalButton href={content.contact.instagramUrl}>Instagram ↗</ExternalButton>}
        {content.contact.phone && <a href={`tel:${content.contact.phone.replace(/[^+\d]/g, '')}`}>{content.contact.phone}</a>}
      </div>
      <small>Preview · Not indexed · Public details sourced from JP's Booksy listing</small>
    </footer>
  )
}
