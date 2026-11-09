// Maakt proxy/prikbord-sync-worker.js: het ene bestand dat Oscar in
// Cloudflare plakt. Het is proxy/prikbord-worker-kern.js, met daarin de
// echte public/js/validate.js en public/js/merge.js geplakt in plaats van de
// imports. Zo controleert en samenvoegt de worker precies zoals de app (zie
// docs/prikbord-afwijkingen.md, A5). tests/worker.test.mjs faalt als het
// bestand niet meer bij de bronnen past.
// Gebruik: npm run worker
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const pad = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
export const UIT = pad('proxy/prikbord-sync-worker.js')

// Een pure module zonder imports, met de exports als gewone declaraties.
function zonderExports(bron, naam) {
  if (/^\s*import\s/m.test(bron)) throw new Error(`${naam} heeft imports; die kan de worker niet aan`)
  return bron.replace(/^export (const|function|class|let) /gm, '$1 ').trimEnd()
}

export async function bouwWorker() {
  const kern = await readFile(pad('proxy/prikbord-worker-kern.js'), 'utf8')
  const regels = kern.split('\n')
  const eersteImport = regels.findIndex((r) => r.startsWith('import '))
  let naImports = eersteImport
  while (regels[naImports]?.startsWith('import ')) naImports++
  const imports = regels.slice(eersteImport, naImports).join('\n')
  for (const nodig of ['../public/js/validate.js', '../public/js/merge.js']) {
    if (!imports.includes(`'${nodig}'`)) throw new Error(`verwachtte een import van ${nodig}`)
  }
  if (regels.slice(eersteImport, naImports).length !== 2) throw new Error('verwachtte precies twee imports (validate.js en merge.js)')
  const kop = regels.slice(0, eersteImport).join('\n').trimEnd()
  const rest = regels.slice(naImports).join('\n').trimStart()
  const validate = zonderExports(await readFile(pad('public/js/validate.js'), 'utf8'), 'validate.js')
  const merge = zonderExports(await readFile(pad('public/js/merge.js'), 'utf8'), 'merge.js')
  return `${kop}
//
// ⚠️ Dit bestand is gemaakt met "npm run worker" uit proxy/prikbord-worker-kern.js,
// public/js/validate.js en public/js/merge.js. Pas die aan, niet dit bestand.

// De geplakte modules bevatten ook wat alleen de app gebruikt (bijv. importeer).
/* eslint-disable no-unused-vars */

// ---------- public/js/validate.js ----------
${validate}

// ---------- public/js/merge.js ----------
${merge}

/* eslint-enable no-unused-vars */

// ---------- de worker ----------
${rest}`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await writeFile(UIT, await bouwWorker())
  console.log('proxy/prikbord-sync-worker.js bijgewerkt')
}
