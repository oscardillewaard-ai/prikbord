import { test } from 'node:test'
import assert from 'node:assert/strict'
import { schoonStaat, schoonBriefje, schoonLink, MAX_TEKST } from '../public/js/validate.js'
import { beginStaat, nieuwBriefje } from '../public/js/model.js'

const NU = 1_762_600_000_000

test('een verse stand komt ongeschonden door de controle', () => {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  nieuwBriefje(bord, { door: s.apparaat.ik[s.bord], tekst: 'Shakshuka met feta 🍳', cat: 'recepten', now: NU })
  const json = JSON.parse(JSON.stringify(s))
  assert.deepEqual(schoonStaat(json), json)
})

test('kapotte of vreemde opslag geeft null (de app begint dan opnieuw)', () => {
  for (const raw of [null, undefined, 42, 'tekst', [], {}, { v: 2, borden: {} }, { v: 1, borden: [] }, { v: 1, borden: {} }]) {
    assert.equal(schoonStaat(raw), null, JSON.stringify(raw))
  }
})

test('één kapot briefje valt weg, de rest blijft', () => {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  const ik = s.apparaat.ik[s.bord]
  nieuwBriefje(bord, { id: 'goedbriefje1', door: ik, tekst: 'Blijft', cat: 'todo', now: NU })
  const json = JSON.parse(JSON.stringify(s))
  json.borden[s.bord].briefjes.kapot1 = { id: 'kapot1', door: ik } // geen tijdstip
  json.borden[s.bord].briefjes['x!'] = { id: 'x!', door: ik, gemaakt: NU, v: {} } // slecht id
  const schoon = schoonStaat(json)
  assert.deepEqual(Object.keys(schoon.borden[s.bord].briefjes), ['goedbriefje1'])
})

test('velden worden gecontroleerd: lengte, link alleen http(s), coördinaten binnen bereik', () => {
  const b = schoonBriefje({
    id: 'abcd1234',
    door: 'lid12345',
    gemaakt: NU,
    v: {
      tekst: { w: 'x'.repeat(MAX_TEKST + 50), t: NU },
      link: { w: 'javascript:alert(1)', t: NU },
      plek: { w: { lat: 200, lng: 4 }, t: NU },
      onbekend: { w: 'weg ermee', t: NU },
      cat: { w: 'todo', t: -5 },
    },
    hart: { lid12345: { w: true, t: NU }, 'kapot!': { w: true, t: NU }, lid99999: { w: 'ja', t: NU } },
  })
  assert.equal(b.v.tekst.w.length, MAX_TEKST)
  assert.equal(b.v.link, undefined)
  assert.equal(b.v.plek, undefined)
  assert.equal(b.v.onbekend, undefined)
  assert.equal(b.v.cat, undefined)
  assert.deepEqual(Object.keys(b.hart), ['lid12345'])
})

test('null is een geldige waarde (leeggemaakt, met tijdstempel)', () => {
  const b = schoonBriefje({ id: 'abcd1234', door: 'lid12345', gemaakt: NU, v: { link: { w: null, t: NU } }, hart: {} })
  assert.deepEqual(b.v.link, { w: null, t: NU })
})

test('grafsteen: alleen id, maker, tijdstip en weg blijven over', () => {
  const b = schoonBriefje({ id: 'abcd1234', door: 'lid12345', gemaakt: NU, weg: NU + 5, v: { tekst: { w: 'geheim', t: NU } }, hart: {} })
  assert.deepEqual(b, { id: 'abcd1234', door: 'lid12345', gemaakt: NU, weg: NU + 5 })
})

test('schoonLink', () => {
  assert.equal(schoonLink('https://www.ah.nl/allerhande/recept'), 'https://www.ah.nl/allerhande/recept')
  assert.equal(schoonLink('http://example.com'), 'http://example.com/')
  assert.equal(schoonLink('ftp://example.com'), undefined)
  assert.equal(schoonLink('geen link'), undefined)
})

test('apparaat: onbekende borden en rare waarden vallen weg, geluid staat standaard aan', () => {
  const s = beginStaat(NU)
  const json = JSON.parse(JSON.stringify(s))
  json.apparaat = { geluid: 'ja', ik: { [s.bord]: 'lid12345', anderbord: 'lid12345' }, weergave: { [s.bord]: 'gek' }, concept: { bord: s.bord, tekst: 'half af', cat: 'todo' } }
  const a = schoonStaat(json).apparaat
  assert.equal(a.geluid, true)
  assert.deepEqual(a.ik, { [s.bord]: 'lid12345' })
  assert.deepEqual(a.weergave, {})
  assert.deepEqual(a.concept, { bord: s.bord, tekst: 'half af', cat: 'todo', nieuw: true })
})

test('actief bord dat niet bestaat → het eerste bord', () => {
  const s = JSON.parse(JSON.stringify(beginStaat(NU)))
  const id = s.bord
  s.bord = 'bestaatniet'
  assert.equal(schoonStaat(s).bord, id)
})

test('apparaat: sorteren en laatste back-up worden bewaard, onzin valt weg', () => {
  const s = beginStaat(NU)
  const json = JSON.parse(JSON.stringify(s))
  json.apparaat.sorteer = { [s.bord]: 'hartjes', anderbord1: 'hartjes' }
  json.apparaat.weergave = { [s.bord]: 'vrij' }
  json.apparaat.laatsteBackup = NU
  let schoon = schoonStaat(json)
  assert.deepEqual(schoon.apparaat.sorteer, { [s.bord]: 'hartjes' })
  assert.deepEqual(schoon.apparaat.weergave, { [s.bord]: 'vrij' })
  assert.equal(schoon.apparaat.laatsteBackup, NU)
  json.apparaat.sorteer = { [s.bord]: 'willekeurig' }
  json.apparaat.laatsteBackup = 'gisteren'
  schoon = schoonStaat(json)
  assert.deepEqual(schoon.apparaat.sorteer, {})
  assert.equal(schoon.apparaat.laatsteBackup, 0)
  // Oude opslag uit M1 (zonder deze velden) blijft gewoon werken.
  delete json.apparaat.sorteer
  delete json.apparaat.laatsteBackup
  assert.deepEqual(schoonStaat(json).apparaat.sorteer, {})
})
