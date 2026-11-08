import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeBord, mergeRegister, importeer } from '../public/js/merge.js'
import { schoonBord, schoonStaat } from '../public/js/validate.js'
import { prng } from '../public/js/seed.js'
import { beginStaat, nieuwBriefje } from '../public/js/model.js'

const J = (x) => JSON.stringify(x)

// Willekeurig bord met kleine tijdstempels (1..12), zodat gelijke tijdstippen
// met verschillende waarden vaak voorkomen: precies het lastige geval.
function willekeurigBord(r) {
  const pick = (arr) => arr[Math.floor(r() * arr.length)]
  const t = () => 1 + Math.floor(r() * 12)
  const kans = (p) => r() < p
  const bord = { id: 'bordtest1', gemaakt: pick([1, 2, 3]), info: {}, cats: {}, leden: {}, briefjes: {} }
  if (kans(0.7)) bord.info.naam = { w: pick(['Thuis', 'Porto', 'Thuis!']), t: t() }
  for (const c of ['catAAAA', 'catBBBB']) {
    if (kans(0.6)) bord.cats[c] = { naam: { w: pick(['Eten', 'Reizen']), t: t() }, kleur: { w: pick(['zon', 'roze', 'mint']), t: t() } }
  }
  for (const l of ['lidAAAA', 'lidBBBB', 'lidCCCC']) {
    if (kans(0.5)) bord.leden[l] = { naam: { w: pick(['Oscar', 'Tara', 'Sam']), t: t() } }
  }
  for (const id of ['brf00001', 'brf00002', 'brf00003', 'brf00004', 'brf00005']) {
    if (!kans(0.7)) continue
    const b = { id, door: pick(['lidAAAA', 'lidBBBB']), gemaakt: pick([1, 2]), v: {}, hart: {} }
    if (kans(0.8)) b.v.tekst = { w: pick(['Sushi', 'Sushi!', 'Pizza', '']), t: t() }
    if (kans(0.6)) b.v.cat = { w: pick(['catAAAA', 'catBBBB']), t: t() }
    if (kans(0.3)) b.v.gedaan = { w: kans(0.5) ? null : { datum: '2026-11-08', notitie: pick(['top', 'leuk']) }, t: t() }
    if (kans(0.3)) b.v.vrij = { w: { x: Math.floor(r() * 1000), y: Math.floor(r() * 3000) }, t: t() }
    if (kans(0.3)) b.v.link = { w: pick(['https://ah.nl/', null]), t: t() }
    for (const l of ['lidAAAA', 'lidBBBB', 'lidCCCC']) if (kans(0.4)) b.hart[l] = { w: kans(0.5), t: t() }
    if (kans(0.12)) b.weg = t()
    bord.briefjes[id] = b
  }
  return schoonBord(bord)
}

test('merge is commutatief, associatief en idempotent (2000 geseede rondes)', () => {
  const r = prng(20261108)
  for (let i = 0; i < 2000; i++) {
    const a = willekeurigBord(r)
    const b = willekeurigBord(r)
    const c = willekeurigBord(r)
    assert.equal(J(mergeBord(a, b)), J(mergeBord(b, a)), `commutatief, ronde ${i}`)
    assert.equal(J(mergeBord(mergeBord(a, b), c)), J(mergeBord(a, mergeBord(b, c))), `associatief, ronde ${i}`)
    assert.equal(J(mergeBord(a, a)), J(a), `idempotent, ronde ${i}`)
    const ab = mergeBord(a, b)
    assert.equal(J(mergeBord(ab, b)), J(ab), `opnieuw samenvoegen verandert niets, ronde ${i}`)
    // De uitkomst is zelf weer schoon (zelfde JSON na de controle).
    assert.equal(J(schoonBord(JSON.parse(J(ab)))), J(ab), `uitkomst is schoon, ronde ${i}`)
  }
})

test('per veld: tekstwijziging en hartje tegelijk blijven allebei bewaard', () => {
  const basis = schoonBord({ id: 'bordtest1', gemaakt: 1, briefjes: { brf00001: { id: 'brf00001', door: 'lidAAAA', gemaakt: 1, v: { tekst: { w: 'Sushi', t: 1 } }, hart: {} } } })
  const oscar = structuredClone(basis)
  oscar.briefjes.brf00001.v.tekst = { w: 'Sushi in Den Haag', t: 5 }
  const tara = structuredClone(basis)
  tara.briefjes.brf00001.hart.lidBBBB = { w: true, t: 6 }
  const samen = mergeBord(oscar, tara).briefjes.brf00001
  assert.equal(samen.v.tekst.w, 'Sushi in Den Haag')
  assert.equal(samen.hart.lidBBBB.w, true)
})

test('grafsteen wint van een latere bewerking', () => {
  const a = schoonBord({ id: 'bordtest1', gemaakt: 1, briefjes: { brf00001: { id: 'brf00001', door: 'lidAAAA', gemaakt: 1, weg: 3 } } })
  const b = schoonBord({ id: 'bordtest1', gemaakt: 1, briefjes: { brf00001: { id: 'brf00001', door: 'lidAAAA', gemaakt: 1, v: { tekst: { w: 'nog later', t: 99 } }, hart: {} } } })
  assert.deepEqual(mergeBord(a, b).briefjes.brf00001, { id: 'brf00001', door: 'lidAAAA', gemaakt: 1, weg: 3 })
})

test('gelijk tijdstip: elke telefoon kiest dezelfde waarde', () => {
  const x = { w: 'Pizza', t: 7 }
  const y = { w: 'Sushi', t: 7 }
  assert.equal(mergeRegister(x, y), mergeRegister(y, x))
  assert.equal(mergeRegister(x, y).w, 'Sushi')
})

test('importeren voegt samen: niets gaat verloren, nieuwe briefjes worden geteld', () => {
  const NU = 1_762_600_000_000
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  const ik = s.apparaat.ik[s.bord]
  nieuwBriefje(bord, { id: 'eigen0001', door: ik, tekst: 'Van mij', cat: 'todo', now: NU })
  const backup = structuredClone(s)
  nieuwBriefje(backup.borden[s.bord], { id: 'backup001', door: ik, tekst: 'Uit de back-up', cat: 'todo', now: NU + 1 })
  nieuwBriefje(bord, { id: 'eigen0002', door: ik, tekst: 'Na de back-up', cat: 'todo', now: NU + 2 })
  const { staat, nieuweBriefjes, nieuweBorden } = importeer(schoonStaat(s), schoonStaat(backup))
  assert.deepEqual(Object.keys(staat.borden[s.bord].briefjes).sort(), ['backup001', 'eigen0001', 'eigen0002'])
  assert.equal(nieuweBriefjes, 1)
  assert.equal(nieuweBorden, 0)
  // Nog een keer importeren verandert niets.
  const nogEens = importeer(staat, schoonStaat(backup))
  assert.equal(J(nogEens.staat), J(staat))
  assert.equal(nogEens.nieuweBriefjes, 0)
})

test('importeren van een onbekend bord voegt het toe, met wie je daar was', () => {
  const NU = 1_762_600_000_000
  const hier = beginStaat(NU)
  const daar = beginStaat(NU + 1)
  const { staat, nieuweBorden } = importeer(schoonStaat(hier), schoonStaat(daar))
  assert.equal(nieuweBorden, 1)
  assert.equal(Object.keys(staat.borden).length, 2)
  assert.equal(staat.apparaat.ik[daar.bord], daar.apparaat.ik[daar.bord])
  assert.equal(staat.bord, hier.bord) // actief bord blijft hetzelfde
  assert.ok(schoonStaat(JSON.parse(J(staat))))
})
