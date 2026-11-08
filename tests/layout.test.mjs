import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legNetjes, kolomAantal, kolomBreedte, legVrij, eersteLegePlek, VRIJ, pasCamera, passendeSchaal, zoomRond, ZOOM_MAX } from '../public/js/layout.js'

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

// ---------- Vrij ----------

const los = (n, start = 0) => Array.from({ length: n }, (_, i) => ({ id: `vrij${String(i + start).padStart(4, '0')}`, gemaakt: 1000 + i + start, vrij: null }))

test('vrij: zelfde invoer geeft overal dezelfde plekken (ook in een andere volgorde)', () => {
  const lijst = [...los(9), { id: 'vastgezet1', gemaakt: 5, vrij: { x: 300, y: 40 } }]
  const a = legVrij(lijst)
  const b = legVrij([...lijst].reverse())
  assert.deepEqual(a, b)
  assert.equal(a.vastgezet1.auto, false)
  assert.deepEqual([a.vastgezet1.x, a.vastgezet1.y], [300, 40])
})

test('vrij: briefjes zonder plek krijgen de eerste lege plek bovenaan, binnen het bord', () => {
  const plek = legVrij(los(10))
  const ys = Object.values(plek).map((p) => p.y)
  // 4 per rij: 10 briefjes = 3 rijen.
  assert.equal(new Set(Object.values(plek).map((p) => Math.round(p.y / VRIJ.vakH))).size, 3)
  for (const p of Object.values(plek)) {
    assert.ok(p.x >= 0 && p.x + VRIJ.briefje <= VRIJ.breedte, `x ${p.x} past`)
    assert.ok(p.y >= 0)
    assert.equal(p.auto, true)
  }
  assert.ok(Math.min(...ys) < VRIJ.vakH)
})

test('vrij: een vastgezet briefje houdt zijn vakje bezet; een nieuw briefje laat oudere niet verspringen', () => {
  const vast = { id: 'vastgezet1', gemaakt: 5, vrij: { x: VRIJ.rand, y: VRIJ.boven } }
  const plek = legVrij([vast, ...los(3)])
  assert.ok(Object.entries(plek).every(([id, p]) => id === 'vastgezet1' || !(p.y < VRIJ.vakH && p.x < VRIJ.vakB)), 'linksboven is bezet')
  const meer = legVrij([vast, ...los(4)])
  for (const id of Object.keys(plek)) assert.deepEqual(meer[id], plek[id])
  // Wat er net een randje overheen hangt, telt niet als bezet.
  assert.deepEqual(eersteLegePlek([{ x: VRIJ.rand + VRIJ.briefje * 0.75, y: VRIJ.boven }]), { x: VRIJ.rand, y: VRIJ.boven })
})

test('camera: zoom binnen de grenzen, bord in het midden als het smaller is dan het venster', () => {
  const maten = { vw: 376, vh: 600, ww: 739, wh: 2000 }
  const pas = passendeSchaal(maten)
  assert.equal(pasCamera({ s: 99, tx: 0, ty: 0 }, maten).s, ZOOM_MAX)
  assert.equal(pasCamera({ s: 0.0001, tx: 0, ty: 0 }, maten).s, Math.max(maten.vh / maten.wh, pas * 0.4))
  const passend = pasCamera({ s: pas, tx: 123, ty: 0 }, maten)
  assert.ok(Math.abs(passend.tx) < 1e-9, 'precies passend: tx = 0')
  const klein = pasCamera({ s: pas / 2, tx: 500, ty: 0 }, maten)
  assert.ok(Math.abs(klein.tx - (maten.vw - maten.ww * klein.s) / 2) < 1e-9, 'kleiner: in het midden')
  const ver = pasCamera({ s: 1, tx: -5000, ty: 5000 }, maten)
  assert.equal(ver.tx, maten.vw - maten.ww - 40)
  assert.equal(ver.ty, 40)
})

test('camera: zoomen rond een punt houdt dat punt op zijn plek', () => {
  const cam = { s: 0.5, tx: -20, ty: -100 }
  const uit = zoomRond(cam, 1.25, 200, 300)
  const wereld = (c, x, y) => [(x - c.tx) / c.s, (y - c.ty) / c.s]
  const [a, b] = wereld(cam, 200, 300)
  const [c, d] = wereld(uit, 200, 300)
  assert.ok(Math.abs(a - c) < 1e-9 && Math.abs(b - d) < 1e-9)
})
