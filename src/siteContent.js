const media = (name, alt) => ({
  type: 'image',
  url: `/media/defaults/${name}.webp`,
  alt,
})

export const defaultContent = {
  version: 2,
  revision: 0,
  brand: {
    publicName: 'JP CUTS',
    bridgeName: '@jpcuuts',
    verseQuote: 'Even the hairs of your head are all numbered.',
    verseReference: 'Matthew 10:30',
  },
  hero: {
    eyebrow: 'Smyrna barber · Nashville area',
    headlines: {
      cutRecord: 'Clean cuts. Clear confidence.',
      jpInChair: 'Your cut. Done right.',
      openChair: 'Book your next cut.',
    },
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
    hero: media('jp-hero-03', 'A finished haircut by JP in the barber chair'),
    portrait: media('jp-portrait', 'JP speaking to the camera'),
    gallery: [
      media('jp-cut-01', 'A client with clean lines after a cut by JP'),
      media('jp-cut-02', 'A finished taper and styled locs by JP'),
      media('jp-cut-03', 'A client showing a fresh fade by JP'),
      media('jp-cut-04', 'A young client after a haircut by JP'),
      media('jp-cut-05', 'A client smiling after a fresh cut by JP'),
      media('jp-cut-06', 'A client with a sharp finished haircut by JP'),
      media('jp-cut-07', 'A finished cut and braided style by JP'),
      media('jp-cut-08', 'A clean fade completed by JP'),
    ],
    beforeAfter: {
      enabled: true,
      heading: 'Slide to see the difference.',
      before: media('jp-before-01', 'A client before a haircut by JP'),
      after: media('jp-after-01', 'The same client after a haircut by JP'),
    },
  },
  featured: {
    enabled: true,
    type: 'instagram',
    heading: 'From JP',
    url: 'https://www.instagram.com/reel/DX1nfUogdFn/',
    posterUrl: '/media/defaults/jp-cut-02.webp',
  },
  story: {
    heading: 'Meet JP.',
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
  settings: {
    defaultSkin: 'cut-record',
  },
}

function migrateContent(incoming) {
  if (!incoming || Number(incoming.version || 0) >= defaultContent.version) return incoming

  return {
    ...incoming,
    version: defaultContent.version,
    brand: defaultContent.brand,
    hero: defaultContent.hero,
    booking: defaultContent.booking,
    services: defaultContent.services,
    facts: defaultContent.facts,
    proof: defaultContent.proof,
    media: {
      ...incoming.media,
      beforeAfter: defaultContent.media.beforeAfter,
    },
    story: defaultContent.story,
    events: defaultContent.events,
    contact: defaultContent.contact,
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
