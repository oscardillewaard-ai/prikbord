// Prikbord: een prikbord vol afgescheurde briefjes. Gewone HTML/CSS/JS met
// ES-modules, zonder buildstap (zie docs/prikbord-spec.md).
// Dit bestand doet het scherm; het rekenwerk staat in de pure modules
// (model, merge, layout, filter, seed, validate, link, plek, fotomaat),
// die ook in Node getest worden. De vingers in de vrij-modus staan in
// vrij.js, de animaties in beweging.js, foto's in photos.js en de kaart in
// map.js.

import { waarde, zetVeld, zetHart, hartjesVan, nieuwBriefje, verwijder, categorieen, catVan, lidVan, opHetBord, maakId, zetCat, nieuweCat, verschuifCat, catGebruikt, nieuwBord, voegLidToe, zetLid, zetInfo, ledenVan, beginStaat, GEEN_NAAM } from './model.js'
import { schoonStaat, MAX_TEKST, MAX_NOTITIE, PAPIER, PUNAISE, CAT_SCHOON, LID_SCHOON, INFO_SCHOON, schoonAdres } from './validate.js'
import { importeer, mergeBord } from './merge.js'
import { maakSync, haalBord, maakKoppel, leesKoppel, nieuweCode, peilInterval, BUNDEL_MS, BUNDEL_MAX_MS } from './sync.js'
import { legNetjes, kolomBreedte, legVrij, VRIJ } from './layout.js'
import { ALLES, isAlles, wisselCat, past, sorteer, trek, inDeDoos, perMaand } from './filter.js'
import { uiterlijk } from './seed.js'
import { laad, bewaar, bewaarStraks, bewaarNu, laadSync, bewaarSync } from './store.js'
import { zetRanden } from './randen.js'
import { minderBeweging, scheurAf, vliegNaar, prikIn, wiebelBuren, vanBord, terugNaarBord, valWeg, vervaagLaag, hartPop, schudLos, valInDoos, confetti, stuiter, popIn } from './beweging.js'
import { maakVrij } from './vrij.js'
import { rrrits, tok, plop } from './geluid.js'
import { linkUitInvoer, domeinVan } from './link.js'
import { plekUitLink, schoonZoek, plekLabel, maakPlek } from './plek.js'
import { fotosVan, naarBase64, schoonFotos } from './fotomaat.js'
import * as fotos from './photos.js'
import { laadLeaflet, maakKaart, punaise, kiesPunaise, pasInBeeld, ruimOp, NL } from './map.js'

export const APP_VERSION = '4' // ophogen bij elke release, samen met CACHE in sw.js

// Adres van de sync-worker (proxy/prikbord-sync-worker.js). Leeg = je vult het
// zelf in bij "Bord delen". Ingevuld = alleen nog "Maak een koppel-link".
const DEFAULT_SYNC_URL = ''

// ---------- Wat is er nieuw ----------
// Nieuwste bovenaan. Bij een release: APP_VERSION ophogen, CACHE in sw.js
// ophogen en hier een regel toevoegen.
const CHANGELOG = [
  {
    v: 4,
    items: [
      '🔗 Links op je briefjes: een recept, een restaurant of die ene Airbnb. Op het briefje zie je het domein, en open je het briefje, dan tik je zo door',
      '📸 Foto’s! Plak een foto op een briefje, als polaroidje met plakband. En eentje bij Gedaan, om later terug te kijken',
      '🗺️ De kaart: alle briefjes met een plek als punaises in hun eigen kleur. Tik op een punaise en het briefje opent',
      '📍 Een plek kiezen: tik op de kaart, gebruik je locatie, plak een link van Google Maps of zoek op naam',
      '🤝 Op een gedeeld bord gaan foto’s vanzelf mee naar de anderen, ook als je ze zonder internet toevoegde',
      '💾 Een back-up maken kan nu met of zonder foto’s',
    ],
  },
  {
    v: 3,
    items: [
      '🤝 Samen prikken! Deel een bord met een koppel-link, dan zien jullie meteen elkaars briefjes, hartjes en verhuizingen',
      '📋 Meerdere borden: eentje voor thuis, eentje voor de groepsreis … Tik op de naam bovenin om te wisselen',
      '🙋 Wie ben jij? Kies je naam en de kleur van je punaises. Nieuwe telefoon? Kies "Dit ben ik al", dan tellen je hartjes niet dubbel',
      '📌 Prikt een ander iets, dan zie je het meteen, met een nieuw-stickertje op briefjes die je nog niet zag',
      '🟢 Het bolletje bovenin vertelt of alles bij de anderen is aangekomen. Even geen internet? Je wijzigingen gaan mee zodra het weer lukt',
    ],
  },
  {
    v: 2,
    items: [
      '🧲 Filters boven het bord: kies één of meer categorieën, of 💞 Iedereen zin. De briefjes schuiven vanzelf naar hun nieuwe plek',
      '💕 Dubbeltik op een briefje voor een hartje, en sorteer op meeste hartjes',
      '📦 De Gedaan-doos! Iets gedaan? De punaise springt eruit (plop!) en het briefje valt in de doos, met de datum en hoe het was',
      '🎲 Kun je niet kiezen? Trek een briefje!',
      '✋ Vrij-modus: houd een briefje even vast en sleep het waar je wilt. Knijp om te zoomen, net als op een echt prikbord',
      '🏷️ Je eigen categorieën: namen, emoji, kleuren en volgorde pas je aan onder Meer',
      '💾 Onder Meer zie je wanneer je de laatste back-up maakte',
    ],
  },
  {
    v: 1,
    items: [
      '📌 Het Prikbord is er! Scheur een briefje van het blokje (rrrits!), schrijf erop en prik het op het bord (tok!)',
      '📝 Echte kladblokbriefjes met lijntjes, op warm kurk in een houten lijst',
      '🎨 Elke categorie heeft zijn eigen kleur papier: vakantie, uit eten, recepten, bucketlist en nog veel meer',
      '✍️ Half geschreven briefje? Dat bewaren we voor je, ook als je de app even wegklikt',
      '💾 Maak onder Meer een back-up, en zet hem terug zonder dat er iets verloren gaat',
      '🔇 Liever stil? Zet de geluidjes uit onder Meer',
    ],
  },
]

// ---------- Opslag ----------

const opgestart = laad()
let staat = opgestart.staat
const opslagFout = () => toast('⚠️ Opslaan lukt niet: de opslag is vol of geblokkeerd. Maak een back-up via Meer!', { ms: 6000 })
// Gedeelde borden: groepscode en adres per bord, onder prikbord.sync (buiten de back-up).
const koppelingen = laadSync()
const gedeeld = (id = staat.bord) => !!koppelingen.borden[id]
const laatsteActiviteit = {} // per bord: wanneer er iets gebeurde (voor het peilen)
// Opslaan na een handeling. Op een gedeeld bord vertrekt de wijziging na
// 1,5 s bundelen naar de anderen (§6.3).
const opslaan = () => {
  const gelukt = bewaar(staat, opslagFout)
  laatsteActiviteit[staat.bord] = Date.now()
  if (Object.keys(koppelingen.borden).length) syncStraks()
  return gelukt
}

const bord = () => staat.borden[staat.bord]
const ikId = () => staat.apparaat.ik[staat.bord]
// Per telefoon en per bord onthouden (§5.2, §5.6).
const isVrij = () => staat.apparaat.weergave[staat.bord] === 'vrij'
const sorteerWijze = () => staat.apparaat.sorteer[staat.bord] || 'nieuw'

// ---------- Hulpjes ----------

const $ = (sel, el = document) => el.querySelector(sel)
const view = $('#view')
const laag = $('#laag')
const blok = $('#blok')

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const klem = (x, min, max) => Math.min(max, Math.max(min, x))
const vandaagKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtMoment = (t) => {
  const d = new Date(t)
  const datum = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
  return `${datum} om ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
}
// Een datum als 'JJJJ-MM-DD' (de Gedaan-doos), in de eigen tijdzone.
const alsDatum = (k) => {
  const [j, m, d] = k.split('-').map(Number)
  return new Date(j, m - 1, d || 1)
}
const fmtDag = (k) => alsDatum(k).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtDagLang = (k) => alsDatum(k).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
const fmtMaand = (k) => alsDatum(k).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
const meervoud = (n, een, meer) => `${n} ${n === 1 ? een : meer}`

// Vrij: een briefje is 170 px breed bij zoom 1 (net als netjes op een
// telefoon), en VRIJ.briefje eenheden op het bord (layout.js).
const VRIJ_PX = 170
const K = VRIJ_PX / VRIJ.briefje
const DUBBELTIK = 250 // ms: zo lang wacht een enkele tik voordat het briefje opent

// UI-toestand (niet opgeslagen).
const ui = {
  tab: 'bord',
  persisted: null, // true, false of null (onbekend)
  vel: null, // { id, nieuw, tekst, cat } zolang het schrijfvel open is
  verborgen: new Set(), // briefjes die net weggehaald zijn (5 tellen ongedaan maken)
  bezig: 0, // lopende handelingen (animaties, deelmenu, slepen): niet herladen en geen nieuwe tikken
  open: null, // id van het briefje dat groot open ligt (op het bord verstopt)
  landt: null, // id van het briefje dat nog naar zijn plek moet vliegen
  filter: ALLES, // { cats, samen } (filter.js); niet bewaard, bij de start weer "Alles"
  getrokken: null, // het laatst getrokken briefje (🎲 "Nog eens" geeft een ander)
  tik: null, // { id, timer }: wachten of er een tweede tik komt (hartje)
  camera: {}, // vrij: per bord { s, tx, ty }
  wereldH: 0, // vrij: hoogte van het bord in px bij zoom 1
  getoond: new Set(), // briefjes die met een nieuw-stickertje in beeld waren (M3)
  koppel: null, // de koppel-link die je aan het toevoegen bent: { u, r, n, link, server }
  syncKlaar: false, // de eerste ronde na het openen is klaar (daarna live meldingen)
  naWelkom: null, // wat er na "Wie ben jij?" moet gebeuren ('delen')
  toastTot: 0, // tot wanneer een melding met "Ongedaan maken" staat
  grootVan: '', // het briefje dat groot open ligt, als JSON (de sync tekent het opnieuw als het verandert)
  uploads: 0, // foto's die nu naar de sync-worker gaan: dan niet herladen (§4.1, regel 5)
  fotoVoor: null, // waar de gekozen foto heen gaat: 'vel' of 'gedaan'
  kaartGedaan: false, // kaart: gedane briefjes (grijs) ook laten zien
  kaartCam: {}, // kaart: per bord { midden, zoom }
  plekKies: null, // de plek-kiezer: { kaart, marker, L, gekozen, uitkomsten }
  backup: null, // de back-up-keuze: { met, zonder } (bestanden, alvast ingepakt)
}
let vrijApi = null

let toastTimer = 0
function toast(tekst, { actie, opActie, ms = 2600 } = {}) {
  const el = $('#toast')
  el.innerHTML = `<span>${esc(tekst)}</span>${actie ? `<button type="button" class="toast-actie">${esc(actie)}</button>` : ''}`
  el.hidden = false
  // Als popover ligt de toast ook boven een open venster (top layer).
  try {
    el.hidePopover?.()
    el.showPopover?.()
  } catch {
    // Geen popover-API: dan gewoon als vast blokje onderin.
  }
  el.querySelector('.toast-actie')?.addEventListener('click', () => {
    opActie?.()
    verbergToast()
  })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(verbergToast, ms)
  // Een melding met "Ongedaan maken" niet wegdrukken met een melding van de sync.
  if (actie) ui.toastTot = Date.now() + ms
}
function verbergToast() {
  const el = $('#toast')
  try {
    el.hidePopover?.()
  } catch {
    // Was al dicht.
  }
  el.hidden = true
}

const speel = (geluidje) => {
  if (staat.apparaat.geluid) geluidje()
}
// Voor schermlezers: korte meldingen zonder toast.
function meld(tekst) {
  const el = $('#sr')
  el.textContent = ''
  setTimeout(() => (el.textContent = tekst), 30)
}

// ---------- Hartjes (§5.4, §5.5) ----------

const hartSvg = (kleur, klasse = 'hart') => `<svg class="${klasse} pin-${kleur}" aria-hidden="true"><use href="#hart"/></svg>`

// Klein onderaan het briefje, in de kleuren van wie ze gaf.
function hartjesHtml(bd, b, max = 5) {
  const wie = hartjesVan(b)
  if (!wie.length) return ''
  const meer = wie.length > max ? `<span class="hart-meer">+${wie.length - max}</span>` : ''
  return `<span class="hartjes">${wie
    .slice(0, max)
    .map((id) => hartSvg(lidVan(bd, id).kleur))
    .join('')}${meer}<span class="vh">, ${meervoud(wie.length, 'hartje', 'hartjes')}</span></span>`
}

function zetMijnHart(id, aan) {
  const b = bord().briefjes[id]
  if (!b || b.weg) return false
  const veranderd = zetHart(b, ikId(), aan, Date.now())
  if (veranderd) opslaan()
  return veranderd
}

// Dubbeltik = hartje, net als op Instagram: alleen aanzetten, nooit uit.
function dubbeltik(id) {
  const nieuw = zetMijnHart(id, true)
  if (nieuw) {
    render()
    meld('Hartje gegeven')
  }
  const plek = view.querySelector(`.briefje-plek[data-id="${id}"]`)
  if (plek && !minderBeweging()) hartPop(plek)
  navigator.vibrate?.(8)
}

// Een enkele tik opent het briefje, maar pas als er geen tweede tik komt.
// Met het toetsenbord (detail 0) opent hij meteen.
function tikOpBriefje(id, e) {
  if (e.detail === 0) return openBriefje(id)
  if (ui.tik?.id === id) {
    clearTimeout(ui.tik.timer)
    ui.tik = null
    return dubbeltik(id)
  }
  clearTimeout(ui.tik?.timer)
  ui.tik = {
    id,
    timer: setTimeout(() => {
      ui.tik = null
      openBriefje(id)
    }, DUBBELTIK),
  }
}

// ---------- Foto's, links en plekken op een briefje (§5.4, §5.5, §6.4) ----------
// Een foto staat als Blob in IndexedDB (photos.js). Op het scherm krijgt hij
// een object-URL. Staat hij nog niet op deze telefoon, dan halen we hem bij
// de sync-worker en bewaren hem (de service worker cachet geen andere sites).
// Lukt dat niet (nog niet geüpload, of offline), dan een leeg polaroidje en
// later opnieuw.

const fotoUrls = new Map() // foto-id → object-URL
const fotoMis = new Map() // foto-id → wanneer hij er laatst niet was
const fotoLaadt = new Set()
const FOTO_OPNIEUW_MS = 20_000

// Een polaroidje met een stukje plakband (§5.4).
function polaroidHtml(id, klasse = '') {
  const url = fotoUrls.get(id)
  if (!url) setTimeout(() => laadFoto(id), 0)
  return `<span class="polaroid ${klasse}${url ? '' : ' leeg'}" data-foto="${esc(id)}"><img alt="" ${url ? `src="${url}"` : ''} draggable="false" /><span class="polaroid-band" aria-hidden="true"></span></span>`
}

function toonFoto(id) {
  const url = fotoUrls.get(id)
  for (const el of document.querySelectorAll(`.polaroid[data-foto="${CSS.escape(id)}"]`)) {
    el.classList.remove('leeg')
    const img = el.querySelector('img')
    if (img && img.getAttribute('src') !== url) img.src = url
  }
}

// Uit IndexedDB, of anders van de sync-worker (dan meteen bewaren).
async function laadFoto(id) {
  if (fotoUrls.has(id) || fotoLaadt.has(id) || Date.now() - (fotoMis.get(id) || 0) < FOTO_OPNIEUW_MS) return
  fotoLaadt.add(id)
  try {
    let blob = await fotos.leesFoto(id).catch(() => null)
    const adres = koppelingen.borden[staat.bord]
    if (!blob && adres) {
      const uit = await fotos.haalFoto(fetch, adres, id)
      if (uit.status === 'ok') {
        blob = uit.blob
        await fotos.bewaarFoto(id, blob).catch(() => {})
      }
    }
    if (!blob) return fotoMis.set(id, Date.now())
    fotoMis.delete(id)
    fotoUrls.set(id, URL.createObjectURL(blob))
    toonFoto(id)
  } finally {
    fotoLaadt.delete(id)
  }
}

// Lege polaroidjes in beeld nog eens proberen (na een peiling of bij online).
function probeerMisteFotos() {
  for (const el of document.querySelectorAll('.polaroid.leeg[data-foto]')) laadFoto(el.dataset.foto)
}

// ----- De uploadwachtrij (in IndexedDB, dus ook na een herstart) -----

let wachtrijBezig = false
let wachtrijLater = 0
async function verstuurFotos() {
  if (wachtrijBezig) return
  wachtrijBezig = true
  clearTimeout(wachtrijLater)
  try {
    for (const item of await fotos.wachtrij().catch(() => [])) {
      const adres = koppelingen.borden[item.bord]
      const blob = adres && staat.borden[item.bord] ? await fotos.leesFoto(item.id).catch(() => null) : null
      // Bord niet (meer) gedeeld of foto weg: niets te versturen.
      if (!blob) {
        await fotos.uitWachtrij(item.id).catch(() => {})
        continue
      }
      ui.uploads++
      let uit
      try {
        uit = await fotos.stuurFoto(fetch, adres, item.id, blob)
      } finally {
        ui.uploads--
      }
      if (uit === 'ok' || uit === 'mislukt') await fotos.uitWachtrij(item.id).catch(() => {})
      if (uit === 'mislukt') toast('⚠️ Een foto kon niet naar de anderen. Probeer een andere foto.', { ms: 5000 })
      // Server even druk: zo meteen opnieuw. Offline: bij online of de volgende peiling.
      if (uit === 'opnieuw') wachtrijLater = setTimeout(verstuurFotos, 3000 + Math.random() * 3000)
      if (uit === 'opnieuw' || uit === 'offline') break
    }
  } finally {
    wachtrijBezig = false
  }
}

// Foto's van een bord in de wachtrij zetten (een nieuwe foto, of alle foto's
// als het bord net gedeeld wordt). Alleen wat op deze telefoon staat.
async function zetFotosKlaar(bordId, ids) {
  if (!koppelingen.borden[bordId]) return
  for (const id of ids) if (await fotos.heeftFoto(id).catch(() => false)) await fotos.zetInWachtrij(id, bordId).catch(() => {})
  verstuurFotos()
}
const deelFotos = (bordId) => zetFotosKlaar(bordId, fotosVan({ [bordId]: staat.borden[bordId] }))

// Foto's die bij geen enkel briefje (of concept) meer horen, na twee dagen
// van deze telefoon halen. Bijvoorbeeld van een weggehaald briefje.
async function ruimFotosOp() {
  try {
    const nodig = fotosVan(staat.borden)
    for (const f of [staat.apparaat.concept?.foto, ui.vel?.foto]) if (f) nodig.add(f)
    for (const f of await fotos.alleFotos()) if (!nodig.has(f.id) && Date.now() - (f.t || 0) > 2 * 24 * 3600e3) await fotos.wisFoto(f.id)
  } catch {
    // Geen IndexedDB: niets op te ruimen.
  }
}

// Een foto kiezen (schrijfvel of "Gedaan!"): verkleinen en meteen bewaren.
async function kiesFoto(bestand) {
  const id = maakId()
  const { blob } = await fotos.verklein(bestand)
  try {
    await fotos.bewaarFoto(id, blob)
  } catch {
    throw new fotos.FotoFout('Bewaren lukt niet: is de opslag van je telefoon vol?')
  }
  fotoUrls.set(id, URL.createObjectURL(blob))
  return id
}

// Een link kort voor op het geopende briefje: domein plus een stukje pad.
function kortLink(link) {
  try {
    const u = new URL(link)
    const rest = (u.pathname + u.search).replace(/\/$/, '')
    const kort = domeinVan(link) + (rest.length > 28 ? `${rest.slice(0, 26)}…` : rest)
    return kort
  } catch {
    return link
  }
}

// Link en plek klein onderaan het briefje (§5.5: "🔗 ah.nl").
function bijlagenHtml(b) {
  const link = waarde(b.v, 'link')
  const plek = waarde(b.v, 'plek')
  if (!link && !plek) return ''
  return `<span class="bijlagen">${link ? `<span class="bijlage"><span aria-hidden="true">🔗</span><span class="vh">Link naar</span> ${esc(domeinVan(link))}</span>` : ''}${
    plek ? `<span class="bijlage"><span aria-hidden="true">📍</span><span class="vh">Plek:</span> ${esc(plekLabel(plek))}</span>` : ''
  }</span>`
}

// ---------- De filterbalk (§5.6) ----------

function filterChips() {
  const bd = bord()
  const hier = ui.tab === 'gedaan' ? inDeDoos(bd) : ui.tab === 'kaart' ? kaartBriefjes() : opHetBord(bd)
  const gebruikt = new Set(hier.map((b) => waarde(b.v, 'cat')))
  // Verborgen categorieën alleen als er hier nog briefjes van zijn.
  const cats = categorieen(bd, { metVerborgen: true }).filter((c) => !c.verborgen || gebruikt.has(c.id))
  const f = ui.filter
  const sorteren =
    ui.tab === 'bord' && !isVrij()
      ? `<button type="button" class="chip chip-sorteer" data-action="sorteer" aria-label="Sorteren: ${sorteerWijze() === 'hartjes' ? 'meeste hartjes eerst' : 'nieuwste eerst'}. Tik om te wisselen.">
           <span aria-hidden="true">⇅</span> ${sorteerWijze() === 'hartjes' ? 'Meeste hartjes' : 'Nieuwste eerst'}</button>`
      : ''
  // Op de kaart: gedane briefjes (grijs) erbij of niet.
  const gedaanOok =
    ui.tab === 'kaart'
      ? `<button type="button" class="chip chip-gedaan" data-action="kaart-gedaan" aria-pressed="${ui.kaartGedaan}"><span aria-hidden="true">✅</span> Gedaan ook</button>`
      : ''
  return `${sorteren}
    <button type="button" class="chip chip-alles" data-filter="alles" aria-pressed="${isAlles(f)}">Alles</button>
    <button type="button" class="chip chip-samen" data-filter="samen" aria-pressed="${f.samen}"><span aria-hidden="true">💞</span> Iedereen zin</button>
    ${gedaanOok}
    ${cats
      .map(
        (c) =>
          `<button type="button" class="chip papier-${c.kleur}" data-filter="cat" data-cat="${c.id}" aria-pressed="${f.cats.includes(c.id)}"><span aria-hidden="true">${c.emoji}</span> ${esc(c.naam)}</button>`,
      )
      .join('')}`
}

function filterbalkHtml() {
  const trekKnop = ui.tab === 'bord' ? '<button type="button" class="trek-knop" data-action="trek" aria-label="Trek een briefje" title="Trek een briefje"><span aria-hidden="true">🎲</span></button>' : ''
  return `<div class="filterbalk" id="filterbalk"><div class="chips" id="chips" role="group" aria-label="Filteren">${filterChips()}</div>${trekKnop}</div>`
}

// Bijwerken zonder de balk opnieuw neer te zetten (dan blijft hij op zijn plek gescrold).
function tekenFilterbalk() {
  const chips = $('#chips')
  if (!chips) return
  const html = filterChips()
  if (chips.dataset.html !== html) {
    chips.innerHTML = html
    chips.dataset.html = html
  }
}

function zetFilter(f) {
  ui.filter = f
  tekenFilterbalk()
  if (ui.tab === 'bord') legBordNeer()
  if (ui.tab === 'kaart') zetKaartPunaises()
  if (ui.tab === 'gedaan') {
    const inhoud = $('#doos-inhoud')
    if (inhoud) inhoud.innerHTML = doosInhoud()
  }
}

// Een briefje dat net geprikt of teruggehangen is, moet je zien landen.
function zorgDatHetZichtbaarIs(b) {
  if (b && !past(bord(), b, ui.filter)) ui.filter = ALLES
}

// ---------- Het bord ----------
// Het bord wordt niet bij elke wijziging opnieuw opgebouwd: bestaande
// briefjes blijven staan en schuiven naar hun nieuwe plek (het bord "schudt",
// §5.2). Alleen nieuwe briefjes komen erbij, weggehaalde verdwijnen.

// Briefjes van anderen die deze telefoon nog niet zag (per bord, §5.1).
const nieuwHier = (id = staat.bord) => new Set(staat.apparaat.nieuw[id] || [])
function aantalNieuw(id) {
  const bd = staat.borden[id]
  return [...nieuwHier(id)].filter((b) => bd?.briefjes[b] && !bd.briefjes[b].weg && !waarde(bd.briefjes[b].v, 'gedaan')).length
}

function briefjeBinnen(b, nieuw = false) {
  const bd = bord()
  const cat = catVan(bd, waarde(b.v, 'cat'))
  const lid = lidVan(bd, b.door)
  const u = uiterlijk(b.id)
  // Het stickertje staat op de wrapper, niet op het papier: clip-path zou het afknippen.
  return `
      <button type="button" class="briefje papier-${cat.kleur} rand-${u.rand}" data-action="open" data-id="${b.id}">
        <span class="vh">${nieuw ? 'Nieuw, ' : ''}${esc(cat.naam)}: </span><span class="tekst">${esc(waarde(b.v, 'tekst', ''))}</span>
        ${waarde(b.v, 'foto') ? `<span class="vh">, met foto</span>${polaroidHtml(waarde(b.v, 'foto'), u.dx < 0 ? 'scheef-l' : 'scheef-r')}` : ''}
        ${bijlagenHtml(b)}
        ${hartjesHtml(bd, b)}
        <span class="briefje-voet" aria-hidden="true">${cat.emoji}</span>
      </button>
      <span class="punaise pin-${lid.kleur}" style="--pd:${u.punaiseDraai}deg" aria-hidden="true"></span>
      ${nieuw ? '<span class="nieuw-sticker" aria-hidden="true">nieuw</span>' : ''}`
}

function bordSkelet(scherm) {
  if (scherm === 'leeg') {
    const gedaan = inDeDoos(bord()).length
    return `
      <section class="bord bord-leeg">
        <div class="leeg-briefje papier-zon rand-5">
          ${
            gedaan
              ? `<p class="hand">Alles gedaan! 🎉</p><p>Het bord is leeg en de Gedaan-doos zit vol (${meervoud(gedaan, 'ding', 'dingen')}). Tijd voor nieuwe plannen: scheur rechtsonder een briefje van het blokje.</p>`
              : '<p class="hand">Nog helemaal leeg hier! ✨</p><p>Scheur rechtsonder een briefje van het blokje, schrijf er iets op en prik het op het bord.</p>'
          }
        </div>
        <span class="leeg-pijl" aria-hidden="true">↘</span>
      </section>`
  }
  const filterLeeg = `
    <div class="filter-leeg" id="filter-leeg" hidden>
      <div class="leeg-briefje papier-wit rand-7">
        <p class="hand">Niks gevonden 🔍</p>
        <p>Met dit filter hangt er niets op het bord.</p>
        <button type="button" class="knop primair" data-filter="alles">Alles laten zien</button>
      </div>
    </div>`
  if (scherm === 'vrij') {
    return `
      <section class="bord bord-vrij" aria-label="Briefjes op het bord (vrij)">
        <div class="vrij" id="vrij">
          <div class="vrij-wereld" id="vrij-wereld"></div>
          <div class="zoomknoppen" role="group" aria-label="Zoomen">
            <button type="button" data-zoom="in" aria-label="Inzoomen">+</button>
            <button type="button" data-zoom="uit" aria-label="Uitzoomen">−</button>
            <button type="button" data-zoom="passend" aria-label="Het hele bord laten zien"><span aria-hidden="true">⤢</span></button>
          </div>
        </div>
      </section>`
  }
  return `<section class="bord" aria-label="Briefjes op het bord"><div class="bord-binnen" id="bord-binnen"></div>${filterLeeg}</section>`
}

function tekenBord(vol = false) {
  const bd = bord()
  const alle = opHetBord(bd).filter((b) => !ui.verborgen.has(b.id))
  const scherm = !alle.length ? 'leeg' : isVrij() ? 'vrij' : 'netjes'
  const bakVan = () => (scherm === 'vrij' ? $('#vrij-wereld') : $('#bord-binnen'))
  if (vol || view.dataset.scherm !== scherm || (scherm !== 'leeg' && !bakVan())) {
    view.dataset.scherm = scherm
    vrijApi = null
    view.innerHTML = (alle.length ? filterbalkHtml() : '') + bordSkelet(scherm)
    if (scherm === 'vrij') startVrij()
  } else tekenFilterbalk()
  document.documentElement.classList.toggle('vrij-modus', scherm === 'vrij')
  const bak = bakVan()
  if (!bak || scherm === 'leeg') return
  vulBak(bak, sorteer(alle, sorteerWijze()))
  legBordNeer()
}

// Briefjes toevoegen, bijwerken en weghalen op basis van hun id.
function vulBak(bak, lijst) {
  const bestaand = new Map([...bak.children].map((el) => [el.dataset.id, el]))
  const nieuw = nieuwHier()
  let vorige = null
  for (const b of lijst) {
    let el = bestaand.get(b.id)
    if (el) bestaand.delete(b.id)
    else {
      el = document.createElement('div')
      el.className = 'briefje-plek'
      el.dataset.id = b.id
      el.style.setProperty('--px', `${uiterlijk(b.id).punaiseX}%`)
      // Meteen op zijn plek in de volgorde (tabvolgorde, schermlezers).
      bak.insertBefore(el, vorige ? vorige.nextSibling : bak.firstChild)
    }
    const isNieuw = nieuw.has(b.id)
    if (isNieuw) ui.getoond.add(b.id)
    const binnen = briefjeBinnen(b, isNieuw)
    if (el.binnen !== binnen) {
      el.innerHTML = binnen
      el.binnen = binnen
    }
    el.classList.toggle('verstopt', ui.landt === b.id || ui.open === b.id)
    vorige = el
  }
  for (const el of bestaand.values()) el.remove()
}

function legBordNeer() {
  if ($('#vrij-wereld')) legVrijNeer()
  else legNetjesNeer()
}

// Een briefje dat nog nooit een plek had, springt er meteen naartoe (geen
// glijden vanuit de hoek linksboven).
function zonderOvergang(elementen, bak) {
  if (!elementen.length) return
  void bak.offsetWidth
  for (const el of elementen) el.style.transition = ''
}

// Netjes rommelig (§5.2): alleen de zichtbare briefjes krijgen een plek;
// wat niet door het filter komt, vervaagt waar het hangt.
function legNetjesNeer() {
  const binnen = $('#bord-binnen')
  if (!binnen) return
  const bd = bord()
  const plekken = [...binnen.children]
  const perId = new Map(plekken.map((el) => [el.dataset.id, el]))
  const lijst = sorteer(
    plekken.map((el) => bd.briefjes[el.dataset.id]).filter((b) => b && !b.weg),
    sorteerWijze(),
  )
  const zicht = lijst.filter((b) => past(bd, b, ui.filter)).map((b) => b.id)
  const zichtbaar = new Set(zicht)
  // Eerst de breedte zetten, dan alle hoogtes in één keer meten (één reflow).
  const breedte = binnen.clientWidth
  const w = kolomBreedte(breedte)
  for (const el of plekken) el.style.width = `${w}px`
  const hoogtes = {}
  for (const id of zicht) hoogtes[id] = perId.get(id).offsetHeight
  const { plek, hoogte } = legNetjes(zicht, hoogtes, breedte)
  binnen.style.height = `${zicht.length ? hoogte : 0}px`
  const nieuw = []
  for (const el of plekken) {
    const id = el.dataset.id
    el.classList.toggle('uit', !zichtbaar.has(id))
    const p = plek[id]
    if (!p) continue
    if (!('x' in el.dataset)) {
      el.style.transition = 'none'
      nieuw.push(el)
    }
    el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.draai}deg)`
    el.style.zIndex = p.z
    // Voor de animaties (beweging.js): waar hij hangt.
    Object.assign(el.dataset, { x: p.x, y: p.y, draai: p.draai })
  }
  zonderOvergang(nieuw, binnen)
  const leeg = $('#filter-leeg')
  if (leeg) leeg.hidden = zicht.length > 0
  // Pas na de eerste keer neerleggen geanimeerd verschuiven.
  requestAnimationFrame(() => binnen.classList.add('klaar'))
  ordenStraks(
    binnen,
    lijst.map((b) => b.id),
  )
}

