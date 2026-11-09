// De echte sync-worker (proxy/prikbord-sync-worker.js) op deze computer, met
// een nep-KV in het geheugen. Voor de rooktest (twee browsers op één bord) en
// om het samenwerken zelf te proberen zonder Cloudflare.
// Gebruik: npm run nep-worker  (of: node scripts/nep-worker.mjs 8787)
// Vul daarna in de app bij "Bord delen" http://localhost:8787 in.
// Met --nep-zoek antwoordt een nep-Nominatim op deze computer (een paar vaste
// plekken), zodat zoeken ook zonder internet te proberen is.
import { createServer } from 'node:http'
import worker from '../proxy/prikbord-sync-worker.js'
import { nepKv } from './nep-kv.mjs'

// Een paar vaste plekken voor de nep-zoekdienst.
export const NEP_PLEKKEN = [
  { name: 'Mauritshuis', display_name: 'Mauritshuis, 8, Plein, Centrum, Den Haag, Zuid-Holland, Nederland', lat: '52.0804049', lon: '4.3143911' },
  { name: 'Livraria Lello', display_name: 'Livraria Lello, Rua das Carmelitas, Vitória, Porto, Portugal', lat: '41.1468', lon: '-8.6148' },
  { name: 'Ribeira', display_name: 'Ribeira, Porto, Portugal', lat: '41.1408', lon: '-8.6131' },
]

// Vangt de vragen van de worker aan Nominatim af (alleen die; de rest gaat gewoon).
export function nepNominatim(antwoord = (q) => NEP_PLEKKEN.filter((p) => p.display_name.toLowerCase().includes(q.toLowerCase().split(' ')[0]))) {
  const echt = globalThis.fetch
  const vragen = []
  globalThis.fetch = async (url, init) => {
    const u = new URL(String(url))
    if (u.hostname !== 'nominatim.openstreetmap.org') return echt(url, init)
    vragen.push({ q: u.searchParams.get('q'), ua: init?.headers?.['User-Agent'], t: Date.now() })
    return Response.json(antwoord(u.searchParams.get('q') || ''))
  }
  return { vragen, terug: () => (globalThis.fetch = echt) }
}

export function startWorker(poort = 8787, kv = nepKv(), { env = {} } = {}) {
  const server = createServer(async (req, res) => {
    const stukken = []
    for await (const s of req) stukken.push(s)
    const body = Buffer.concat(stukken)
    const request = new Request(`http://localhost:${poort}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body,
    })
    const antwoord = await worker.fetch(request, { PRIKBORD: kv, ...env })
    res.writeHead(antwoord.status, Object.fromEntries(antwoord.headers))
    res.end(Buffer.from(await antwoord.arrayBuffer()))
  })
  return new Promise((ok) => server.listen(poort, '127.0.0.1', () => ok({ server, kv, env })))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const poort = Number(process.argv.find((a) => /^\d+$/.test(a)) || 8787)
  if (process.argv.includes('--nep-zoek')) nepNominatim()
  await startWorker(poort)
  console.log(`Nep-worker draait op http://localhost:${poort}/ (gegevens alleen in het geheugen${process.argv.includes('--nep-zoek') ? ', nep-zoekdienst' : ''})`)
}
