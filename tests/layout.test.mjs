import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legNetjes, kolomAantal, kolomBreedte } from '../public/js/layout.js'

const ids = Array.from({ length: 30 }, (_, i) => `briefje${i}`)
const hoogtes = Object.fromEntries(ids.map((id, i) => [id, 90 + ((i * 37) % 120)]))

test('kolommen: 2 op een telefoon, meer op bredere schermen', () => {
  assert.equal(kolomAantal(390), 2)
  assert.equal(kolomAantal(360), 2)
  assert.equal(kolomAantal(768), 3)
  assert.equal(kolomAantal(1024), 4)
  assert.equal(kolomAantal(1400), 5)
})

test('zelfde invoer geeft dezelfde posities en draaiing', () => {
  assert.deepEqual(legNetjes(ids, hoogtes, 390), legNetjes([...ids], { ...hoogtes }, 390))
})

test('briefjes blijven binnen het bord en elk krijgt een plek', () => {
  for (const breedte of [320, 390, 430, 768, 1280]) {
    const { plek, hoogte, breedte: w } = legNetjes(ids, hoogtes, breedte)
    assert.equal(Object.keys(plek).length, ids.length)
    assert.equal(w, kolomBreedte(breedte))
    for (const id of ids) {
      const p = plek[id]
      assert.ok(p.x >= 0 && p.x + p.w <= breedte, `${id} past in de breedte op ${breedte}px`)
      assert.ok(p.y >= 0 && p.y + hoogtes[id] <= hoogte, `${id} past in de hoogte`)
      assert.ok(Math.abs(p.draai) <= 3.5)
    }
  }
})

test('in één kolom overlappen briefjes elkaar niet in de hoogte (ruimte voor de punaise)', () => {
  const { plek } = legNetjes(ids, hoogtes, 390)
  const perKolom = {}
  for (const id of ids) (perKolom[Math.round(plek[id].x / 50)] ||= []).push(id)
  for (const kol of Object.values(perKolom)) {
    kol.sort((a, b) => plek[a].y - plek[b].y)
    for (let i = 1; i < kol.length; i++) {
      const boven = kol[i - 1]
      assert.ok(plek[kol[i]].y >= plek[boven].y + hoogtes[boven] + 14 - 6, 'minstens wat lucht tussen twee briefjes')
    }
  }
})

test('stapelvolgorde volgt de lijst (lager briefje ligt erboven, punaise zichtbaar)', () => {
  const { plek } = legNetjes(ids, hoogtes, 390)
  ids.forEach((id, i) => assert.equal(plek[id].z, i + 1))
})

test('leeg bord', () => {
  const r = legNetjes([], {}, 390)
  assert.deepEqual(r.plek, {})
  assert.ok(r.hoogte > 0)
})
