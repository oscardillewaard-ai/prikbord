// Toegankelijkheid controleren met axe-core (M5), in een Playwright-pagina.
// axe-core is een devDependency (MPL-2.0): het draait alleen in de tests en
// komt niet in public/, dus het wordt niet gedeployd.
import { readFile } from 'node:fs/promises'

const AXE = await readFile(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')

// De regels van WCAG 2.2 niveau A en AA, plus de "best practices" van axe.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

// Geeft de overtredingen terug als korte regels ("regel: element — uitleg").
// `uitzonderingen` = regel-id's die op dit scherm bewust niet gelden, met reden
// in de rooktest.
export async function axeScan(p, { uitzonderingen = [] } = {}) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE })
  return p.evaluate(
    async ([tags, uit]) => {
      const r = await window.axe.run(document, {
        runOnly: { type: 'tag', values: tags },
        rules: Object.fromEntries(uit.map((id) => [id, { enabled: false }])),
        resultTypes: ['violations'],
      })
      return r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} — ${v.help}`))
    },
    [TAGS, uitzonderingen],
  )
}

// Leesbare letters op het papier, zoals de browser ze echt tekent. axe-core
// slaat tekst over een achtergrondafbeelding over, en het papier heeft korrel
// en lijntjes: een witte kop op geel papier kwam er zo doorheen (na M5
// gevonden op het welkomstscherm). tests/contrast.test.mjs rekent met de
// kleuren zoals ze in styles.css staan; dit kijkt naar wat er na alle
// CSS-regels van overblijft. Norm: 4,5 : 1 voor elke letter op een briefje.
// Geeft de overtredingen terug als korte regels.
export function papierScan(p) {
  return p.evaluate(() => {
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    const lum = (k) => 0.2126 * lin(k[0]) + 0.7152 * lin(k[1]) + 0.0722 * lin(k[2])
    const rgba = (s) => {
      const m = (s.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number)
      return [m[0], m[1], m[2], m[3] ?? 1]
    }
    // `voor` (met doorzichtigheid) over een dekkende `achter`.
    const over = (voor, achter) => [0, 1, 2].map((i) => voor[i] * voor[3] + achter[i] * (1 - voor[3])).concat(1)
    const fout = new Set()
    for (const papier of document.querySelectorAll('.briefje, .leeg-briefje')) {
      const basis = rgba(getComputedStyle(papier).backgroundColor)
      if (basis[3] < 1 || !papier.getClientRects().length) continue
      const loper = document.createTreeWalker(papier, NodeFilter.SHOW_TEXT)
      for (let n; (n = loper.nextNode()); ) {
        const tekst = n.textContent.trim()
        // Alleen letters en cijfers: een emoji heeft zijn eigen kleuren.
        if (!/[\p{L}\p{N}]/u.test(tekst)) continue
        const el = n.parentElement
        if (el.closest('.vh, [hidden]') || !el.getClientRects().length) continue
        // Lagen tussen de letter en het papier (een label met een wit waas,
        // een knop) en de doorzichtigheid van de letter zelf.
        let achter = basis
        let dek = 1
        const keten = []
        for (let e = el; e && e !== papier; e = e.parentElement) keten.unshift(e)
        for (const e of keten) {
          const cs = getComputedStyle(e)
          const bg = rgba(cs.backgroundColor)
          if (bg[3] > 0) achter = over(bg, achter)
          dek *= Number(cs.opacity)
        }
        const kleur = rgba(getComputedStyle(el).color)
        const voor = over([kleur[0], kleur[1], kleur[2], kleur[3] * dek], achter)
        const [licht, donker] = [lum(voor), lum(achter)].sort((x, y) => y - x)
        const contrast = (licht + 0.05) / (donker + 0.05)
        if (contrast < 4.5) fout.add(`${el.className || el.tagName.toLowerCase()} "${tekst.slice(0, 28)}": ${contrast.toFixed(2)} : 1`)
      }
    }
    return [...fout]
  })
}
