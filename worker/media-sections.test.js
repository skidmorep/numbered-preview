import assert from 'node:assert/strict'
import test from 'node:test'
import { gallerySlotForIndex, gallerySlotLabel, moveGalleryAsset } from '../src/mediaSections.js'

const gallery = Array.from({ length: 12 }, (_, index) => ({
  url: `/photo-${index}.jpg`,
  alt: `Photo ${index}`,
  focus: { x: index, y: 100 - index },
}))

test('gallery slots describe the public section, position, and frame shape', () => {
  assert.equal(gallerySlotLabel(0), 'Portfolio · position 1 · portrait')
  assert.equal(gallerySlotLabel(2), 'Portfolio · position 3 · wide')
  assert.equal(gallerySlotLabel(5), 'Weddings & events · position 1 · wide')
  assert.equal(gallerySlotLabel(9), 'Teams & groups · position 2 · portrait')
  assert.equal(gallerySlotForIndex(4).section.id, 'library')
})

test('moving a photo changes only its selected section and preserves asset metadata', () => {
  const next = moveGalleryAsset(gallery, 'weddings', 2, 0)
  assert.notEqual(next, gallery)
  assert.equal(next[5], gallery[7])
  assert.equal(next[6], gallery[5])
  assert.equal(next[7], gallery[6])
  for (const index of [0, 1, 2, 3, 4, 8, 9, 10, 11]) assert.equal(next[index], gallery[index])
  assert.deepEqual(next[5].focus, { x: 7, y: 93 })
})

test('invalid and non-public moves leave the gallery untouched', () => {
  assert.equal(moveGalleryAsset(gallery, 'library', 0, 1), gallery)
  assert.equal(moveGalleryAsset(gallery, 'portfolio', 0, 3), gallery)
  assert.equal(moveGalleryAsset(gallery, 'missing', 0, 1), gallery)
  assert.equal(moveGalleryAsset(gallery, 'teams', 1, 1), gallery)
})
