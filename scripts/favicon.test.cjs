const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')

const icons = [
  { file: 'favicon-jp-20260906-32.png', size: 32, rel: 'icon' },
  { file: 'favicon-jp-20260906-512.png', size: 512, rel: 'icon' },
  { file: 'favicon-jp-20260906-180.png', size: 180, rel: 'apple-touch-icon' },
]

function readPngSize(file) {
  const buffer = fs.readFileSync(path.join(root, 'public', file))
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG')

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

test('the approved JP favicon set is linked with cache-safe filenames', () => {
  for (const { file, size, rel } of icons) {
    assert.match(
      html,
      new RegExp(`<link rel="${rel}"(?: type="image/png")? sizes="${size}x${size}" href="/${file}" />`),
    )
    assert.deepEqual(readPngSize(file), { width: size, height: size })
  }

  assert.doesNotMatch(html, /href="\/favicon-jp\.svg"/)
})
