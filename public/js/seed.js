// Vast "toeval" op basis van een id (puur: geen DOM, geen opslag).
// Draaiing, verschuiving, scheurrand en de plek van de punaise komen hieruit,
// zodat een briefje er op elke telefoon precies hetzelfde uitziet.

// FNV-1a (32 bit) over de tekens van een string.
export function hash32(tekst) {
  let h = 0x811c9dc5
  for (const teken of String(tekst)) {
    h ^= teken.codePointAt(0)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32: klein, snel en overal hetzelfde (alleen gehele getallen en Math.imul).
export function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rond = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d
const tussen = (r, min, max) => min + r() * (max - min)

// Aantal varianten van de gekartelde rand. Elk briefje krijgt er één via zijn
// id. Zo blijft het een handvol CSS-regels in plaats van een lange
// clip-path per briefje (scheelt veel bij 300 briefjes).
export const RANDEN = 16

// Hoe een briefje op het bord hangt.
export function uiterlijk(id) {
  const r = prng(hash32(id))
  return {
    draai: rond(tussen(r, -3.5, 3.5), 2), // graden
    dx: rond(tussen(r, -5, 5)), // px, opzij
    dy: rond(tussen(r, -3, 3)), // px, op en neer
    rand: Math.floor(r() * RANDEN), // welke scheurrand
    punaiseX: rond(tussen(r, 40, 60)), // % van de breedte
    punaiseDraai: Math.round(tussen(r, -30, 30)), // graden
  }
}

// Eén rand van een briefje als reeks punten, met de klok mee vanaf linksboven.
// `vorm` geeft per kant de diepte (px) en het aantal punten. Langs de rand
// staat de plek in %, dwars op de rand in px, zodat de tandjes even groot
// blijven, hoe hoog het briefje ook is.
function kant(r, kantNaam, { diepte, punten, onregelmatig = 0.6 }) {
  // Ongelijke stukjes: een echte scheur heeft geen vaste maat.
  const stukjes = Array.from({ length: punten }, () => 1 - onregelmatig / 2 + r() * onregelmatig)
  const totaal = stukjes.reduce((a, b) => a + b, 0)
  const uit = []
  let pos = 0
  for (let i = 0; i < punten; i++) {
    pos += stukjes[i]
    const langs = rond((pos / totaal) * 100, 2)
    if (i === punten - 1) break // de hoek pakt de volgende kant
    const dwars = rond(r() * diepte, 2)
    if (kantNaam === 'boven') uit.push(`${langs}% ${dwars}px`)
    if (kantNaam === 'rechts') uit.push(`calc(100% - ${dwars}px) ${langs}%`)
    if (kantNaam === 'onder') uit.push(`${rond(100 - langs, 2)}% calc(100% - ${dwars}px)`)
    if (kantNaam === 'links') uit.push(`${dwars}px ${rond(100 - langs, 2)}%`)
  }
  return uit
}

// Perforatie: kleine halve rondjes langs de bovenkant (een vel uit een blok
// met scheurlijn). `aantal` gaatjes over de hele breedte.
function perforatie(r, { aantal, diepte }) {
  const uit = []
  for (let i = 0; i < aantal; i++) {
    const midden = ((i + 0.5) / aantal) * 100
    const half = (0.32 / aantal) * 100
    const d = rond(diepte * (0.8 + r() * 0.4), 2)
    uit.push(`${rond(midden - half, 2)}% 0px`, `${rond(midden - half / 2, 2)}% ${rond(d * 0.8, 2)}px`)
    uit.push(`${rond(midden, 2)}% ${d}px`, `${rond(midden + half / 2, 2)}% ${rond(d * 0.8, 2)}px`, `${rond(midden + half, 2)}% 0px`)
  }
  return uit
}

// De clip-path voor rand-variant `n` in een bepaalde vorm. `vorm` per kant:
// { diepte, punten } of voor boven ook { perforatie: { aantal, diepte } }.
export function randPolygon(n, vorm) {
  const r = prng(hash32(`rand-${n}-${JSON.stringify(vorm)}`))
  const hoek = (d) => rond(r() * d, 2)
  const pt = []
  pt.push(`${hoek(vorm.links.diepte)}px ${hoek(vorm.boven.diepte ?? 0)}px`)
  pt.push(...(vorm.boven.perforatie ? perforatie(r, vorm.boven.perforatie) : kant(r, 'boven', vorm.boven)))
  pt.push(`calc(100% - ${hoek(vorm.rechts.diepte)}px) ${hoek(vorm.boven.diepte ?? 0)}px`)
  pt.push(...kant(r, 'rechts', vorm.rechts))
  pt.push(`calc(100% - ${hoek(vorm.rechts.diepte)}px) calc(100% - ${hoek(vorm.onder.diepte)}px)`)
  pt.push(...kant(r, 'onder', vorm.onder))
  pt.push(`${hoek(vorm.links.diepte)}px calc(100% - ${hoek(vorm.onder.diepte)}px)`)
  pt.push(...kant(r, 'links', vorm.links))
  return `polygon(${pt.join(', ')})`
}
