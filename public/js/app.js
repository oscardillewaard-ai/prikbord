// Prikbord: een prikbord vol afgescheurde briefjes. Gewone HTML/CSS/JS met
// ES-modules, zonder buildstap (zie docs/prikbord-spec.md).
// Dit bestand doet het scherm; het rekenwerk staat in de pure modules
// (model, merge, layout, seed, validate), die ook in Node getest worden.

import { waarde, zetVeld, nieuwBriefje, verwijder, categorieen, catVan, lidVan, opHetBord, maakId } from './model.js'
import { schoonStaat, MAX_TEKST } from './validate.js'
import { importeer } from './merge.js'
import { legNetjes, kolomBreedte } from './layout.js'
import { uiterlijk } from './seed.js'
import { laad, bewaar, bewaarStraks, bewaarNu } from './store.js'
import { zetRanden } from './randen.js'
import { minderBeweging, scheurAf, vliegNaar, prikIn, wiebelBuren, vanBord, terugNaarBord, valWeg, vervaagLaag } from './beweging.js'
import { rrrits, tok } from './geluid.js'

export const APP_VERSION = '1' // ophogen bij elke release, samen met CACHE in sw.js

// ---------- Wat is er nieuw ----------
// Nieuwste bovenaan. Bij een release: APP_VERSION ophogen, CACHE in sw.js
// ophogen en hier een regel toevoegen.
const CHANGELOG = [
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

// ---------- Hulpjes ----------

const $ = (sel, el = document) => el.querySelector(sel)
const view = $('#view')
const laag = $('#laag')
const blok = $('#blok')

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const vandaagKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtMoment = (t) => {
  const d = new Date(t)
  const datum = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
  return `${datum} om ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
}

// UI-toestand (niet opgeslagen).
const ui = {
  tab: 'bord',
  persisted: null, // true, false of null (onbekend)
  vel: null, // { id, nieuw, tekst, cat } zolang het schrijfvel open is
  verborgen: new Set(), // briefjes die net weggehaald zijn (5 tellen ongedaan maken)
  bezig: 0, // lopende handelingen (animaties, deelmenu, later slepen en uploads): niet herladen
  open: null, // id van het briefje dat groot open ligt (op het bord verstopt)
  landt: null, // id van het briefje dat nog naar zijn plek moet vliegen
}

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

// ---------- Het bord ----------

function briefjeHtml(b) {
  const bd = bord()
  const cat = catVan(bd, waarde(b.v, 'cat'))
  const lid = lidVan(bd, b.door)
  const u = uiterlijk(b.id)
  return `
    <div class="briefje-plek${ui.landt === b.id || ui.open === b.id ? ' verstopt' : ''}" data-id="${b.id}" style="--px:${u.punaiseX}%">
      <button type="button" class="briefje papier-${cat.kleur} rand-${u.rand}" data-action="open" data-id="${b.id}">
        <span class="vh">${esc(cat.naam)}: </span><span class="tekst">${esc(waarde(b.v, 'tekst', ''))}</span>
        <span class="briefje-voet" aria-hidden="true">${cat.emoji}</span>
      </button>
      <span class="punaise pin-${lid.kleur}" style="--pd:${u.punaiseDraai}deg" aria-hidden="true"></span>
    </div>`
}

function renderBord() {
  const lijst = opHetBord(bord()).filter((b) => !ui.verborgen.has(b.id))
  if (!lijst.length) {
    return `
      <section class="bord bord-leeg">
        <div class="leeg-briefje papier-zon rand-5">
          <p class="hand">Nog helemaal leeg hier! ✨</p>
          <p>Scheur rechtsonder een briefje van het blokje, schrijf er iets op en prik het op het bord.</p>
        </div>
        <span class="leeg-pijl" aria-hidden="true">↘</span>
      </section>`
  }
  return `<section class="bord" aria-label="Briefjes op het bord"><div class="bord-binnen" id="bord-binnen">${lijst.map(briefjeHtml).join('')}</div></section>`
}

// De briefjes neerleggen: eerst de breedte zetten, dan alle hoogtes in één
// keer meten (één reflow), dan de plekken uitrekenen (layout.js).
function legBordNeer() {
  const binnen = $('#bord-binnen')
  if (!binnen) return
  const breedte = binnen.clientWidth
  const w = kolomBreedte(breedte)
  const plekken = [...binnen.querySelectorAll('.briefje-plek')]
  for (const el of plekken) el.style.width = `${w}px`
  const hoogtes = {}
  for (const el of plekken) hoogtes[el.dataset.id] = el.offsetHeight
  const { plek, hoogte } = legNetjes(
    plekken.map((el) => el.dataset.id),
    hoogtes,
    breedte,
  )
  binnen.style.height = `${hoogte}px`
  for (const el of plekken) {
    const p = plek[el.dataset.id]
    el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.draai}deg)`
    el.style.zIndex = p.z
    // Voor de animaties (beweging.js): waar hij hangt.
    Object.assign(el.dataset, { x: p.x, y: p.y, draai: p.draai })
  }
  // Pas na de eerste keer neerleggen geanimeerd verschuiven (het bord "schudt").
  requestAnimationFrame(() => binnen.classList.add('klaar'))
}

