// Een demobord met briefjes van drie mensen (alleen voor de screenshots).
import { beginStaat, nieuwBriefje, voegLidToe, zetHart, zetVeld } from '../public/js/model.js'

export const DEMO_NU = Date.parse('2026-11-08T12:00:00+01:00')

export function demoStaat() {
  const nu = DEMO_NU
  const s = beginStaat(nu - 30 * 864e5)
  const bord = s.borden[s.bord]
  const ik = s.apparaat.ik[s.bord]
  bord.leden[ik].naam = { w: 'Oscar', t: nu }
  const tara = voegLidToe(bord, { id: 'lidtara1', naam: 'Tara', kleur: 'blauw', now: nu })
  const sam = voegLidToe(bord, { id: 'lidsam01', naam: 'Sam', kleur: 'groen', now: nu })
  const briefjes = [
    [ik, 'vakantie', 'Met de trein door Italië: Milaan, Bologna voor de pasta, Florence voor het ijs en dan een week aan zee bij Positano 🍦🚂 En onderweg nog even naar Napels voor de echte pizza'],
    [tara, 'uiteten', 'Sushi in Den Haag 🍣'],
    [ik, 'recepten', 'Shakshuka met feta en véél koriander'],
    [sam, 'bucketlist', 'Noorderlicht zien ✨'],
    [tara, 'weekend', 'Weekendje België: Gent, frietjes en een ruïne bezoeken'],
    [ik, 'todo', 'Fietsband plakken 🚲'],
    [sam, 'dagjeuit', 'Efteling in de winter ❄️'],
    [tara, 'restaurants', 'De Kas in Amsterdam (reserveren!)'],
    [ik, 'todo', 'Dakgoot schoonmaken voor de herfst 🍂'],
    [tara, 'recepten', 'Pompoensoep met gember'],
    [sam, 'bucketlist', 'Ooit een marathon lopen 🏃'],
    [ik, 'dagjeuit', 'Fietsen over de Afsluitdijk'],
  ]
  briefjes.forEach(([door, cat, tekst], i) => {
    nieuwBriefje(bord, { id: `demo${String(i + 1).padStart(2, '0')}`, door, tekst, cat, now: nu - (i + 1) * 3600e3 })
  })
  s.apparaat.seenVersion = 999 // nooit "Wat is er nieuw" over de plaatjes heen
  s.apparaat.laatsteCat[s.bord] = 'weekend'
  return s
}


// Het demobord van M2: hartjes van drie mensen en een gevulde Gedaan-doos.
export function demoStaatM2() {
  const s = demoStaat()
  const bord = s.borden[s.bord]
  const ik = s.apparaat.ik[s.bord]
  const nu = DEMO_NU
  const hart = (id, ...wie) => wie.forEach((l, i) => zetHart(bord.briefjes[id], l, true, nu + i))
  hart('demo02', ik, 'lidtara1', 'lidsam01')
  hart('demo04', ik, 'lidsam01')
  hart('demo01', 'lidtara1')
  hart('demo07', ik, 'lidtara1', 'lidsam01')
  hart('demo10', 'lidsam01')
  const gedaan = [
    [ik, 'uiteten', 'Pannenkoeken eten in het bos 🥞', '2026-11-02', 'Met poffertjes toe. Wat een feest!'],
    ['lidtara1', 'dagjeuit', 'Kastelen kijken in Limburg 🏰', '2026-10-19', 'Valkenburg was magisch'],
    ['lidsam01', 'recepten', 'Zelf ramen maken 🍜', '2026-10-05', ''],
    [ik, 'todo', 'Fietsen naar de APK 🚲', '2026-11-06', ''],
    ['lidtara1', 'bucketlist', 'Zonsopkomst op de Brocken ☀️', '2026-09-14', 'Om 5 uur op, maar zó mooi'],
  ]
  gedaan.forEach(([door, cat, tekst, datum, notitie], i) => {
    const b = nieuwBriefje(bord, { id: `klaar${String(i + 1).padStart(2, '0')}`, door, tekst, cat, now: nu - (40 + i) * 864e5 })
    zetVeld(b, 'gedaan', notitie ? { datum, notitie } : { datum }, Date.parse(`${datum}T20:00:00+01:00`))
    if (i % 2 === 0) zetHart(b, 'lidtara1', true, nu)
  })
  return s
}
