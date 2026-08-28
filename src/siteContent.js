const media = (name, alt) => ({
  type: 'image',
  url: `/media/defaults/${name}.webp`,
  alt,
})

export const defaultContent = {
  version: 1,
  revision: 0,
  brand: {
    publicName: 'NUMBERED / JP CUTZ',
    bridgeName: 'Cuts by JP',
    verseQuote: 'Even the hairs of your head are all numbered.',
    verseReference: 'Matthew 10:30',
  },
  hero: {
    eyebrow: 'Nashville barber · Mobile service available',
    headlines: {
      cutRecord: 'Look sharp. No guesswork.',
      jpInChair: 'JP in the chair',
      openChair: 'The open chair',
    },
    intro: 'Book JP for a clean cut in Nashville, with mobile service when the week calls for it.',
  },
  booking: {
    label: 'See times & book',
    url: 'https://booksy.com/en-us/1230497_jp-cutz_barber-shop_123099_nashville-davidson',
  },
  services: [
    { id: 'cut-beard', name: 'Haircut + beard', price: '$40', duration: '', note: 'Trim and lineup', enabled: true },
    { id: 'adult-cut', name: 'Haircut', price: '$35', duration: '', note: 'Current public Booksy listing', enabled: true },
    { id: 'kids-cut', name: 'Kids cut', price: '$25', duration: '', note: '', enabled: true },
    { id: 'line-up', name: 'Line-up', price: '$20', duration: '', note: '', enabled: true },
    { id: 'after-hours', name: 'After / early hours', price: '$60', duration: '', note: '', enabled: true },
  ],
  facts: {
    priceRange: '$20–$60',
    location: 'Nashville',
    mobile: 'Mobile service',
    bookingTruth: 'Booksy',
  },
  proof: {
    rating: '5.0',
    reviewCount: 9,
    sourceLabel: 'Verified on Booksy',
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
  },
  featured: {
    enabled: true,
    type: 'instagram',
    heading: 'From JP',
    url: 'https://www.instagram.com/reel/DX1nfUogdFn/',
    posterUrl: '/media/defaults/jp-cut-02.webp',
  },
  story: {
    heading: 'Details matter because people do.',
    body: 'The name Numbered comes from Matthew 10:30. It is a reminder that every person matters and every detail deserves care.',
  },
  events: {
    enabled: true,
    heading: 'Bring JP to the room.',
    body: 'Teams, weddings, pop-ups, church and youth events, and group cuts deserve a scoped conversation about date, headcount, location, and travel.',
    actionLabel: 'Ask about an event',
    actionUrl: 'https://www.instagram.com/cutzby.jp/',
  },
  contact: {
    phone: '',
    instagramUrl: 'https://www.instagram.com/cutzby.jp/',
  },
  settings: {
    defaultSkin: 'cut-record',
  },
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
  return deepMerge(defaultContent, incoming || {})
}

export function instagramEmbedUrl(url) {
  const match = String(url || '').match(/instagram\.com\/reel\/([A-Za-z0-9_-]+)/)
  return match ? `https://www.instagram.com/reel/${match[1]}/embed/` : ''
}
