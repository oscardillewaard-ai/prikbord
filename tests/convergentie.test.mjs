// Convergentie (§9): 3 gesimuleerde telefoons doen willekeurige bewerkingen
// (tekst, categorie, hartjes, slepen, gedaan, verwijderen, nieuwe briefjes,
// categorieën, leden, bordnaam) en synchroniseren in willekeurige volgorde,
// met de echte sync-motor (public/js/sync.js) en de echte worker. De nep-KV
// geeft soms een verouderde stand terug (KV is "uiteindelijk consistent").
// Een schrijfactie die daarop voortbouwt, overschrijft dan die van een ander:
// precies het geval van twee gelijktijdige PUT's. Soms mislukt een
// schrijfactie (429), en soms is een telefoon offline.
// Na afloop moeten alle telefoons én de server exact dezelfde stand hebben,
// en die stand moet gelijk zijn aan álle bewerkingen samen: niets kwijt.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker from '../proxy/prikbord-sync-worker.js'
import { maakSync, haalBord } from '../public/js/sync.js'
import { prng } from '../public/js/seed.js'
import { mergeBord } from '../public/js/merge.js'
import { schoonBord } from '../public/js/validate.js'
import { nieuwBord, voegLidToe, nieuwBriefje, zetVeld, zetHart, hartjesVan, verwijder, zetCat, zetLid, zetInfo } from '../public/js/model.js'

const J = JSON.stringify
const BEGIN = 1_762_700_000_000
const SERVER = 'https://prikbord.test'
const CODE = 'Convergentie_test_1234567'
const CATS = ['vakantie', 'weekend', 'uiteten', 'recepten', 'todo']
const TEKSTEN = ['Sushi', 'Sushi in Den Haag', 'Pizza 🍕', 'Noorderlicht', 'Appeltaart van oma', 'Fietsband', 'Porto!', '']

// KV met geheugen: elke schrijfactie is een nieuwe versie. `oud` = kans dat
// een leesactie 1 of 2 versies achterloopt, `fout` = kans dat put mislukt.
// `pauze`: wacht een willekeurig aantal microtaken, zodat gelijktijdige
// rondes door elkaar lopen.
function lastigeKv(r, instelling) {
  const versies = new Map()
  const tel = { lees: 0, schrijf: 0, verouderd: 0, mislukt: 0 }
  const pauze = async () => {
    for (let i = Math.floor(r() * 4); i > 0; i--) await null
  }
  const lees = async (sleutel) => {
    await pauze()
    tel.lees++
    const lijst = versies.get(sleutel) || []
    let i = lijst.length - 1
    if (i > 0 && r() < instelling.oud) {
      i = Math.max(0, i - 1 - Math.floor(r() * 2))
      tel.verouderd++
    }
    return lijst[i] || { value: null, metadata: null }
  }
  return {
    tel,
    nieuwste: (sleutel) => versies.get(sleutel)?.at(-1)?.value ?? null,
    async get(sleutel) {
      return (await lees(sleutel)).value
    },
    async getWithMetadata(sleutel) {
      const e = await lees(sleutel)
      return { value: e.value, metadata: e.metadata }
    },
    async put(sleutel, value, opties = {}) {
      await pauze()
      if (r() < instelling.fout) {
        tel.mislukt++
        throw new Error('KV PUT failed: 429 Too Many Requests')
      }
      tel.schrijf++
      if (!versies.has(sleutel)) versies.set(sleutel, [])
      versies.get(sleutel).push({ value, metadata: opties.metadata ?? null })
    },
  }
}

