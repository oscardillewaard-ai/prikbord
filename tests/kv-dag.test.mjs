// Hoeveel KV-schrijf- en leesacties kost een drukke dag? (§6.3)
// Een royale dag, met dezelfde regels als de app (1,5 s bundelen, max. 6 s;
// peilen elke 10 s als er de laatste 5 minuten iets gebeurde, anders 30 s;
// alleen het actieve bord; bij het openen van de app één keer alle borden),
// de echte sync-motor en de echte worker. Tijd is nagebootst, dus de test is
// snel en herhaalbaar.
//
// De dag:
// - Bord "Thuis" (Oscar en Tara, 120 briefjes): allebei 8 keer de app open,
//   4 minuten, met elk 6 bewerkingen (prikken, hartjes, tekst, slepen).
//   Eén keer de eerste sleepbeweging in vrij: dan krijgen alle briefjes een
//   vaste plek (één grote, gebundelde PUT).
// - Bord "Groepsreis" (5 mensen, 40 briefjes): een planavond van een uur
//   waarin iedereen tegelijk de app open heeft en elke 30 tot 150 seconden
//   iets doet; de helft daarvan is een reeks van 3 hartjes binnen 2 seconden.
//   Daarnaast opent iedereen dat bord nog 3 keer 2 minuten, met 2 bewerkingen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker from '../proxy/prikbord-sync-worker.js'
import { maakSync, peilInterval, BUNDEL_MS, BUNDEL_MAX_MS } from '../public/js/sync.js'
import { prng } from '../public/js/seed.js'
import { nepKv } from '../scripts/nep-kv.mjs'
import { nieuwBord, voegLidToe, nieuwBriefje, zetVeld, zetHart, hartjesVan, waarde } from '../public/js/model.js'
import { legVrij } from '../public/js/layout.js'

const DAG = Date.UTC(2026, 10, 14, 6, 0, 0) // zaterdag 7:00 in Nederland
const UUR = 3600e3
const CODES = { thuis: 'Thuis_code_123456789012', reis: 'Reis_code_1234567890123' }