// Na het schuiven ook de volgorde in de pagina gelijktrekken (tabvolgorde en
// schermlezers). Pas als het schuiven klaar is: verplaatsen breekt een
// lopende overgang af.
let ordenTimer = 0
function ordenStraks(bak, ids) {
  clearTimeout(ordenTimer)
  ordenTimer = setTimeout(() => {
    if (!bak.isConnected || ui.bezig) return
    const kinderen = [...bak.children]
    if (ids.every((id, i) => kinderen[i]?.dataset.id === id)) return
    const perId = new Map(kinderen.map((el) => [el.dataset.id, el]))
    for (const id of ids) if (perId.has(id)) bak.append(perId.get(id))
  }, 700)
}

// ---------- Vrij (§5.2) ----------

function vrijMaten() {
  const vp = $('#vrij')
  const vw = vp?.clientWidth || innerWidth
  const vh = vp?.clientHeight || innerHeight
  const ww = VRIJ.breedte * K
  // Minstens zo hoog dat het kurk het scherm vult als het hele bord in beeld is.
  return { vw, vh, ww, wh: Math.max(ui.wereldH, (vh * ww) / vw) }
}

// Het venster begint onder de filterbalk en loopt door tot de tabbalk.
function plaatsVrij() {
  const vp = $('#vrij')
  const boven = $('#filterbalk') || $('.kop')
  if (vp && boven) vp.style.top = `${boven.getBoundingClientRect().bottom}px`
}

function startVrij() {
  const vp = $('#vrij')
  const wereld = $('#vrij-wereld')
  plaatsVrij()
  wereld.style.width = `${VRIJ.breedte * K}px`
  vrijApi = maakVrij({
    viewport: vp,
    wereld,
    K,
    maten: vrijMaten,
    cam: ui.camera[staat.bord],
    kanOptillen,
    opSlepen,
    opNeerzetten,
    opAnnuleren,
    opCamera: (c) => (ui.camera[staat.bord] = c),
  })
}

// De plekken in vrij: een eigen vrije plek, of de eerste lege plek bovenaan.
function vrijPlekken(lijst) {
  return legVrij(lijst.map((b) => ({ id: b.id, gemaakt: b.gemaakt, vrij: waarde(b.v, 'vrij') })))
}

function legVrijNeer() {
  const wereld = $('#vrij-wereld')
  if (!wereld) return
  const bd = bord()
  const plekken = [...wereld.children]
  const lijst = plekken.map((el) => bd.briefjes[el.dataset.id]).filter((b) => b && !b.weg)
  const plek = vrijPlekken(lijst)
  // Stapelvolgorde: wat het laatst is neergezet, ligt bovenop.
  const stapel = [...lijst].sort((a, b) => waarde(a.v, 'stapel', 0) - waarde(b.v, 'stapel', 0) || a.gemaakt - b.gemaakt || (a.id < b.id ? -1 : 1))
  const z = new Map(stapel.map((b, i) => [b.id, i + 1]))
  const nieuw = []
  for (const el of plekken) {
    const id = el.dataset.id
    const p = plek[id]
    if (!p) continue
    el.style.width = `${VRIJ_PX}px`
    // Filters dimmen in vrij in plaats van te verschuiven.
    el.classList.toggle('gedimd', !past(bd, bd.briefjes[id], ui.filter))
    if (el.classList.contains('sleept')) continue
    if (!('x' in el.dataset)) {
      el.style.transition = 'none'
      nieuw.push(el)
    }
    const x = p.x * K
    const y = p.y * K
    el.style.transform = `translate(${x}px, ${y}px) rotate(${p.draai}deg)`
    el.style.zIndex = z.get(id)
    Object.assign(el.dataset, { x, y, draai: p.draai, ux: p.x, uy: p.y })
  }
  zonderOvergang(nieuw, wereld)
  let onder = 0
  for (const el of plekken) onder = Math.max(onder, Number(el.dataset.y || 0) + el.offsetHeight)
  // Wat ruimte eronder, zodat je een briefje ook naar beneden kunt slepen.
  ui.wereldH = onder + 320 * K
  wereld.style.height = `${vrijMaten().wh}px`
  vrijApi?.pas()
  requestAnimationFrame(() => wereld.classList.add('klaar'))
}

function kanOptillen(plek) {
  if (laag.open || ui.bezig) return null
  const b = bord().briefjes[plek.dataset.id]
  if (!b || b.weg) return null
  ui.bezig++
  clearTimeout(ui.tik?.timer)
  ui.tik = null
  plek.classList.add('opgetild', 'sleept')
  // Kort trillen waar de browser dat kan (niet op de iPhone).
  navigator.vibrate?.(10)
  return { x: Number(plek.dataset.ux), y: Number(plek.dataset.uy) }
}

function opSlepen(plek, x, y) {
  plek.style.transform = `translate(${x * K}px, ${y * K}px) rotate(${plek.dataset.draai}deg)`
}

// Briefjes zonder eigen vrije plek krijgen bij de eerste sleepbeweging hun
// huidige plek vast, zodat er niets verspringt als het gesleepte briefje op
// hun vakje terechtkomt.
function zetVastInVrij(bd, now) {
  const lijst = opHetBord(bd).filter((b) => !ui.verborgen.has(b.id))
  const plek = vrijPlekken(lijst)
  for (const b of lijst) if (!waarde(b.v, 'vrij')) zetVeld(b, 'vrij', { x: Math.round(plek[b.id].x), y: Math.round(plek[b.id].y) }, now)
}

function opNeerzetten(plek, x, y) {
  const id = plek.dataset.id
  const bd = bord()
  const b = bd.briefjes[id]
  ui.bezig--
  if (b && !b.weg) {
    const now = Date.now()
    zetVastInVrij(bd, now)
    zetVeld(b, 'vrij', { x: Math.round(klem(x, 0, VRIJ.breedte - VRIJ.briefje)), y: Math.round(klem(y, 0, 99_000)) }, now)
    // Bovenop de stapel.
    const hoogste = Math.max(0, ...opHetBord(bd).filter((a) => a.id !== id).map((a) => waarde(a.v, 'stapel', 0)))
    if (waarde(b.v, 'stapel', 0) <= hoogste) zetVeld(b, 'stapel', hoogste + 1, now)
    opslaan()
  }
  // Zonder glijden op de nieuwe plek zetten, en dan opnieuw prikken.
  plek.style.transition = 'none'
  plek.classList.remove('opgetild', 'sleept')
  legVrijNeer()
  zonderOvergang([plek], plek.parentElement)
  meld('Briefje verplaatst')
  if (minderBeweging()) return speel(tok)
  prikIn(plek, () => {
    speel(tok)
    navigator.vibrate?.(8)
    wiebelBuren(plek)
  })
}

function opAnnuleren(plek) {
  ui.bezig--
  plek.classList.remove('opgetild', 'sleept')
  legVrijNeer()
}

// Het briefje in beeld brengen als het buiten beeld valt (zonder animatie,
// want het gebeurt onder het schrijfvel).
function zichtbaarMaken(plek) {
  if (vrijApi && plek.closest('#vrij')) return vrijApi.toon(plek)
  const r = plek.getBoundingClientRect()
  const boven = ($('#filterbalk') || $('.kop')).getBoundingClientRect().bottom + 16
  const onder = innerHeight - $('.tabbar').offsetHeight - 16
  if (r.top >= boven && r.bottom <= onder) return
  scrollTo({ top: scrollY + r.top - (boven + onder) / 2 + r.height / 2, behavior: 'instant' })
}

// Welke categorie een nieuw briefje krijgt: de laatst gebruikte op dit bord,
// of anders de eerste. Het blokje heeft die kleur al.
function standaardCat() {
  const cats = categorieen(bord())
  return cats.find((c) => c.id === staat.apparaat.laatsteCat[staat.bord]) || cats[0]
}
function blokCat() {
  const c = staat.apparaat.concept
  if (c?.nieuw && c.bord === staat.bord && bord().cats[c.cat]) return catVan(bord(), c.cat)
  return standaardCat()
}

let laatsteBreedte = innerWidth
addEventListener('resize', () => {
  if (kaartTab) {
    plaatsKaart()
    kaartTab.kaart.invalidateSize()
  }
  if (vrijApi) {
    plaatsVrij()
    legVrijNeer()
    return
  }
  if (innerWidth === laatsteBreedte) return
  laatsteBreedte = innerWidth
  legBordNeer()
})

// ---------- Kaart (§5.9) ----------
// Alle briefjes met een plek, als punaises in de kleur van hun categorie.
// Tik op een punaise en het briefje opent. De filters werken hier ook, en
// gedane briefjes kun je grijs laten zien. Leaflet komt uit vendor/ (map.js).

let kaartTab = null // { L, kaart, groep, bord, eerste }

const kaartBriefjes = () =>
  Object.values(bord().briefjes).filter((b) => !b.weg && !ui.verborgen.has(b.id) && waarde(b.v, 'plek') && (ui.kaartGedaan || !waarde(b.v, 'gedaan')))

function kaartSkelet() {
  return `${filterbalkHtml()}
    <section class="kaart-tab" id="kaart-tab" aria-label="Kaart met de briefjes die een plek hebben">
      <div id="kaart" class="kaart"></div>
      <p class="kaart-laden" id="kaart-laden">🗺️ Kaart laden…</p>
      <div class="kaart-leeg" id="kaart-leeg" hidden></div>
    </section>`
}

// Het venster begint onder de filterbalk en loopt door tot de tabbalk.
function plaatsKaart() {
  const tab = $('#kaart-tab')
  const boven = $('#filterbalk') || $('.kop')
  if (tab && boven) tab.style.top = `${boven.getBoundingClientRect().bottom}px`
}

