// Stijl van kurk en papier. Tijdelijk drie voorstellen (M1); zodra er een
// keuze is, blijft er één over. Kies met ?stijl=a|b|c in de adresbalk.
// De kleuren, de letter en de punaises staan in styles.css onder
// html[data-stijl="…"]; hier staat alleen de vorm van de scheurrand, want die
// rekenen we uit (seed.js) en zetten we als een handvol CSS-regels neer.

import { randPolygon, RANDEN } from './seed.js'

export const STIJLEN = {
  a: {
    naam: 'Klassiek kurk',
    // Bovenkant echt afgescheurd van het blok, de rest bijna recht.
    rand: { boven: { diepte: 4.5, punten: 26 }, rechts: { diepte: 0.8, punten: 5 }, onder: { diepte: 0.8, punten: 5 }, links: { diepte: 0.8, punten: 5 } },
  },
  b: {
    naam: 'Licht & luchtig',
    // Zacht gerafeld aan alle kanten, zoals handgeschept papier.
    rand: { boven: { diepte: 1.6, punten: 18 }, rechts: { diepte: 1.6, punten: 12 }, onder: { diepte: 1.6, punten: 18 }, links: { diepte: 1.6, punten: 12 } },
  },
  c: {
    naam: 'Schoolschrift',
    // Van een kladblok met scheurlijn: gaatjes bovenaan, rechte zijkanten.
    rand: { boven: { perforatie: { aantal: 14, diepte: 3 } }, rechts: { diepte: 0.5, punten: 4 }, onder: { diepte: 2.5, punten: 16 }, links: { diepte: 0.5, punten: 4 } },
  },
}

export function kiesStijl() {
  let id = new URLSearchParams(location.search).get('stijl')
  if (!STIJLEN[id]) id = 'a'
  document.documentElement.dataset.stijl = id
  const regels = Array.from({ length: RANDEN }, (_, n) => `.rand-${n}{clip-path:${randPolygon(n, STIJLEN[id].rand)}}`)
  let el = document.getElementById('randen')
  if (!el) {
    el = document.createElement('style')
    el.id = 'randen'
    document.head.append(el)
  }
  el.textContent = regels.join('\n')
  return id
}