function maakTelefoons(r, kv, klok, grof) {
  const env = { PRIKBORD: kv }
  const viaWorker = (url, init = {}) => worker.fetch(new Request(url, init), env)
  // Elke telefoon heeft een eigen klok: de een loopt achter, de ander voor.
  // Met `grof` tikt de klok in hele seconden: dan krijgen wijzigingen op
  // verschillende telefoons vaak precies hetzelfde tijdstip (de vaste keuze
  // in merge.js moet dan op elke telefoon hetzelfde uitvallen).
  return [0, -4000, grof ? 3000 : 2500].map((afwijking, n) => {
    const t = { naam: 'ABC'[n], bord: null, ik: null, online: true, teller: 0 }
    t.nu = () => (grof ? Math.floor((klok() + afwijking) / 1000) * 1000 : klok() + afwijking)
    t.sync = maakSync({
      fetch: (url, init) => (t.online ? viaWorker(url, init) : Promise.reject(new TypeError('Failed to fetch'))),
      lees: () => t.bord,
      schrijf: (_, samen) => (t.bord = samen),
      adres: () => ({ u: SERVER, r: CODE }),
      wacht: async () => {},
      willekeurig: r,
      online: () => t.online,
      nu: t.nu,
    })
    t.koppel = async () => {
      const { rev, bord } = await haalBord(viaWorker, { u: SERVER, r: CODE })
      t.sync.onthoud(bord.id, rev, bord)
      t.ik = voegLidToe(bord, { naam: `Telefoon ${t.naam}`, now: t.nu() })
      t.bord = bord
    }
    return t
  })
}

// Eén willekeurige bewerking met de echte modelfuncties.
function bewerk(t, r) {
  const kies = (lijst) => lijst[Math.floor(r() * lijst.length)]
  const now = t.nu()
  const bord = t.bord
  const levend = Object.values(bord.briefjes).filter((b) => !b.weg)
  const x = r()
  if (x < 0.14 || !levend.length) {
    nieuwBriefje(bord, { id: `brf-${t.naam}-${t.teller++}`, door: t.ik, tekst: kies(TEKSTEN), cat: kies(CATS), now })
  } else if (x < 0.3) zetVeld(kies(levend), 'tekst', `${kies(TEKSTEN)} ${Math.floor(r() * 9)}`, now)
  else if (x < 0.38) zetVeld(kies(levend), 'cat', kies(CATS), now)
  else if (x < 0.55) {
    const b = kies(levend)
    zetHart(b, t.ik, !hartjesVan(b).includes(t.ik), now)
  } else if (x < 0.68) {
    const b = kies(levend)
    zetVeld(b, 'vrij', { x: Math.floor(r() * 770), y: Math.floor(r() * 3000) }, now)
    zetVeld(b, 'stapel', Math.floor(r() * 60), now)
  } else if (x < 0.76) zetVeld(kies(levend), 'gedaan', r() < 0.7 ? { datum: '2026-11-09', notitie: kies(['top', 'leuk', 'nooit meer']) } : null, now)
  else if (x < 0.84) verwijder(bord, kies(levend).id, now)
  else if (x < 0.9) {
    const veld = kies(['naam', 'kleur', 'verborgen'])
    zetCat(bord, kies(CATS), veld, veld === 'naam' ? kies(['Eten', 'Reizen', 'Klusjes']) : veld === 'kleur' ? kies(['zon', 'roze', 'mint']) : r() < 0.5, now)
  } else if (x < 0.95) {
    if (r() < 0.5) zetLid(bord, t.ik, 'kleur', kies(['rood', 'blauw', 'groen', 'paars']), now)
    else zetLid(bord, t.ik, 'naam', kies(['Oscar', 'Tara', 'Sam', 'Noor']), now)
  } else zetInfo(bord, 'naam', kies(['Porto', 'Porto!', 'Lissabon']), now)
}

