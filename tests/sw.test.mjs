// Bewaakt het release-ritueel (§4.1, regel 7) en de offline-lijst van de
// service worker (§9): faalt als CACHE niet bij APP_VERSION past, of als een
// app-bestand in SHELL ontbreekt (dan werkt de app offline niet meer).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url))
const sw = readFileSync(join(PUBLIC, 'sw.js'), 'utf8')
const app = readFileSync(join(PUBLIC, 'js/app.js'), 'utf8')

const cache = sw.match(/const CACHE = '([^']+)'/)?.[1]
const versie = app.match(/APP_VERSION = '(\d+)'/)?.[1]
const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])

function alleBestanden(map) {
  return readdirSync(map).flatMap((naam) => {
    const pad = join(map, naam)
    return statSync(pad).isDirectory() ? alleBestanden(pad) : [relative(PUBLIC, pad)]
  })
}

test('CACHE in sw.js past bij APP_VERSION in app.js', () => {
  assert.ok(versie, 'APP_VERSION gevonden')
  assert.equal(cache, `prikbord-v${versie}`)
})

test('de nieuwste regel in CHANGELOG hoort bij APP_VERSION', () => {
  const eerste = app.match(/const CHANGELOG = \[\s*\{\s*v: (\d+)/)?.[1]
  assert.equal(eerste, versie)
})

test('elk app-bestand staat in SHELL', () => {
  // Licenties en de service worker zelf hoeven niet offline in de cache.
  const nodig = alleBestanden(PUBLIC).filter((f) => f !== 'sw.js' && !/\.txt$|LICENSE/i.test(f) && !f.startsWith('.'))
  const ontbreekt = nodig.filter((f) => !shell.includes(f))
  assert.deepEqual(ontbreekt, [], `ontbreekt in SHELL: ${ontbreekt.join(', ')}`)
  assert.ok(shell.includes('./') && shell.includes('index.html'))
})

test('alles in SHELL bestaat echt', () => {
  const weg = shell.filter((f) => f !== './' && !existsSync(join(PUBLIC, f)))
  assert.deepEqual(weg, [], `bestaat niet: ${weg.join(', ')}`)
})

test('de service worker ruimt alleen eigen caches op (A1) en laat andere sites met rust', () => {
  assert.match(sw, /k\.startsWith\('prikbord-'\)/)
  assert.match(sw, /origin !== self\.location\.origin\) return/)
  assert.match(sw, /cache: 'no-cache'/)
  assert.match(app, /k\.startsWith\('prikbord-'\)/)
})
