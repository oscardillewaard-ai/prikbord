import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALLES, isAlles, wisselCat, iedereenZin, past, sorteer, trek, inDeDoos, perMaand } from '../public/js/filter.js'
import { beginStaat, nieuwBriefje, zetHart, zetVeld, verwijder, voegLidToe } from '../public/js/model.js'
import { prng } from '../public/js/seed.js'

const NU = 1_762_600_000_000

function bordMetBriefjes() {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  const ik = s.apparaat.ik[s.bord]
  const maak = (id, cat, t) => nieuwBriefje(bord, { id, door: ik, tekst: id, cat, now: NU + t })
  const a = maak('sushi001', 'uiteten', 1)
  const b = maak('soep0001', 'recepten', 2)
  const c = maak('pizza001', 'uiteten', 3)
  const d = maak('taart001', 'recepten', 4)
  return { s, bord, ik, a, b, c, d }
}

test('filter: Alles, chips aan en uit, meerdere categorieën tegelijk', () => {
  const { bord, a, b, c } = bordMetBriefjes()
  assert.ok(isAlles(ALLES))
  let f = wisselCat(ALLES, 'uiteten')
  assert.ok(!isAlles(f))
  assert.deepEqual([a, b, c].filter((x) => past(bord, x, f)).map((x) => x.id), ['sushi001', 'pizza001'])
  f = wisselCat(f, 'recepten')
  assert.equal([a, b, c].filter((x) => past(bord, x, f)).length, 3)
  f = wisselCat(wisselCat(f, 'uiteten'), 'recepten')
  assert.ok(isAlles(f))
  // ALLES zelf blijft onaangeroerd.
  assert.deepEqual(ALLES.cats, [])
})

test('💞 Iedereen zin: alleen als elk lid een hartje gaf', () => {
  const { bord, ik, a, b } = bordMetBriefjes()
  assert.equal(iedereenZin(bord, a), false)
  zetHart(a, ik, true, NU + 10)
  assert.equal(iedereenZin(bord, a), true) // één lid: dat ben jij
  const tara = voegLidToe(bord, { naam: 'Tara', now: NU })
  assert.equal(iedereenZin(bord, a), false)
  zetHart(a, tara, true, NU + 11)
  assert.equal(iedereenZin(bord, a), true)
  zetHart(a, tara, false, NU + 12)
  assert.equal(iedereenZin(bord, a), false)
  const f = { cats: [], samen: true }
  zetHart(b, ik, true, NU + 13)
  zetHart(b, tara, true, NU + 13)
  assert.deepEqual([a, b].filter((x) => past(bord, x, f)).map((x) => x.id), ['soep0001'])
  // Combinatie: categorie én iedereen zin.
  assert.equal(past(bord, b, { cats: ['uiteten'], samen: true }), false)
})

test('sorteren: nieuwste eerst, of meeste hartjes (bij gelijk: nieuwste eerst)', () => {
  const { bord, ik, a, b, c, d } = bordMetBriefjes()
  const lijst = [a, b, c, d]
  assert.deepEqual(sorteer(lijst).map((x) => x.id), ['taart001', 'pizza001', 'soep0001', 'sushi001'])
  const tara = voegLidToe(bord, { naam: 'Tara', now: NU })
  zetHart(a, ik, true, NU + 20)
  zetHart(a, tara, true, NU + 21)
  zetHart(b, ik, true, NU + 22)
  zetHart(c, tara, true, NU + 23)
  zetHart(d, ik, false, NU + 24) // uitgezet telt niet
  assert.deepEqual(sorteer(lijst, 'hartjes').map((x) => x.id), ['sushi001', 'pizza001', 'soep0001', 'taart001'])
  // De oorspronkelijke lijst blijft zoals hij was.
  assert.deepEqual(lijst.map((x) => x.id), ['sushi001', 'soep0001', 'pizza001', 'taart001'])
})

test('trek een briefje: uit de zichtbare, en "nog eens" geeft een ander', () => {
  const ids = ['a1234', 'b1234', 'c1234']
  const r = prng(42)
  const geteld = { a1234: 0, b1234: 0, c1234: 0 }
  let vorige = null
  for (let i = 0; i < 3000; i++) {
    const id = trek(ids, r, vorige)
    assert.notEqual(id, vorige)
    geteld[id]++
    vorige = id
  }
  // Ongeveer eerlijk verdeeld.
  for (const n of Object.values(geteld)) assert.ok(n > 800 && n < 1200, JSON.stringify(geteld))
  assert.equal(trek(['enigeee'], r, 'enigeee'), 'enigeee')
  assert.equal(trek([], r), null)
  assert.equal(trek(ids, () => 0.9999999), 'c1234')
})

test('Gedaan-doos: nieuwste eerst op datum, per maand gegroepeerd', () => {
  const { bord, a, b, c, d } = bordMetBriefjes()
  zetVeld(a, 'gedaan', { datum: '2026-10-03' }, NU + 30)
  zetVeld(b, 'gedaan', { datum: '2026-11-08', notitie: 'Heerlijk!' }, NU + 31)
  zetVeld(c, 'gedaan', { datum: '2026-11-01' }, NU + 32)
  zetVeld(d, 'gedaan', { datum: '2026-11-08' }, NU + 33) // zelfde dag, later in de doos
  const doos = inDeDoos(bord)
  assert.deepEqual(doos.map((x) => x.id), ['taart001', 'soep0001', 'pizza001', 'sushi001'])
  assert.deepEqual(
    perMaand(doos).map((m) => [m.maand, m.briefjes.length]),
    [
      ['2026-11', 3],
      ['2026-10', 1],
    ],
  )
  // Terughangen (gedaan = null) en weghalen: niet meer in de doos.
  zetVeld(c, 'gedaan', null, NU + 40)
  verwijder(bord, 'sushi001', NU + 41)
  assert.deepEqual(inDeDoos(bord).map((x) => x.id), ['taart001', 'soep0001'])
})
