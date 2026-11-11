// Kleine lokale webserver voor public/, om de app op localhost te proberen
// (een service worker werkt alleen op https of localhost).
// Gebruik: npm run serve  (of: node scripts/serve.mjs 4173)
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../public/', import.meta.url))
const POORT = Number(process.argv[2] || process.env.PORT || 4173)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

export function start(poort = POORT) {
  const server = createServer(async (req, res) => {
    let pad = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (pad.endsWith('/')) pad += 'index.html'
    const bestand = normalize(join(ROOT, pad))
    if (!bestand.startsWith(ROOT)) {
      res.writeHead(403).end()
      return
    }
    try {
      if (!(await stat(bestand)).isFile()) throw new Error('geen bestand')
      res.writeHead(200, { 'Content-Type': TYPES[extname(bestand)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(await readFile(bestand))
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Niet gevonden')
    }
  })
  return new Promise((ok) => server.listen(poort, '127.0.0.1', () => ok(server)))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await start()
  console.log(`Prikbord draait op http://localhost:${POORT}/`)
}
