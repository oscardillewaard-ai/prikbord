// De gekartelde randen van de briefjes (§5.4): kladblokpapier met de gaatjes
// van de scheurlijn bovenaan en een licht gescheurde onderkant. De vorm
// rekenen we uit (seed.js) en zetten we als een handvol CSS-regels neer:
// elk briefje krijgt via zijn id één van de RANDEN varianten.

import { randPolygon, RANDEN } from './seed.js'

export const RANDVORM = {
  boven: { perforatie: { aantal: 14, diepte: 3 } },
  rechts: { diepte: 0.5, punten: 4 },
  onder: { diepte: 2.5, punten: 16 },
  links: { diepte: 0.5, punten: 4 },
}

export function zetRanden() {
  const el = document.createElement('style')
  el.id = 'randen'
  el.textContent = Array.from({ length: RANDEN }, (_, n) => `.rand-${n}{clip-path:${randPolygon(n, RANDVORM)}}`).join('\n')
  document.head.append(el)
}