// Het briefje in beeld schuiven als het buiten beeld valt (zonder animatie,
// want het gebeurt onder het schrijfvel).
function zichtbaarMaken(plek) {
  const r = plek.getBoundingClientRect()
  const boven = $('.kop').offsetHeight + 16
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
  if (innerWidth === laatsteBreedte) return
  laatsteBreedte = innerWidth
  legBordNeer()
})

// ---------- Lege tabs (komen in een volgende mijlpaal) ----------

function renderKaart() {
  return `
    <section class="tab-leeg">
      <div class="leeg-briefje papier-lucht rand-3">
        <p class="hand">🗺️ Hier komt de kaart</p>
        <p>Briefjes met een plek verschijnen straks als punaises op de kaart. Handig voor restaurants, dagjes uit en die ene vakantie.</p>
      </div>
    </section>`
}

function renderGedaan() {
  return `
    <section class="tab-leeg">
      <div class="leeg-briefje papier-mint rand-9">
        <p class="hand">📦 De Gedaan-doos</p>
        <p>Iets gedaan? Straks gooi je het briefje hier in, met de datum en een foto. Een plakboek van alles wat jullie samen deden 🎉</p>
      </div>
    </section>`
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
  return `
    <section class="meer">
      <h2>Meer</h2>

      <h3 class="groep-kop">Dit bord</h3>
      <div class="groep">
        <div class="rij"><span class="rij-icoon" aria-hidden="true">${esc(waarde(bd.info, 'emoji', '📌'))}</span>
          <span class="rij-tekst"><strong>${esc(waarde(bd.info, 'naam', 'Prikbord'))}</strong>
          <span class="klein">Meer borden en samen prikken met vrienden komen in een volgende versie 🤝</span></span></div>
      </div>

      <h3 class="groep-kop">Op deze telefoon</h3>
      <div class="groep">
        <label class="rij">
          <span class="rij-icoon" aria-hidden="true">🔊</span>
          <span class="rij-tekst"><strong>Geluid</strong><span class="klein">Rrrits bij het scheuren en tok bij het prikken</span></span>
          <input type="checkbox" class="schakelaar" data-setting="geluid" ${staat.apparaat.geluid ? 'checked' : ''} />
        </label>
        <div class="rij"><span class="rij-icoon" aria-hidden="true">💾</span>
          <span class="rij-tekst"><strong>Blijvende opslag</strong><span class="klein">${opslag}</span></span></div>
      </div>

      <h3 class="groep-kop">Back-up</h3>
      <div class="groep">
        <button type="button" class="rij" data-action="export">
          <span class="rij-icoon" aria-hidden="true">📤</span>
          <span class="rij-tekst"><strong>Back-up maken</strong><span class="klein">Bewaar al je briefjes in een bestand</span></span>
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

function render() {
  const bd = bord()
  $('#kop-titel').innerHTML = `<span class="kop-emoji" aria-hidden="true">${esc(waarde(bd.info, 'emoji', '📌'))}</span> ${esc(waarde(bd.info, 'naam', 'Prikbord'))}`
  document.body.dataset.tab = ui.tab
  for (const b of document.querySelectorAll('.tabbar [data-tab]')) {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page')
    else b.removeAttribute('aria-current')
  }
  blok.hidden = ui.tab !== 'bord'
  $('.blok-vel', blok).className = `blok-vel papier-${blokCat()?.kleur || 'wit'}`
  if (ui.tab === 'bord') view.innerHTML = renderBord()
  if (ui.tab === 'kaart') view.innerHTML = renderKaart()
  if (ui.tab === 'gedaan') view.innerHTML = renderGedaan()
  if (ui.tab === 'meer') view.innerHTML = renderMeer()
  if (ui.tab === 'bord') legBordNeer()
}

// ---------- De laag: geopend briefje, schrijfvel, wat is er nieuw ----------
// Eén <dialog> voor alles wat over het bord heen komt. De donkere achtergrond
// is een eigen element (.laag-achter), zodat hij mee kan vervagen.

const speel = (geluidje) => {
  if (staat.apparaat.geluid) geluidje()
}
// Voor schermlezers: korte meldingen zonder toast.
function meld(tekst) {
  const el = $('#sr')
  el.textContent = ''
  setTimeout(() => (el.textContent = tekst), 30)
}

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
  if (laag.dataset.soort === 'open') return terughangen()
  return metRust(async () => {
    await vervaagLaag(laag)
    sluitDirect()
  })
}

laag.addEventListener('close', () => {
  document.documentElement.classList.remove('laag-open')
  // Schrijfvel dicht zonder prikken: het concept blijft bewaard voor de volgende keer.
  if (laag.dataset.soort === 'vel' && ui.vel) {
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
})

// Esc (en de terugknop op Android) sluit met dezelfde beweging.
laag.addEventListener('cancel', (e) => {
  e.preventDefault()
  sluitLaag()
})

// Tik naast het briefje sluit het. Het schrijfvel niet: dan ben je te snel
// iets kwijt als je net naast het papier tikt.
laag.addEventListener('click', (e) => {
  if (e.target === laag || e.target.classList.contains('laag-achter') || e.target.matches('.groot, .nieuws')) sluitLaag()
})

// Tik op een briefje: het komt van het bord en opent groot.
function openBriefje(id) {
  const bd = bord()
  const b = bd.briefjes[id]
  if (!b || b.weg || laag.open) return
  const cat = catVan(bd, waarde(b.v, 'cat'))
  const lid = lidVan(bd, b.door)
  const u = uiterlijk(b.id)
  const plek = view.querySelector(`.briefje-plek[data-id="${id}"]`)
  openLaag(
    `
    <div class="groot" data-id="${b.id}">
      <div class="briefje-plek groot-plek" style="--px:${u.punaiseX}%">
        <div class="briefje groot-papier papier-${cat.kleur} rand-${u.rand}">
          <p class="groot-cat"><span aria-hidden="true">${cat.emoji}</span> ${esc(cat.naam)}</p>
          <p class="groot-tekst" id="laag-titel">${esc(waarde(b.v, 'tekst', ''))}</p>
          <p class="groot-meta">Geprikt door ${esc(lid.naam)} op ${fmtMoment(b.gemaakt)}</p>
        </div>
        <span class="punaise pin-${lid.kleur}" style="--pd:${u.punaiseDraai}deg" aria-hidden="true"></span>
      </div>
      <div class="laag-knoppen">
        <button type="button" class="knop" data-laag="weg"><span aria-hidden="true">🗑️</span> Weghalen</button>
        <button type="button" class="knop" data-laag="bewerk"><span aria-hidden="true">✏️</span> Bewerken</button>
        <button type="button" class="knop primair" data-laag="sluit">Terughangen <span aria-hidden="true">📌</span></button>
      </div>
    </div>`,
    'open',
  )
  ui.open = id
  if (!plek || minderBeweging()) return
  plek.classList.add('verstopt')
  metRust(() => vanBord(plek, $('.groot-plek', laag), laag))
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

// Het schrijfvel. Een nieuw briefje krijgt meteen zijn id, zodat het vel
// dezelfde scheurrand heeft als straks het briefje op het bord.
// `vanBlok`: net van het blokje gescheurd (met rrrits en animatie).
function openVel({ id, nieuw, tekst = '', cat, vanBlok = false }) {
  const bd = bord()
  const cats = categorieen(bd)
  if (!cats.some((c) => c.id === cat)) cat = cats[0]?.id
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
  if (e.target.id !== 'vel-tekst' || !ui.vel) return
  ui.vel.tekst = e.target.value
  werkTellerBij()
  bewaarConcept()
})

laag.addEventListener('submit', (e) => {
  if (e.target.id !== 'vel-form') return
  e.preventDefault()
  prik()
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
  }
  doe[knop.dataset.laag]?.()
})

// ---------- Weghalen, met 5 tellen ongedaan maken (§6.2) ----------
// Een grafsteen is definitief (en gaat straks naar de anderen). Daarom eerst
// bevestigen en pas 5 tellen nadat "Ongedaan maken" verschijnt echt weghalen.
// Gaat de app eerder naar de achtergrond, dan gebeurt het meteen: je had het
// al bevestigd.

let wegWacht = null

async function haalWeg(id) {
  if (!id || !confirm('Dit briefje van het bord halen?')) return
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
  render()
  const delen = []
  if (uit.nieuweBriefjes) delen.push(`${uit.nieuweBriefjes} ${uit.nieuweBriefjes === 1 ? 'nieuw briefje' : 'nieuwe briefjes'}`)
  if (uit.nieuweBorden) delen.push(`${uit.nieuweBorden} ${uit.nieuweBorden === 1 ? 'bord' : 'borden'}`)
  toast(delen.length ? `📥 Samengevoegd: ${delen.join(' en ')} erbij!` : '📥 Samengevoegd. Alles stond er al!')
})

// ---------- Acties ----------

const acties = {
  open: (el) => openBriefje(el.dataset.id),
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
  const el = e.target.closest('[data-action]')
  if (el && acties[el.dataset.action]) acties[el.dataset.action](el)
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
  ui.tab = knop.dataset.tab
  render()
  scrollTo(0, 0)
})

// Tik op het scheurblokje: een vel eraf (of het concept dat er nog lag).
blok.addEventListener('click', () => {
  if (laag.open) return
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
// of schrijfvel, niet tijdens "ongedaan maken" en niet tijdens het deelmenu.

let herlaadStraks = false
const rustig = () => !laag.open && !wegWacht && ui.bezig === 0
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
