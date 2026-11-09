// Een vol bord om prestaties te meten en te voelen (M5): standaard 300
// briefjes van drie mensen, meestal kort en soms lang, een deel met link,
// plek, hartjes en foto. Altijd hetzelfde (geseede PRNG).
// Gebruikt door scripts/prestaties.mjs en scripts/proefbord.mjs.
import sharp from 'sharp'
import { beginStaat, nieuwBriefje, voegLidToe, zetHart, zetVeld, THUIS_CATS } from '../public/js/model.js'
import { prng } from '../public/js/seed.js'

export const NU = Date.parse('2026-11-08T12:00:00+01:00')

const ZINNEN = [
  'Sushi in Den Haag 🍣',
  'Met de trein door Italië: Milaan, Bologna voor de pasta, Florence voor het ijs en dan een week aan zee',
  'Shakshuka met feta en véél koriander',
  'Noorderlicht zien ✨',
  'Weekendje België: Gent, frietjes en een ruïne bezoeken',
  'Fietsband plakken 🚲',
  'Efteling in de winter ❄️',
  'De Kas in Amsterdam (reserveren!)',
  'Dakgoot schoonmaken voor de herfst 🍂',
  'Pompoensoep met gember',
  'Ooit een marathon lopen 🏃',
  'Fietsen over de Afsluitdijk',
]

// Geeft { s, fotoIds }: een stand zoals in prikbord.v1, en de id's van de foto's.
export function volBord({ aantal = 300, fotos = 60, naam = 'Thuis', emoji = '🏠', ikNaam = 'Oscar', voorvoegsel = 'p' } = {}) {
  const rnd = prng(42)
  const s = beginStaat(NU - 90 * 864e5)
  const bord = s.borden[s.bord]
  bord.info.naam = { w: naam, t: NU }
  bord.info.emoji = { w: emoji, t: NU }
  const ik = s.apparaat.ik[s.bord]
  bord.leden[ik].naam = { w: ikNaam, t: NU }
  const leden = [ik, voegLidToe(bord, { id: 'lidtara1', naam: 'Tara', kleur: 'blauw', now: NU }), voegLidToe(bord, { id: 'lidsam01', naam: 'Sam', kleur: 'groen', now: NU })]
  const fotoIds = []
  for (let i = 0; i < aantal; i++) {
    // Meestal kort, soms een lang verhaal (tot 500 tekens).
    const r = rnd()
    let tekst = ZINNEN[Math.floor(rnd() * ZINNEN.length)]
    if (r > 0.7) tekst = `${tekst}. ${ZINNEN[Math.floor(rnd() * ZINNEN.length)]}. ${ZINNEN[Math.floor(rnd() * ZINNEN.length)]}`
    if (r > 0.93) tekst = `${tekst} ${'En dan nog dit en dat, want er is altijd meer te doen. '.repeat(6)}`.slice(0, 500)
    const b = nieuwBriefje(bord, {
      id: `${voorvoegsel}${String(i).padStart(4, '0')}`,
      door: leden[Math.floor(rnd() * 3)],
      tekst,
      cat: THUIS_CATS[Math.floor(rnd() * THUIS_CATS.length)].id,
      now: NU - (i + 1) * 3600e3,
    })
    if (rnd() < 0.2) zetVeld(b, 'link', `https://www.example.nl/recept/${i}`, NU)
    if (rnd() < 0.15) zetVeld(b, 'plek', { lat: 52 + rnd(), lng: 4 + rnd(), naam: `Plek ${i}` }, NU)
    for (const l of leden) if (rnd() < 0.3) zetHart(b, l, true, NU)
    if (fotoIds.length < fotos && rnd() < (fotos - fotoIds.length) / (aantal - i)) {
      const f = `${voorvoegsel}foto${String(i).padStart(6, '0')}x`
      zetVeld(b, 'foto', f, NU)
      fotoIds.push(f)
    }
  }
  return { s, fotoIds }
}

// Een "foto" van 1600 × 1200 zoals de app hem bewaart (JPEG, kwaliteit 0,8).
// Ruis: zwaar, zoals een foto vol detail (± 300 KB).
export async function ruisFoto(n) {
  const ruis = await sharp({ create: { width: 1600, height: 1200, channels: 3, noise: { type: 'gaussian', mean: 120 + n * 10, sigma: 40 } } })
    .blur(1.2)
    .png()
    .toBuffer()
  return sharp(ruis).jpeg({ quality: 80 }).toBuffer()
}

// Een tekening van 1600 × 1200 (lucht, zon, heuvels): even groot in
// beeldpunten, maar een klein bestand, voor in een back-upbestand.
export async function tekenFoto(n) {
  const r = prng(n + 7)
  const tint = Math.round(r() * 360)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">
    <defs><linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${tint},60%,72%)"/><stop offset="1" stop-color="hsl(${(tint + 40) % 360},70%,88%)"/></linearGradient></defs>
    <rect width="1600" height="1200" fill="url(#l)"/>
    <circle cx="${300 + r() * 1000}" cy="${200 + r() * 200}" r="${90 + r() * 60}" fill="hsl(45,95%,62%)"/>
    <path d="M0 ${800 + r() * 100} Q 400 ${600 + r() * 150} 800 ${780 + r() * 100} T 1600 ${720 + r() * 120} V1200 H0Z" fill="hsl(${(tint + 120) % 360},40%,45%)"/>
    <path d="M0 ${950 + r() * 60} Q 500 ${850 + r() * 80} 1000 ${960 + r() * 60} T 1600 ${900 + r() * 80} V1200 H0Z" fill="hsl(${(tint + 140) % 360},45%,32%)"/>
  </svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer()
}
