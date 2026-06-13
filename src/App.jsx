import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Camera,
  Clock3,
  Home,
  MapPin,
  Scissors,
  ShieldCheck,
  Users,
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

const proofSlots = ['Before / after 01', 'Before / after 02']

const brandArc = [
  {
    label: 'What you want',
    text: 'Look ready without chasing down availability every week.',
  },
  {
    label: 'What gets old',
    text: 'A rushed cut lingers in every photo, practice, class, and workday.',
  },
  {
    label: 'How JP helps',
    text: 'Book the chair, say what you need, and let JP handle the details.',
  },
]

const planSteps = ['Book 30 minutes', 'Tell JP what you need', 'Leave ready']

const groupCuts = ['Teams', 'Events', 'Weddings', 'Pop-ups', 'House calls', 'Athlete touch-ups']

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
            <p className="verse">Matthew 10:30 - even the hairs of your head are all numbered.</p>
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

      <section className="proof-strip" aria-label="Proof coming soon">
        <p>Real JP cut photos are coming here. For now, use the summer reel.</p>
        <a href={reelUrl} target="_blank" rel="noreferrer">
          <Camera size={18} aria-hidden="true" />
          Watch the summer reel
        </a>
      </section>

      <section className="section brand-arc-section" aria-labelledby="arc-title">
        <div className="section-heading">
          <p className="section-label">Ready all week</p>
          <h2 id="arc-title">A cut should make the week easier.</h2>
        </div>
        <div className="arc-grid">
          {brandArc.map((item) => (
            <article className="arc-card" key={item.label}>
              <h3>{item.label}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section services-section" aria-labelledby="services-title">
        <div className="section-heading">
          <p className="section-label">Services</p>
          <h2 id="services-title">One chair, three clear prices.</h2>
        </div>
        <div className="service-list">
          {services.map((service) => (
            <article className="service-row" key={service.name}>
              <strong>{service.price}</strong>
              <div>
                <h3>{service.name}</h3>
                <p>{service.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section plan-section" aria-labelledby="plan-title">
        <div>
          <p className="section-label">The plan</p>
          <h2 id="plan-title">Book. Tell. Leave ready.</h2>
        </div>
        <ol className="plan-list">
          {planSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="section media-section" aria-labelledby="proof-title">
        <div className="section-heading">
          <p className="section-label">Proof</p>
          <h2 id="proof-title">No fake barber photos.</h2>
        </div>
        <div className="proof-grid">
          {proofSlots.map((slot) => (
            <div className="proof-placeholder" key={slot}>
              <span>{slot}</span>
              <p>Real photo placeholder</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section split-section" aria-labelledby="group-title">
        <div>
          <p className="section-label">Teams + events</p>
          <h2 id="group-title">Need JP on site?</h2>
          <p>
            House calls are $50 because JP brings the setup and travels. For teams,
            pop-ups, weddings, and youth events, start with the booking link and
            share the details.
          </p>
        </div>
        <div className="tag-grid">
          {groupCuts.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="section booking-section" aria-labelledby="booking-title">
        <div className="booking-copy">
          <p className="section-label">Booking</p>
          <h2 id="booking-title">Pick the chair time.</h2>
          <p>
            JP is in Nashville all summer, cuts Mondays at Lipscomb, and uses
            Faded University or other appointment windows through the booking link.
          </p>
        </div>
        <ul className="booking-notes" aria-label="Booking notes">
          <li>
            <Clock3 size={18} aria-hidden="true" />
            30-minute chair
          </li>
          <li>
            <Home size={18} aria-hidden="true" />
            $50 house call
          </li>
          <li>
            <ShieldCheck size={18} aria-hidden="true" />
            Beard is a $10 add-on
          </li>
        </ul>
      </section>

      <section className="final-cta" aria-labelledby="final-title">
        <div>
          <Users size={24} aria-hidden="true" />
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
