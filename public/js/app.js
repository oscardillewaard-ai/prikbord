// Prikbord: een prikbord vol afgescheurde briefjes. Gewone HTML/CSS/JS met
// ES-modules, zonder buildstap (zie docs/prikbord-spec.md).
// Dit bestand doet het scherm; het rekenwerk staat in de pure modules
// (model, merge, layout, filter, seed, validate), die ook in Node getest
// worden. De vingers in de vrij-modus staan in vrij.js, de animaties in
// beweging.js.

import { waarde, zetVeld, zetHart, hartjesVan, nieuwBriefje, verwijder, categorieen, catVan, lidVan, opHetBord, maakId, zetCat, nieuweCat, verschuifCat, catGebruikt } from './model.js'
import { schoonStaat, MAX_TEKST, MAX_NOTITIE, PAPIER, CAT_SCHOON } from './validate.js'
import { importeer } from './merge.js'
import { legNetjes, kolomBreedte, legVrij, VRIJ } from './layout.js'
import { ALLES, isAlles, wisselCat, past, sorteer, trek, inDeDoos, perMaand } from './filter.js'
import { uiterlijk } from './seed.js'
import { laad, bewaar, bewaarStraks, bewaarNu } from './store.js'
import { zetRanden } from './randen.js'
import { minderBeweging, scheurAf, vliegNaar, prikIn, wiebelBuren, vanBord, terugNaarBord, valWeg, vervaagLaag, hartPop, schudLos, valInDoos, confetti, stuiter, popIn } from './beweging.js'
import { maakVrij } from './vrij.js'
import { rrrits, tok, plop } from './geluid.js'

export const APP_VERSION = '3' // ophogen bij elke release, samen met CACHE in sw.js

