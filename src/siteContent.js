const media = (name, alt, focus = { x: 50, y: 50 }) => ({
  type: 'image',
  url: `/media/defaults/${name}.webp`,
  alt,
  focus: { x: focus.x, y: focus.y },
})

export const officialLogoUrl = '/media/defaults/jp-cuts-camo-logo.png'

function safeSocialUrl(value, allowedHosts, fallback = '') {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && allowedHosts.includes(url.hostname)
      ? url.toString()
      : fallback
  } catch { return fallback }
}

function safeInstagramReelUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:'
      && url.hostname === 'www.instagram.com'
      && /^\/reel\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
      ? url.toString()
      : defaultContent.featured.url
  } catch { return defaultContent.featured.url }
}

function safeImageMediaUrl(value, fallback = '') {
  const url = String(value || '')
  return /^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp|avif)$/.test(url)
    || /^\/media\/defaults\/[A-Za-z0-9_-]+\.(?:jpg|png|webp|avif)$/.test(url)
    ? url
    : fallback
}

export const defaultContent = {
  version: 6,
  revision: 0,
  brand: {
    publicName: 'JP CUTS',
    bridgeName: '@jpcuuts',
    logo: {
      type: 'image',
      url: officialLogoUrl,
      alt: 'JP Cuts logo',
    },
    verseQuote: 'Even the hairs of your head are all numbered.',
    verseReference: 'Matthew 10:30',
  },
  hero: {
    eyebrow: 'MIDDLE TENNESSEE',
    headline: 'Your cut. Dialed in.',
    intro: 'JP delivers clean, precise cuts for clients across Smyrna and Middle Tennessee.',
  },
  work: {
    eyebrow: 'Fresh cut',
    heading: 'Real cuts.\nReal clients.',
    instagramLabel: 'See more on Instagram',
  },
  booking: {
    label: 'Book a cut',
    url: 'https://calendly.com/jpcuts/30mins',
    heading: 'Ready for your next cut?',
    instagramLabel: 'Follow @jpcuuts',
  },
  servicesSection: {
    eyebrow: 'Services',
    heading: 'Simple pricing.\nNo surprises.',
  },
  services: [
    { id: 'haircut', name: 'Haircut', price: '$35', duration: '35 minutes', note: 'Book through Calendly', enabled: true },
    { id: 'beard-add-on', name: 'Shave or beard trim', price: '+$5', duration: '', note: 'Add-on with a haircut', enabled: true },
  ],
  facts: {
    priceRange: '$35',
    location: 'Faded University · Smyrna, Middle Tennessee',
    mobile: 'Middle Tennessee',
    bookingTruth: 'Calendly',
  },
  locations: {
    fadedUniversity: {
      name: 'Faded University',
      address: '113 Front Street, Smyrna, TN 37167',
      availabilityLabel: 'JP’s school availability',
      hours: 'Tuesday–Friday, 9:00am–3:00pm; Saturday, 8:00am–2:00pm',
      bookingNote: 'Appointments only — use Calendly to book.',
    },
    lipscomb: {
      name: 'Lipscomb',
      availabilityLabel: 'By appointment',
      businessNote: 'JP is still cutting at Lipscomb by appointment, where he does the majority of his business.',
      locationNote: 'JP shares the exact Lipscomb location with booked clients.',
    },
  },
  proof: {
    rating: '',
    reviewCount: 0,
    sourceLabel: '',
  },
  media: {
    hero: media('jp-chair-hero', 'JP cutting a client’s hair in the barber chair', { x: 53, y: 43 }),
    eventsHero: media('jp-event-setup-hero', 'JP cutting a young client at a JP Cuts group event setup with chairs, lights, and the JP Cuts logo projected on the wall', { x: 63, y: 57 }),
    portrait: media('jp-chair-portrait', 'JP smiling and holding clippers at Faded University', { x: 50, y: 18 }),
    gallery: [
      media('jp-chair-work-01', 'A client with clean waves and sharp lines after a cut by JP'),
      media('jp-chair-work-02', 'A client with a finished red curly fade by JP'),
      media('jp-chair-work-03', 'A finished fade and styled locs by JP'),
      media('jp-chair-about-02', 'JP at Faded University'),
      media('jp-chair-about-03', 'JP training at Faded University'),
      media('jp-chair-event-01', 'JP preparing a client for a formal event'),
      media('jp-chair-event-02', 'A formal event haircut by JP'),
      media('jp-chair-event-03', 'JP working with a client before an event'),
      media('jp-chair-team-01', 'JP cutting a team member’s hair during a group session'),
      media('jp-chair-team-02', 'JP shaping a fade during a team haircut session'),
      media('jp-chair-team-03', 'JP finishing a team member’s haircut'),
    ],
    beforeAfter: {
      enabled: true,
      heading: 'Drag to see the transformation.',
      before: media('jp-chair-before', 'A client before a haircut by JP'),
      after: media('jp-chair-after', 'The same client after a haircut by JP'),
    },
  },
  featured: {
    enabled: false,
    type: 'instagram',
    heading: 'From JP',
    url: 'https://www.instagram.com/reel/DX1nfUogdFn/',
    posterUrl: '/media/defaults/jp-chair-work-02.webp',
  },
  story: {
    heading: 'About JP',
    subtitle: 'Clean cuts. Easy conversation. No pretense.',
    body: 'Have you ever been bored and decided to do something crazy? For me, that meant shaving my brother’s head 10 years ago. What I thought was just a good prank eventually turned into a passion.\n\nWhen I got to college, I realized that people needed more than just haircuts, they needed a place to belong. That realization inspired me to pursue barber school after graduating from college and prepared me to turn that passion into a career.\n\nToday, I get to combine my passion for barbering with my passion for people—providing professional services while creating a space where you feel known, connected, and confident.',
  },
  events: {
    enabled: true,
    outlineHeading: 'GROUP CUTS',
    heading: 'EVENTS & TEAMS',
    body: 'Planning cuts for a team, wedding, pop-up, church, or youth event? Send JP the date, headcount, and location to start the conversation.',
    actionLabel: 'Ask about your event',
    weddingHeading: 'Weddings & events',
    teamHeading: 'Teams & groups',
  },
  contact: {
    phone: '',
    instagramUrl: 'https://www.instagram.com/jpcuuts/',
    facebookUrl: 'https://www.facebook.com/jpcuuts',
    tiktokUrl: 'https://www.tiktok.com/@jpcuuts',
    youtubeUrl: 'https://www.youtube.com/@jpcuuts',
  },
}

