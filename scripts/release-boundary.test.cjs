const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const productionConfig = fs.readFileSync('wrangler.production.toml', 'utf8')
const devConfig = fs.readFileSync('wrangler.toml', 'utf8')
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

test('dev and production deploy through isolated Workers and routes', () => {
  assert.match(devConfig, /name = "numbered-preview-review"/)
  assert.match(devConfig, /pattern = "dev\.jpcuuts\.com"/)
  assert.doesNotMatch(devConfig, /pattern = "(?:www\.)?jpcuuts\.com"/)

  assert.match(productionConfig, /name = "numbered-preview-dev"/)
  assert.match(productionConfig, /pattern = "jpcuuts\.com"/)
  assert.match(productionConfig, /pattern = "www\.jpcuuts\.com"/)
  assert.doesNotMatch(productionConfig, /pattern = "dev\.jpcuuts\.com"/)

  assert.equal(packageJson.scripts['cf:deploy'], undefined)
  assert.equal(packageJson.scripts['cf:deploy:dev'], 'npm run build && wrangler deploy --config wrangler.toml')
  assert.equal(packageJson.scripts['cf:deploy:production'], 'npm run build && wrangler deploy --config wrangler.production.toml')
})
