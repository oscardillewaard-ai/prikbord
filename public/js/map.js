// De kaart (§5.9): Leaflet uit vendor/ (BSD-2, zie vendor/LEAFLET-LICENSE)
// met tegels van OpenStreetMap, zoals Parkenjacht. Leaflet wordt pas geladen
// als je de kaart nodig hebt (de kaart-tab of een plek kiezen), zodat het
// bord net zo snel opent als voorheen. Offline staat Leaflet in de cache van
// de service worker; de tegels niet (die komen van een andere site), dus dan
// zie je de punaises op een lege achtergrond.

export const NL = { midden: [52.2, 5.3], zoom: 7 }
const TEGELS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const BRON = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bijdragers</a>'

let laden = null
export function laadLeaflet() {
  if (globalThis.L?.map) return Promise.resolve(globalThis.L)
  if (!laden) {
    laden = new Promise((ok, nee) => {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = 'vendor/leaflet.css'
      document.head.append(css)
      const js = document.createElement('script')
      js.src = 'vendor/leaflet.js'
      js.onload = () => (globalThis.L?.map ? ok(globalThis.L) : nee(new Error('Leaflet laden lukt niet')))
      js.onerror = () => nee(new Error('De kaart laden lukt niet. Heb je internet?'))
      document.head.append(js)
    })
    laden.catch(() => (laden = null))
  }
  return laden
}

// Een kaart in `el`, met tegels en een zichtbare bronvermelding.
export function maakKaart(L, el, { midden = NL.midden, zoom = NL.zoom } = {}) {
  const kaart = L.map(el, { zoomControl: false, attributionControl: true, worldCopyJump: true, tapTolerance: 12 }).setView(midden, zoom)
  // Zoomknoppen met Nederlandse uitleg (Leaflet zegt "Zoom in").
  L.control.zoom({ zoomInTitle: 'Inzoomen', zoomOutTitle: 'Uitzoomen' }).addTo(kaart)
  kaart.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>')
  L.tileLayer(TEGELS, { maxZoom: 19, attribution: BRON, crossOrigin: false }).addTo(kaart)
  return kaart
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Een punaise in de kleur van de categorie, met de emoji erin.
export function punaise(L, { kleur, emoji = '', grijs = false, nieuw = false }) {
  return L.divIcon({
    className: 'kaart-pin-icoon',
    html: `<span class="kaart-pin papier-${esc(kleur)}${grijs ? ' grijs' : ''}${nieuw ? ' nieuw' : ''}" aria-hidden="true"><span class="kaart-pin-kop">${esc(emoji)}</span><span class="kaart-pin-naald"></span></span>`,
    iconSize: [34, 46],
    iconAnchor: [17, 45],
    tooltipAnchor: [0, -40],
  })
}

// De punaise waarmee je een plek kiest (sleepbaar).
export function kiesPunaise(L) {
  return L.divIcon({
    className: 'kaart-pin-icoon',
    html: '<span class="kaart-pin kies" aria-hidden="true"><span class="kaart-pin-kop">📍</span><span class="kaart-pin-naald"></span></span>',
    iconSize: [34, 46],
    iconAnchor: [17, 45],
  })
}

// Alle punaises in beeld, of anders Nederland. Zonder animatie: dit is het
// begin, en een punaise steekt 45 px boven zijn punt uit (daarom boven meer ruimte).
export function pasInBeeld(L, kaart, plekken, { max = 15 } = {}) {
  if (!plekken.length) return kaart.setView(NL.midden, NL.zoom, { animate: false })
  if (plekken.length === 1) return kaart.setView([plekken[0].lat, plekken[0].lng], Math.min(max, 14), { animate: false })
  kaart.fitBounds(L.latLngBounds(plekken.map((p) => [p.lat, p.lng])), { paddingTopLeft: [40, 70], paddingBottomRight: [40, 30], maxZoom: max, animate: false })
}

// Een kaart opruimen. Niet meteen: is hij nog aan het zoomen of schuiven, dan
// gaat er in Leaflet daarna nog een timer af die de (weggehaalde) kaart
// zoekt, met een fout als gevolg. Daarom eerst stoppen en even wachten.
export function ruimOp(kaart) {
  if (!kaart) return
  try {
    kaart.stop()
    kaart.off()
  } catch {
    // Al weg.
  }
  setTimeout(() => {
    try {
      kaart.remove()
    } catch {
      // Al weg.
    }
  }, 600)
}