function migrateContent(incoming) {
  if (!incoming) return incoming
  const incomingVersion = Number(incoming.version || 0)
  const legacyContract = incomingVersion < 4
  const legacyMedia = legacyContract
  const schemaUpgrade = incomingVersion < defaultContent.version
  const serviceNotes = new Map((incoming.services || []).map((service) => [service.id, service.note]))

  return {
    ...incoming,
    version: defaultContent.version,
    brand: {
      ...defaultContent.brand,
      ...(legacyContract ? {} : incoming.brand),
      publicName: defaultContent.brand.publicName,
      bridgeName: defaultContent.brand.bridgeName,
      logo: {
        ...defaultContent.brand.logo,
        ...(incoming.brand?.logo || {}),
        type: 'image',
        url: safeImageMediaUrl(incoming.brand?.logo?.url, officialLogoUrl),
      },
    },
    hero: {
      ...defaultContent.hero,
      ...incoming.hero,
      eyebrow: schemaUpgrade ? defaultContent.hero.eyebrow : (incoming.hero?.eyebrow || defaultContent.hero.eyebrow),
      intro: legacyContract ? defaultContent.hero.intro : (incoming.hero?.intro || defaultContent.hero.intro),
      headline: incoming.hero?.headline
        || incoming.hero?.headlines?.cutRecord
        || defaultContent.hero.headline,
    },
    work: {
      ...defaultContent.work,
      ...incoming.work,
    },
    booking: {
      ...defaultContent.booking,
      ...incoming.booking,
      url: defaultContent.booking.url,
    },
    servicesSection: {
      ...defaultContent.servicesSection,
      ...incoming.servicesSection,
    },
    services: defaultContent.services.map((service) => ({
      ...service,
      note: serviceNotes.get(service.id) ?? service.note,
    })),
    facts: {
      ...defaultContent.facts,
      ...(legacyContract ? {} : incoming.facts),
      priceRange: defaultContent.facts.priceRange,
      bookingTruth: defaultContent.facts.bookingTruth,
    },
    locations: {
      fadedUniversity: {
        ...defaultContent.locations.fadedUniversity,
        ...(incoming.locations?.fadedUniversity || {}),
      },
      lipscomb: {
        ...defaultContent.locations.lipscomb,
        ...(incoming.locations?.lipscomb || {}),
      },
    },
    proof: defaultContent.proof,
    story: {
      ...defaultContent.story,
      ...(legacyContract ? {} : incoming.story),
      subtitle: schemaUpgrade ? defaultContent.story.subtitle : (incoming.story?.subtitle || defaultContent.story.subtitle),
    },
    events: {
      ...defaultContent.events,
      ...(legacyContract ? { actionLabel: incoming.events?.actionLabel } : incoming.events),
      outlineHeading: schemaUpgrade ? defaultContent.events.outlineHeading : (incoming.events?.outlineHeading || defaultContent.events.outlineHeading),
      heading: schemaUpgrade ? defaultContent.events.heading : (incoming.events?.heading || defaultContent.events.heading),
    },
    contact: {
      ...defaultContent.contact,
      ...(legacyContract ? {} : incoming.contact),
      phone: '',
      instagramUrl: defaultContent.contact.instagramUrl,
      facebookUrl: legacyContract ? defaultContent.contact.facebookUrl : safeSocialUrl(incoming.contact?.facebookUrl, ['facebook.com', 'www.facebook.com'], defaultContent.contact.facebookUrl),
      tiktokUrl: legacyContract ? defaultContent.contact.tiktokUrl : safeSocialUrl(incoming.contact?.tiktokUrl, ['tiktok.com', 'www.tiktok.com'], defaultContent.contact.tiktokUrl),
      youtubeUrl: legacyContract ? defaultContent.contact.youtubeUrl : safeSocialUrl(incoming.contact?.youtubeUrl, ['youtube.com', 'www.youtube.com', 'youtu.be'], defaultContent.contact.youtubeUrl),
    },
    media: legacyMedia ? defaultContent.media : (incoming.media || defaultContent.media),
    featured: {
      ...defaultContent.featured,
      ...(legacyContract ? {} : incoming.featured),
      enabled: schemaUpgrade ? false : Boolean(incoming.featured?.enabled),
      type: 'instagram',
      url: legacyContract ? defaultContent.featured.url : safeInstagramReelUrl(incoming.featured?.url),
      posterUrl: defaultContent.featured.posterUrl,
    },
  }
}

