import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beginStaat, nieuwBriefje, zetVeld, verwijder, stempel, opHetBord, categorieen, maakId, voegLidToe, THUIS_CATS } from '../public/js/model.js'
import { ID_RE } from '../public/js/validate.js'

const NU = 1_762_600_000_000

test('tijdstempel = max(nu, vorige + 1)', () => {
  assert.equal(stempel(null, NU), NU)
  assert.equal(stempel({ t: NU - 10 }, NU), NU)
  // Klok sprong terug, of twee wijzigingen in dezelfde milliseconde:
  assert.equal(stempel({ t: NU }, NU), NU + 1)
  assert.equal(stempel({ t: NU + 500 }, NU), NU + 501)
})

test('maakId: lang, willekeurig en geldig', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => maakId()))
  assert.equal(ids.size, 1000)
  for (const id of ids) assert.match(id, ID_RE)
})

test('beginstaat: bord Thuis met de 8 categorieën en jij als lid', () => {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  assert.equal(bord.info.naam.w, 'Thuis')
  assert.deepEqual(categorieen(bord).map((c) => c.naam), THUIS_CATS.map((c) => c.naam))
  assert.equal(Object.keys(bord.leden).length, 1)
  assert.ok(bord.leden[s.apparaat.ik[s.bord]])
})

test('zetVeld: alleen bij een echte wijziging een nieuwe tijdstempel', () => {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  const b = nieuwBriefje(bord, { door: 'lid12345', tekst: 'Sushi', cat: 'uiteten', now: NU })
  assert.equal(zetVeld(b, 'tekst', 'Sushi', NU + 5), false)
  assert.equal(b.v.tekst.t, NU)
  assert.equal(zetVeld(b, 'tekst', 'Sushi in Den Haag', NU), true)
  assert.equal(b.v.tekst.t, NU + 1) // zelfde milliseconde → toch later
  assert.throws(() => zetVeld(b, 'onzin', 1, NU))
})

test('verwijderen zet een grafsteen die later is dan elke bewerking', () => {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  const b = nieuwBriefje(bord, { door: 'lid12345', tekst: 'Weg', cat: 'todo', now: NU })
  zetVeld(b, 'tekst', 'Weg ermee', NU + 1000) // klok van een ander stond voor
  verwijder(bord, b.id, NU + 10)
  assert.deepEqual(Object.keys(bord.briefjes[b.id]).sort(), ['door', 'gemaakt', 'id', 'weg'])
  assert.ok(bord.briefjes[b.id].weg > NU + 1000)
  assert.equal(opHetBord(bord).length, 0)
  assert.equal(zetVeld(bord.briefjes[b.id], 'tekst', 'terug?', NU + 2000), false)
})

test('opHetBord: nieuwste eerst, zonder gedane briefjes', () => {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  const a = nieuwBriefje(bord, { door: 'lid12345', tekst: 'oud', cat: 'todo', now: NU })
  const b = nieuwBriefje(bord, { door: 'lid12345', tekst: 'nieuw', cat: 'todo', now: NU + 1 })
  const c = nieuwBriefje(bord, { door: 'lid12345', tekst: 'gedaan', cat: 'todo', now: NU + 2 })
  zetVeld(c, 'gedaan', { datum: '2026-11-08' }, NU + 3)
  assert.deepEqual(opHetBord(bord).map((x) => x.id), [b.id, a.id])
})

test('nieuw lid krijgt een kleur die nog vrij is', () => {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  const id = voegLidToe(bord, { naam: 'Tara', now: NU })
  assert.notEqual(bord.leden[id].kleur.w, 'rood')
})
