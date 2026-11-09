// Maakt een proefbord als back-upbestand (M5): 300 briefjes, 40 met foto, om
// op je eigen telefoon te voelen of scrollen vloeiend blijft.
// Gebruik: node scripts/proefbord.mjs [uitbestand]
// Standaard docs/m5/prikbord-backup-proefbord-300.json.
// Op de telefoon: download het bestand, Meer → Terugzetten, kies het bestand.
// Het komt erbij als een eigen bord "Proefbord (300)"; je eigen borden blijven
// zoals ze zijn. Weghalen: wissel naar het proefbord, Meer → Bord verlaten.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { volBord, tekenFoto } from './vol-bord.mjs'

const UIT = process.argv[2] || fileURLToPath(new URL('../docs/m5/prikbord-backup-proefbord-300.json', import.meta.url))
const { s, fotoIds } = volBord({ aantal: 300, fotos: 40, naam: 'Proefbord (300)', emoji: '🧪', ikNaam: 'Ik', voorvoegsel: 'pb' })
const fotos = {}
for (const [i, id] of fotoIds.entries()) fotos[id] = { type: 'image/jpeg', data: (await tekenFoto(i)).toString('base64') }
await mkdir(dirname(UIT), { recursive: true })
await writeFile(UIT, JSON.stringify({ ...s, fotos }))
console.log(`${UIT}: 300 briefjes, ${fotoIds.length} foto's`)
