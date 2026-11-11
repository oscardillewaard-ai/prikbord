// Leesbare inkt op elke papierkleur (§8, M5). axe-core (in de rooktest) slaat
// tekst over een achtergrondafbeelding over, en het papier heeft korrel en
// lijntjes. Daarom rekenen we het contrast hier zelf na, met de kleuren en
// doorzichtigheden zoals ze in styles.css staan (WCAG 2.2, formule voor
// relatieve luminantie).
//
// Normen: 4,5 : 1 voor gewone tekst (AA). Voor de handschriftletter op de
// briefjes eisen we 7 : 1 (AAA): een handschrift leest lastiger dan een
// gewone letter, dus daar willen we extra ruimte.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PAPIER } from '../public/js/validate.js'

const CSS = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')

// ---------- Kleuren uit de CSS ----------

const rootVar = (naam) => {
  const m = CSS.match(new RegExp(`--${naam}:\\s*(#[0-9a-fA-F]{6}|rgba?\\([^)]*\\))`))
  assert.ok(m, `--${naam} staat niet in :root`)
  return m[1]
}
// Alle declaraties van één selector (ook als hij in een lijst staat), in volgorde.
function regel(selector) {
  const uit = {}
  const re = /([^{}]+)\{([^{}]*)\}/g
  for (let m; (m = re.exec(CSS)); ) {
    const selectors = m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((x) => x.trim())
    if (!selectors.includes(selector)) continue
    for (const d of m[2].replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
      const i = d.indexOf(':')
      if (i > 0) uit[d.slice(0, i).trim()] = d.slice(i + 1).trim()
    }
  }
  assert.ok(Object.keys(uit).length, `${selector} staat niet in styles.css`)
  return uit
}
const opacity = (selector) => Number(regel(selector).opacity ?? 1)

