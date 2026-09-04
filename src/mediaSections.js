export const gallerySections = [
  {
    id: 'portfolio',
    heading: 'Portfolio',
    description: 'These three photos appear in the Work section.',
    indices: [0, 1, 2],
    shapes: ['Portrait', 'Portrait', 'Wide'],
    reorderable: true,
  },
  {
    id: 'weddings',
    heading: 'Weddings & events',
    description: 'The first photo spans the row. The next two use portrait frames.',
    indices: [5, 6, 7],
    shapes: ['Wide', 'Portrait', 'Portrait'],
    reorderable: true,
  },
  {
    id: 'teams',
    heading: 'Teams & groups',
    description: 'The first photo spans the row. The next two use portrait frames.',
    indices: [8, 9, 10],
    shapes: ['Wide', 'Portrait', 'Portrait'],
    reorderable: true,
  },
  {
    id: 'library',
    heading: 'Photo library',
    description: 'Stored safely, but not currently shown on the public site.',
    indices: [3, 4, 11],
    shapes: ['Not shown', 'Not shown', 'Not shown'],
    reorderable: false,
  },
]

export function gallerySlotForIndex(index) {
  for (const section of gallerySections) {
    const position = section.indices.indexOf(index)
    if (position !== -1) return { section, position, shape: section.shapes[position] }
  }
  return null
}

export function gallerySlotLabel(index) {
  const slot = gallerySlotForIndex(index)
  if (!slot) return `Additional photo ${index + 1} · not shown`
  return `${slot.section.heading} · position ${slot.position + 1} · ${slot.shape.toLowerCase()}`
}

export function moveGalleryAsset(gallery, sectionId, fromPosition, toPosition) {
  const section = gallerySections.find((candidate) => candidate.id === sectionId)
  if (!section?.reorderable) return gallery
  if (!Number.isInteger(fromPosition) || !Number.isInteger(toPosition)) return gallery
  if (fromPosition < 0 || toPosition < 0 || fromPosition >= section.indices.length || toPosition >= section.indices.length || fromPosition === toPosition) return gallery

  const sectionAssets = section.indices.map((index) => gallery[index])
  const [moved] = sectionAssets.splice(fromPosition, 1)
  sectionAssets.splice(toPosition, 0, moved)
  const next = gallery.slice()
  section.indices.forEach((index, position) => { next[index] = sectionAssets[position] })
  return next
}