function tekenKaartTab(vol = false) {
  document.documentElement.classList.add('kaart-modus')
  if (!vol && view.dataset.scherm === 'kaart' && $('#kaart') && kaartTab?.bord === staat.bord) {
    tekenFilterbalk()
    return zetKaartPunaises()
  }
  ruimKaartTabOp()
  view.dataset.scherm = 'kaart'
  view.innerHTML = kaartSkelet()
  plaatsKaart()
  const el = $('#kaart')
  const bordId = staat.bord
  laadLeaflet()
    .then((L) => {
      if (!el.isConnected) return
      const cam = ui.kaartCam[bordId]
      const kaart = maakKaart(L, el, cam || {})
      kaartTab = { L, kaart, groep: L.layerGroup().addTo(kaart), bord: bordId, eerste: !cam }
      kaart.on('moveend', () => (ui.kaartCam[bordId] = { midden: kaart.getCenter(), zoom: kaart.getZoom() }))
      $('#kaart-laden')?.remove()
      zetKaartPunaises()
    })
    .catch((err) => {
      const m = $('#kaart-laden')
      if (m) m.textContent = `⚠️ ${err.message}`
    })
}

function ruimKaartTabOp() {
  ruimOp(kaartTab?.kaart)
  kaartTab = null
}

function zetKaartPunaises() {
  const bd = bord()
  const met = kaartBriefjes()
  const lijst = met.filter((b) => past(bd, b, ui.filter))
  const leeg = $('#kaart-leeg')
  if (leeg) {
    leeg.hidden = lijst.length > 0
    leeg.innerHTML = met.length
      ? `<div class="leeg-briefje papier-wit rand-7"><p class="hand">Niks gevonden 🔍</p><p>Met dit filter staat er niets op de kaart.</p>
         <button type="button" class="knop primair" data-filter="alles">Alles laten zien</button></div>`
      : `<div class="leeg-briefje papier-lucht rand-3"><p class="hand">🗺️ Nog geen plekken</p>
         <p>Geef een briefje een plek met het kaartje <strong>🗺️ Plek</strong> op het schrijfvel. Handig voor restaurants, dagjes uit en die ene vakantie.</p></div>`
  }
  if (!kaartTab) return
  const { L, kaart, groep } = kaartTab
  groep.clearLayers()
  const nieuw = nieuwHier()
  for (const b of lijst) {
    const p = waarde(b.v, 'plek')
    const cat = catVan(bd, waarde(b.v, 'cat'))
    const gedaan = !!waarde(b.v, 'gedaan')
    const tekst = waarde(b.v, 'tekst', '')
    const kort = tekst.length > 60 ? `${tekst.slice(0, 58)}…` : tekst
    L.marker([p.lat, p.lng], {
      icon: punaise(L, { kleur: cat.kleur, emoji: cat.emoji, grijs: gedaan, nieuw: nieuw.has(b.id) }),
      title: `${gedaan ? 'Gedaan: ' : ''}${kort}`,
      keyboard: true,
      riseOnHover: true,
      zIndexOffset: gedaan ? -1000 : 0,
    })
      .on('click', () => (gedaan ? openUitDoos(b.id) : openBriefje(b.id)))
      // Leaflet opent met Enter alleen een popup; wij openen het briefje (Enter of spatie).
      .on('keypress', (e) => {
        if (e.originalEvent.key !== 'Enter' && e.originalEvent.key !== ' ') return
        e.originalEvent.preventDefault()
        if (gedaan) openUitDoos(b.id)
        else openBriefje(b.id)
      })
      .addTo(groep)
  }
  if (kaartTab.eerste) {
    kaartTab.eerste = false
    pasInBeeld(L, kaart, lijst.map((b) => waarde(b.v, 'plek')))
  }
}

// "Op de kaart" op een geopend briefje: naar de kaart-tab, ingezoomd op de plek.
async function toonOpKaart(id) {
  const b = bord().briefjes[id]
  const p = b && waarde(b.v, 'plek')
  if (!p) return
  if (waarde(b.v, 'gedaan')) ui.kaartGedaan = true
  if (!past(bord(), b, ui.filter)) ui.filter = ALLES
  ui.kaartCam[staat.bord] = { midden: [p.lat, p.lng], zoom: 16 }
  await metRust(async () => {
    await vervaagLaag(laag)
    sluitDirect()
  })
  ui.tab = 'kaart'
  scrollTo(0, 0)
  render(true)
}

// ----- Een plek kiezen (op het schrijfvel) -----
// Vier manieren (§5.9): tikken op de kaart en de punaise verslepen, "Mijn
// locatie", een link van Google Maps of OpenStreetMap plakken, en zoeken op
// naam via de eigen worker (Nominatim, §6.5). Zoeken gebeurt alleen na een
// tik op de zoekknop, nooit terwijl je typt, en hooguit eens per seconde.

const ZOEK_PAUZE_MS = 1000
let laatsteZoek = 0

// Het adres van een sync-worker om mee te zoeken.
const zoekAdres = () => DEFAULT_SYNC_URL || koppelingen.borden[staat.bord]?.u || koppelingen.url || Object.values(koppelingen.borden)[0]?.u || ''

function openPlekKiezer() {
  if (!ui.vel) return
  if (ui.vel.fotoBezig) return toast('⏳ Even geduld, de foto wordt nog verkleind')
  const p = ui.vel.plek
  openLaag(
    `
    <div class="paneel plek-kiezer" id="plek-kiezer">
      <h2 id="laag-titel">📍 Waar is het?</h2>
      <div class="zoek-rij">
        <input id="plek-zoek" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Zoek een plek, of plak een link"
          aria-label="Zoek een plek op naam of adres, of plak een link van Google Maps of OpenStreetMap" />
        <button type="button" class="knop primair zoek-knop" data-plek="zoek"><span aria-hidden="true">🔎</span> Zoek</button>
      </div>
      <ul class="zoek-uitkomsten" id="zoek-uitkomsten" hidden></ul>
      <p class="fout" id="plek-fout" role="alert"></p>
      <div class="kies-kaart" id="kies-kaart"><p class="kaart-laden">🗺️ Kaart laden…</p></div>
      <p class="plek-status" id="plek-status" aria-live="polite"></p>
      <div class="plek-knoppen">
        <button type="button" class="knop" data-plek="locatie"><span aria-hidden="true">🎯</span> Mijn locatie</button>
        ${p ? '<button type="button" class="knop" data-plek="weg"><span aria-hidden="true">🗑️</span> Geen plek</button>' : ''}
      </div>
      <label class="veld"><span>Naam van de plek <span class="klein">(mag leeg blijven)</span></span>
        <input id="plek-naam" maxlength="120" autocomplete="off" value="${esc(p?.naam || '')}" placeholder="Bijv. Sushi in Den Haag" /></label>
      <p class="paneel-uitleg plek-uitleg">Tik op de kaart om de punaise neer te zetten en sleep hem precies goed. Zoeken: © OpenStreetMap-bijdragers, via Nominatim.</p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-plek="terug">Terug</button>
        <button type="button" class="knop primair" data-plek="klaar">Klaar <span aria-hidden="true">📍</span></button>
      </div>
    </div>`,
    'plek',
  )
  ui.plekKies = { gekozen: null, uitkomsten: [], kaart: null, marker: null, L: null }
  if (p) zetKiesPunaise(p.lat, p.lng)
  laadLeaflet()
    .then((L) => {
      const el = $('#kies-kaart')
      const k = ui.plekKies
      if (!el || !k || laag.dataset.soort !== 'plek') return
      el.innerHTML = ''
      const gekozen = k.gekozen
      const kaart = maakKaart(L, el, gekozen ? { midden: [gekozen.lat, gekozen.lng], zoom: 15 } : ui.kaartCam[staat.bord] || NL)
      Object.assign(k, { L, kaart })
      if (gekozen) zetKiesPunaise(gekozen.lat, gekozen.lng)
      else if (!ui.kaartCam[staat.bord]) {
        // Zonder eerdere kaart: waar de andere briefjes van dit bord liggen.
        const plekken = Object.values(bord().briefjes)
          .filter((b) => !b.weg)
          .map((b) => waarde(b.v, 'plek'))
          .filter(Boolean)
        if (plekken.length) pasInBeeld(L, kaart, plekken, { max: 13 })
      }
      kaart.on('click', (e) => zetKiesPunaise(e.latlng.lat, e.latlng.lng))
      setTimeout(() => kaart.invalidateSize(), 60)
    })
    .catch((err) => {
      const el = $('#kies-kaart')
      if (el) el.innerHTML = `<p class="kaart-laden">⚠️ ${esc(err.message)} Plak een link of gebruik je locatie.</p>`
    })
}

function zetKiesPunaise(lat, lng, { naam, zoom } = {}) {
  const k = ui.plekKies
  if (!k) return
  k.gekozen = { lat, lng }
  if (naam) $('#plek-naam').value = naam
  if (k.kaart) {
    if (!k.marker) {
      k.marker = k.L.marker([lat, lng], { icon: kiesPunaise(k.L), draggable: true, autoPan: true, keyboard: false, title: 'De gekozen plek (sleep om te verplaatsen)' }).addTo(k.kaart)
      k.marker.on('dragend', () => {
        const ll = k.marker.getLatLng()
        k.gekozen = { lat: ll.lat, lng: ll.lng }
        toonGekozen()
      })
    } else k.marker.setLatLng([lat, lng])
    if (zoom) k.kaart.setView([lat, lng], zoom)
  }
  toonGekozen()
}

function toonGekozen() {
  const k = ui.plekKies
  const el = $('#plek-status')
  if (el && k?.gekozen) el.textContent = `📍 ${plekLabel(maakPlek(k.gekozen.lat, k.gekozen.lng))}`
}

const plekFout = (tekst) => {
  const el = $('#plek-fout')
  if (el) el.textContent = tekst
}

// Een geplakte link (of twee getallen) meteen gebruiken: dat is geen zoekdienst.
function gebruikLink(tekst) {
  const uit = plekUitLink(tekst)
  if (!uit) return false
  if (uit.kort) {
    plekFout('Dit is een verkorte link. Open hem, kopieer de lange link uit de adresbalk en plak die hier. Of zoek de plek op naam.')
    return true
  }
  if (uit.zoek) {
    $('#plek-zoek').value = uit.zoek
    plekFout('In deze link staan geen coördinaten. Tik op Zoek om de plek op naam te zoeken.')
    return true
  }
  plekFout('')
  zetKiesPunaise(uit.lat, uit.lng, { naam: uit.naam, zoom: 16 })
  $('#plek-zoek').value = ''
  meld('Plek uit de link gehaald')
  return true
}

async function zoekPlek() {
  const veld = $('#plek-zoek')
  const knop = laag.querySelector('[data-plek="zoek"]')
  if (!veld || !ui.plekKies || knop?.disabled) return
  plekFout('')
  const q = veld.value.replace(/\s+/g, ' ').trim()
  // Een link of twee getallen: meteen gebruiken, zonder zoekdienst.
  const uitLink = plekUitLink(q)
  if (uitLink && !uitLink.zoek) return gebruikLink(q)
  const term = uitLink?.zoek || q
  if (uitLink?.zoek) veld.value = term
  if (term.length < 2) return plekFout('Typ eerst een naam of adres ✍️')
  const adres = zoekAdres()
  if (!adres) return plekFout('Zoeken op naam kan zodra er een sync-server is (Meer → Samen prikken). Tik intussen op de kaart, gebruik je locatie of plak een link.')
  knop.disabled = true
  knop.innerHTML = '⏳ <span class="vh">Bezig met zoeken</span>'
  // Nominatim: hooguit één zoekopdracht per seconde (§6.5), ook vanuit de app.
  const wacht = laatsteZoek + ZOEK_PAUZE_MS - Date.now()
  if (wacht > 0) await new Promise((ok) => setTimeout(ok, wacht))
  laatsteZoek = Date.now()
  let uit
  try {
    const res = await fetch(`${adres}/zoek?q=${encodeURIComponent(term)}`, { cache: 'no-store', ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(15_000) } : {}) })
    const data = await res.json().catch(() => null)
    if (res.status === 503 && data?.uit) uit = { fout: 'Zoeken staat even uit. Tik op de kaart, gebruik je locatie of plak een link.' }
    else if (!res.ok) uit = { fout: `${data?.fout || `Zoeken lukt nu niet (fout ${res.status})`}. Probeer het zo nog eens, of tik op de kaart.` }
    else uit = { lijst: schoonZoek(data) }
  } catch {
    uit = { fout: navigator.onLine === false ? 'Zoeken kan alleen met internet. Tik op de kaart of plak een link.' : 'De zoekdienst is niet bereikbaar. Tik op de kaart of plak een link.' }
  } finally {
    laatsteZoek = Date.now()
    if (knop.isConnected) {
      knop.disabled = false
      knop.innerHTML = '<span aria-hidden="true">🔎</span> Zoek'
    }
  }
  const k = ui.plekKies
  if (!k || laag.dataset.soort !== 'plek') return
  const lijstEl = $('#zoek-uitkomsten')
  if (uit.fout) {
    lijstEl.hidden = true
    return plekFout(uit.fout)
  }
  k.uitkomsten = uit.lijst
  if (!uit.lijst.length) {
    lijstEl.hidden = true
    return plekFout(`Niks gevonden voor '${term}'. Probeer het wat anders, of tik op de kaart.`)
  }
  if (uit.lijst.length === 1) return kiesZoekUitkomst(0)
  lijstEl.innerHTML = uit.lijst
    .map((u, i) => `<li><button type="button" class="zoek-uitkomst" data-zoek-uit="${i}"><strong>${esc(u.plek.naam)}</strong><span class="klein">${esc(u.adres)}</span></button></li>`)
    .join('')
  lijstEl.hidden = false
  meld(`${uit.lijst.length} plekken gevonden`)
}

function kiesZoekUitkomst(i) {
  const u = ui.plekKies?.uitkomsten[i]
  if (!u) return
  $('#zoek-uitkomsten').hidden = true
  zetKiesPunaise(u.plek.lat, u.plek.lng, { naam: u.plek.naam, zoom: 16 })
  meld(`Gekozen: ${u.plek.naam}`)
}

function mijnLocatie(knop) {
  if (!navigator.geolocation) return plekFout('Je locatie opvragen kan niet in deze browser.')
  plekFout('')
  const tekst = knop.innerHTML
  knop.disabled = true
  knop.textContent = '⏳ Even zoeken…'
  const klaar = () => {
    if (knop.isConnected) {
      knop.disabled = false
      knop.innerHTML = tekst
    }
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      klaar()
      if (laag.dataset.soort !== 'plek') return
      zetKiesPunaise(pos.coords.latitude, pos.coords.longitude, { zoom: 16 })
      meld('Je locatie staat op de kaart')
    },
    (err) => {
      klaar()
      plekFout(err.code === 1 ? 'Je gaf geen toestemming voor je locatie. Dat kun je aanzetten in de instellingen van je telefoon.' : 'Je locatie vinden lukt nu niet. Tik op de kaart of zoek de plek.')
    },
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
  )
}

function plekActie(knop) {
  const wat = knop.dataset.plek
  if (wat === 'zoek') return zoekPlek()
  if (wat === 'locatie') return mijnLocatie(knop)
  if (wat === 'terug') return terugNaarVel()
  if (wat === 'weg' && ui.vel) {
    ui.vel.plek = null
    return terugNaarVel()
  }
  if (wat === 'klaar' && ui.vel) {
    const g = ui.plekKies?.gekozen
    if (!g) return plekFout('Kies eerst een plek: tik op de kaart, zoek, of plak een link.')
    ui.vel.plek = maakPlek(g.lat, g.lng, $('#plek-naam').value)
    terugNaarVel()
  }
}

function ruimKiesKaartOp() {
  ruimOp(ui.plekKies?.kaart)
  ui.plekKies = null
}

function terugNaarVel() {
  ruimKiesKaartOp()
  if (!ui.vel) return sluitDirect()
  openVel({ ...ui.vel, vanBlok: false })
  bewaarConcept()
}

// ---------- De Gedaan-doos (§5.8) ----------

const inDoosNu = () => inDeDoos(bord()).filter((b) => !ui.verborgen.has(b.id))

function renderGedaan() {
  if (!inDoosNu().length) {
    return `
      <section class="tab-leeg">
        <div class="leeg-briefje papier-mint rand-9">
          <p class="hand">📦 De Gedaan-doos</p>
          <p>Nog niks in de doos. Iets gedaan? Tik op het briefje en dan op <strong>Gedaan! ✅</strong>. Hier komt een plakboek van alles wat jullie samen deden 🎉</p>
        </div>
      </section>`
  }
  return `${filterbalkHtml()}<section class="doos" id="doos-inhoud">${doosInhoud()}</section>`
}

function geplaktHtml(b) {
  const bd = bord()
  const cat = catVan(bd, waarde(b.v, 'cat'))
  const g = waarde(b.v, 'gedaan')
  const u = uiterlijk(b.id)
  return `
    <div class="geplakt-plek" style="--draai:${u.draai}deg">
      <button type="button" class="briefje geplakt papier-${cat.kleur} rand-${u.rand}" data-action="open-doos" data-id="${b.id}">
        <span class="geplakt-datum">✅ ${fmtDag(g.datum)}</span>
        <span class="vh">${esc(cat.naam)}: </span><span class="tekst">${esc(waarde(b.v, 'tekst', ''))}</span>
        ${g.notitie ? `<span class="geplakt-notitie">“${esc(g.notitie)}”</span>` : ''}
        ${g.foto || waarde(b.v, 'foto') ? `<span class="vh">, met foto</span>${polaroidHtml(g.foto || waarde(b.v, 'foto'), u.dx < 0 ? 'scheef-l' : 'scheef-r')}` : ''}
        ${bijlagenHtml(b)}
        ${hartjesHtml(bd, b)}
        <span class="briefje-voet" aria-hidden="true">${cat.emoji}</span>
      </button>
      <span class="plakband" aria-hidden="true"></span>
    </div>`
}

function doosInhoud() {
  const bd = bord()
  const alle = inDoosNu()
  const lijst = alle.filter((b) => past(bd, b, ui.filter))
  const teller = isAlles(ui.filter) ? `${meervoud(alle.length, 'ding', 'dingen')} samen gedaan 🎉` : `${lijst.length} van de ${meervoud(alle.length, 'ding', 'dingen')} samen gedaan 🎉`
  const maanden = perMaand(lijst)
    .map(
      (m) => `
      <h3 class="maand"><span>${fmtMaand(m.maand)}</span></h3>
      <div class="plakboek">${m.briefjes.map(geplaktHtml).join('')}</div>`,
    )
    .join('')
  return `
    <h2 class="doos-kop"><span aria-hidden="true">📦</span> De Gedaan-doos</h2>
    <p class="doos-teller" id="doos-teller">${teller}</p>
    ${
      maanden ||
      `<div class="leeg-briefje papier-wit rand-7 doos-niks"><p class="hand">Niks gevonden 🔍</p><p>Met dit filter zit er niets in de doos.</p>
       <button type="button" class="knop primair" data-filter="alles">Alles laten zien</button></div>`
    }`
}

// ---------- Meer ----------

