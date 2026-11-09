// De echte sync-worker (proxy/prikbord-sync-worker.js) op deze computer, met
// een nep-KV in het geheugen. Voor de rooktest (twee browsers op één bord) en
// om het samenwerken zelf te proberen zonder Cloudflare.
// Gebruik: npm run nep-worker  (of: node scripts/nep-worker.mjs 8787)
// Vul daarna in de app bij "Bord delen" http://localhost:8787 in.
import { createServer } from 'node:http'
import worker from '../proxy/prikbord-sync-worker.js'
import { nepKv } from './nep-kv.mjs'

export function startWorker(poort = 8787, kv = nepKv()) {
  const server = createServer(async (req, res) => {
    const stukken = []
    for await (const s of req) stukken.push(s)
    const body = Buffer.concat(stukken)
    const request = new Request(`http://localhost:${poort}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body,
    })
    const antwoord = await worker.fetch(request, { PRIKBORD: kv })
    res.writeHead(antwoord.status, Object.fromEntries(antwoord.headers))
    res.end(Buffer.from(await antwoord.arrayBuffer()))
  })
  return new Promise((ok) => server.listen(poort, '127.0.0.1', () => ok({ server, kv })))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const poort = Number(process.argv[2] || 8787)
  await startWorker(poort)
  console.log(`Nep-worker draait op http://localhost:${poort}/ (gegevens alleen in het geheugen)`)
}
