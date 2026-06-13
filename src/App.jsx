import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Scissors,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import './App.css'

const bookingUrl = 'https://calendly.com/jpcuts/30mins'

const services = [
  {
    number: '01',
    name: 'The Cut',
    detail: '30 minute precision cut',
    price: '$30',
  },
  {
    number: '02',
    name: 'Cut + Beard',
    detail: 'Clean cut with beard trim',
    price: '$40',
  },
  {
    number: '03',
    name: 'House Call',
    detail: 'Nashville-area mobile cut',
    price: '$50',
  },
]

const bookingNotes = [
  'Pay after the appointment',
  'Card-secured no-show policy planned for production booking',
  'Current preview booking runs through Calendly',
]

const mobileCuts = [
  'Team cuts',
  'Athlete touch-ups',
  'Weddings',
  'Church + youth events',
  'Pop-ups',
  'House calls',
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
      { threshold: 0.15 },
    )

    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  return (
    <main>
      <section className="hero-section" ref={heroRef}>
        <nav className="topline" aria-label="Brand">
          <a className="logo-lockup" href="#top" aria-label="Numbered home">
            <span className="logo-mark">JPCUTS</span>
            <span className="logo-divider" aria-hidden="true" />
            <span className="brand-name">Numbered</span>
          </a>
          <a className="nav-book" href={bookingUrl} target="_blank" rel="noreferrer">
            Book
            <ChevronRight size={16} aria-hidden="true" />
          </a>
        </nav>

        <div className="hero-grid" id="top">
          <div className="hero-copy">
            <p className="eyebrow">Nashville + Smyrna barbering</p>
            <h1>Every cut has a number.</h1>
            <p className="hero-lede">
              Precision cuts for the weekly rhythm: book it, show up, walk out
              sharp.
            </p>
            <div className="hero-actions">
              <a className="primary-cta" href={bookingUrl} target="_blank" rel="noreferrer">
                <CalendarDays size={20} aria-hidden="true" />
                Book a cut
              </a>
              <span className="quick-price">$30 / 30 min</span>
            </div>
          </div>

          <div className="number-card" aria-label="Numbered visual identity preview">
            <div className="tool-rail" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="plate-label">Precision</p>
            <div className="plate-number">30</div>
            <div className="plate-footer">
              <span>Cut</span>
              <span>Nashville</span>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Brand positioning">
        <p>Trusted by athletes who cannot afford a bad week.</p>
        <span>Team bookings welcome</span>
      </section>

      <section className="section services-section" aria-labelledby="services-title">
        <div className="section-heading">
          <p className="eyebrow">Services</p>
          <h2 id="services-title">The menu is the brand.</h2>
        </div>
        <div className="service-list">
          {services.map((service) => (
            <article className="service-row" key={service.number}>
              <span className="service-number">{service.number}</span>
              <div>
                <h3>{service.name}</h3>
                <p>{service.detail}</p>
              </div>
              <strong>{service.price}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section split-section" aria-labelledby="where-title">
        <div>
          <p className="eyebrow">Where JP is cutting</p>
          <h2 id="where-title">Nashville area. Smyrna during school weeks.</h2>
          <p>
            The schedule can move with barber school, pop-ups, and mobile calls.
            The booking link keeps the current appointment window in one place.
          </p>
        </div>
        <div className="info-panel">
          <div>
            <MapPin size={22} aria-hidden="true" />
            <span>Nashville, TN area</span>
          </div>
          <div>
            <Scissors size={22} aria-hidden="true" />
            <span>Smyrna barber school</span>
          </div>
          <div>
            <Clock3 size={22} aria-hidden="true" />
            <span>30 minute main appointment</span>
          </div>
        </div>
      </section>

      <section className="section events-section" aria-labelledby="events-title">
        <div className="section-heading">
          <p className="eyebrow">Mobile cuts</p>
          <h2 id="events-title">One chair. Whole room handled.</h2>
        </div>
        <div className="tag-grid">
          {mobileCuts.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="section booking-section" aria-labelledby="booking-title">
        <div className="booking-copy">
          <p className="eyebrow">Booking policy</p>
          <h2 id="booking-title">Simple now. Stricter when payments go live.</h2>
          <p>
            For the preview, booking sends people to Calendly. The production
            path should use Square Appointments or another PCI-compliant booking
            provider before card-secured no-show fees are advertised as active.
          </p>
        </div>
        <ul className="booking-notes" aria-label="Booking notes">
          {bookingNotes.map((note) => (
            <li key={note}>
              <ShieldCheck size={18} aria-hidden="true" />
              {note}
            </li>
          ))}
        </ul>
      </section>

      <section className="final-cta" aria-labelledby="final-title">
        <div>
          <Sparkles size={24} aria-hidden="true" />
          <h2 id="final-title">Book the next cut.</h2>
          <p>30 minutes. $30. Keep the schedule clean.</p>
        </div>
        <a className="primary-cta" href={bookingUrl} target="_blank" rel="noreferrer">
          <Users size={20} aria-hidden="true" />
          Book JP
        </a>
      </section>

      <a
        className={`sticky-cta ${showStickyCta ? 'is-visible' : ''}`}
        href={bookingUrl}
        target="_blank"
        rel="noreferrer"
      >
        <CalendarDays size={19} aria-hidden="true" />
        Book - $30 / 30 min
      </a>
    </main>
  )
}

export default App