function rgb(kleur) {
  if (kleur.startsWith('#')) return { r: parseInt(kleur.slice(1, 3), 16), g: parseInt(kleur.slice(3, 5), 16), b: parseInt(kleur.slice(5, 7), 16), a: 1 }
  const [r, g, b, a = 1] = kleur.match(/[\d.]+/g).map(Number)
  return { r, g, b, a }
}
// `voor` met doorzichtigheid t over `achter`.
const meng = (voor, achter, t) => ({ r: voor.r * t + achter.r * (1 - t), g: voor.g * t + achter.g * (1 - t), b: voor.b * t + achter.b * (1 - t), a: 1 })
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (k) => 0.2126 * lin(k.r) + 0.7152 * lin(k.g) + 0.0722 * lin(k.b)
export function contrast(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const INKT = rgb(rootVar('inkt'))
// Het papier is niet overal even licht (versie 6): onderaan ligt er een zweem
// schaduw overheen (--papier-schaduw). We rekenen met het donkerste stukje;
// de glans bovenaan maakt het papier alleen maar lichter, dus leesbaarder.
const SCHADUW = rgb(rootVar('papier-schaduw'))
const PAPIEREN = PAPIER.map((p) => [p, meng(SCHADUW, rgb(rootVar(`p-${p}`)), SCHADUW.a)])
const WIT = rgb('#ffffff')
// Laagste contrast over alle papierkleuren, met de naam van de slechtste.
function slechtste(fn) {
  return PAPIEREN.map(([naam, p]) => ({ naam, c: fn(p) })).sort((a, b) => a.c - b.c)[0]
}
const meld = ({ naam, c }) => `${c.toFixed(2)} : 1 op ${naam}`

// ---------- De tests ----------

test('rekenformule klopt: zwart op wit is 21 : 1, wit op wit 1 : 1, en #767676 op wit ~4,54 : 1', () => {
  assert.equal(contrast(rgb('#000000'), WIT).toFixed(1), '21.0')
  assert.equal(contrast(WIT, WIT), 1)
  assert.equal(contrast(rgb('#767676'), WIT).toFixed(2), '4.54')
})

test('alle 10 papierkleuren staan in de stijl', () => {
  assert.equal(PAPIEREN.length, 10)
})

test('het licht op het papier: een zweem schaduw (hooguit 8%), en de glans is wit', () => {
  // De schaduw maakt het papier donkerder en kost dus contrast: klein houden.
  assert.ok(SCHADUW.a > 0 && SCHADUW.a <= 0.08, `--papier-schaduw is ${SCHADUW.a}`)
  const glans = rgb(rootVar('papier-glans'))
  assert.deepEqual([glans.r, glans.g, glans.b], [255, 255, 255])
  // En het verloop gebruikt ze ook echt (anders rekent deze test met lucht).
  assert.match(CSS, /--papier-licht:[^;]*var\(--papier-glans\)[^;]*var\(--papier-schaduw\)/)
  assert.match(regel('.briefje').background, /var\(--papier-licht\)/)
})

test('handschriftinkt op elk papier: minstens 7 : 1 (AAA), ook boven een lijntje minstens 4,5 : 1', () => {
  const op = slechtste((p) => contrast(INKT, p))
  assert.ok(op.c >= 7, meld(op))
  // Een lijntje van het kladblokpapier loopt soms door een letter heen.
  const lijntje = rgb(rootVar('lijntje'))
  const opLijn = slechtste((p) => contrast(INKT, meng(lijntje, p, lijntje.a)))
  assert.ok(opLijn.c >= 4.5, meld(opLijn))
})

test('kleine letters op het papier: minstens 4,5 : 1 (AA) op elke kleur', () => {
  const gevallen = {
    // tekst met doorzichtigheid op het papier
    '.groot-meta ("Geprikt door …")': (p) => contrast(meng(INKT, p, opacity('.groot-meta')), p),
    '.vel-teller (tekenteller)': (p) => contrast(meng(INKT, p, opacity('.vel-teller')), p),
    '.hart-meer ("+3" bij hartjes)': (p) => contrast(meng(INKT, p, opacity('.hart-meer')), p),
    '.geplakt-notitie ("Hoe was het?")': (p) => contrast(meng(INKT, p, opacity('.geplakt-notitie')), p),
    // eigen kleur op het papier
    '.geplakt-datum (datum in de doos)': (p) => contrast(rgb(regel('.geplakt-datum').color), p),
    // label met een wit waas eronder ("🔗 ah.nl")
    '.bijlage ("🔗 ah.nl")': (p) => {
      const waas = rgb(regel('.bijlage').background)
      return contrast(INKT, meng(WIT, p, waas.a))
    },
  }
  const fout = []
  for (const [naam, fn] of Object.entries(gevallen)) {
    const s = slechtste(fn)
    if (s.c < 4.5) fout.push(`${naam}: ${meld(s)}`)
  }
  assert.deepEqual(fout, [])
})

test('chips en tabjes (doorzichtig als ze uit staan) op het kurk: minstens 4,5 : 1', () => {
  // Het kurk is gevlekt; we rekenen met de basiskleur plus de donkere waas
  // van de filterbalk, en achter het schrijfvel met de donkere laag. Dat is
  // een benadering van het gemiddelde, geen meting per pixel.
  const kurk = rgb(rootVar('kurk-kleur'))
  const balk = meng(rgb('rgba(60, 30, 8, 0.32)'), kurk, 0.32)
  const achter = rgb(regel('.laag-achter').background)
  const donker = meng(achter, kurk, achter.a)
  const chip = slechtste((p) => contrast(meng(INKT, balk, opacity('.chip')), meng(p, balk, opacity('.chip'))))
  const tabje = slechtste((p) => contrast(meng(INKT, donker, opacity('.tabje')), meng(p, donker, opacity('.tabje'))))
  assert.ok(chip.c >= 4.5, `chip: ${meld(chip)}`)
  assert.ok(tabje.c >= 4.5, `tabje: ${meld(tabje)}`)
})