function deepMerge(base, incoming) {
  if (Array.isArray(base)) return Array.isArray(incoming) ? incoming : base
  if (!base || typeof base !== 'object') return incoming ?? base

  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      incoming && Object.hasOwn(incoming, key)
        ? deepMerge(value, incoming[key])
        : value,
    ]),
  )
}

const centeredFocus = { x: 50, y: 50 }

function withFocus(asset, fallback) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return asset
  if (Object.hasOwn(asset, 'focus')) return asset
  const source = fallback?.focus || centeredFocus
  return { ...asset, focus: { x: source.x, y: source.y } }
}

function normalizeMediaFocus(content) {
  const mediaContent = content.media || {}
  const beforeAfter = mediaContent.beforeAfter || {}
  return {
    ...content,
    media: {
      ...mediaContent,
      hero: withFocus(mediaContent.hero, defaultContent.media.hero),
      eventsHero: withFocus(mediaContent.eventsHero, defaultContent.media.eventsHero),
      portrait: withFocus(mediaContent.portrait, defaultContent.media.portrait),
      gallery: Array.isArray(mediaContent.gallery)
        ? mediaContent.gallery.map((asset, index) => withFocus(asset, defaultContent.media.gallery[index]))
        : defaultContent.media.gallery,
      beforeAfter: {
        ...beforeAfter,
        before: withFocus(beforeAfter.before, defaultContent.media.beforeAfter.before),
        after: withFocus(beforeAfter.after, defaultContent.media.beforeAfter.after),
      },
    },
  }
}

export function mergeContent(incoming) {
  return normalizeMediaFocus(deepMerge(defaultContent, migrateContent(incoming) || {}))
}

export function imageFocusStyle(asset) {
  const focus = asset?.focus || centeredFocus
  return { objectPosition: `${focus.x}% ${focus.y}%` }
}
