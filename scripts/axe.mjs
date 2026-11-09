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
