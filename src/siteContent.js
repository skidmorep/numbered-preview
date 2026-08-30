const media = (name, alt, focus = { x: 50, y: 50 }) => ({
  type: 'image',
  url: `/media/defaults/${name}.webp`,
  alt,
  focus: { x: focus.x, y: focus.y },
})

export const defaultContent = {
  version: 4,
  revision: 0,
  brand: {
    publicName: 'JP CUTS',
    bridgeName: '@jpcuuts',
    verseQuote: 'Even the hairs of your head are all numbered.',
    verseReference: 'Matthew 10:30',
  },
  hero: {
    eyebrow: 'Smyrna barber · Middle Tennessee',
    headline: 'Your cut. Dialed in.',
    intro: 'JP delivers clean, precise cuts for clients across Smyrna and Middle Tennessee.',
  },
  booking: {
    label: 'Book a cut',
    url: 'https://calendly.com/jpcuts/30mins',
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
  proof: {
    rating: '',
    reviewCount: 0,
    sourceLabel: '',
  },
  media: {
    hero: media('jp-chair-hero', 'JP cutting a client’s hair in the barber chair', { x: 53, y: 43 }),
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
    enabled: true,
    type: 'instagram',
    heading: 'From JP',
    url: 'https://www.instagram.com/reel/DX1nfUogdFn/',
    posterUrl: '/media/defaults/jp-chair-work-02.webp',
  },
  story: {
    heading: 'About JP',
    body: 'Have you ever been bored and decided to do something crazy? For me, that meant shaving my brother’s head 10 years ago. What I thought was just a good prank eventually turned into a passion.\n\nWhen I got to college, I realized that people needed more than just haircuts, they needed a place to belong. That realization inspired me to pursue barber school after graduating from college and prepared me to turn that passion into a career.\n\nToday, I get to combine my passion for barbering with my passion for people—providing professional services while creating a space where you feel known, connected, and confident.',
  },
  events: {
    enabled: true,
    heading: 'Cuts for events, groups, and teams.',
    body: 'Planning cuts for a team, wedding, pop-up, church, or youth event? Send JP the date, headcount, and location to start the conversation.',
    actionLabel: 'Ask about your event',
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
  const legacy = Number(incoming.version || 0) < defaultContent.version
  const serviceNotes = new Map((incoming.services || []).map((service) => [service.id, service.note]))

  return {
    ...incoming,
    version: defaultContent.version,
    brand: defaultContent.brand,
    hero: {
      ...defaultContent.hero,
      headline: incoming.hero?.headline
        || incoming.hero?.headlines?.cutRecord
        || defaultContent.hero.headline,
    },
    booking: {
      ...defaultContent.booking,
      label: incoming.booking?.label || defaultContent.booking.label,
    },
    services: defaultContent.services.map((service) => ({
      ...service,
      note: serviceNotes.get(service.id) || service.note,
    })),
    facts: defaultContent.facts,
    story: defaultContent.story,
    events: {
      ...defaultContent.events,
      actionLabel: incoming.events?.actionLabel || defaultContent.events.actionLabel,
    },
    contact: defaultContent.contact,
    media: legacy ? defaultContent.media : (incoming.media || defaultContent.media),
    featured: defaultContent.featured,
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

export function instagramEmbedUrl(url) {
  const match = String(url || '').match(/instagram\.com\/reel\/([A-Za-z0-9_-]+)/)
  return match ? `https://www.instagram.com/reel/${match[1]}/embed/` : ''
}