function renderMeer() {
  const bd = bord()
  const opslag =
    ui.persisted === true
      ? '✅ Je briefjes blijven bewaard, ook als de telefoon ruimte nodig heeft.'
      : ui.persisted === false
        ? '⚠️ De browser belooft niet dat alles bewaard blijft. Maak af en toe een back-up.'
        : '⏳ Nog onbekend.'
  const laatste = staat.apparaat.laatsteBackup
  const backupTekst = laatste ? `Laatste back-up: ${fmtMoment(laatste)}` : 'Bewaar al je briefjes in een bestand. Nog nooit gedaan op deze telefoon!'
  const nCats = categorieen(bd).length
  return `
    <section class="meer">
      <h2>Meer</h2>

      <h3 class="groep-kop">Dit bord</h3>
      <div class="groep">
        <button type="button" class="rij" data-action="bord-instel">
          <span class="rij-icoon" aria-hidden="true">${esc(waarde(bd.info, 'emoji', '📌'))}</span>
          <span class="rij-tekst"><strong>${esc(waarde(bd.info, 'naam', 'Prikbord'))}</strong><span class="klein">Naam en emoji, of het bord verlaten</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
        <button type="button" class="rij" data-action="delen">
          <span class="rij-icoon" aria-hidden="true">🤝</span>
          <span class="rij-tekst"><strong>Samen prikken</strong><span class="klein">${gedeeld() ? `<span data-sync-status>${esc(statusTekst())}</span><br>${esc(metWie(bd))}` : 'Alleen op deze telefoon. Deel dit bord met een koppel-link'}</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
        <button type="button" class="rij" data-action="ik">
          <span class="rij-icoon" aria-hidden="true"><span class="pin-bol pin-${lidVan(bd, ikId()).kleur}"></span></span>
          <span class="rij-tekst"><strong>Wie ben ik</strong><span class="klein">Je bent ${esc(lidVan(bd, ikId()).naam)} op dit bord · naam en kleur</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
        <button type="button" class="rij" data-action="cats">
          <span class="rij-icoon" aria-hidden="true">🏷️</span>
          <span class="rij-tekst"><strong>Categorieën</strong><span class="klein">${meervoud(nCats, 'categorie', 'categorieën')} · namen, emoji, kleuren en volgorde</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
      </div>

      <h3 class="groep-kop">Borden</h3>
      <div class="groep">
        <button type="button" class="rij" data-action="borden">
          <span class="rij-icoon" aria-hidden="true">📋</span>
          <span class="rij-tekst"><strong>Alle borden</strong><span class="klein">${meervoud(Object.keys(staat.borden).length, 'bord', 'borden')} · wisselen, nieuw bord of een koppel-link</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
      </div>

      <h3 class="groep-kop">Op deze telefoon</h3>
      <div class="groep">
        <label class="rij">
          <span class="rij-icoon" aria-hidden="true">🔊</span>
          <span class="rij-tekst"><strong>Geluid</strong><span class="klein">Rrrits bij het scheuren, tok bij het prikken en plop bij gedaan</span></span>
          <input type="checkbox" class="schakelaar" data-setting="geluid" ${staat.apparaat.geluid ? 'checked' : ''} />
        </label>
        <div class="rij"><span class="rij-icoon" aria-hidden="true">💾</span>
          <span class="rij-tekst"><strong>Blijvende opslag</strong><span class="klein">${opslag}</span></span></div>
      </div>

      <h3 class="groep-kop">Back-up</h3>
      <div class="groep">
        <button type="button" class="rij" data-action="export">
          <span class="rij-icoon" aria-hidden="true">📤</span>
          <span class="rij-tekst"><strong>Back-up maken</strong><span class="klein" id="laatste-backup">${backupTekst}</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
        <button type="button" class="rij" data-action="import">
          <span class="rij-icoon" aria-hidden="true">📥</span>
          <span class="rij-tekst"><strong>Back-up terugzetten</strong><span class="klein">Wordt samengevoegd: wat je al hebt, blijft staan</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
      </div>

      <h3 class="groep-kop">App</h3>
      <div class="groep">
        <button type="button" class="rij" data-action="changelog">
          <span class="rij-icoon" aria-hidden="true">✨</span>
          <span class="rij-tekst"><strong>Wat is er nieuw</strong></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
        <button type="button" class="rij" data-action="force-update">
          <span class="rij-icoon" aria-hidden="true">🔄</span>
          <span class="rij-tekst"><strong>Nu bijwerken</strong><span class="klein">Haalt de nieuwste versie op. Je briefjes blijven staan.</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
      </div>
      <p class="versie">Prikbord versie ${APP_VERSION} · met liefde gemaakt 📌</p>
    </section>`
}

// ---------- Tekenen ----------

function kopRechts() {
  if (ui.tab !== 'bord') return ''
  const v = isVrij() ? 'vrij' : 'netjes'
  return `
    <div class="weergave" role="group" aria-label="Weergave van het bord">
      <button type="button" data-weergave="netjes" aria-pressed="${v === 'netjes'}" title="Netjes rommelig: de app prikt zelf">Netjes</button>
      <button type="button" data-weergave="vrij" aria-pressed="${v === 'vrij'}" title="Vrij: slepen en zoomen">Vrij</button>
    </div>`
}

// Bovenin: emoji en naam van het bord (tik = alle borden), het statusbolletje
// en een tellertje als er op een ander bord iets nieuws hangt.
function tekenKop() {
  const bd = bord()
  const elders = Object.keys(staat.borden).filter((id) => id !== staat.bord).reduce((n, id) => n + aantalNieuw(id), 0)
  $('#kop-titel').innerHTML = `<span class="kop-emoji" aria-hidden="true">${esc(waarde(bd.info, 'emoji', '📌'))}</span>
    <span class="kop-naam">${esc(waarde(bd.info, 'naam', 'Prikbord'))}</span><span class="kop-pijl" aria-hidden="true">▾</span>
    <span class="sync-dot" id="sync-dot" hidden><span class="vh" data-sync-status></span></span>
    ${elders ? `<span class="kop-nieuw" title="Nieuw op je andere borden">${elders}<span class="vh"> nieuw op je andere borden</span></span>` : ''}
    <span class="vh">, alle borden</span>`
  tekenStatus()
}

function render(vol = false) {
  tekenKop()
  $('#kop-rechts').innerHTML = kopRechts()
  document.body.dataset.tab = ui.tab
  for (const b of document.querySelectorAll('.tabbar [data-tab]')) {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page')
    else b.removeAttribute('aria-current')
  }
  blok.hidden = ui.tab !== 'bord'
  $('.blok-vel', blok).className = `blok-vel papier-${blokCat()?.kleur || 'wit'}`
  if (ui.tab !== 'kaart') {
    ruimKaartTabOp()
    document.documentElement.classList.remove('kaart-modus')
  }
  if (ui.tab === 'bord') return tekenBord(vol)
  vrijApi = null
  document.documentElement.classList.remove('vrij-modus')
  if (ui.tab === 'kaart') return tekenKaartTab(vol)
  view.dataset.scherm = ui.tab
  if (ui.tab === 'gedaan') view.innerHTML = renderGedaan()
  if (ui.tab === 'meer') view.innerHTML = renderMeer()
}

// ---------- De laag: geopend briefje, schrijfvel, wat is er nieuw ----------
// Eén <dialog> voor alles wat over het bord heen komt. De donkere achtergrond
// is een eigen element (.laag-achter), zodat hij mee kan vervagen.
// Soorten: open (van het bord), trek (🎲), gedaan (het formulier "Gedaan!"),
// doos en doos-gedaan (uit de Gedaan-doos), vel (schrijfvel), nieuws,
// cats en cat (categorie-editor).

function openLaag(html, soort) {
  if (laag.open) {
    // Wisselen binnen de laag (bijv. van groot briefje naar bewerken): de
    // achtergrond laten staan, anders knippert hij.
    for (const el of [...laag.children]) if (!el.classList.contains('laag-achter')) el.remove()
    laag.insertAdjacentHTML('beforeend', html)
  } else {
    laag.innerHTML = `<div class="laag-achter" aria-hidden="true"></div>${html}`
    laag.showModal()
  }
  laag.dataset.soort = soort
  document.documentElement.classList.add('laag-open')
}

// Tijdens een animatie: geen tikken op de laag en niet herladen.
async function metRust(fn) {
  ui.bezig++
  laag.classList.add('bezig')
  try {
    return await fn()
  } finally {
    ui.bezig--
    laag.classList.remove('bezig')
  }
}

// Dicht zonder animatie (die is dan al gedaan).
function sluitDirect() {
  if (laag.open) laag.close()
}

// Dicht met een passende beweging.
function sluitLaag() {
  if (!laag.open || laag.classList.contains('bezig')) return
  const soort = laag.dataset.soort
  if (soort === 'open' || soort === 'trek' || soort === 'gedaan') return terughangen()
  if (soort === 'doos-gedaan') return wisselGroot('doos')
  if (soort === 'cat') return openCats()
  if (soort === 'plek') return terugNaarVel()
  return metRust(async () => {
    await vervaagLaag(laag)
    sluitDirect()
  })
}

laag.addEventListener('close', () => {
  document.documentElement.classList.remove('laag-open')
  const soort = laag.dataset.soort
  if (soort === 'plek') ruimKiesKaartOp()
  // Schrijfvel dicht zonder prikken: het concept blijft bewaard voor de volgende keer.
  if ((soort === 'vel' || soort === 'plek') && ui.vel) {
    const c = staat.apparaat.concept
    const bewaard = c && c.id === ui.vel.id && c.tekst.trim()
    ui.vel = null
    bewaarNu(staat, opslagFout)
    render()
    if (bewaard) toast(c.nieuw ? '✍️ Je briefje ligt nog klaar op het blokje' : '✍️ Je wijziging is bewaard als concept')
  }
  // Een geopend briefje dat nog verstopt was, komt terug op het bord.
  if (ui.open) {
    view.querySelector(`.briefje-plek[data-id="${ui.open}"]`)?.classList.remove('verstopt')
    ui.open = null
  }
  laag.dataset.soort = ''
  laag.innerHTML = ''
  if (soort === 'koppel-ja' || soort === 'wie') ui.koppel = null
  if (soort === 'backup') ui.backup = null
  // Categorieën, namen, kleuren of borden aangepast: alles opnieuw tekenen.
  if (['cats', 'cat', 'ik', 'bord', 'welkom', 'delen'].includes(soort)) render(true)
})

// Esc (en de terugknop op Android) sluit met dezelfde beweging.
laag.addEventListener('cancel', (e) => {
  e.preventDefault()
  sluitLaag()
})

// Tik naast het briefje sluit het. Niet bij het schrijfvel en de formulieren:
// dan ben je te snel iets kwijt als je net naast het papier tikt.
const RUSTIG_SLUITEN = ['open', 'trek', 'doos', 'nieuws', 'borden']
laag.addEventListener('click', (e) => {
  if (!RUSTIG_SLUITEN.includes(laag.dataset.soort)) return
  if (e.target === laag || e.target.classList.contains('laag-achter') || e.target.matches('.groot, .nieuws')) sluitLaag()
})

function hartKnopHtml(bd, b) {
  const ik = ikId()
  const wie = hartjesVan(b)
  const aan = wie.includes(ik)
  return `
    <button type="button" class="hart-knop${aan ? ' aan' : ''}" data-laag="hart" aria-pressed="${aan}" aria-label="${aan ? 'Hartje weghalen' : 'Hartje geven'}">
      ${hartSvg(lidVan(bd, ik).kleur, 'hart hart-groot')}
      ${wie.length ? `<span class="hart-tal" aria-hidden="true">${wie.length}</span>` : ''}
    </button>`
}

const KNOPPEN = {
  open: `
    <button type="button" class="knop" data-laag="weg"><span aria-hidden="true">🗑️</span> Weghalen</button>
    <button type="button" class="knop" data-laag="bewerk"><span aria-hidden="true">✏️</span> Bewerken</button>
    <button type="button" class="knop" data-laag="gedaan">Gedaan! <span aria-hidden="true">✅</span></button>
    <button type="button" class="knop primair" data-laag="sluit">Terughangen <span aria-hidden="true">📌</span></button>`,
  trek: `
    <button type="button" class="knop" data-laag="nog-eens"><span aria-hidden="true">🎲</span> Nog eens</button>
    <button type="button" class="knop primair" data-laag="sluit">Sluiten</button>`,
  doos: `
    <button type="button" class="knop" data-laag="weg"><span aria-hidden="true">🗑️</span> Weghalen</button>
    <button type="button" class="knop" data-laag="terug-op-bord"><span aria-hidden="true">📌</span> Terughangen</button>
    <button type="button" class="knop" data-laag="gedaan"><span aria-hidden="true">✏️</span> Aanpassen</button>
    <button type="button" class="knop primair" data-laag="sluit">Sluiten</button>`,
}

