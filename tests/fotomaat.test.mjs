import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doelMaat, besteUitkomst, naarBase64, vanBase64, schoonFotos, fotosVan, POGINGEN, MAX_ZIJDE, DOEL_BYTES } from '../public/js/fotomaat.js'
import { fotoSoort, MAX_FOTO, FOTO_TYPES } from '../public/js/validate.js'
import { beginStaat, nieuwBriefje, zetVeld, verwijder } from '../public/js/model.js'

const NU = 1_762_600_000_000
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
const WEBP = new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 ')

test('verkleinen: langste zijde hooguit 1600 px, verhoudingen gelijk, nooit groter', () => {
  assert.equal(MAX_ZIJDE, 1600)
  // Een staande iPhone-foto (12 MP).
  assert.deepEqual(doelMaat(3024, 4032), { w: 1200, h: 1600 })
  assert.deepEqual(doelMaat(4032, 3024), { w: 1600, h: 1200 })
  // Een panorama.
  assert.deepEqual(doelMaat(16000, 3000), { w: 1600, h: 300 })
  // Al klein genoeg: niets doen.
  assert.deepEqual(doelMaat(800, 600), { w: 800, h: 600 })
  assert.deepEqual(doelMaat(1600, 1600), { w: 1600, h: 1600 })
  // Rare invoer valt terug op 1 px in plaats van te crashen.
  assert.deepEqual(doelMaat(0, NaN), { w: 1, h: 1 })
  assert.deepEqual(doelMaat(20000, 1, 1024), { w: 1024, h: 1 })
})

test('eerste poging is 1600 px met kwaliteit 0,8 (§6.4); de beste uitkomst blijft onder 400 KB', () => {
  assert.deepEqual(POGINGEN[0], { zijde: 1600, kwaliteit: 0.8 })
  for (let i = 1; i < POGINGEN.length; i++) assert.ok(POGINGEN[i].zijde <= POGINGEN[i - 1].zijde)
  assert.equal(DOEL_BYTES, 400 * 1024)
  assert.deepEqual(besteUitkomst([{ bytes: 500_000 }, { bytes: 390_000 }, { bytes: 200_000 }]), { bytes: 390_000 })
  // Niets onder het doel: de kleinste.
  assert.deepEqual(besteUitkomst([{ bytes: 900_000 }, { bytes: 700_000 }, { bytes: 800_000 }]), { bytes: 700_000 })
  assert.equal(besteUitkomst([]), null)
})

test('soort aan de eerste bytes: jpeg, png en webp, en verder niets', () => {
  assert.deepEqual(FOTO_TYPES, ['image/jpeg', 'image/png', 'image/webp'])
  assert.equal(fotoSoort(JPEG), 'image/jpeg')
  assert.equal(fotoSoort(PNG), 'image/png')
  assert.equal(fotoSoort(WEBP), 'image/webp')
  assert.equal(fotoSoort(JPEG.buffer), 'image/jpeg')
  // HEIC (ftypheic), GIF, tekst en leeg: nee.
  assert.equal(fotoSoort(new TextEncoder().encode('\x00\x00\x00\x18ftypheic')), null)
  assert.equal(fotoSoort(new TextEncoder().encode('GIF89a')), null)
  assert.equal(fotoSoort(new TextEncoder().encode('<svg></svg>')), null)
  assert.equal(fotoSoort(new Uint8Array(0)), null)
  assert.equal(fotoSoort(null), null)
  assert.equal(MAX_FOTO, 1_572_864)
})

test('base64 heen en terug, ook voor een foto van een paar honderd KB', () => {
  const groot = new Uint8Array(300_000).map((_, i) => (i * 7919) % 256)
  assert.deepEqual(vanBase64(naarBase64(groot)), groot)
  assert.equal(naarBase64(JPEG), Buffer.from(JPEG).toString('base64'))
})

test("foto's uit een back-up: alleen echte foto's met een goed id en niet te groot", () => {
  const uit = schoonFotos({
    goedeFoto1: { type: 'image/jpeg', data: naarBase64(JPEG) },
    pngFotoTwee: { type: 'image/heic', data: naarBase64(PNG) }, // type komt uit de bytes
    'slecht id!': { data: naarBase64(JPEG) },
    nepFotoDrie: { type: 'image/jpeg', data: btoa('<script>') },
    kapotBase64: { type: 'image/jpeg', data: '%%%niet-base64' },
    teGrootFoto: { type: 'image/jpeg', data: naarBase64(new Uint8Array(MAX_FOTO + 10).map((_, i) => (i < 3 ? JPEG[i] : 0))) },
    geenData123: { type: 'image/jpeg' },
  })
  assert.deepEqual(Object.keys(uit), ['goedeFoto1', 'pngFotoTwee'])
  assert.equal(uit.goedeFoto1.type, 'image/jpeg')
  assert.deepEqual(uit.goedeFoto1.bytes, JPEG)
  assert.equal(uit.pngFotoTwee.type, 'image/png')
  assert.deepEqual(schoonFotos(null), {})
  assert.deepEqual(schoonFotos([1, 2]), {})
})

test("welke foto's horen bij de borden (briefje en Gedaan), niet bij weggehaalde briefjes", () => {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  const ik = s.apparaat.ik[s.bord]
  const a = nieuwBriefje(bord, { id: 'briefjeA1', door: ik, tekst: 'A', cat: 'todo', now: NU })
  const b = nieuwBriefje(bord, { id: 'briefjeB1', door: ik, tekst: 'B', cat: 'todo', now: NU })
  nieuwBriefje(bord, { id: 'briefjeC1', door: ik, tekst: 'C', cat: 'todo', now: NU })
  zetVeld(a, 'foto', 'fotoVanA1', NU + 1)
  zetVeld(a, 'gedaan', { datum: '2026-11-09', foto: 'fotoGedaan1' }, NU + 2)
  zetVeld(b, 'foto', 'fotoVanB1', NU + 1)
  assert.deepEqual([...fotosVan(s.borden)].sort(), ['fotoGedaan1', 'fotoVanA1', 'fotoVanB1'])
  verwijder(bord, 'briefjeB1', NU + 5)
  assert.deepEqual([...fotosVan(s.borden)].sort(), ['fotoGedaan1', 'fotoVanA1'])
  assert.equal(fotosVan(null).size, 0)
})
