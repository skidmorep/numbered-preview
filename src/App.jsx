import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Camera,
  MapPin,
  Scissors,
} from 'lucide-react'
import './App.css'
import jpReelStill from './assets/jp-reel.jpg'

const bookingUrl = 'https://calendly.com/jpcuts/30mins'
const reelUrl = 'https://www.instagram.com/reel/DX1nfUogdFn/'

const services = [
  {
    name: 'Chair cut',
    detail: 'A 30-minute chair for the cut you need.',
    price: '$30',
  },
  {
    name: 'Cut + beard',
    detail: 'The same chair with a beard trim added on.',
    price: '$40',
  },
  {
    name: 'House call',
    detail: 'JP packs the tools, travels, and cuts on site.',
    price: '$50',
  },
]

const scheduleItems = [
  {
    icon: MapPin,
    label: 'Nashville all summer',
  },
  {
    icon: CalendarDays,
    label: 'Mondays at Lipscomb',
  },
  {
    icon: Scissors,
    label: 'Faded University + other booking windows',
  },
]

function App() {
  const heroRef = useRef(null)
  const [showStickyCta, setShowStickyCta] = useState(false)

  useEffect(() => {
    const hero = heroRef.current

    if (!hero) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0.1 },
    )

    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  return (
    <main>
      <section className="hero-section" ref={heroRef}>
        <nav className="topline" aria-label="Primary">
          <a className="logo-lockup" href="#top" aria-label="Numbered home">
            <span className="logo-mark">JPCUTS</span>
            <span className="brand-name">Numbered Barbering</span>
          </a>
          <a className="nav-book" href={bookingUrl} target="_blank" rel="noreferrer">
            Book
          </a>
        </nav>

        <div className="hero-grid" id="top">
          <div className="hero-copy">
            <p className="verse">"Even the hairs of your head are all numbered." Matthew 10:30</p>
            <h1>Numbered Barbering</h1>
            <p className="hero-lede">
              Nashville cuts with JP. Book 30 minutes, tell him what you need,
              and leave ready.
            </p>
            <div className="hero-actions">
              <a className="primary-cta" href={bookingUrl} target="_blank" rel="noreferrer">
                <CalendarDays size={19} aria-hidden="true" />
                Book a Cut
              </a>
              <span className="quick-note">Summer schedule</span>
            </div>
          </div>

          <div className="hero-panel" aria-label="Current prices and summer schedule">
            <figure className="jp-still">
              <img src={jpReelStill} alt="JP sharing the summer cutting schedule" />
              <figcaption>JP / summer schedule update</figcaption>
            </figure>
            <div className="price-stack" aria-label="Service prices">
              {services.map((service) => (
                <article className="price-row" key={service.name}>
                  <strong>{service.price}</strong>
                  <span>{service.name}</span>
                </article>
              ))}
            </div>
            <div className="schedule-card">
              <p className="panel-title">Where JP is cutting</p>
              <ul>
                {scheduleItems.map(({ icon: Icon, label }) => (
                  <li key={label}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="JP summer schedule reel">
        <p>Watch JP's summer schedule update.</p>
        <a href={reelUrl} target="_blank" rel="noreferrer">
          <Camera size={18} aria-hidden="true" />
          Summer reel
        </a>
      </section>

      <section className="section chair-section" aria-labelledby="chair-title">
        <div className="section-heading">
          <p className="section-label">The chair</p>
          <h2 id="chair-title">Simple by design.</h2>
        </div>
        <p className="section-copy">
          JP keeps it simple: book 30 minutes, tell him what you need, and get
          the cut handled.
        </p>
      </section>

      <section className="section media-section" aria-labelledby="proof-title">
        <div className="section-heading">
          <p className="section-label">Proof</p>
          <h2 id="proof-title">JP's real cuts go here.</h2>
        </div>
        <p className="section-copy">Before/afters, reels, and client photos.</p>
      </section>

      <section className="section split-section" aria-labelledby="group-title">
        <div>
          <p className="section-label">Teams, events, house calls</p>
          <h2 id="group-title">Bring JP to the room.</h2>
          <p>
            House calls are $50. For teams, weddings, pop-ups, and youth events,
            book a time and send the details.
          </p>
        </div>
      </section>

      <section className="final-cta" aria-labelledby="final-title">
        <div>
          <h2 id="final-title">Book a Cut</h2>
          <p>$30 chair cut. $40 with beard. $50 house call.</p>
        </div>
        <a className="primary-cta" href={bookingUrl} target="_blank" rel="noreferrer">
          <CalendarDays size={19} aria-hidden="true" />
          Book JP
        </a>
      </section>

      <a
        className={`sticky-cta ${showStickyCta ? 'is-visible' : ''}`}
        href={bookingUrl}
        target="_blank"
        rel="noreferrer"
      >
        <CalendarDays size={18} aria-hidden="true" />
        Book a Cut
      </a>
    </main>
  )
}

export default App
