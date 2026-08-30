const media = (name, alt) => ({
  type: 'image',
  url: `/media/defaults/${name}.webp`,
  alt,
})

export const defaultContent = {
  version: 3,
  revision: 0,
  brand: {
    publicName: 'JP CUTS',
    bridgeName: '@jpcuuts',
    verseQuote: 'Even the hairs of your head are all numbered.',
    verseReference: 'Matthew 10:30',
  },
  hero: {
    eyebrow: 'Smyrna barber · Nashville area',
    headline: 'Your cut. Dialed in.',
    intro: 'JP delivers clean, precise cuts for clients across Smyrna and the Nashville area.',
  },
  booking: {
    label: 'Book a cut',
    url: 'https://calendly.com/jpcuts/30mins',
  },
  services: [
    { id: 'haircut', name: 'Haircut', price: '$35', duration: 'About 35 minutes', note: 'Book through Calendly', enabled: true },
    { id: 'beard-add-on', name: 'Shave or beard trim', price: '+$5', duration: '', note: 'Add-on with a haircut', enabled: true },
  ],
  facts: {
    priceRange: '$35',
    location: 'Faded University · Smyrna',
    mobile: 'Nashville area',
    bookingTruth: 'Calendly',
  },
  proof: {
    rating: '',
    reviewCount: 0,
    sourceLabel: '',
  },
  media: {
    hero: media('jp-chair-hero', 'JP cutting a client’s hair in the barber chair'),
    portrait: media('jp-chair-portrait', 'JP holding clippers at Faded University'),
    gallery: [
      media('jp-chair-work-01', 'A client with clean waves and sharp lines after a cut by JP'),
      media('jp-chair-work-02', 'A client with a finished red curly fade by JP'),
      media('jp-chair-work-03', 'A finished fade and styled locs by JP'),
      media('jp-chair-about-02', 'JP at Faded University'),
      media('jp-chair-about-03', 'JP training at Faded University'),
      media('jp-chair-event-01', 'JP preparing a client for a formal event'),
      media('jp-chair-event-02', 'A formal event haircut by JP'),
      media('jp-chair-event-03', 'JP working with a client before an event'),
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
    body: 'JP is a Smyrna-based barber serving clients across the Nashville area. He brings a calm chair, careful attention, and a clean finish to every appointment. This temporary bio is ready for JP to replace in the editor.',
  },
  events: {
    enabled: true,
    heading: 'Cuts for your group or event.',
    body: 'Planning cuts for a team, wedding, pop-up, church, or youth event? Email JP with the date, headcount, and location to start the conversation.',
    actionLabel: 'Email JP',
    actionUrl: 'mailto:jp@jpcuuts.com?subject=Group%20or%20event%20inquiry',
  },
  contact: {
    email: 'jp@jpcuuts.com',
    phone: '',
    instagramUrl: 'https://www.instagram.com/jpcuuts/',
    facebookUrl: 'https://www.facebook.com/jpcuuts',
    tiktokUrl: 'https://www.tiktok.com/@jpcuuts',
    youtubeUrl: 'https://www.youtube.com/@jpcuuts',
  },
}

function migrateContent(incoming) {
  if (!incoming || Number(incoming.version || 0) >= defaultContent.version) return incoming

  return {
    ...incoming,
    version: defaultContent.version,
    hero: {
      ...defaultContent.hero,
      ...incoming.hero,
      headline: incoming.hero?.headline
        || incoming.hero?.headlines?.cutRecord
        || defaultContent.hero.headline,
    },
    story: {
      ...incoming.story,
      heading: incoming.story?.heading === 'Meet JP.'
        ? defaultContent.story.heading
        : incoming.story?.heading,
    },
    media: {
      ...defaultContent.media,
      ...incoming.media,
      beforeAfter: {
        ...defaultContent.media.beforeAfter,
        ...incoming.media?.beforeAfter,
      },
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

export function mergeContent(incoming) {
  return deepMerge(defaultContent, migrateContent(incoming) || {})
}

export function instagramEmbedUrl(url) {
  const match = String(url || '').match(/instagram\.com\/reel\/([A-Za-z0-9_-]+)/)
  return match ? `https://www.instagram.com/reel/${match[1]}/embed/` : ''
}
