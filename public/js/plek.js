// Plekken op de kaart (§5.9), puur: geen DOM, geen opslag.
// - plekUitLink: coördinaten uit een geplakte link van Google Maps,
//   OpenStreetMap of Apple Kaarten (manier 3, zonder zoekdienst).
// - schoonZoek: wat de zoekfunctie van de worker teruggeeft (manier 4).
// - plekLabel: hoe een plek op het briefje staat.

const PLEK_NAAM = 120 // zoals validate.js

const isGetal = (x) => typeof x === 'number' && Number.isFinite(x)
const goed = (lat, lng) => isGetal(lat) && isGetal(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0)
// Zes decimalen is ± 10 cm: preciezer heeft geen zin en maakt de JSON langer.
const rond = (x) => Math.round(x * 1e6) / 1e6

export function maakPlek(lat, lng, naam) {
  if (!goed(lat, lng)) return null
  const p = { lat: rond(lat), lng: rond(lng) }
  const n = typeof naam === 'string' ? naam.replace(/\s+/g, ' ').trim().slice(0, PLEK_NAAM) : ''
  if (n) p.naam = n
  return p
}

const GETAL = '(-?\\d{1,3}(?:\\.\\d+)?)'
const PAAR = new RegExp(`^\\s*${GETAL}\\s*,\\s*${GETAL}\\s*$`)

// "52.0116,4.3571" (ook met een spatie na de komma).
function paar(tekst) {
  const m = String(tekst ?? '').match(PAAR)
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null
}

// Een naam uit het pad van Google (/maps/place/Sushi+Den+Haag/@…).
function padNaam(stuk) {
  try {
    return decodeURIComponent(stuk.replace(/\+/g, ' '))
  } catch {
    return stuk
  }
}

// Verkorte links kunnen we niet openen zonder internetverzoek naar Google
// of Apple (en dat blokkeert de browser). Die herkennen we alleen.
const KORT = /^(maps\.app\.goo\.gl|goo\.gl|maps\.apple|osm\.org|g\.co)$/i

// Geeft { lat, lng, naam? } terug, of { kort: true } bij een verkorte link,
// of { zoek: 'tekst' } als er wel een plaatsnaam maar geen coördinaten in
// staan, of null als er niets bruikbaars in zit.
export function plekUitLink(invoer) {
  const tekst = String(invoer ?? '').trim()
  if (!tekst) return null
  // Gewoon twee getallen geplakt: "52.0116, 4.3571".
  const los = paar(tekst)
  if (los) return maakPlek(los.lat, los.lng)
  // geo:52.01,4.35?q=…
  const geo = tekst.match(/geo:(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i)
  if (geo) return maakPlek(Number(geo[1]), Number(geo[2]))
  const gevonden = tekst.match(/https?:\/\/[^\s<>"']+/i)
  if (!gevonden) return null
  let url
  try {
    url = new URL(gevonden[0])
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./i, '')
  if (KORT.test(host) || (host === 'goo.gl' && url.pathname.startsWith('/maps'))) return { kort: true }
  const q = url.searchParams
  let pad = url.pathname
  try {
    pad = decodeURIComponent(pad)
  } catch {
    // Een kapotte %-code: dan het pad zoals het is.
  }

  // OpenStreetMap: een marker (mlat/mlon) gaat voor het midden van de kaart (#map=z/lat/lng).
  if (/openstreetmap\.(org|de|fr|nl)$/i.test(host)) {
    const m = maakPlek(Number(q.get('mlat')), Number(q.get('mlon')))
    if (m) return m
    const kaart = url.hash.match(/map=\d{1,2}\/(-?[\d.]+)\/(-?[\d.]+)/)
    if (kaart) return maakPlek(Number(kaart[1]), Number(kaart[2]))
    return null
  }

  // Apple Kaarten: ?ll=… of ?coordinate=…, met q= of name= als naam.
  if (/(^|\.)maps\.apple\.com$/i.test(host)) {
    const naam = q.get('name') || (paar(q.get('q')) ? '' : q.get('q')) || ''
    for (const k of ['coordinate', 'll', 'sll', 'q']) {
      const p = paar(q.get(k))
      if (p) return maakPlek(p.lat, p.lng, naam)
    }
    const adres = q.get('address') || naam
    return adres ? { zoek: adres.slice(0, PLEK_NAAM) } : null
  }

  // Google Maps (google.nl, google.com, maps.google.com …).
  if (/(^|\.)google\.[a-z.]{2,6}$/i.test(host) && (/^\/maps/.test(url.pathname) || host.startsWith('maps.'))) {
    const plaats = url.pathname.match(/\/maps\/place\/([^/@]+)/)
    const naam = plaats ? padNaam(plaats[1]) : ''
    // !3d…!4d… is de punaise van de plek zelf; /@lat,lng is het midden van de kaart.
    const pin = pad.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
    if (pin) return maakPlek(Number(pin[1]), Number(pin[2]), naam)
    for (const k of ['q', 'query', 'destination', 'daddr', 'll', 'center']) {
      const p = paar(q.get(k))
      if (p) return maakPlek(p.lat, p.lng, naam)
    }
    const at = pad.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
    if (at) return maakPlek(Number(at[1]), Number(at[2]), naam)
    const zoek = naam || q.get('q') || q.get('query') || q.get('destination') || ''
    return zoek ? { zoek: zoek.slice(0, PLEK_NAAM) } : null
  }
  return null
}

// Wat /zoek van de worker teruggeeft: hooguit 5 uitkomsten, elk met een
// plek (met korte naam) en het hele adres voor in de lijst.
export function schoonZoek(raw) {
  if (!Array.isArray(raw?.plekken)) return []
  const uit = []
  for (const r of raw.plekken.slice(0, 5)) {
    if (!r || typeof r !== 'object') continue
    const adres = typeof r.adres === 'string' ? r.adres.replace(/\s+/g, ' ').trim().slice(0, 250) : ''
    const naam = (typeof r.naam === 'string' && r.naam.trim()) || korteNaam(adres)
    const plek = maakPlek(r.lat, r.lng, naam)
    if (plek?.naam) uit.push({ plek, adres })
  }
  return uit
}

// Op het briefje: de naam, of anders de coördinaten in Nederlandse notatie.
export function plekLabel(plek) {
  if (!plek) return ''
  if (plek.naam) return plek.naam
  const f = (x) => Math.abs(x).toFixed(4).replace('.', ',')
  return `${f(plek.lat)}° ${plek.lat >= 0 ? 'N' : 'Z'}, ${f(plek.lng)}° ${plek.lng >= 0 ? 'O' : 'W'}`
}

// Een korte naam uit een lang adres van de zoekdienst: het eerste stukje.
// Begint het adres met een huisnummer ("8, Plein, Den Haag, …"), dan
// "Plein 8".
export function korteNaam(adres) {
  const delen = String(adres ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
  if (!delen.length) return ''
  const naam = /^\d+[a-z]?(-\d+)?$/i.test(delen[0]) && delen[1] ? `${delen[1]} ${delen[0]}` : delen[0]
  return naam.slice(0, PLEK_NAAM)
}