async function simuleer({ zaad, rondes, tegelijk, grof = false }) {
  const r = prng(zaad)
  const instelling = { oud: 0.25, fout: 0.1 }
  const kv = lastigeKv(r, instelling)
  let tijd = BEGIN
  const telefoons = maakTelefoons(r, kv, () => tijd, grof)
  const [a] = telefoons
  // Telefoon A maakt het bord en deelt het; B en C koppelen.
  a.bord = nieuwBord({ id: 'convergent1', naam: 'Groepsreis', emoji: '🧳', sjabloon: 'thuis', now: a.nu() })
  a.ik = voegLidToe(a.bord, { naam: 'Telefoon A', now: a.nu() })
  while ((await a.sync.ronde(a.bord.id)).status !== 'ok');
  for (const t of telefoons.slice(1)) await t.koppel()
  // Alle bewerkingen samen: hier moet iedereen straks op uitkomen.
  let alles = null
  const noteer = (t) => (alles = mergeBord(alles, schoonBord(JSON.parse(J(t.bord)))))
  telefoons.forEach(noteer)

  for (let ronde = 0; ronde < rondes; ronde++) {
    tijd += Math.floor(r() * (grof ? 1200 : 3000))
    // Soms gaat een telefoon even offline (of komt hij terug).
    for (const t of telefoons) if (r() < 0.04) t.online = !t.online
    // 0 tot 3 bewerkingen, op willekeurige telefoons.
    for (let i = Math.floor(r() * 4); i > 0; i--) {
      const t = telefoons[Math.floor(r() * 3)]
      bewerk(t, r)
      noteer(t)
    }
    // Een willekeurige groep telefoons synchroniseert, in willekeurige volgorde.
    const wie = telefoons.filter(() => r() < 0.55).sort(() => r() - 0.5)
    if (tegelijk) await Promise.all(wie.map((t) => t.sync.ronde(t.bord.id)))
    else for (const t of wie) await t.sync.ronde(t.bord.id)
  }

  // Grove klok: als slot passen alle drie op precies hetzelfde tijdstip de
  // bordnaam en een categorie aan, elk met een andere waarde. Dat gelijkspel
  // wordt niet meer overschreven, dus de vaste keuze moet overal gelijk zijn.
  if (grof) {
    const T = tijd + 60_000
    telefoons.forEach((t, i) => {
      zetInfo(t.bord, 'naam', ['Porto', 'Lissabon', 'Faro'][i], T)
      zetCat(t.bord, 'todo', 'naam', ['Klusjes', 'Doen!', 'Lijstje'][i], T)
      noteer(t)
    })
  }

  // Rustig afronden: KV weer betrouwbaar, iedereen online, een paar keer rond.
  const stats = { ...kv.tel }
  instelling.oud = 0
  instelling.fout = 0
  for (const t of telefoons) t.online = true
  let rondjes = 0
  while (rondjes < 6) {
    rondjes++
    for (const t of telefoons) await t.sync.ronde(t.bord.id)
    const standen = telefoons.map((t) => J(t.bord))
    if (standen.every((x) => x === standen[0]) && telefoons.every((t) => !t.sync.heeftIets(t.bord.id))) break
  }
  return { telefoons, kv, alles, rondjes, stats }
}

function controleer({ telefoons, kv, alles, rondjes }) {
  const standen = telefoons.map((t) => J(t.bord))
  assert.ok(rondjes < 6, `na ${rondjes} rustige rondes nog niet gelijk`)
  assert.equal(standen[1], standen[0], 'telefoon B = telefoon A')
  assert.equal(standen[2], standen[0], 'telefoon C = telefoon A')
  assert.equal(J(JSON.parse(kv.nieuwste(`bord:${CODE}`))), standen[0], 'server = telefoons')
  assert.equal(standen[0], J(alles), 'eindstand = alle bewerkingen samen (niets kwijt, niets verzonnen)')
}

test('convergentie: 3 telefoons, 1500 rondes, om de beurt (geseed, herhaalbaar)', async (t) => {
  const uit = await simuleer({ zaad: 20261109, rondes: 1500, tegelijk: false })
  controleer(uit)
  const b = uit.telefoons[0].bord
  const briefjes = Object.values(b.briefjes)
  t.diagnostic(`${briefjes.filter((x) => !x.weg).length} briefjes + ${briefjes.filter((x) => x.weg).length} grafstenen, ${Object.keys(b.leden).length} leden`)
  t.diagnostic(`onderweg: ${uit.stats.verouderd} verouderde leesacties, ${uit.stats.mislukt} mislukte schrijfacties, ${uit.stats.schrijf} geslaagde schrijfacties`)
  assert.ok(uit.stats.verouderd > 100 && uit.stats.mislukt > 20, 'de KV was echt lastig')
  assert.ok(briefjes.some((x) => x.weg) && briefjes.some((x) => x.v?.gedaan?.w) && briefjes.some((x) => Object.keys(x.hart || {}).length > 1))
})

test('convergentie: 3 telefoons, 400 rondes, tegelijk (rondes lopen door elkaar)', async () => {
  for (const zaad of [1, 2, 3]) controleer(await simuleer({ zaad, rondes: 400, tegelijk: true }))
})

test('convergentie: klok in hele seconden, dus vaak precies hetzelfde tijdstip (600 rondes)', async () => {
  const uit = await simuleer({ zaad: 7, rondes: 600, tegelijk: false, grof: true })
  controleer(uit)
  assert.ok(['Porto', 'Lissabon', 'Faro'].includes(uit.telefoons[0].bord.info.naam.w))
})