// ---------- Wat is er nieuw ----------
// Nieuwste bovenaan. Bij een release: APP_VERSION ophogen, CACHE in sw.js
// ophogen en hier een regel toevoegen.
const CHANGELOG = [
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
const opslaan = () => bewaar(staat, opslagFout)

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
  bezig: 0, // lopende handelingen (animaties, deelmenu, slepen, later uploads): niet herladen
  open: null, // id van het briefje dat groot open ligt (op het bord verstopt)
  landt: null, // id van het briefje dat nog naar zijn plek moet vliegen
  filter: ALLES, // { cats, samen } (filter.js); niet bewaard, bij de start weer "Alles"
  getrokken: null, // het laatst getrokken briefje (🎲 "Nog eens" geeft een ander)
  tik: null, // { id, timer }: wachten of er een tweede tik komt (hartje)
  camera: {}, // vrij: per bord { s, tx, ty }
  wereldH: 0, // vrij: hoogte van het bord in px bij zoom 1
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

// ---------- De filterbalk (§5.6) ----------

function filterChips() {
  const bd = bord()
  const hier = ui.tab === 'gedaan' ? inDeDoos(bd) : opHetBord(bd)
  const gebruikt = new Set(hier.map((b) => waarde(b.v, 'cat')))
  // Verborgen categorieën alleen als er hier nog briefjes van zijn.
  const cats = categorieen(bd, { metVerborgen: true }).filter((c) => !c.verborgen || gebruikt.has(c.id))
  const f = ui.filter
  const sorteren =
    ui.tab === 'bord' && !isVrij()
      ? `<button type="button" class="chip chip-sorteer" data-action="sorteer" aria-label="Sorteren: ${sorteerWijze() === 'hartjes' ? 'meeste hartjes eerst' : 'nieuwste eerst'}. Tik om te wisselen.">
           <span aria-hidden="true">⇅</span> ${sorteerWijze() === 'hartjes' ? 'Meeste hartjes' : 'Nieuwste eerst'}</button>`
      : ''
  return `${sorteren}
    <button type="button" class="chip chip-alles" data-filter="alles" aria-pressed="${isAlles(f)}">Alles</button>
    <button type="button" class="chip chip-samen" data-filter="samen" aria-pressed="${f.samen}"><span aria-hidden="true">💞</span> Iedereen zin</button>
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

function briefjeBinnen(b) {
  const bd = bord()
  const cat = catVan(bd, waarde(b.v, 'cat'))
  const lid = lidVan(bd, b.door)
  const u = uiterlijk(b.id)
  return `
      <button type="button" class="briefje papier-${cat.kleur} rand-${u.rand}" data-action="open" data-id="${b.id}">
        <span class="vh">${esc(cat.naam)}: </span><span class="tekst">${esc(waarde(b.v, 'tekst', ''))}</span>
        ${hartjesHtml(bd, b)}
        <span class="briefje-voet" aria-hidden="true">${cat.emoji}</span>
      </button>
      <span class="punaise pin-${lid.kleur}" style="--pd:${u.punaiseDraai}deg" aria-hidden="true"></span>`
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
    const binnen = briefjeBinnen(b)
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
  if (vrijApi) {
    plaatsVrij()
    legVrijNeer()
    return
  }
  if (innerWidth === laatsteBreedte) return
  laatsteBreedte = innerWidth
  legBordNeer()
})

// ---------- Kaart (komt in M4) ----------

function renderKaart() {
  return `
    <section class="tab-leeg">
      <div class="leeg-briefje papier-lucht rand-3">
        <p class="hand">🗺️ Hier komt de kaart</p>
        <p>Briefjes met een plek verschijnen straks als punaises op de kaart. Handig voor restaurants, dagjes uit en die ene vakantie.</p>
      </div>
    </section>`
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
        <div class="rij"><span class="rij-icoon" aria-hidden="true">${esc(waarde(bd.info, 'emoji', '📌'))}</span>
          <span class="rij-tekst"><strong>${esc(waarde(bd.info, 'naam', 'Prikbord'))}</strong>
          <span class="klein">Meer borden en samen prikken met vrienden komen in een volgende versie 🤝</span></span></div>
        <button type="button" class="rij" data-action="cats">
          <span class="rij-icoon" aria-hidden="true">🏷️</span>
          <span class="rij-tekst"><strong>Categorieën</strong><span class="klein">${meervoud(nCats, 'categorie', 'categorieën')} · namen, emoji, kleuren en volgorde</span></span>
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

function render(vol = false) {
  const bd = bord()
  $('#kop-titel').innerHTML = `<span class="kop-emoji" aria-hidden="true">${esc(waarde(bd.info, 'emoji', '📌'))}</span> ${esc(waarde(bd.info, 'naam', 'Prikbord'))}`
  $('#kop-rechts').innerHTML = kopRechts()
  document.body.dataset.tab = ui.tab
  for (const b of document.querySelectorAll('.tabbar [data-tab]')) {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page')
    else b.removeAttribute('aria-current')
  }
  blok.hidden = ui.tab !== 'bord'
  $('.blok-vel', blok).className = `blok-vel papier-${blokCat()?.kleur || 'wit'}`
  if (ui.tab === 'bord') return tekenBord(vol)
  vrijApi = null
  document.documentElement.classList.remove('vrij-modus')
  view.dataset.scherm = ui.tab
  if (ui.tab === 'kaart') view.innerHTML = renderKaart()
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
  return metRust(async () => {
    await vervaagLaag(laag)
    sluitDirect()
  })
}

laag.addEventListener('close', () => {
  document.documentElement.classList.remove('laag-open')
  const soort = laag.dataset.soort
  // Schrijfvel dicht zonder prikken: het concept blijft bewaard voor de volgende keer.
  if (soort === 'vel' && ui.vel) {
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
  // Categorieën aangepast: chips, kleuren en het blokje opnieuw.
  if (soort === 'cats' || soort === 'cat') render(true)
})

// Esc (en de terugknop op Android) sluit met dezelfde beweging.
laag.addEventListener('cancel', (e) => {
  e.preventDefault()
  sluitLaag()
})

// Tik naast het briefje sluit het. Niet bij het schrijfvel en de formulieren:
// dan ben je te snel iets kwijt als je net naast het papier tikt.
const RUSTIG_SLUITEN = ['open', 'trek', 'doos', 'nieuws']
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
  const inDoos = soort === 'doos'
  return `
    <div class="groot" data-id="${b.id}" data-soort="${soort}">
      ${soort === 'trek' ? '<p class="trek-kop laag-extra">🎲 Het lot heeft gesproken!</p>' : ''}
      <div class="briefje-plek groot-plek${inDoos ? ' in-doos' : ''}" style="--px:${u.punaiseX}%">
        <div class="briefje groot-papier papier-${cat.kleur} rand-${u.rand}">
          <p class="groot-cat"><span aria-hidden="true">${cat.emoji}</span> ${esc(cat.naam)}</p>
          <p class="groot-tekst" id="laag-titel">${esc(waarde(b.v, 'tekst', ''))}</p>
          ${
            g
              ? `<div class="groot-gedaan"><p class="gedaan-stempel">✅ Gedaan op ${fmtDagLang(g.datum)}</p>${g.notitie ? `<p class="gedaan-notitie">“${esc(g.notitie)}”</p>` : ''}</div>`
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
    <form class="gedaan-form laag-extra" id="gedaan-form" data-id="${id}">
      <h2 class="gedaan-kop">${g ? 'Hoe was het? ✍️' : 'Gedaan! 🎉'}</h2>
      <label class="veld"><span>Wanneer?</span>
        <input type="date" name="datum" value="${g?.datum || vandaagKey()}" max="${vandaagKey()}" required /></label>
      <label class="veld"><span>Hoe was het? <span class="klein">(mag leeg blijven)</span></span>
        <textarea name="notitie" rows="3" maxlength="${MAX_NOTITIE}" placeholder="Heerlijk! Volgende keer weer 😋">${esc(g?.notitie || '')}</textarea></label>
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
  return notitie ? { datum, notitie } : { datum }
}

// De punaise springt eruit (plop) en het briefje valt in de doos, met confetti.
async function gooiInDoos(id, gedaan) {
  const b = bord().briefjes[id]
  if (!b || b.weg) return
  zetWegDoor()
  zetVeld(b, 'gedaan', gedaan, Date.now())
  opslaan()
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
function openVel({ id, nieuw, tekst = '', cat, vanBlok = false }) {
  const bd = bord()
  // Een verborgen categorie blijft staan bij een briefje dat hem al had.
  const cats = categorieen(bd, { metVerborgen: true }).filter((c) => !c.verborgen || c.id === cat)
  if (!cats.some((c) => c.id === cat)) cat = standaardCat()?.id || cats[0]?.id
  ui.vel = { id, nieuw, tekst, cat }
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
          <textarea id="vel-tekst" maxlength="${MAX_TEKST}" rows="6" placeholder="Wat wil je onthouden? ✍️" aria-label="Wat er op het briefje staat">${esc(tekst)}</textarea>
          <span class="vel-teller" id="vel-teller" aria-live="polite"></span>
        </div>
      </div>
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

function werkTellerBij() {
  const n = ui.vel?.tekst.length || 0
  const el = $('#vel-teller')
  if (el) el.textContent = n > MAX_TEKST - 100 ? `${n}/${MAX_TEKST}` : ''
}

// Concept bijhouden terwijl je typt (§4.1, regel 12).
function bewaarConcept() {
  if (!ui.vel) return
  staat.apparaat.concept = { bord: staat.bord, id: ui.vel.id, nieuw: ui.vel.nieuw, tekst: ui.vel.tekst, cat: ui.vel.cat }
  bewaarStraks(staat, opslagFout)
}

// "Prikken!": opslaan, het bord eronder bijwerken (het briefje nog verstopt),
// het vel laten krimpen en naar zijn plek laten vliegen, en dan de punaise
// erin met een tok. De buren wiebelen mee.
async function prik() {
  if (!ui.vel || laag.classList.contains('bezig')) return
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
  if (e.target.id === 'vel-tekst' && ui.vel) {
    ui.vel.tekst = e.target.value
    werkTellerBij()
    bewaarConcept()
  }
  if (e.target.form?.id === 'cat-form') werkCatVoorbeeldBij(e.target.form)
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
    'nog-eens': async () => {
      await terughangen()
      trekBriefje()
    },
  }
  doe[knop.dataset.laag]?.()
})

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
    const form = $('#cat-form')
    form.emoji.value = knop.dataset.emoji
    return werkCatVoorbeeldBij(form)
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

async function exporteer() {
  bewaarNu(staat, opslagFout)
  const json = JSON.stringify(staat, null, 2)
  const naam = `prikbord-backup-${vandaagKey()}.json`
  const file = new File([json], naam, { type: 'application/json' })
  // Op de iPhone werkt het deelmenu beter dan een download ("Bewaar in Bestanden").
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
  a.download = naam
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  backupGemaakt()
}

// Importeren voegt samen in plaats van te vervangen (§4.2).
$('#import-bestand').addEventListener('change', async (e) => {
  const bestand = e.target.files[0]
  e.target.value = ''
  if (!bestand) return
  let backup = null
  try {
    backup = schoonStaat(JSON.parse(await bestand.text()))
  } catch {
    backup = null
  }
  if (!backup) return alert('Dit bestand is geen Prikbord-back-up. Kies een bestand dat begint met "prikbord-backup".')
  if (!confirm('Deze back-up samenvoegen met wat je nu hebt? Er gaat niets verloren.')) return
  zetWegDoor()
  const uit = importeer(staat, backup)
  staat = uit.staat
  opslaan()
  render(true)
  const delen = []
  if (uit.nieuweBriefjes) delen.push(meervoud(uit.nieuweBriefjes, 'nieuw briefje', 'nieuwe briefjes'))
  if (uit.nieuweBorden) delen.push(meervoud(uit.nieuweBorden, 'bord', 'borden'))
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
  cats: () => openCats(),
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
})
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
// of schrijfvel, niet tijdens "ongedaan maken", niet tijdens het deelmenu en
// niet tijdens een sleepbeweging of het schuiven over het bord.

let herlaadStraks = false
const rustig = () => !laag.open && !wegWacht && ui.bezig === 0 && !vrijApi?.bezig()
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

// Half geschreven briefje van de vorige keer? Meteen weer openen (regel 12).
const concept = staat.apparaat.concept
if (concept && concept.bord === staat.bord && concept.tekst.trim() && !laag.open) {
  openVel({ ...concept, id: concept.id || maakId(), nieuw: concept.nieuw || !concept.id })
  toast('✍️ Je was nog aan het schrijven. Hier is je briefje terug!')
}