function grootHtml(b, soort) {
  const bd = bord()
  const cat = catVan(bd, waarde(b.v, 'cat'))
  const lid = lidVan(bd, b.door)
  const u = uiterlijk(b.id)
  const g = waarde(b.v, 'gedaan')
  const foto = waarde(b.v, 'foto')
  const link = waarde(b.v, 'link')
  const plek = waarde(b.v, 'plek')
  const inDoos = soort === 'doos'
  ui.grootVan = JSON.stringify(b) // past de sync het briefje aan, dan opnieuw tekenen
  return `
    <div class="groot" data-id="${b.id}" data-soort="${soort}">
      ${soort === 'trek' ? '<p class="trek-kop laag-extra">🎲 Het lot heeft gesproken!</p>' : ''}
      <div class="briefje-plek groot-plek${inDoos ? ' in-doos' : ''}" style="--px:${u.punaiseX}%">
        <div class="briefje groot-papier papier-${cat.kleur} rand-${u.rand}">
          <p class="groot-cat"><span aria-hidden="true">${cat.emoji}</span> ${esc(cat.naam)}</p>
          <p class="groot-tekst" id="laag-titel">${esc(waarde(b.v, 'tekst', ''))}</p>
          ${foto ? polaroidHtml(foto, 'groot-foto') : ''}
          ${link ? `<p class="groot-link"><a href="${esc(link)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🔗</span> ${esc(kortLink(link))}</a></p>` : ''}
          ${
            plek
              ? `<p class="groot-waar"><span class="groot-waar-naam"><span aria-hidden="true">📍</span> ${esc(plekLabel(plek))}</span>
                 <button type="button" class="knop klein-knop" data-laag="op-kaart"><span aria-hidden="true">🗺️</span> Op de kaart</button></p>`
              : ''
          }
          ${
            g
              ? `<div class="groot-gedaan"><p class="gedaan-stempel">✅ Gedaan op ${fmtDagLang(g.datum)}</p>${g.notitie ? `<p class="gedaan-notitie">“${esc(g.notitie)}”</p>` : ''}${
                  g.foto ? polaroidHtml(g.foto, 'gedaan-foto') : ''
                }</div>`
              : ''
          }
          <div class="groot-voet">
            <p class="groot-meta">Geprikt door ${esc(lid.naam)} op ${fmtMoment(b.gemaakt)}</p>
            ${hartKnopHtml(bd, b)}
          </div>
        </div>
        ${inDoos ? '<span class="plakband" aria-hidden="true"></span>' : `<span class="punaise pin-${lid.kleur}" style="--pd:${u.punaiseDraai}deg" aria-hidden="true"></span>`}
      </div>
      <div class="laag-knoppen">${KNOPPEN[soort]}</div>
    </div>`
}

// Tik op een briefje: het komt van het bord en opent groot.
// soort 'trek': getrokken met de dobbelsteen (andere knoppen).
function openBriefje(id, soort = 'open') {
  const b = bord().briefjes[id]
  if (!b || b.weg || laag.open) return
  zagHet(id)
  const plek = view.querySelector(`.briefje-plek[data-id="${id}"]`)
  openLaag(grootHtml(b, soort), soort)
  ui.open = id
  if (!plek || minderBeweging()) return
  plek.classList.add('verstopt')
  metRust(() => vanBord(plek, $('.groot-plek', laag), laag))
}

// Uit de Gedaan-doos: geen plek op het bord, dus gewoon groot naar voren.
function openUitDoos(id) {
  const b = bord().briefjes[id]
  if (!b || b.weg || laag.open) return
  openLaag(grootHtml(b, 'doos'), 'doos')
  if (!minderBeweging()) metRust(() => popIn($('.groot-plek', laag), laag))
}

// Binnen de laag naar een andere soort (bijv. terug van het formulier).
function wisselGroot(soort) {
  const id = laag.querySelector('.groot')?.dataset.id
  const b = id && bord().briefjes[id]
  if (!b || b.weg) return sluitDirect()
  const scroll = laag.scrollTop
  openLaag(grootHtml(b, soort), soort)
  laag.scrollTop = scroll
}

// "Terughangen": het briefje krimpt terug naar zijn plek, met een tok.
function terughangen() {
  const plek = ui.open && view.querySelector(`.briefje-plek[data-id="${ui.open}"]`)
  const groot = $('.groot-plek', laag)
  return metRust(async () => {
    if (!plek || !groot || minderBeweging()) await vervaagLaag(laag)
    else {
      await terugNaarBord(groot, plek, laag, () => plek.classList.remove('verstopt'))
      speel(tok)
    }
    sluitDirect()
  })
}

// Het hartje op het geopende briefje.
function wisselHart(id) {
  const b = bord().briefjes[id]
  if (!b || b.weg) return
  const aan = !hartjesVan(b).includes(ikId())
  zetMijnHart(id, aan)
  const knop = laag.querySelector('.hart-knop')
  if (knop) {
    knop.outerHTML = hartKnopHtml(bord(), b)
    const nieuw = laag.querySelector('.hart-knop')
    nieuw.focus({ preventScroll: true })
    if (aan && !minderBeweging()) nieuw.querySelector('svg').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' })
  }
  if (aan) navigator.vibrate?.(8)
  meld(aan ? 'Hartje gegeven' : 'Hartje weggehaald')
  render()
}

// ---------- Gedaan! (§5.8) ----------

// Het formulier komt onder het briefje, in plaats van de knoppen.
function toonGedaanForm(id) {
  const b = bord().briefjes[id]
  const groot = laag.querySelector('.groot')
  if (!b || !groot) return
  const g = waarde(b.v, 'gedaan')
  const uitDoos = groot.dataset.soort === 'doos'
  groot.querySelector('.laag-knoppen').outerHTML = `
    <form class="gedaan-form laag-extra" id="gedaan-form" data-id="${id}" data-foto="${esc(g?.foto || '')}">
      <h2 class="gedaan-kop">${g ? 'Hoe was het? ✍️' : 'Gedaan! 🎉'}</h2>
      <label class="veld"><span>Wanneer?</span>
        <input type="date" name="datum" value="${g?.datum || vandaagKey()}" max="${vandaagKey()}" required /></label>
      <label class="veld"><span>Hoe was het? <span class="klein">(mag leeg blijven)</span></span>
        <textarea name="notitie" rows="3" maxlength="${MAX_NOTITIE}" placeholder="Heerlijk! Volgende keer weer 😋">${esc(g?.notitie || '')}</textarea></label>
      <div class="gedaan-foto-rij" id="gedaan-foto-rij">${gedaanFotoHtml(g?.foto)}</div>
      <p class="fout" id="gedaan-fout" role="alert"></p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-laag="gedaan-terug">Terug</button>
        <button type="submit" class="knop primair">${uitDoos ? 'Bewaren ✍️' : 'In de doos! 📦'}</button>
      </div>
    </form>`
  laag.dataset.soort = uitDoos ? 'doos-gedaan' : 'gedaan'
  groot.dataset.soort = laag.dataset.soort
}

function leesGedaanForm(form) {
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(form.datum.value) ? form.datum.value : vandaagKey()
  const notitie = form.notitie.value.trim().slice(0, MAX_NOTITIE)
  const g = notitie ? { datum, notitie } : { datum }
  if (form.dataset.foto) g.foto = form.dataset.foto
  return g
}

// Een foto bij "Gedaan!" (§5.8), om later terug te kijken.
function gedaanFotoHtml(foto, bezig = false) {
  if (bezig) return '<span class="polaroid leeg bezig klein"><span class="vh">Foto wordt verkleind</span></span>'
  if (foto) return `<span class="vel-foto">${polaroidHtml(foto, 'klein')}<button type="button" class="weg-knop" data-gedaan-foto="weg" aria-label="Foto weghalen">✕</button></span>`
  return '<button type="button" class="extra-knop" data-gedaan-foto="kies"><span class="icoon-plakband" aria-hidden="true"></span> Foto erbij</button>'
}
function gedaanFotoActie(knop) {
  const form = $('#gedaan-form')
  if (!form) return
  if (knop.dataset.gedaanFoto === 'kies') {
    ui.fotoVoor = 'gedaan'
    return $('#foto-bestand').click()
  }
  form.dataset.foto = ''
  $('#gedaan-foto-rij').innerHTML = gedaanFotoHtml(null)
  meld('Foto weggehaald')
}

// De punaise springt eruit (plop) en het briefje valt in de doos, met confetti.
async function gooiInDoos(id, gedaan) {
  const b = bord().briefjes[id]
  if (!b || b.weg) return
  zetWegDoor()
  zetVeld(b, 'gedaan', gedaan, Date.now())
  opslaan()
  if (gedaan.foto) zetFotosKlaar(staat.bord, [gedaan.foto])
  meld('In de Gedaan-doos')
  const doel = $('.tabbar [data-tab="gedaan"]')
  const groot = $('.groot-plek', laag)
  ui.open = null
  await metRust(async () => {
    if (groot && !minderBeweging()) await valInDoos(groot, doel, laag, () => speel(plop))
    else await vervaagLaag(laag)
    sluitDirect()
  })
  render()
  const melding = () => toast('📦 In de Gedaan-doos! 🎉', { actie: 'Ongedaan maken', ms: 5000, opActie: () => terugUitDoos(id) })
  if (minderBeweging()) {
    speel(plop)
    return melding()
  }
  stuiter(doel.querySelector('span'))
  confetti(doel)
  // De melding pas als het feestje bijna voorbij is (anders ligt hij over de confetti).
  setTimeout(melding, 700)
}

// Aanpassen vanuit de doos (datum of "hoe was het").
function bewaarGedaan(id, gedaan) {
  const b = bord().briefjes[id]
  if (!b || b.weg) return
  zetVeld(b, 'gedaan', gedaan, Date.now())
  opslaan()
  if (gedaan.foto) zetFotosKlaar(staat.bord, [gedaan.foto])
  wisselGroot('doos')
  if (ui.tab === 'gedaan') render()
  toast('✍️ Bewaard')
}

// "Terughangen" uit de doos: het briefje gaat terug naar het bord en de
// punaise prikt erin.
async function terugUitDoos(id) {
  const bd = bord()
  const b = bd.briefjes[id]
  if (!b || b.weg) return
  zetVeld(b, 'gedaan', null, Date.now())
  opslaan()
  if (laag.open) {
    await metRust(async () => {
      await vervaagLaag(laag)
      sluitDirect()
    })
  }
  zorgDatHetZichtbaarIs(b)
  const wasBord = ui.tab === 'bord'
  ui.tab = 'bord'
  ui.landt = id
  render()
  ui.landt = null
  if (!wasBord) scrollTo(0, 0)
  const plek = view.querySelector(`.briefje-plek[data-id="${id}"]`)
  meld('Weer op het bord')
  toast('📌 Weer terug op het bord!')
  if (!plek) return
  zichtbaarMaken(plek)
  plek.classList.remove('verstopt')
  if (minderBeweging()) return speel(tok)
  prikIn(plek, () => {
    speel(tok)
    wiebelBuren(plek)
  })
}

// ---------- Trek een briefje 🎲 (§5.7) ----------
// Willekeurig uit wat nu zichtbaar is (dus binnen de filters). Het bord
// schudt, één briefje wiebelt los en vliegt groot naar het midden.

async function trekBriefje() {
  if (laag.open || ui.bezig || ui.tab !== 'bord') return
  const bd = bord()
  const ids = opHetBord(bd)
    .filter((b) => !ui.verborgen.has(b.id) && past(bd, b, ui.filter))
    .map((b) => b.id)
  const id = trek(ids, Math.random, ui.getrokken)
  if (!id) return toast('🎲 Er hangt hier niks om uit te kiezen')
  ui.getrokken = id
  const bak = $('#vrij-wereld') || $('#bord-binnen')
  const plek = bak?.querySelector(`.briefje-plek[data-id="${id}"]`)
  if (plek && !minderBeweging()) {
    zichtbaarMaken(plek)
    const zichtbaar = [...bak.children].filter((el) => !el.classList.contains('uit') && !el.classList.contains('gedimd'))
    await metRust(() => schudLos(zichtbaar, plek))
  }
  meld('Getrokken')
  openBriefje(id, 'trek')
}

// ---------- Het schrijfvel ----------
// Een nieuw briefje krijgt meteen zijn id, zodat het vel dezelfde scheurrand
// heeft als straks het briefje op het bord.
// `vanBlok`: net van het blokje gescheurd (met rrrits en animatie).
// Link, foto en plek: undefined = wat er al op het briefje staat.
function openVel({ id, nieuw, tekst = '', cat, link, foto, plek, vanBlok = false }) {
  const bd = bord()
  const bestaand = bd.briefjes[id]
  const al = (k, w) => (w !== undefined ? w : nieuw || !bestaand ? null : waarde(bestaand.v, k))
  // Een verborgen categorie blijft staan bij een briefje dat hem al had.
  const cats = categorieen(bd, { metVerborgen: true }).filter((c) => !c.verborgen || c.id === cat)
  if (!cats.some((c) => c.id === cat)) cat = standaardCat()?.id || cats[0]?.id
  ui.vel = { id, nieuw, tekst, cat, link: al('link', link), foto: al('foto', foto), plek: al('plek', plek) }
  const kleur = catVan(bd, cat).kleur
  const u = uiterlijk(id)
  openLaag(
    `
    <form class="vel" method="dialog" id="vel-form">
      <p class="vh" id="laag-titel">${nieuw ? 'Nieuw briefje' : 'Briefje bewerken'}</p>
      <div class="tabjes" role="radiogroup" aria-label="Categorie">
        ${cats
          .map(
            (c) => `
          <button type="button" role="radio" aria-checked="${c.id === cat}" class="tabje papier-${c.kleur}" data-cat="${c.id}">
            <span aria-hidden="true">${c.emoji}</span> ${esc(c.naam)}
          </button>`,
          )
          .join('')}
      </div>
      <div class="briefje-plek vel-plek">
        <div class="briefje vel-papier papier-${kleur} rand-${u.rand}" id="vel-papier">
          <textarea id="vel-tekst" maxlength="${MAX_TEKST}" rows="3" placeholder="Wat wil je onthouden? ✍️" aria-label="Wat er op het briefje staat">${esc(tekst)}</textarea>
          <div class="vel-bijlagen" id="vel-bijlagen">${velBijlagenHtml()}</div>
          <span class="vel-teller" id="vel-teller" aria-live="polite"></span>
        </div>
      </div>
      <div class="vel-extra" role="group" aria-label="Iets toevoegen aan het briefje">
        <button type="button" class="extra-knop" data-vel="link" aria-expanded="false" aria-controls="vel-link-rij"><span aria-hidden="true">📎</span> Link</button>
        <button type="button" class="extra-knop" data-vel="foto"><span class="icoon-plakband" aria-hidden="true"></span> Foto</button>
        <button type="button" class="extra-knop" data-vel="plek"><span aria-hidden="true">🗺️</span> Plek</button>
      </div>
      <div class="vel-link" id="vel-link-rij" hidden>
        <input id="vel-link" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Plak of typ een link, bijv. ah.nl/…" aria-label="Link" />
        <button type="button" class="knop klein-knop" data-vel="link-ok">OK</button>
      </div>
      <p class="fout" id="vel-fout" role="alert"></p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-laag="weggooien">Weggooien</button>
        <button type="submit" class="knop primair prik">Prikken! <span aria-hidden="true">📌</span></button>
      </div>
    </form>`,
    'vel',
  )
  const ta = $('#vel-tekst')
  werkTellerBij()
  // Meteen focussen, nog binnen de tik: anders komt op de iPhone het
  // toetsenbord niet omhoog. (Na een herstart met concept lukt dat niet.)
  ta.focus({ preventScroll: true })
  ta.setSelectionRange(ta.value.length, ta.value.length)
  laag.querySelector('.tabje[aria-checked="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  if (vanBlok) {
    speel(rrrits)
    if (!minderBeweging()) metRust(() => scheurAf($('.blok-vel', blok), $('.vel-plek', laag), laag, `papier-${kleur}`))
  }
}

// Wat er op het vel geplakt zit: foto, link en plek, elk met een kruisje.
function velBijlagenHtml() {
  const v = ui.vel
  if (!v) return ''
  const kruisje = (wat, label) => `<button type="button" class="weg-knop" data-vel="${wat}-weg" aria-label="${label}">✕</button>`
  return [
    v.fotoBezig ? '<span class="vel-foto"><span class="polaroid leeg bezig klein"><span class="vh">Foto wordt verkleind</span></span></span>' : '',
    !v.fotoBezig && v.foto ? `<span class="vel-foto">${polaroidHtml(v.foto, 'klein')}${kruisje('foto', 'Foto weghalen')}</span>` : '',
    v.link ? `<span class="bijlage vel-bijlage"><span aria-hidden="true">🔗</span> ${esc(domeinVan(v.link))}${kruisje('link', 'Link weghalen')}</span>` : '',
    v.plek ? `<span class="bijlage vel-bijlage"><span aria-hidden="true">📍</span> ${esc(plekLabel(v.plek))}${kruisje('plek', 'Plek weghalen')}</span>` : '',
  ].join('')
}
function tekenVelBijlagen() {
  const el = $('#vel-bijlagen')
  if (el) el.innerHTML = velBijlagenHtml()
}

// De knoppen op het schrijfvel (paperclip, plakband, kaartje en de kruisjes).
function velActie(knop) {
  if (!ui.vel) return
  const wat = knop.dataset.vel
  const fout = $('#vel-fout')
  if (fout) fout.textContent = ''
  if (wat === 'link') {
    const rij = $('#vel-link-rij')
    rij.hidden = !rij.hidden
    knop.setAttribute('aria-expanded', String(!rij.hidden))
    if (!rij.hidden) {
      const veld = $('#vel-link')
      veld.value = ui.vel.link || ''
      veld.focus()
    }
    return
  }
  if (wat === 'link-ok') return bewaarVelLink()
  if (wat === 'foto') {
    ui.fotoVoor = 'vel'
    return $('#foto-bestand').click()
  }
  if (wat === 'plek') return openPlekKiezer()
  if (['link-weg', 'foto-weg', 'plek-weg'].includes(wat)) {
    ui.vel[wat.replace('-weg', '')] = null
    tekenVelBijlagen()
    bewaarConcept()
    meld(wat === 'foto-weg' ? 'Foto weggehaald' : wat === 'link-weg' ? 'Link weggehaald' : 'Plek weggehaald')
    $('#vel-tekst')?.focus({ preventScroll: true })
  }
}

function bewaarVelLink() {
  const veld = $('#vel-link')
  if (!veld || !ui.vel) return
  const link = linkUitInvoer(veld.value)
  if (link === undefined) {
    $('#vel-fout').textContent = 'Dat lijkt geen link. Alleen links die met http:// of https:// beginnen (of gewoon ah.nl/…).'
    return veld.focus()
  }
  ui.vel.link = link || null
  $('#vel-link-rij').hidden = true
  laag.querySelector('[data-vel="link"]')?.setAttribute('aria-expanded', 'false')
  tekenVelBijlagen()
  bewaarConcept()
  if (link) meld('Link toegevoegd')
}

function werkTellerBij() {
  const n = ui.vel?.tekst.length || 0
  const el = $('#vel-teller')
  if (el) el.textContent = n > MAX_TEKST - 100 ? `${n}/${MAX_TEKST}` : ''
}

// Concept bijhouden terwijl je typt (§4.1, regel 12).
function bewaarConcept() {
  if (!ui.vel) return
  const { id, nieuw, tekst, cat, link, foto, plek } = ui.vel
  staat.apparaat.concept = { bord: staat.bord, id, nieuw, tekst, cat, link, foto, plek }
  bewaarStraks(staat, opslagFout)
}

// "Prikken!": opslaan, het bord eronder bijwerken (het briefje nog verstopt),
// het vel laten krimpen en naar zijn plek laten vliegen, en dan de punaise
// erin met een tok. De buren wiebelen mee.
async function prik() {
  if (!ui.vel || laag.classList.contains('bezig')) return
  if (ui.vel.fotoBezig) return toast('⏳ Even geduld, de foto wordt nog verkleind')
  // Een link die je wel typte maar nog niet met OK bevestigde, gaat ook mee.
  const linkRij = $('#vel-link-rij')
  if (linkRij && !linkRij.hidden && $('#vel-link').value.trim()) {
    bewaarVelLink()
    if (!linkRij.hidden) return
  }
  const tekst = ui.vel.tekst.trim()
  if (!tekst) {
    const papier = $('#vel-papier')
    papier.classList.remove('schud')
    void papier.offsetWidth
    papier.classList.add('schud')
    $('#vel-tekst').placeholder = 'Eerst iets opschrijven ✍️'
    return
  }
  const bd = bord()
  const now = Date.now()
  const { id, cat } = ui.vel
  const bestaand = bd.briefjes[id]
  const nieuw = !bestaand || !!bestaand.weg
  // Weggehaald terwijl je het bewerkte? Dan wordt het een nieuw briefje.
  const echtId = bestaand?.weg ? maakId() : id
  if (nieuw) {
    nieuwBriefje(bd, { id: echtId, door: ikId(), tekst, cat, now })
    staat.apparaat.laatsteCat[staat.bord] = cat
  } else {
    zetVeld(bestaand, 'tekst', tekst, now)
    zetVeld(bestaand, 'cat', cat, now)
  }
  // Link, foto en plek (M4). Niets erop gezet = ook geen leeg veld maken.
  const b = bd.briefjes[echtId]
  const oudeFoto = waarde(b.v, 'foto')
  for (const k of ['link', 'foto', 'plek']) {
    const w = ui.vel[k] ?? null
    if (w !== null || b.v[k]) zetVeld(b, k, w, now)
  }
  if (ui.vel.foto && ui.vel.foto !== oudeFoto) zetFotosKlaar(staat.bord, [ui.vel.foto])
  staat.apparaat.concept = null
  ui.vel = null
  ui.open = null
  opslaan()
  meld(nieuw ? 'Briefje geprikt' : 'Briefje bijgewerkt')

  zorgDatHetZichtbaarIs(bd.briefjes[echtId])
  ui.landt = echtId
  render()
  ui.landt = null
  const plek = view.querySelector(`.briefje-plek[data-id="${echtId}"]`)
  if (!plek) return sluitDirect()
  zichtbaarMaken(plek)

  if (minderBeweging()) {
    await metRust(async () => {
      await vervaagLaag(laag, 160)
      sluitDirect()
    })
    plek.classList.remove('verstopt')
    plek.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 })
    speel(tok)
    return
  }
  await metRust(async () => {
    const vlieger = await vliegNaar($('#vel-papier'), plek, laag)
    plek.classList.remove('verstopt')
    vlieger.remove()
    sluitDirect()
  })
  prikIn(plek, () => {
    speel(tok)
    navigator.vibrate?.(8)
    wiebelBuren(plek)
  })
}

function gooiWeg() {
  if (ui.vel?.tekst.trim() && !confirm('Dit briefje weggooien? Wat je schreef, is dan weg.')) return
  staat.apparaat.concept = null
  ui.vel = null
  opslaan()
  metRust(async () => {
    if (minderBeweging()) await vervaagLaag(laag)
    else await valWeg($('.vel-plek', laag), laag)
    sluitDirect()
  })
}

laag.addEventListener('input', (e) => {
  // Een geplakte link meteen gebruiken (geen zoekdienst nodig). Typen doet
  // niets: zoeken pas na een tik op Zoek (§6.5).
  if (e.target.id === 'plek-zoek' && (e.inputType === 'insertFromPaste' || /https?:\/\/|geo:/i.test(e.target.value))) gebruikLink(e.target.value)
  if (e.target.id === 'vel-tekst' && ui.vel) {
    ui.vel.tekst = e.target.value
    werkTellerBij()
    bewaarConcept()
  }
  if (e.target.form?.id === 'cat-form') werkCatVoorbeeldBij(e.target.form)
})

laag.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return
  if (e.target.id === 'vel-link') {
    e.preventDefault()
    bewaarVelLink()
  }
  if (e.target.id === 'plek-zoek' && !e.isComposing) {
    e.preventDefault()
    zoekPlek()
  }
})

laag.addEventListener('submit', (e) => {
  e.preventDefault()
  if (e.target.id === 'vel-form') prik()
  if (e.target.id === 'gedaan-form') {
    const gedaan = leesGedaanForm(e.target)
    if (laag.dataset.soort === 'doos-gedaan') bewaarGedaan(e.target.dataset.id, gedaan)
    else gooiInDoos(e.target.dataset.id, gedaan)
  }
  if (e.target.id === 'cat-form') bewaarCat(e.target)
  const formulieren = { 'welkom-form': bewaarWelkom, 'bord-nieuw-form': maakNieuwBord, 'koppel-form': leesGeplakt, 'wie-form': nieuwLid, 'delen-form': startDelen, 'ik-form': bewaarIk, 'bord-form': bewaarBordInstel }
  formulieren[e.target.id]?.(e.target)
})

laag.addEventListener('click', (e) => {
  const tab = e.target.closest('.tabje')
  if (tab && ui.vel) {
    ui.vel.cat = tab.dataset.cat
    for (const t of laag.querySelectorAll('.tabje')) t.setAttribute('aria-checked', String(t === tab))
    const papier = $('#vel-papier')
    papier.className = papier.className.replace(/papier-\w+/, `papier-${catVan(bord(), ui.vel.cat).kleur}`)
    bewaarConcept()
    return
  }
  const catKnop = e.target.closest('[data-cats], [data-emoji]')
  if (catKnop) return catActie(catKnop)
  const samenKnop = e.target.closest('[data-borden], [data-koppel], [data-wie], [data-delen]')
  if (samenKnop) return samenActie(samenKnop)
  const velKnop = e.target.closest('[data-vel]')
  if (velKnop) return velActie(velKnop)
  const plekKnop = e.target.closest('[data-plek]')
  if (plekKnop) return plekActie(plekKnop)
  const zoekUit = e.target.closest('[data-zoek-uit]')
  if (zoekUit) return kiesZoekUitkomst(Number(zoekUit.dataset.zoekUit))
  const gedaanFoto = e.target.closest('[data-gedaan-foto]')
  if (gedaanFoto) return gedaanFotoActie(gedaanFoto)
  const knop = e.target.closest('[data-laag]')
  if (!knop) return
  const id = laag.querySelector('.groot')?.dataset.id
  const doe = {
    sluit: sluitLaag,
    weggooien: gooiWeg,
    bewerk: () => {
      const b = bord().briefjes[id]
      if (b) openVel({ id, nieuw: false, tekst: waarde(b.v, 'tekst', ''), cat: waarde(b.v, 'cat') })
    },
    weg: () => haalWeg(id),
    hart: () => wisselHart(id),
    gedaan: () => toonGedaanForm(id),
    'gedaan-terug': () => wisselGroot(laag.dataset.soort === 'doos-gedaan' ? 'doos' : 'open'),
    'terug-op-bord': () => terugUitDoos(id),
    'op-kaart': () => toonOpKaart(id),
    'nog-eens': async () => {
      await terughangen()
      trekBriefje()
    },
  }
  doe[knop.dataset.laag]?.()
})

// Knoppen in de panelen van M3 (borden, koppelen, wie ben jij, delen).
function samenActie(knop) {
  const d = knop.dataset
  if (d.borden === 'kies') return wisselBord(d.bord)
  if (d.borden === 'nieuw') return openNieuwBord()
  if (d.borden === 'koppel') return openKoppelPlak()
  if (d.borden === 'lijst') return openBorden()
  if (d.borden === 'verlaat') return verlaatBord()
  if (d.koppel === 'ja') return haalEnKoppel()
  if (d.koppel === 'kopieer') return kopieerKoppel()
  if (d.koppel === 'nee') {
    ui.koppel = null
    return sluitLaag()
  }
  if (d.wie) return voltooiKoppel(d.wie)
  if (d.delen === 'deel') return deelLink()
  if (d.delen === 'nu') {
    laatsteActiviteit[staat.bord] = Date.now()
    motor.ronde(staat.bord).then(plannPeil)
  }
}

// ---------- Categorie-editor (§5.6) ----------
// Per bord: toevoegen, hernoemen, emoji, kleur, volgorde en verbergen.
// Een categorie wordt nooit gewist, alleen verborgen (model.js).

const KLEURNAMEN = { zon: 'geel', perzik: 'perzik', koraal: 'koraal', roze: 'roze', lila: 'lila', lucht: 'lichtblauw', mint: 'mint', salie: 'saliegroen', zand: 'zand', wit: 'wit' }
const EMOJI_KEUS = ['🏝️', '🧳', '🎡', '🍝', '🍽️', '🥘', '✅', '⭐', '🎬', '📚', '🎵', '🎁', '🏃', '🚲', '🏕️', '🌍', '🛒', '🏠', '🎉', '💡', '🐶', '🌱', '☕', '💝']

function catInfo(bd, id) {
  return categorieen(bd, { metVerborgen: true }).find((c) => c.id === id)
}

function openCats(focus) {
  const bd = bord()
  const alle = categorieen(bd, { metVerborgen: true })
  const zicht = alle.filter((c) => !c.verborgen)
  const weg = alle.filter((c) => c.verborgen)
  const aantal = (id) => {
    const n = catGebruikt(bd, id)
    return n ? meervoud(n, 'briefje', 'briefjes') : 'nog leeg'
  }
  const rij = (c, i) => `
    <div class="rij cat-rij">
      <button type="button" class="cat-knop" data-cats="bewerk" data-cat="${c.id}">
        <span class="cat-staal papier-${c.kleur}" aria-hidden="true">${c.emoji}</span>
        <span class="rij-tekst"><strong>${esc(c.naam)}</strong><span class="klein">${aantal(c.id)}</span></span>
      </button>
      ${
        c.verborgen
          ? `<button type="button" class="knop klein-knop" data-cats="toon" data-cat="${c.id}">Laten zien</button>`
          : `<button type="button" class="cat-pijl" data-cats="op" data-cat="${c.id}" aria-label="${esc(c.naam)} omhoog" ${i === 0 ? 'disabled' : ''}>▲</button>
             <button type="button" class="cat-pijl" data-cats="neer" data-cat="${c.id}" aria-label="${esc(c.naam)} omlaag" ${i === zicht.length - 1 ? 'disabled' : ''}>▼</button>`
      }
    </div>`
  openLaag(
    `
    <div class="paneel">
      <h2 id="laag-titel">🏷️ Categorieën</h2>
      <p class="paneel-uitleg">Voor het bord <strong>${esc(waarde(bd.info, 'naam', 'Prikbord'))}</strong>. Elke categorie heeft zijn eigen kleur papier. Tik op een categorie om hem aan te passen.</p>
      <div class="groep">${zicht.map(rij).join('')}</div>
      <button type="button" class="knop blok-knop" data-cats="nieuw">＋ Nieuwe categorie</button>
      ${
        weg.length
          ? `<h3 class="groep-kop">🙈 Verborgen</h3>
             <p class="paneel-uitleg">Die kies je niet meer voor een nieuw briefje, maar oude briefjes houden hun kleur.</p>
             <div class="groep">${weg.map(rij).join('')}</div>`
          : ''
      }
      <button type="button" class="knop primair blok-knop" data-laag="sluit">Klaar <span aria-hidden="true">👍</span></button>
    </div>`,
    'cats',
  )
  // Na omhoog/omlaag de focus terug op dezelfde knop (of de andere pijl als die nu uit staat).
  if (focus) {
    const el = laag.querySelector(`[data-cats="${focus.actie}"][data-cat="${focus.id}"]`)
    const ander = laag.querySelector(`[data-cats="${focus.actie === 'op' ? 'neer' : 'op'}"][data-cat="${focus.id}"]`)
    ;(el && !el.disabled ? el : ander)?.focus({ preventScroll: true })
  }
}

function openCatBewerk(catId) {
  const bd = bord()
  const bezet = new Set(categorieen(bd, { metVerborgen: true }).map((c) => c.kleur))
  const c = catId ? catInfo(bd, catId) : { naam: '', emoji: '💡', kleur: PAPIER.find((k) => !bezet.has(k)) || 'zon', verborgen: false }
  if (!c) return openCats()
  const mijnKleur = lidVan(bd, ikId()).kleur
  openLaag(
    `
    <form class="paneel" id="cat-form" data-cat="${catId || ''}" novalidate>
      <h2 id="laag-titel">${catId ? 'Categorie aanpassen' : 'Nieuwe categorie'}</h2>
      <div class="briefje-plek cat-voorbeeld-plek" style="--px:50%">
        <div class="briefje cat-voorbeeld papier-${c.kleur} rand-4" id="cat-voorbeeld"><span class="tekst">${esc(c.emoji)} ${esc(c.naam || 'Nieuwe categorie')}</span></div>
        <span class="punaise pin-${mijnKleur}" aria-hidden="true"></span>
      </div>
      <label class="veld"><span>Naam</span>
        <input name="naam" value="${esc(c.naam)}" maxlength="40" autocomplete="off" placeholder="Bijv. Films kijken" /></label>
      <label class="veld"><span>Emoji</span>
        <input name="emoji" value="${esc(c.emoji)}" maxlength="16" autocomplete="off" class="emoji-veld" /></label>
      <div class="emoji-keus" role="group" aria-label="Kies een emoji">
        ${EMOJI_KEUS.map((e) => `<button type="button" data-emoji="${e}" aria-label="${e}">${e}</button>`).join('')}
      </div>
      <fieldset class="kleuren"><legend>Kleur van het papier</legend>
        ${PAPIER.map((k) => `<label class="kleur papier-${k}" title="${KLEURNAMEN[k]}"><input type="radio" name="kleur" value="${k}" ${k === c.kleur ? 'checked' : ''} /><span class="vh">${KLEURNAMEN[k]}</span></label>`).join('')}
      </fieldset>
      <p class="fout" id="cat-fout" role="alert"></p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-cats="lijst">Terug</button>
        <button type="submit" class="knop primair">${catId ? 'Bewaren' : 'Toevoegen'}</button>
      </div>
      ${catId && !c.verborgen ? `<button type="button" class="knop-tekst" data-cats="verberg" data-cat="${catId}">🙈 Deze categorie verbergen</button>` : ''}
      ${catId && c.verborgen ? `<button type="button" class="knop-tekst" data-cats="toon" data-cat="${catId}">👀 Weer laten zien</button>` : ''}
    </form>`,
    'cat',
  )
  if (!catId) laag.querySelector('[name="naam"]').focus({ preventScroll: true })
}

function werkCatVoorbeeldBij(form) {
  const v = $('#cat-voorbeeld')
  if (!v) return
  const kleur = form.kleur.value || 'wit'
  v.className = v.className.replace(/papier-\w+/, `papier-${kleur}`)
  v.querySelector('.tekst').textContent = `${form.emoji.value.trim()} ${form.naam.value.trim() || 'Nieuwe categorie'}`
}

function bewaarCat(form) {
  const bd = bord()
  const now = Date.now()
  const naam = form.naam.value.trim()
  const emoji = form.emoji.value.trim() || '📌'
  const kleur = form.kleur.value
  const fout = $('#cat-fout')
  if (CAT_SCHOON.naam(naam) === undefined) {
    fout.textContent = 'Geef de categorie een naam ✍️'
    return form.naam.focus()
  }
  if (CAT_SCHOON.emoji(emoji) === undefined) {
    fout.textContent = 'Kies één emoji (of laat het vakje leeg)'
    return form.emoji.focus()
  }
  const id = form.dataset.cat
  if (id) {
    zetCat(bd, id, 'naam', naam, now)
    zetCat(bd, id, 'emoji', emoji, now)
    zetCat(bd, id, 'kleur', kleur, now)
  } else nieuweCat(bd, { naam, emoji, kleur, now })
  opslaan()
  openCats()
  toast(id ? '✍️ Bewaard' : `🏷️ ${naam} staat erbij!`)
}

function catActie(knop) {
  const bd = bord()
  const id = knop.dataset.cat
  if (knop.dataset.emoji) {
    const form = knop.closest('form')
    form.emoji.value = knop.dataset.emoji
    if (form.id === 'cat-form') werkCatVoorbeeldBij(form)
    return
  }
  const actie = knop.dataset.cats
  if (actie === 'bewerk') return openCatBewerk(id)
  if (actie === 'nieuw') return openCatBewerk(null)
  if (actie === 'lijst') return openCats()
  if (actie === 'op' || actie === 'neer') {
    if (verschuifCat(bd, id, actie === 'op' ? -1 : 1, Date.now())) opslaan()
    return openCats({ actie, id })
  }
  if (actie === 'verberg') {
    if (categorieen(bd).length <= 1) return alert('Je hebt minstens één categorie nodig.')
    zetCat(bd, id, 'verborgen', true, Date.now())
    opslaan()
    openCats()
    return toast('🙈 Verborgen. Terugzetten kan onderaan de lijst.')
  }
  if (actie === 'toon') {
    zetCat(bd, id, 'verborgen', false, Date.now())
    opslaan()
    openCats()
    return toast('👀 Hij doet weer mee!')
  }
}

// ---------- Samen: sync, borden, koppelen en leden (M3) ----------
// Het rekenwerk staat in sync.js (de motor) en de worker; hier zit het scherm
// eromheen: het statusbolletje, peilen, meldingen, en de panelen voor borden,
// delen, koppelen en "wie ben jij".

const syncStatus = {} // per bord: { status, fout, om, sinds, vorige }
const tijdje = (t) => new Date(t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
const mijnNaam = () => staat.apparaat.naam || GEEN_NAAM
// Safari op de iPhone, niet als app op het beginscherm: die twee bewaren hun
// briefjes apart (uit mijn kennis van iOS, niet getest op een toestel).
const IOS_SAFARI = 'standalone' in navigator && !navigator.standalone

// Niet eindeloos wachten op een sync-server die niet antwoordt. En op weg
// naar de achtergrond de laatste wijziging nog meegeven (keepalive kan tot
// 64 KB). Lukt dat niet, dan blijft hij in het verschil staan.
function syncFetch(url, init = {}) {
  const extra = {}
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) extra.signal = AbortSignal.timeout(20_000)
  if (document.visibilityState === 'hidden' && (init.body?.length || 0) < 60_000) extra.keepalive = true
  return fetch(url, { ...init, ...extra })
}

const motor = maakSync({
  fetch: syncFetch,
  lees: (id) => staat.borden[id],
  schrijf: naSync,
  adres: (id) => koppelingen.borden[id] || null,
  online: () => navigator.onLine !== false,
  opStatus: zetStatus,
})

// Het bolletje springt pas op "bezig" als een ronde langer dan een halve
// seconde duurt; anders knippert het bij elke peiling.
let bezigTimer = 0
function zetStatus(id, { status, fout = '' }) {
  const vorig = syncStatus[id] || {}
  const vorige = status === 'bezig' ? (vorig.status === 'bezig' ? vorig.vorige : vorig.status) : null
  syncStatus[id] = { status, fout, om: status === 'ok' ? Date.now() : vorig.om, sinds: Date.now(), vorige }
  if (id !== staat.bord) return
  tekenStatus()
  clearTimeout(bezigTimer)
  if (status === 'bezig') bezigTimer = setTimeout(tekenStatus, 600)
}
function getoondeStatus(id) {
  const s = syncStatus[id]
  if (!s) return 'bezig'
  if (s.status === 'bezig' && s.vorige && Date.now() - s.sinds < 500) return s.vorige
  return s.status
}
function statusTekst(id = staat.bord) {
  if (!gedeeld(id)) return 'Alleen op deze telefoon'
  const s = syncStatus[id] || {}
  const st = getoondeStatus(id)
  if (st === 'offline') return '📵 Offline: je wijzigingen gaan mee zodra het weer lukt'
  if (st === 'fout') return `⚠️ ${s.fout}. Je wijzigingen gaan mee zodra het weer lukt.`
  if (st === 'ok' && s.om) return `✅ Gesynchroniseerd om ${tijdje(s.om)}`
  return '⏳ Bezig met synchroniseren…'
}
function tekenStatus() {
  const dot = $('#sync-dot')
  if (dot) {
    dot.hidden = !gedeeld()
    dot.dataset.status = getoondeStatus(staat.bord)
    dot.title = statusTekst()
  }
  for (const el of document.querySelectorAll('[data-sync-status]')) el.textContent = statusTekst()
}

// Iets van de anderen binnengekomen (de motor voegde het al samen).
function naSync(id, samen, oud) {
  if (!staat.borden[id]) return
  staat.borden[id] = samen
  laatsteActiviteit[id] = Date.now()
  const ik = staat.apparaat.ik[id]
  const binnen = Object.values(samen.briefjes).filter((b) => !oud.briefjes[b.id] && !b.weg && !waarde(b.v, 'gedaan') && b.door !== ik)
  if (binnen.length) staat.apparaat.nieuw[id] = [...new Set([...(staat.apparaat.nieuw[id] || []), ...binnen.map((b) => b.id)])].slice(-500)
  // Gewoon bewaren, zonder nieuwe sync: dit kwam juist van de server.
  bewaar(staat, opslagFout)
  if (id !== staat.bord) return tekenKop()
  if (binnen.length && ui.syncKlaar && document.visibilityState === 'visible') meldBinnen(samen, binnen)
  tekenNaSync()
}

// Een melding pas als de vorige met "Ongedaan maken" weg is.
function meldLater(tekst) {
  setTimeout(() => toast(tekst, { ms: 3500 }), Math.max(0, (ui.toastTot || 0) - Date.now()))
}
function meldBinnen(bd, lijst) {
  const namen = [...new Set(lijst.map((b) => lidVan(bd, b.door).naam))]
  const tekst = waarde(lijst[0].v, 'tekst', '')
  const kort = tekst.length > 40 ? `${tekst.slice(0, 38)}…` : tekst
  if (lijst.length === 1) meldLater(`📌 ${namen[0]} prikte '${kort}'`)
  else if (namen.length === 1) meldLater(`📌 ${namen[0]} prikte ${lijst.length} briefjes`)
  else meldLater(`📌 ${lijst.length} nieuwe briefjes`)
}

// Het bord bijwerken, maar niet midden in een animatie of sleepbeweging.
let naSyncLater = 0
function tekenNaSync() {
  clearTimeout(naSyncLater)
  if (ui.bezig || vrijApi?.bezig()) {
    naSyncLater = setTimeout(tekenNaSync, 400)
    return
  }
  const soort = laag.open ? laag.dataset.soort : ''
  if (['open', 'trek', 'doos'].includes(soort)) {
    const id = laag.querySelector('.groot')?.dataset.id
    const b = id && bord().briefjes[id]
    if (!b || b.weg) {
      sluitDirect()
      meldLater('🗑️ Dit briefje is net door een ander weggehaald')
    } else if (JSON.stringify(b) !== ui.grootVan) wisselGroot(soort)
  }
  render()
}

// Wijzigingen 1,5 s bundelen (max. 6 s), zodat een reeks hartjes of een
// sleepbeweging één schrijfactie wordt. Dan alle gedeelde borden met iets
// nieuws versturen (ook een bord waar je net vandaan kwam).
let bundel = null
function syncStraks() {
  const nu = Date.now()
  if (!bundel) bundel = { sinds: nu, timer: 0 }
  clearTimeout(bundel.timer)
  bundel.timer = setTimeout(stuurGewijzigd, Math.max(0, Math.min(bundel.sinds + BUNDEL_MAX_MS, nu + BUNDEL_MS) - nu))
}
function stuurGewijzigd() {
  if (bundel) clearTimeout(bundel.timer)
  bundel = null
  for (const id of Object.keys(koppelingen.borden)) if (staat.borden[id] && motor.heeftIets(id)) motor.ronde(id)
}

// Peilen: alleen het actieve bord, alleen als de app in beeld is. Elke 10 s
// als er de laatste 5 minuten iets gebeurde, anders elke 30 s.
let peilTimer = 0
function plannPeil() {
  clearTimeout(peilTimer)
  if (!gedeeld() || document.visibilityState !== 'visible') return
  peilTimer = setTimeout(async () => {
    await motor.ronde(staat.bord)
    probeerMisteFotos()
    plannPeil()
  }, peilInterval(Date.now(), laatsteActiviteit[staat.bord] || 0))
}

// Bij het openen van de app: één keer alle gedeelde borden (het actieve
// eerst), voor de stand en het "nieuw"-tellertje.
async function startSync() {
  const ids = Object.keys(koppelingen.borden)
    .filter((id) => staat.borden[id])
    .sort((a, b) => (b === staat.bord) - (a === staat.bord))
  for (const id of ids) await motor.ronde(id)
  ui.syncKlaar = true
  const n = aantalNieuw(staat.bord)
  if (n && document.visibilityState === 'visible') meldLater(`📌 ${meervoud(n, 'nieuw briefje', 'nieuwe briefjes')} sinds je vorige bezoek`)
  plannPeil()
}

// Een briefje openen = gezien: het stickertje gaat eraf.
function zagHet(id) {
  const lijst = staat.apparaat.nieuw[staat.bord]
  if (!lijst?.includes(id)) return
  const over = lijst.filter((x) => x !== id)
  if (over.length) staat.apparaat.nieuw[staat.bord] = over
  else delete staat.apparaat.nieuw[staat.bord]
  ui.getoond.delete(id)
  bewaar(staat, opslagFout)
  const el = view.querySelector(`.briefje-plek[data-id="${id}"]`)
  if (el) {
    el.querySelector('.nieuw-sticker')?.remove()
    el.binnen = '' // volgende keer opnieuw tekenen (ook de tekst voor schermlezers)
  }
}

// Weg uit de app of naar een ander bord: wat met een stickertje in beeld
// was, is gezien. De volgende keer zijn die stickertjes weg.
function wisGezien() {
  if (!ui.getoond.size) return
  const over = (staat.apparaat.nieuw[staat.bord] || []).filter((x) => !ui.getoond.has(x))
  if (over.length) staat.apparaat.nieuw[staat.bord] = over
  else delete staat.apparaat.nieuw[staat.bord]
  ui.getoond.clear()
  bewaar(staat, opslagFout)
}

// Wie je bent op de borden waar je nog "Ik" heette.
function kiesNaam(naam) {
  staat.apparaat.naam = naam
  const now = Date.now()
  for (const [id, bd] of Object.entries(staat.borden)) {
    const ik = staat.apparaat.ik[id]
    if (ik && bd.leden[ik] && waarde(bd.leden[ik], 'naam') === GEEN_NAAM) zetLid(bd, ik, 'naam', naam, now)
  }
  opslaan()
}

// ----- Welkom: wie ben jij? (eerste start) -----

function openWelkom({ daarna = null } = {}) {
  ui.naWelkom = daarna
  openLaag(
    `
    <form class="paneel welkom" id="welkom-form" novalidate>
      <div class="briefje-plek welkom-plek" style="--px:50%">
        <div class="briefje welkom-papier papier-zon rand-6">
          <h2 class="welkom-kop" id="laag-titel">Hoi! Welkom bij het Prikbord 📌</h2>
          <p class="welkom-tekst">Hoe heet je? Dan zien de anderen straks wie wat prikte.</p>
          <input name="naam" maxlength="40" autocomplete="given-name" placeholder="Je naam ✍️" aria-label="Je naam" enterkeyhint="done" />
        </div>
        <span class="punaise pin-rood" aria-hidden="true"></span>
      </div>
      <p class="fout" id="welkom-fout" role="alert"></p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-laag="sluit">Later</button>
        <button type="submit" class="knop primair">Dit ben ik! <span aria-hidden="true">👋</span></button>
      </div>
      <p class="paneel-uitleg welkom-voet">Aanpassen kan altijd onder Meer → Wie ben ik.</p>
    </form>`,
    'welkom',
  )
  laag.querySelector('[name="naam"]').focus({ preventScroll: true })
}

function bewaarWelkom(form) {
  const naam = form.naam.value.trim()
  if (LID_SCHOON.naam(naam) === undefined) {
    $('#welkom-fout').textContent = 'Vul je naam in ✍️'
    return form.naam.focus()
  }
  kiesNaam(naam)
  const daarna = ui.naWelkom
  ui.naWelkom = null
  if (daarna === 'delen') return openDelen()
  metRust(async () => {
    await vervaagLaag(laag)
    sluitDirect()
  })
  toast(`👋 Hoi ${naam}!`)
}

// ----- Alle borden -----

const BORD_EMOJI = ['🏠', '🧳', '✈️', '🏖️', '⛺', '🎉', '🍽️', '💡', '❤️', '🎄', '🛠️', '📚']

function metWie(bd) {
  if (!gedeeld(bd.id)) return 'Alleen op deze telefoon'
  const ik = staat.apparaat.ik[bd.id]
  const namen = ledenVan(bd)
    .filter((l) => l.id !== ik)
    .map((l) => l.naam)
  if (!namen.length) return 'Gedeeld · nog niemand anders erbij'
  const eerst = namen.slice(0, 2)
  const rest = namen.length - eerst.length
  return `Samen met ${rest > 0 ? `${eerst.join(', ')} en ${meervoud(rest, 'ander', 'anderen')}` : eerst.join(' en ')}`
}

function openBorden() {
  const lijst = Object.values(staat.borden).sort((a, b) => waarde(a.info, 'naam', '').localeCompare(waarde(b.info, 'naam', ''), 'nl') || (a.id < b.id ? -1 : 1))
  const rij = (bd) => {
    const actief = bd.id === staat.bord
    const n = aantalNieuw(bd.id)
    return `
      <button type="button" class="rij bord-rij" data-borden="kies" data-bord="${bd.id}" ${actief ? 'aria-current="true"' : ''}>
        <span class="rij-icoon" aria-hidden="true">${esc(waarde(bd.info, 'emoji', '📌'))}</span>
        <span class="rij-tekst"><strong>${esc(waarde(bd.info, 'naam', 'Prikbord'))}</strong>
          <span class="klein">${esc(metWie(bd))}</span>
          ${actief && gedeeld(bd.id) ? `<span class="klein" data-sync-status>${esc(statusTekst())}</span>` : ''}</span>
        ${n ? `<span class="nieuw-tal">${n} nieuw</span>` : ''}
        <span class="rij-pijl" aria-hidden="true">${actief ? '✓' : '›'}</span>
      </button>`
  }
  openLaag(
    `
    <div class="paneel">
      <h2 id="laag-titel">📋 Je borden</h2>
      <p class="paneel-uitleg">Wissel van bord, begin een nieuw bord, of doe mee met het bord van een ander.</p>
      <div class="groep">${lijst.map(rij).join('')}</div>
      <button type="button" class="knop blok-knop" data-borden="nieuw">＋ Nieuw bord</button>
      <button type="button" class="knop blok-knop" data-borden="koppel"><span aria-hidden="true">🔗</span> Ik heb een koppel-link</button>
      <button type="button" class="knop primair blok-knop" data-laag="sluit">Sluiten</button>
    </div>`,
    'borden',
  )
}

function wisselBord(id) {
  if (!staat.borden[id]) return
  zetWegDoor()
  wisGezien()
  const anders = id !== staat.bord
  staat.bord = id
  ui.filter = ALLES
  ui.getrokken = null
  opslaan()
  sluitDirect()
  ui.tab = 'bord'
  scrollTo(0, 0)
  render(true)
  if (anders) meld(`Bord ${waarde(bord().info, 'naam', '')}`)
  if (gedeeld(id)) motor.ronde(id)
  plannPeil()
}

function openNieuwBord() {
  openLaag(
    `
    <form class="paneel" id="bord-nieuw-form" novalidate>
      <h2 id="laag-titel">📋 Nieuw bord</h2>
      <p class="paneel-uitleg">Bijvoorbeeld voor een groepsreis, een verbouwing of een verjaardag. Delen met anderen kan straks onder Meer.</p>
      <label class="veld"><span>Naam</span>
        <input name="naam" maxlength="60" autocomplete="off" placeholder="Bijv. Groepsreis Porto" /></label>
      <label class="veld"><span>Emoji</span>
        <input name="emoji" value="🧳" maxlength="16" autocomplete="off" class="emoji-veld" /></label>
      <div class="emoji-keus" role="group" aria-label="Kies een emoji">
        ${BORD_EMOJI.map((e) => `<button type="button" data-emoji="${e}" aria-label="${e}">${e}</button>`).join('')}
      </div>
      <fieldset class="sjablonen"><legend>Beginnen met</legend>
        <label class="sjabloon"><input type="radio" name="sjabloon" value="thuis" checked />
          <span><strong>🏠 De thuis-categorieën</strong><span class="klein">Vakantie, uit eten, recepten, to do, bucketlist …</span></span></label>
        <label class="sjabloon"><input type="radio" name="sjabloon" value="leeg" />
          <span><strong>✨ Leeg</strong><span class="klein">Eén categorie; de rest maak je zelf</span></span></label>
      </fieldset>
      <p class="fout" id="bord-fout" role="alert"></p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-borden="lijst">Terug</button>
        <button type="submit" class="knop primair">Bord maken</button>
      </div>
    </form>`,
    'nieuw-bord',
  )
  laag.querySelector('[name="naam"]').focus({ preventScroll: true })
}

function maakNieuwBord(form) {
  const naam = form.naam.value.trim()
  const emoji = form.emoji.value.trim() || '📌'
  const fout = $('#bord-fout')
  if (INFO_SCHOON.naam(naam) === undefined) {
    fout.textContent = 'Geef het bord een naam ✍️'
    return form.naam.focus()
  }
  if (INFO_SCHOON.emoji(emoji) === undefined) {
    fout.textContent = 'Kies één emoji (of laat het vakje leeg)'
    return form.emoji.focus()
  }
  const now = Date.now()
  const bd = nieuwBord({ naam, emoji, sjabloon: form.sjabloon.value === 'leeg' ? 'leeg' : 'thuis', now })
  staat.apparaat.ik[bd.id] = voegLidToe(bd, { naam: mijnNaam(), now })
  staat.borden = Object.fromEntries(
    Object.entries({ ...staat.borden, [bd.id]: bd }).sort(([a], [b]) => (a < b ? -1 : 1)),
  )
  wisselBord(bd.id)
  toast(`${emoji} ${naam} staat klaar! Scheur er een briefje af.`)
}

// ----- Koppelen: een koppel-link openen of plakken -----

function openKoppelPlak() {
  openLaag(
    `
    <form class="paneel" id="koppel-form" novalidate>
      <h2 id="laag-titel">🔗 Koppel-link</h2>
      <p class="paneel-uitleg">Kreeg je een link om mee te prikken? Plak hem hier. Het hele berichtje mag ook.</p>
      <label class="veld"><span>De link</span>
        <textarea name="link" rows="3" autocomplete="off" spellcheck="false" class="link-veld" placeholder="https://…/prikbord/#koppel=…"></textarea></label>
      <p class="fout" id="koppel-fout" role="alert"></p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-borden="lijst">Terug</button>
        <button type="submit" class="knop primair">Verder</button>
      </div>
    </form>`,
    'koppel',
  )
  laag.querySelector('[name="link"]').focus({ preventScroll: true })
}

function leesGeplakt(form) {
  const k = leesKoppel(form.link.value)
  if (!k) {
    $('#koppel-fout').textContent = 'Dit lijkt geen koppel-link. Vraag de ander om hem nog eens te sturen.'
    return form.link.focus()
  }
  openKoppelJa({ ...k, link: form.link.value.trim() })
}

// "Bord 'Groepsreis Porto' toevoegen?"
function openKoppelJa(k) {
  const al = Object.entries(koppelingen.borden).find(([id, x]) => x.r === k.r && staat.borden[id])
  if (al) {
    wisselBord(al[0])
    toast('👍 Dit bord staat al op je telefoon')
    return
  }
  ui.koppel = k
  openLaag(
    `
    <div class="paneel" id="koppel-ja">
      <h2 id="laag-titel">🤝 Bord '${esc(k.n)}' toevoegen?</h2>
      <p class="paneel-uitleg">Je ziet dan alle briefjes op dit bord, en de anderen zien wat jij prikt. Wat je al hebt, blijft gewoon staan.</p>
      ${
        IOS_SAFARI
          ? `<div class="tip-briefje papier-zon rand-3">
              <p><strong>📱 Staat het Prikbord op je beginscherm?</strong> Open dan de app, tik bovenin op de naam van het bord en kies <strong>Ik heb een koppel-link</strong>. Plak daar deze link. Safari en de app op je beginscherm bewaren hun briefjes namelijk apart.</p>
              <button type="button" class="knop klein-knop" data-koppel="kopieer">📋 Link kopiëren</button>
            </div>`
          : ''
      }
      <p class="fout" id="koppel-fout" role="alert"></p>
      <div class="laag-knoppen" id="koppel-knoppen">
        <button type="button" class="knop" data-koppel="nee">Nee, toch niet</button>
        <button type="button" class="knop primair" data-koppel="ja">Toevoegen <span aria-hidden="true">🤝</span></button>
      </div>
    </div>`,
    'koppel-ja',
  )
}

async function haalEnKoppel() {
  const k = ui.koppel
  const knoppen = $('#koppel-knoppen')
  if (!k || !knoppen) return
  const ja = knoppen.querySelector('[data-koppel="ja"]')
  for (const b of knoppen.querySelectorAll('button')) b.disabled = true
  $('#koppel-fout').textContent = ''
  ja.textContent = '⏳ Bord ophalen…'
  let uit
  try {
    uit = await haalBord(syncFetch, k)
  } catch (err) {
    uit = { fout: err.message }
  }
  // Intussen weggeklikt?
  if (ui.koppel !== k || laag.dataset.soort !== 'koppel-ja') return
  if (uit.fout || !uit.bord) {
    $('#koppel-fout').textContent = uit.fout || 'Dit bord staat nog niet op de sync-server. Vraag wie de link stuurde om de app even te openen (met internet), en probeer het dan opnieuw.'
    for (const b of knoppen.querySelectorAll('button')) b.disabled = false
    ja.textContent = 'Opnieuw proberen'
    return
  }
  k.server = uit
  // Stond dit bord al hier (bijv. uit een back-up), dan weten we wie je bent.
  const bekend = staat.apparaat.ik[uit.bord.id]
  if (bekend && uit.bord.leden[bekend]) return voltooiKoppel(bekend)
  openWie()
}

// "Wie ben jij?" op een bord waar je net bij komt. Al lid (andere telefoon
// of tablet)? Dan "Dit ben ik al", zodat je hartjes niet dubbel tellen.
function openWie() {
  const bd = ui.koppel.server.bord
  const leden = ledenVan(bd)
  openLaag(
    `
    <form class="paneel" id="wie-form" novalidate>
      <h2 id="laag-titel">🙋 Wie ben jij?</h2>
      ${
        leden.length
          ? `<p class="paneel-uitleg">Heb je '${esc(waarde(bd.info, 'naam', ui.koppel.n))}' al op een andere telefoon of tablet? Kies dan jezelf, dan tellen je hartjes niet dubbel.</p>
             <div class="groep">${leden
               .map(
                 (l) => `
               <button type="button" class="rij wie-rij" data-wie="${l.id}" aria-label="Dit ben ik al: ${esc(l.naam)}">
                 <span class="pin-bol pin-${l.kleur}" aria-hidden="true"></span>
                 <span class="rij-tekst"><strong>${esc(l.naam)}</strong></span>
                 <span class="wie-knop" aria-hidden="true">Dit ben ik al</span>
               </button>`,
               )
               .join('')}</div>
             <h3 class="groep-kop">Nieuw op dit bord?</h3>`
          : '<p class="paneel-uitleg">Je bent de eerste op dit bord! 🎉</p>'
      }
      <label class="veld"><span>Je naam</span>
        <input name="naam" value="${esc(staat.apparaat.naam)}" maxlength="40" autocomplete="given-name" placeholder="Bijv. Tara" /></label>
      <p class="fout" id="wie-fout" role="alert"></p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-koppel="nee">Toch niet</button>
        <button type="submit" class="knop primair">Ik ben nieuw hier <span aria-hidden="true">👋</span></button>
      </div>
    </form>`,
    'wie',
  )
}

function nieuwLid(form) {
  const naam = form.naam.value.trim()
  if (LID_SCHOON.naam(naam) === undefined) {
    $('#wie-fout').textContent = 'Vul je naam in ✍️'
    return form.naam.focus()
  }
  voltooiKoppel(null, naam)
}

// Het bord op de telefoon zetten (of samenvoegen als het er al was) en
// meteen de eerste sync: dan weten de anderen dat je erbij bent.
function voltooiKoppel(lidId, naam) {
  const k = ui.koppel
  if (!k?.server?.bord) return
  const { rev, bord: vanServer } = k.server
  const id = vanServer.id
  const now = Date.now()
  motor.vergeet(id)
  motor.onthoud(id, rev, vanServer) // maakt een eigen kopie
  const bd = staat.borden[id] ? mergeBord(staat.borden[id], vanServer) : vanServer
  if (!lidId) {
    if (!staat.apparaat.naam) kiesNaam(naam)
    lidId = voegLidToe(bd, { naam, now })
  } else if (!staat.apparaat.naam) kiesNaam(lidVan(bd, lidId).naam)
  staat.borden = Object.fromEntries(
    Object.entries({ ...staat.borden, [id]: bd }).sort(([a], [b]) => (a < b ? -1 : 1)),
  )
  staat.apparaat.ik[id] = lidId
  koppelingen.borden[id] = { u: k.u, r: k.r }
  bewaarSync(koppelingen)
  ui.koppel = null
  // Een leeg beginbord dat je nooit gebruikte, ruimen we op: anders heb je
  // na je eerste koppel-link twee borden die "Thuis" heten.
  for (const ander of Object.values(staat.borden)) if (ander.id !== id && onaangeroerd(ander)) haalVanTelefoon(ander.id)
  wisselBord(id)
  deelFotos(id)
  toast(`🤝 Welkom op '${waarde(bd.info, 'naam', k.n)}'!`)
}

async function kopieerKoppel() {
  try {
    await navigator.clipboard.writeText(ui.koppel?.link || '')
    toast('📋 Gekopieerd! Plak hem in de app op je beginscherm.')
  } catch {
    prompt('Kopieer deze link:', ui.koppel?.link || '')
  }
}

// ----- Delen: een koppel-link maken en versturen -----

function koppelLink(id = staat.bord) {
  const k = koppelingen.borden[id]
  return k ? maakKoppel(`${location.origin}${location.pathname}`, { u: k.u, r: k.r, n: waarde(staat.borden[id].info, 'naam', 'Prikbord') }) : ''
}

function openDelen() {
  // Eerst je naam, anders heet je bij de anderen "Ik".
  if (!staat.apparaat.naam) return openWelkom({ daarna: 'delen' })
  const bd = bord()
  const naam = waarde(bd.info, 'naam', 'Prikbord')
  if (!gedeeld()) {
    openLaag(
      `
      <form class="paneel" id="delen-form" novalidate>
        <h2 id="laag-titel">🤝 Samen prikken</h2>
        <p class="paneel-uitleg">Deel '${esc(naam)}' met een koppel-link. Wie hem opent, ziet alle briefjes en kan meeprikken, en jullie zien meteen wat de ander doet.</p>
        <p class="paneel-uitleg">🔐 Iedereen met deze link kan meekijken en prikken. Stuur hem alleen naar wie je erbij wilt hebben.</p>
        ${
          DEFAULT_SYNC_URL
            ? ''
            : `<label class="veld"><span>Adres van de sync-server</span>
                 <input name="url" type="url" inputmode="url" autocomplete="off" spellcheck="false" value="${esc(koppelingen.url)}" placeholder="https://prikbord.jouw-naam.workers.dev" /></label>`
        }
        <p class="fout" id="delen-fout" role="alert"></p>
        <div class="laag-knoppen">
          <button type="button" class="knop" data-laag="sluit">Later</button>
          <button type="submit" class="knop primair">Maak een koppel-link <span aria-hidden="true">🔗</span></button>
        </div>
      </form>`,
      'delen',
    )
    return
  }
  const ik = ikId()
  openLaag(
    `
    <div class="paneel">
      <h2 id="laag-titel">🤝 Samen prikken</h2>
      <p class="paneel-uitleg">Stuur deze link naar wie mee mag prikken op '${esc(naam)}'. 🔐 Iedereen met deze link kan meekijken en prikken.</p>
      <label class="veld"><span>Koppel-link</span>
        <input id="koppel-link" class="link-veld" readonly value="${esc(koppelLink())}" /></label>
      <button type="button" class="knop primair blok-knop" data-delen="deel"><span aria-hidden="true">🔗</span> Link delen</button>
      <h3 class="groep-kop">Op dit bord</h3>
      <div class="groep">${ledenVan(bd)
        .map((l) => `<div class="rij"><span class="pin-bol pin-${l.kleur}" aria-hidden="true"></span><span class="rij-tekst"><strong>${esc(l.naam)}${l.id === ik ? ' (jij)' : ''}</strong></span></div>`)
        .join('')}</div>
      <h3 class="groep-kop">Synchroniseren</h3>
      <div class="groep">
        <div class="rij"><span class="rij-icoon" aria-hidden="true">🔄</span><span class="rij-tekst"><span data-sync-status>${esc(statusTekst())}</span></span></div>
        <button type="button" class="rij" data-delen="nu"><span class="rij-icoon" aria-hidden="true">⚡</span><span class="rij-tekst"><strong>Nu synchroniseren</strong></span><span class="rij-pijl" aria-hidden="true">›</span></button>
      </div>
      <button type="button" class="knop primair blok-knop" data-laag="sluit">Klaar <span aria-hidden="true">👍</span></button>
    </div>`,
    'delen',
  )
}

function startDelen(form) {
  const url = schoonAdres(DEFAULT_SYNC_URL || form.url?.value)
  if (!url) {
    $('#delen-fout').textContent = 'Vul het https-adres van de sync-server in, bijv. https://prikbord.jouw-naam.workers.dev'
    return form.url?.focus()
  }
  if (!DEFAULT_SYNC_URL) koppelingen.url = url
  koppelingen.borden[staat.bord] = { u: url, r: nieuweCode() }
  bewaarSync(koppelingen)
  motor.vergeet(staat.bord)
  laatsteActiviteit[staat.bord] = Date.now()
  motor.ronde(staat.bord).then(plannPeil)
  deelFotos(staat.bord)
  openDelen()
  tekenStatus()
  // Nog binnen de tik: anders weigert de iPhone het deelmenu.
  deelLink()
}

async function deelLink() {
  const url = koppelLink()
  const naam = waarde(bord().info, 'naam', 'Prikbord')
  if (navigator.share) {
    ui.bezig++
    try {
      await navigator.share({ title: `Prikbord: ${naam}`, text: `Prik je mee op '${naam}'? 📌`, url })
      return
    } catch (err) {
      if (err.name === 'AbortError') return
    } finally {
      ui.bezig--
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast('🔗 Link gekopieerd! Plak hem in een appje.')
  } catch {
    $('#koppel-link')?.select()
    toast('🔗 Kopieer de link hierboven')
  }
}

// ----- Wie ben ik (naam en kleur op dit bord) -----

const PINNAMEN = { rood: 'rood', blauw: 'blauw', groen: 'groen', geel: 'geel', paars: 'paars', oranje: 'oranje', roze: 'roze', turkoois: 'turkoois' }

function openIk() {
  const bd = bord()
  const ik = lidVan(bd, ikId())
  const anderen = new Map(
    ledenVan(bd)
      .filter((l) => l.id !== ik.id)
      .map((l) => [l.kleur, l.naam]),
  )
  openLaag(
    `
    <form class="paneel" id="ik-form" novalidate>
      <h2 id="laag-titel">🙋 Wie ben ik?</h2>
      <p class="paneel-uitleg">Op '${esc(waarde(bd.info, 'naam', 'Prikbord'))}'. Je naam staat bij wat je prikt, en je punaises en hartjes hebben jouw kleur.</p>
      <label class="veld"><span>Je naam</span>
        <input name="naam" value="${esc(ik.naam === GEEN_NAAM ? '' : ik.naam)}" maxlength="40" autocomplete="given-name" placeholder="Bijv. Oscar" /></label>
      <fieldset class="kleuren pin-keus"><legend>Kleur van je punaises</legend>
        ${PUNAISE.map((k) => {
          const van = anderen.get(k)
          return `<label class="kleur pin-${k}" title="${van ? `Ook van ${esc(van)}` : PINNAMEN[k]}"><input type="radio" name="kleur" value="${k}" ${k === ik.kleur ? 'checked' : ''} /><span class="vh">${PINNAMEN[k]}${van ? `, ook van ${esc(van)}` : ''}</span>${van ? `<span class="pin-van" aria-hidden="true">${esc([...van][0].toUpperCase())}</span>` : ''}</label>`
        }).join('')}
      </fieldset>
      <p class="fout" id="ik-fout" role="alert"></p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-laag="sluit">Terug</button>
        <button type="submit" class="knop primair">Bewaren</button>
      </div>
    </form>`,
    'ik',
  )
}

function bewaarIk(form) {
  const naam = form.naam.value.trim()
  if (LID_SCHOON.naam(naam) === undefined) {
    $('#ik-fout').textContent = 'Vul je naam in ✍️'
    return form.naam.focus()
  }
  const now = Date.now()
  kiesNaam(naam)
  zetLid(bord(), ikId(), 'naam', naam, now)
  zetLid(bord(), ikId(), 'kleur', form.kleur.value, now)
  opslaan()
  sluitDirect()
  toast('🙋 Bewaard!')
}

// ----- Dit bord: naam, emoji en verlaten -----

function openBordInstel() {
  const bd = bord()
  const emoji = waarde(bd.info, 'emoji', '📌')
  openLaag(
    `
    <form class="paneel" id="bord-form" novalidate>
      <h2 id="laag-titel">${esc(emoji)} Dit bord</h2>
      <p class="paneel-uitleg">${gedeeld() ? 'Een nieuwe naam of emoji zien de anderen ook.' : 'Dit bord staat alleen op deze telefoon.'}</p>
      <label class="veld"><span>Naam</span>
        <input name="naam" value="${esc(waarde(bd.info, 'naam', ''))}" maxlength="60" autocomplete="off" /></label>
      <label class="veld"><span>Emoji</span>
        <input name="emoji" value="${esc(emoji)}" maxlength="16" autocomplete="off" class="emoji-veld" /></label>
      <div class="emoji-keus" role="group" aria-label="Kies een emoji">
        ${BORD_EMOJI.map((e) => `<button type="button" data-emoji="${e}" aria-label="${e}">${e}</button>`).join('')}
      </div>
      <p class="fout" id="bord-fout" role="alert"></p>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-laag="sluit">Terug</button>
        <button type="submit" class="knop primair">Bewaren</button>
      </div>
      <button type="button" class="knop-tekst" data-borden="verlaat">👋 Dit bord verlaten</button>
    </form>`,
    'bord',
  )
}

function bewaarBordInstel(form) {
  const naam = form.naam.value.trim()
  const emoji = form.emoji.value.trim() || '📌'
  if (INFO_SCHOON.naam(naam) === undefined) {
    $('#bord-fout').textContent = 'Geef het bord een naam ✍️'
    return form.naam.focus()
  }
  if (INFO_SCHOON.emoji(emoji) === undefined) {
    $('#bord-fout').textContent = 'Kies één emoji (of laat het vakje leeg)'
    return form.emoji.focus()
  }
  const now = Date.now()
  zetInfo(bord(), 'naam', naam, now)
  zetInfo(bord(), 'emoji', emoji, now)
  opslaan()
  sluitDirect()
  toast('✍️ Bewaard')
}

// Geen briefjes, niet gedeeld en de naam, emoji en categorieën nooit aangepast.
function onaangeroerd(bd) {
  if (Object.keys(bd.briefjes).length || gedeeld(bd.id)) return false
  const registers = [...Object.values(bd.info), ...Object.values(bd.cats).flatMap((c) => Object.values(c))]
  return registers.every((r) => r.t === bd.gemaakt)
}

// Een bord van deze telefoon halen, met alles wat erbij hoort.
function haalVanTelefoon(id) {
  delete staat.borden[id]
  for (const m of ['ik', 'weergave', 'sorteer', 'laatsteCat', 'nieuw']) delete staat.apparaat[m][id]
  if (staat.apparaat.concept?.bord === id) staat.apparaat.concept = null
  delete koppelingen.borden[id]
  bewaarSync(koppelingen)
  motor.vergeet(id)
  delete syncStatus[id]
  // Foto's die nog naar de anderen moesten: niet meer (de wachtrij ruimt ze op).
  verstuurFotos()
}

// Bord verlaten haalt het alleen van deze telefoon weg (§5.1). Was het je
// laatste bord, dan begin je met een vers bord "Thuis".
function verlaatBord(id = staat.bord) {
  const bd = staat.borden[id]
  if (!bd) return
  const naam = waarde(bd.info, 'naam', 'Prikbord')
  const samen = gedeeld(id)
  const vraag = samen
    ? `'${naam}' van deze telefoon halen? De anderen houden alles, en met de koppel-link kun je later terug.`
    : `'${naam}' staat alleen op deze telefoon. Verlaten = alle briefjes van dit bord weg. Twijfel je? Maak dan eerst een back-up. Toch verlaten?`
  if (!confirm(vraag)) return
  zetWegDoor()
  wisGezien()
  haalVanTelefoon(id)
  const over = Object.values(staat.borden).sort((a, b) => waarde(a.info, 'naam', '').localeCompare(waarde(b.info, 'naam', ''), 'nl'))
  if (over.length) staat.bord = over[0].id
  else {
    const vers = beginStaat(Date.now(), staat.apparaat.naam)
    staat.borden = vers.borden
    staat.bord = vers.bord
    staat.apparaat.ik = { ...vers.apparaat.ik }
  }
  sluitDirect()
  wisselBord(staat.bord)
  toast(samen ? `👋 Je hebt '${naam}' verlaten. De anderen houden alles.` : `👋 '${naam}' is weg`)
}

// ---------- Weghalen, met 5 tellen ongedaan maken (§6.2) ----------
// Een grafsteen is definitief (en gaat straks naar de anderen). Daarom eerst
// bevestigen en pas 5 tellen nadat "Ongedaan maken" verschijnt echt weghalen.
// Gaat de app eerder naar de achtergrond, dan gebeurt het meteen: je had het
// al bevestigd.

let wegWacht = null

async function haalWeg(id) {
  if (!id || !confirm('Dit briefje weghalen?')) return
  zetWegDoor()
  ui.verborgen.add(id)
  ui.open = null
  wegWacht = { id, bord: staat.bord, timer: 0 }
  render()
  const groot = $('.groot-plek', laag)
  await metRust(async () => {
    if (groot && !minderBeweging()) await valWeg(groot, laag)
    else await vervaagLaag(laag)
    sluitDirect()
  })
  if (!wegWacht || wegWacht.id !== id) return
  wegWacht.timer = setTimeout(zetWegDoor, 5000)
  toast('🗑️ Briefje weggehaald', {
    actie: 'Ongedaan maken',
    ms: 5000,
    opActie: () => {
      if (!wegWacht || wegWacht.id !== id) return
      clearTimeout(wegWacht.timer)
      wegWacht = null
      ui.verborgen.delete(id)
      render()
      // Terug op het bord, met punaise en al.
      const plek = view.querySelector(`.briefje-plek[data-id="${id}"]`)
      if (plek && !minderBeweging())
        prikIn(plek, () => {
          speel(tok)
          wiebelBuren(plek)
        })
    },
  })
}

function zetWegDoor() {
  if (!wegWacht) return
  const { id, bord: bordId, timer } = wegWacht
  clearTimeout(timer)
  wegWacht = null
  const bd = staat.borden[bordId]
  if (bd) verwijder(bd, id, Date.now())
  ui.verborgen.delete(id)
  opslaan()
}

// ---------- Wat is er nieuw ----------

function openChangelog(sinds = 0) {
  const regels = CHANGELOG.filter((e) => e.v > sinds)
  const bijgewerkt = sinds > 0
  openLaag(
    `
    <div class="nieuws">
      <div class="nieuws-pins" aria-hidden="true"><span>📌</span><span>📝</span><span>📌</span></div>
      <h2 id="laag-titel">${bijgewerkt ? 'Er hangt iets nieuws op het prikbord! ✨' : 'Wat is er nieuw ✨'}</h2>
      <p class="klein">${bijgewerkt ? `Bijgewerkt naar versie ${APP_VERSION}` : 'Alles wat er voor jullie gemaakt is'}</p>
      ${regels.map((e) => `<section><h3>📌 Versie ${e.v}</h3><ul>${e.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('')}
      <button type="button" class="knop primair blok-knop" data-laag="sluit">Leuk! 📌</button>
    </div>`,
    'nieuws',
  )
}

// Eenmalig na een update laten zien wat er nieuw is (§4.1, regel 6).
function toonNieuwsSindsVorigeKeer() {
  const nu = Number(APP_VERSION)
  const gezien = staat.apparaat.seenVersion
  staat.apparaat.seenVersion = nu
  opslaan()
  if (gezien > 0 && gezien < nu) openChangelog(gezien)
}

// ---------- Back-up ----------

function backupGemaakt() {
  staat.apparaat.laatsteBackup = Date.now()
  opslaan()
  const el = $('#laatste-backup')
  if (el) el.textContent = `Laatste back-up: ${fmtMoment(staat.apparaat.laatsteBackup)}`
}

// Een back-up als bestand: via het deelmenu (op de iPhone "Bewaar in
// Bestanden"), anders als download. Moet direct binnen een tik gebeuren,
// anders weigert Safari het deelmenu.
async function deelBestand(file) {
  if (navigator.canShare?.({ files: [file] })) {
    ui.bezig++
    try {
      await navigator.share({ files: [file], title: 'Prikbord back-up' })
      backupGemaakt()
      return
    } catch (err) {
      if (err.name === 'AbortError') return
    } finally {
      ui.bezig--
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  backupGemaakt()
}

// De back-up: de hele stand, en met foto's ook die als base64 (§6.4).
function backupBestand(fotoData = null) {
  bewaarNu(staat, opslagFout)
  const json = JSON.stringify(fotoData ? { ...staat, fotos: fotoData } : staat, null, fotoData ? 0 : 2)
  return new File([json], `prikbord-backup-${vandaagKey()}${fotoData ? '-met-fotos' : ''}.json`, { type: 'application/json' })
}

const fmtGrootte = (bytes) => (bytes > 900_000 ? `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

async function exporteer() {
  const ids = [...fotosVan(staat.borden)]
  // Geen foto's: meteen, zoals altijd.
  if (!ids.length) return deelBestand(backupBestand())
  const zonder = backupBestand()
  openLaag(
    `
    <div class="paneel" id="backup-keus">
      <h2 id="laag-titel">💾 Back-up maken</h2>
      <p class="paneel-uitleg">Er hangen foto's op je borden. Wil je die ook in de back-up?</p>
      <div class="groep">
        <button type="button" class="rij" data-backup="met" disabled>
          <span class="rij-icoon" aria-hidden="true">📸</span>
          <span class="rij-tekst"><strong>Met foto's</strong><span class="klein" id="backup-met">⏳ Even inpakken…</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
        <button type="button" class="rij" data-backup="zonder">
          <span class="rij-icoon" aria-hidden="true">📝</span>
          <span class="rij-tekst"><strong>Zonder foto's</strong><span class="klein">± ${fmtGrootte(zonder.size)} · alle briefjes, zonder de foto's zelf</span></span>
          <span class="rij-pijl" aria-hidden="true">›</span>
        </button>
      </div>
      <p class="paneel-uitleg">⚠️ Met foto's wordt het bestand groot. Mailen of in een appje sturen lukt dan misschien niet: bewaar hem liever in Bestanden of iCloud Drive.</p>
      <button type="button" class="knop primair blok-knop" data-laag="sluit">Annuleren</button>
    </div>`,
    'backup',
  )
  ui.backup = { zonder, met: null }
  const keus = ui.backup
  // Alvast inpakken: dan kan het deelmenu straks meteen open (binnen de tik).
  const fotoData = {}
  let n = 0
  for (const id of ids) {
    const blob = await fotos.leesFoto(id).catch(() => null)
    if (!blob) continue
    fotoData[id] = { type: blob.type || 'image/jpeg', data: naarBase64(new Uint8Array(await blob.arrayBuffer())) }
    n++
  }
  if (ui.backup !== keus || !$('#backup-keus')) return
  keus.met = backupBestand(fotoData)
  const missen = ids.length - n
  $('#backup-met').textContent = `± ${fmtGrootte(keus.met.size)} · ${meervoud(n, 'foto', "foto's")}${missen ? ` (${missen} nog niet op deze telefoon)` : ''}`
  laag.querySelector('[data-backup="met"]').disabled = false
}

laag.addEventListener('click', (e) => {
  const knop = e.target.closest('[data-backup]')
  if (!knop || !ui.backup) return
  const bestand = knop.dataset.backup === 'met' ? ui.backup.met : ui.backup.zonder
  if (!bestand) return
  ui.backup = null
  deelBestand(bestand)
  sluitDirect()
})

// Een gekozen foto: verkleinen, bewaren, en op het vel of bij "Gedaan!".
$('#foto-bestand').addEventListener('change', async (e) => {
  const bestand = e.target.files[0]
  e.target.value = ''
  const voor = ui.fotoVoor
  ui.fotoVoor = null
  if (!bestand) return
  if (voor === 'vel' && ui.vel) {
    const vel = ui.vel
    vel.fotoBezig = true
    tekenVelBijlagen()
    try {
      const id = await kiesFoto(bestand)
      if (ui.vel === vel) vel.foto = id
      meld('Foto erop geplakt')
    } catch (err) {
      if ($('#vel-fout')) $('#vel-fout').textContent = `📷 ${err.message}`
      else toast(`📷 ${err.message}`, { ms: 5000 })
    } finally {
      vel.fotoBezig = false
      if (ui.vel === vel) {
        tekenVelBijlagen()
        bewaarConcept()
      }
    }
  }
  if (voor === 'gedaan' && $('#gedaan-form')) {
    const form = $('#gedaan-form')
    $('#gedaan-foto-rij').innerHTML = gedaanFotoHtml(null, true)
    try {
      form.dataset.foto = await kiesFoto(bestand)
      meld('Foto erbij gedaan')
    } catch (err) {
      $('#gedaan-fout').textContent = `📷 ${err.message}`
    }
    if (form.isConnected) $('#gedaan-foto-rij').innerHTML = gedaanFotoHtml(form.dataset.foto || null)
  }
})

// Importeren voegt samen in plaats van te vervangen (§4.2).
$('#import-bestand').addEventListener('change', async (e) => {
  const bestand = e.target.files[0]
  e.target.value = ''
  if (!bestand) return
  let backup = null
  let fotoBackup = {}
  try {
    const raw = JSON.parse(await bestand.text())
    backup = schoonStaat(raw)
    fotoBackup = schoonFotos(raw?.fotos)
  } catch {
    backup = null
  }
  if (!backup) return alert('Dit bestand is geen Prikbord-back-up. Kies een bestand dat begint met "prikbord-backup".')
  if (!confirm('Deze back-up samenvoegen met wat je nu hebt? Er gaat niets verloren.')) return
  zetWegDoor()
  const uit = importeer(staat, backup)
  staat = uit.staat
  opslaan()
  // Foto's uit de back-up die hier nog niet stonden, bewaren (en naar de
  // anderen als het bord gedeeld is).
  let nieuweFotos = 0
  for (const [id, f] of Object.entries(fotoBackup)) {
    if (await fotos.heeftFoto(id).catch(() => true)) continue
    try {
      await fotos.bewaarFoto(id, new Blob([f.bytes], { type: f.type }))
      fotoMis.delete(id)
      nieuweFotos++
    } catch {
      toast('⚠️ Niet alle foto’s passen op deze telefoon', { ms: 4000 })
      break
    }
  }
  if (nieuweFotos) for (const id of Object.keys(koppelingen.borden)) if (staat.borden[id]) deelFotos(id)
  render(true)
  const delen = []
  if (uit.nieuweBriefjes) delen.push(meervoud(uit.nieuweBriefjes, 'nieuw briefje', 'nieuwe briefjes'))
  if (uit.nieuweBorden) delen.push(meervoud(uit.nieuweBorden, 'bord', 'borden'))
  if (nieuweFotos) delen.push(meervoud(nieuweFotos, 'foto', "foto's"))
  toast(delen.length ? `📥 Samengevoegd: ${delen.join(' en ')} erbij!` : '📥 Samengevoegd. Alles stond er al!')
})

// ---------- Acties ----------

const acties = {
  open: (el, e) => tikOpBriefje(el.dataset.id, e),
  'open-doos': (el) => openUitDoos(el.dataset.id),
  trek: trekBriefje,
  sorteer: () => {
    staat.apparaat.sorteer[staat.bord] = sorteerWijze() === 'hartjes' ? 'nieuw' : 'hartjes'
    opslaan()
    tekenFilterbalk()
    legBordNeer()
    meld(sorteerWijze() === 'hartjes' ? 'Gesorteerd op meeste hartjes' : 'Gesorteerd op nieuwste eerst')
  },
  'kaart-gedaan': () => {
    ui.kaartGedaan = !ui.kaartGedaan
    tekenFilterbalk()
    zetKaartPunaises()
    meld(ui.kaartGedaan ? 'Gedane briefjes staan grijs op de kaart' : 'Alleen briefjes die nog op het bord hangen')
  },
  cats: () => openCats(),
  borden: () => openBorden(),
  delen: () => openDelen(),
  ik: () => openIk(),
  'bord-instel': () => openBordInstel(),
  export: exporteer,
  import: () => $('#import-bestand').click(),
  changelog: () => openChangelog(0),
  'force-update': async () => {
    // Alleen de app-cache wissen, nooit localStorage of IndexedDB (§4.1, regel 9).
    bewaarNu(staat, opslagFout)
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      await reg?.update()
      // Alleen onze eigen caches: de andere apps op dit domein delen dezelfde opslag (A1).
      for (const k of await caches.keys()) if (k.startsWith('prikbord-')) await caches.delete(k)
    } catch {
      // Geen cache-API: gewoon herladen.
    }
    location.reload()
  },
}

view.addEventListener('click', (e) => {
  const filter = e.target.closest('[data-filter]')
  if (filter) {
    const soort = filter.dataset.filter
    if (soort === 'alles') zetFilter(ALLES)
    if (soort === 'samen') zetFilter({ ...ui.filter, samen: !ui.filter.samen })
    if (soort === 'cat') zetFilter(wisselCat(ui.filter, filter.dataset.cat))
    return
  }
  const zoom = e.target.closest('[data-zoom]')
  if (zoom && vrijApi) {
    if (zoom.dataset.zoom === 'in') vrijApi.zoom(1.4)
    if (zoom.dataset.zoom === 'uit') vrijApi.zoom(1 / 1.4)
    if (zoom.dataset.zoom === 'passend') vrijApi.passend()
    return
  }
  const el = e.target.closest('[data-action]')
  if (el && acties[el.dataset.action]) acties[el.dataset.action](el, e)
})

view.addEventListener('change', (e) => {
  if (e.target.dataset.setting !== 'geluid') return
  staat.apparaat.geluid = e.target.checked
  opslaan()
  toast(e.target.checked ? '🔊 Geluid staat aan' : '🔇 Geluid staat uit')
})

document.querySelector('.tabbar').addEventListener('click', (e) => {
  const knop = e.target.closest('[data-tab]')
  if (!knop) return
  // Een enkele tik die nog wachtte (dubbeltik?), hoort bij het vorige scherm.
  clearTimeout(ui.tik?.timer)
  ui.tik = null
  ui.tab = knop.dataset.tab
  scrollTo(0, 0)
  render()
})

// Netjes of vrij: per telefoon en per bord onthouden (§5.2).
$('.kop').addEventListener('click', (e) => {
  // Tik op de bordnaam: alle borden.
  if (e.target.closest('#kop-titel')) {
    if (!laag.open && !ui.bezig) openBorden()
    return
  }
  const knop = e.target.closest('[data-weergave]')
  if (!knop || laag.open) return
  const v = knop.dataset.weergave
  if ((isVrij() ? 'vrij' : 'netjes') === v) return
  staat.apparaat.weergave[staat.bord] = v
  opslaan()
  scrollTo(0, 0)
  render(true)
  meld(v === 'vrij' ? 'Vrije weergave' : 'Netjes rommelig')
  if (v === 'vrij') toast('✋ Houd een briefje even vast om het te verslepen. Knijp of gebruik + en − om te zoomen.', { ms: 4500 })
})

// Tik op het scheurblokje: een vel eraf (of het concept dat er nog lag).
blok.addEventListener('click', () => {
  if (laag.open || ui.bezig) return
  const c = staat.apparaat.concept
  if (c && c.bord === staat.bord && c.nieuw && c.id) return openVel({ ...c, vanBlok: true })
  openVel({ id: maakId(), nieuw: true, tekst: '', cat: standaardCat()?.id, vanBlok: true })
})

// iOS: het toetsenbord verkleint alleen de zichtbare ruimte. Het schrijfvel
// gebruikt die maat, zodat "Prikken!" niet achter het toetsenbord verdwijnt.
if (window.visualViewport) {
  const pas = () => {
    document.documentElement.style.setProperty('--vvh', `${visualViewport.height}px`)
    document.documentElement.style.setProperty('--vvtop', `${visualViewport.offsetTop}px`)
  }
  visualViewport.addEventListener('resize', pas)
  visualViewport.addEventListener('scroll', pas)
  pas()
}

// Naar de achtergrond: alles meteen wegschrijven (iOS kan de app daarna sluiten).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return
  zetWegDoor()
  bewaarNu(staat, opslagFout)
  // Wat nog gebundeld wachtte meteen versturen (lukt dat niet meer, dan gaat
  // het de volgende keer mee: het blijft in het verschil staan).
  if (bundel) stuurGewijzigd()
  clearTimeout(peilTimer)
  wisGezien()
  render()
})

// Terug in de app: meteen kijken wat er nieuw is, en weer peilen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return
  stuurGewijzigd()
  if (gedeeld()) motor.ronde(staat.bord).then(plannPeil)
  verstuurFotos()
})
addEventListener('online', () => {
  stuurGewijzigd()
  if (gedeeld()) motor.ronde(staat.bord).then(plannPeil)
  verstuurFotos()
  fotoMis.clear()
  probeerMisteFotos()
})
addEventListener('offline', () => {
  for (const id of Object.keys(koppelingen.borden)) zetStatus(id, { status: 'offline' })
})
// Een koppel-link openen terwijl de app al openstaat.
addEventListener('hashchange', () => {
  const k = koppelUitAdres()
  if (k) {
    if (laag.open) sluitDirect()
    openKoppelJa(k)
  }
})

// Een koppel-link in het adres (…/#koppel=…): uit het adres halen (anders
// staat hij in de geschiedenis en bij een herlaad opnieuw open) en lezen.
function koppelUitAdres() {
  if (!/koppel=/.test(location.hash)) return null
  const link = location.href
  history.replaceState(null, '', location.pathname + location.search)
  const k = leesKoppel(link)
  if (!k) toast('⚠️ Deze koppel-link is kapot. Vraag om een nieuwe.', { ms: 5000 })
  return k && { ...k, link }
}
addEventListener('pagehide', () => {
  zetWegDoor()
  bewaarNu(staat, opslagFout)
})

// ---------- Blijvende opslag (§4.1, regel 3) ----------

async function vraagBlijvendeOpslag() {
  if (!navigator.storage?.persist) return
  try {
    ui.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    // Niet ondersteund of geweigerd: status blijft onbekend.
  }
  if (ui.tab === 'meer') render()
}

// ---------- Updates (§4.1, regel 5) ----------
// Een nieuwe service worker neemt het over → herladen, zodat de nieuwe versie
// meteen zichtbaar is. Maar nooit midden in iets: niet met een open venster
// of schrijfvel, niet tijdens "ongedaan maken", niet tijdens het deelmenu,
// niet tijdens een sleepbeweging of het schuiven over het bord, en niet
// terwijl er een foto naar de anderen gaat.

let herlaadStraks = false
const rustig = () => !laag.open && !wegWacht && ui.bezig === 0 && ui.uploads === 0 && !vrijApi?.bezig()
function herlaadAlsRustig() {
  if (!rustig()) {
    herlaadStraks = true
    return
  }
  bewaarNu(staat, opslagFout)
  location.reload()
}
setInterval(() => {
  if (herlaadStraks && rustig()) location.reload()
}, 1000)

async function zoekUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
  } catch {
    // Offline: gewoon de huidige versie blijven gebruiken.
  }
}

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Bij de allereerste installatie is er niets te verversen.
    if (hadController) herlaadAlsRustig()
  })
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {})
  // iOS houdt de app vaak "open" op de achtergrond; kijk bij terugkomen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') zoekUpdate()
  })
}

// ---------- Start ----------

zetRanden()
if (opgestart.nieuw) {
  staat.apparaat.seenVersion = Number(APP_VERSION)
  opslaan()
}
render()
// De handschriftletter komt soms pas na het eerste tekenen binnen; dan opnieuw meten.
document.fonts?.ready.then(() => legBordNeer())
toonNieuwsSindsVorigeKeer()
vraagBlijvendeOpslag()

// Een koppel-link gaat voor. Anders: half geschreven briefje van de vorige
// keer meteen weer openen (regel 12). Anders, bij de eerste start: wie ben jij?
const binnenLink = koppelUitAdres()
const concept = staat.apparaat.concept
if (binnenLink) openKoppelJa(binnenLink)
else if (concept && concept.bord === staat.bord && concept.tekst.trim() && !laag.open) {
  openVel({ ...concept, id: concept.id || maakId(), nieuw: concept.nieuw || !concept.id })
  toast('✍️ Je was nog aan het schrijven. Hier is je briefje terug!')
} else if (opgestart.nieuw && !staat.apparaat.naam && !laag.open) openWelkom()
startSync()
// Foto's die nog moesten vertrekken (bijv. offline toegevoegd), en opruimen.
verstuurFotos()
setTimeout(ruimFotosOp, 8000)