test('KV-schrijfacties op een drukke dag (meld dit getal)', async (t) => {
  const r = prng(14112026)
  const kv = nepKv()
  const env = { PRIKBORD: kv }
  const viaWorker = (url, init = {}) => worker.fetch(new Request(url, init), env)
  let tijd = DAG - UUR
  const wachtrij = []
  const plan = (op, doe) => wachtrij.push({ op, doe, n: wachtrij.length })
  const kies = (lijst) => lijst[Math.floor(r() * lijst.length)]
  let bewerkingen = 0

  // Telefoons: Oscar en Tara op beide borden, Sam, Noor en Daan alleen op de reis.
  const mensen = ['Oscar', 'Tara', 'Sam', 'Noor', 'Daan']
  const telefoons = mensen.map((naam) => {
    const tel = { naam, borden: {}, ik: {}, adres: {}, laatste: {}, open: null, bundel: {} }
    tel.sync = maakSync({
      fetch: viaWorker,
      lees: (id) => tel.borden[id],
      schrijf: (id, samen) => {
        tel.borden[id] = samen
        tel.laatste[id] = tijd // iets van een ander binnengekomen telt ook als "er gebeurde iets"
      },
      adres: (id) => tel.adres[id],
      wacht: async () => {},
      nu: () => tijd,
    })
    return tel
  })
  const [oscar, tara] = telefoons

  // Voorbereiding (telt niet mee): de borden maken, vullen en delen.
  async function maakGedeeld(soort, naam, wie, aantal) {
    const eigenaar = wie[0]
    const bord = nieuwBord({ id: `${soort}bord1`, naam, emoji: '📌', now: tijd })
    for (const tel of wie) tel.ik[bord.id] = voegLidToe(bord, { naam: tel.naam, now: tijd })
    for (let i = 0; i < aantal; i++) nieuwBriefje(bord, { id: `${soort}-b${i}`, door: kies(wie).ik[bord.id], tekst: 'Iets leuks om te doen, met een paar woorden uitleg erbij', cat: 'todo', now: tijd - i * 1000 })
    eigenaar.borden[bord.id] = bord
    for (const tel of wie) tel.adres[bord.id] = { u: 'https://prikbord.test', r: CODES[soort] }
    await eigenaar.sync.ronde(bord.id)
    for (const tel of wie.slice(1)) {
      tel.borden[bord.id] = structuredClone(eigenaar.borden[bord.id])
      await tel.sync.ronde(bord.id)
    }
    return bord.id
  }
  const thuis = await maakGedeeld('thuis', 'Thuis', [oscar, tara], 120)
  const reis = await maakGedeeld('reis', 'Groepsreis', telefoons, 40)
  const voor = { ...kv.tel }

  // Eén bewerking op het actieve bord, dan bundelen (zoals de app).
  function bewerk(tl, id, soort) {
    const bord = tl.borden[id]
    const levend = Object.values(bord.briefjes).filter((b) => !b.weg && !waarde(b.v, 'gedaan'))
    const b = kies(levend)
    bewerkingen++
    const x = r()
    if (soort === 'hartjes') zetHart(b, tl.ik[id], !hartjesVan(b).includes(tl.ik[id]), tijd)
    else if (x < 0.3) nieuwBriefje(bord, { id: `${tl.naam}-${Math.floor(tijd)}-${Math.floor(r() * 1e6)}`, door: tl.ik[id], tekst: 'Nieuw idee', cat: 'todo', now: tijd })
    else if (x < 0.6) zetHart(b, tl.ik[id], !hartjesVan(b).includes(tl.ik[id]), tijd)
    else if (x < 0.8) zetVeld(b, 'tekst', `Aangepast ${Math.floor(r() * 100)}`, tijd)
    else {
      zetVeld(b, 'vrij', { x: Math.floor(r() * 770), y: Math.floor(r() * 2000) }, tijd)
      zetVeld(b, 'stapel', Math.floor(tijd / 1000), tijd)
    }
    tl.laatste[id] = tijd
    const bun = tl.bundel[id] || (tl.bundel[id] = { sinds: tijd, token: 0 })
    if (!bun.actief) Object.assign(bun, { actief: true, sinds: tijd })
    const token = ++bun.token
    plan(Math.min(bun.sinds + BUNDEL_MAX_MS, tijd + BUNDEL_MS), async () => {
      if (bun.token !== token) return
      bun.actief = false
      await tl.sync.ronde(id)
    })
  }

  // De eerste sleepbeweging op een bord zonder vrije plekken: alles vast.
  function eersteSleep(tl, id) {
    const bord = tl.borden[id]
    const lijst = Object.values(bord.briefjes).filter((b) => !b.weg)
    const plek = legVrij(lijst.map((b) => ({ id: b.id, gemaakt: b.gemaakt, vrij: waarde(b.v, 'vrij') })))
    for (const b of lijst) zetVeld(b, 'vrij', { x: Math.round(plek[b.id].x), y: Math.round(plek[b.id].y) }, tijd)
    bewerk(tl, id, 'slepen')
  }

  // De app open: één keer alle borden, dan het actieve bord peilen.
  function sessie(tl, start, duur, id, bewerkingen) {
    plan(start, async () => {
      tl.open = { tot: start + duur, id }
      for (const b of Object.keys(tl.borden)) await tl.sync.ronde(b)
      const peil = async () => {
        if (!tl.open || tijd >= tl.open.tot) return (tl.open = null)
        await tl.sync.ronde(id)
        plan(tijd + peilInterval(tijd, tl.laatste[id] || 0), peil)
      }
      plan(tijd + peilInterval(tijd, tl.laatste[id] || 0), peil)
    })
    for (const [op, soort] of bewerkingen) {
      plan(op, async () => {
        if (soort === 'eerste-sleep') return eersteSleep(tl, id)
        if (soort === 'hartjes') {
          // Drie hartjes binnen 2 seconden.
          for (const extra of [0, 700, 1400]) plan(tijd + extra, async () => bewerk(tl, id, 'hartjes'))
          return
        }
        bewerk(tl, id, soort)
      })
    }
  }

  // De dag inplannen.
  for (const tl of [oscar, tara]) {
    for (let s = 0; s < 8; s++) {
      const start = DAG + s * 1.8 * UUR + Math.floor(r() * 30 * 60e3)
      const lijst = []
      let op = start + 20e3
      for (let i = 0; i < 6; i++) lijst.push([(op += 5e3 + Math.floor(r() * 35e3)), 'gewoon'])
      if (tl === oscar && s === 3) lijst.push([op + 10e3, 'eerste-sleep'])
      sessie(tl, start, 4 * 60e3, thuis, lijst)
    }
  }
  const avond = DAG + 13 * UUR // 20:00
  for (const tl of telefoons) {
    const lijst = []
    for (let op = avond + Math.floor(r() * 60e3); op < avond + UUR - 30e3; op += 30e3 + Math.floor(r() * 120e3)) lijst.push([op, r() < 0.5 ? 'hartjes' : 'gewoon'])
    sessie(tl, avond, UUR, reis, lijst)
    for (let s = 0; s < 3; s++) {
      const start = DAG + (1 + s * 3.5) * UUR + Math.floor(r() * UUR)
      sessie(tl, start, 2 * 60e3, reis, [
        [start + 30e3, 'gewoon'],
        [start + 70e3, 'gewoon'],
      ])
    }
  }

  // Afspelen in de tijd.
  while (wachtrij.length) {
    wachtrij.sort((a, b) => a.op - b.op || a.n - b.n)
    const e = wachtrij.shift()
    tijd = Math.max(tijd, e.op)
    await e.doe()
  }

  const schrijf = kv.tel.schrijf - voor.schrijf
  const lees = kv.tel.lees - voor.lees
  t.diagnostic(`drukke dag: ${bewerkingen} bewerkingen op 2 borden door 5 mensen`)
  t.diagnostic(`drukke dag: ${schrijf} KV-schrijfacties (gratis plan: 1.000 per dag, samen met Parkenjacht)`)
  t.diagnostic(`drukke dag: ${lees} KV-leesacties (gratis plan: 100.000 per dag)`)
  // Iedereen eindigt met dezelfde stand.
  for (const id of [thuis, reis]) {
    const op = telefoons.filter((tl) => tl.borden[id])
    for (const tl of op) await tl.sync.ronde(id)
    const standen = op.map((tl) => JSON.stringify(tl.borden[id]))
    assert.ok(standen.every((s) => s === standen[0]), `${id}: iedereen gelijk`)
  }
  assert.ok(schrijf < 500, `ruim binnen de 1.000 schrijfacties: ${schrijf}`)
  assert.ok(lees < 20_000, `ruim binnen de 100.000 leesacties: ${lees}`)
})
