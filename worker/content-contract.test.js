import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('runtime source contains no wrong-barber, Booksy, or Nashville references', () => {
  const runtimeFiles = [
    ...textFiles(path.join(root, 'src')),
    path.join(root, 'index.html'),
  ]
  for (const file of runtimeFiles) {
    const text = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(text, /booksy|cutzby\.jp|jp cutz|nashville/i, path.relative(root, file))
    assert.doesNotMatch(text, /jp@jpcuuts\.com|mailto:/i, `public email leaked in ${path.relative(root, file)}`)
  }
})

test('every shipped homepage WebP is approved and matches the media source manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'media-sources.json'), 'utf8'))
  const records = new Map(manifest.assets.map((asset) => [asset.file, asset]))
  const shipped = fs.readdirSync(path.join(root, 'public/media/defaults'))
    .filter((name) => name.endsWith('.webp'))
    .map((name) => `public/media/defaults/${name}`)
    .sort()

  assert.deepEqual(shipped, [...records.keys()].sort())
  for (const file of shipped) {
    const bytes = fs.readFileSync(path.join(root, file))
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), records.get(file).sha256, file)
    assert.ok(records.get(file).source)
    assert.ok(records.get(file).role)
  }
})

function textFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return textFiles(file)
    return /\.(?:js|jsx|css|html)$/.test(entry.name) ? [file] : []
  })
}
