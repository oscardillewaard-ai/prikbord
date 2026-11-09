// Foto's (§6.4): verkleinen, bewaren in IndexedDB, de uploadwachtrij en
// ophalen bij de sync-worker. Het rekenwerk staat in fotomaat.js.
//
// Waarom IndexedDB en niet localStorage: alle apps op dit domein delen één
// localStorage van een paar MB (§4.2). Foto's daarin kunnen Tarapp en
// Parkenjacht laten vastlopen.
//
// Database "prikbord":
// - fotos:    foto-id → { blob, t }        (t = wanneer hij hier kwam)
// - wachtrij: foto-id → { bord, t }        (moet nog naar de sync-worker)

import { POGINGEN, DOEL_BYTES, doelMaat, besteUitkomst } from './fotomaat.js'
import { fotoSoort, MAX_FOTO } from './validate.js'

const DB_NAAM = 'prikbord'
const DB_VERSIE = 1

export class FotoFout extends Error {}

let dbBelofte = null
function db() {
  if (!dbBelofte) {
    dbBelofte = new Promise((ok, nee) => {
      if (typeof indexedDB === 'undefined') return nee(new FotoFout('Deze browser kan geen foto’s bewaren'))
      const req = indexedDB.open(DB_NAAM, DB_VERSIE)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos')
        if (!d.objectStoreNames.contains('wachtrij')) d.createObjectStore('wachtrij')
      }
      req.onsuccess = () => {
        // Een nieuwere versie van de app in een ander tabblad: loslaten.
        req.result.onversionchange = () => {
          req.result.close()
          dbBelofte = null
        }
        ok(req.result)
      }
      req.onerror = () => nee(req.error || new FotoFout('IndexedDB openen lukt niet'))
      req.onblocked = () => nee(new FotoFout('IndexedDB is even bezet'))
    })
    dbBelofte.catch(() => (dbBelofte = null))
  }
  return dbBelofte
}

// Eén handeling op één store, als Promise.
async function doe(store, modus, fn) {
  const d = await db()
  return new Promise((ok, nee) => {
    const tx = d.transaction(store, modus)
    let uit
    const req = fn(tx.objectStore(store))
    if (req) req.onsuccess = () => (uit = req.result)
    tx.oncomplete = () => ok(uit)
    tx.onerror = () => nee(tx.error)
    tx.onabort = () => nee(tx.error || new FotoFout('opslaan afgebroken (vol?)'))
  })
}

export const bewaarFoto = (id, blob) => doe('fotos', 'readwrite', (s) => s.put({ blob, t: Date.now() }, id))
export const leesFoto = async (id) => (await doe('fotos', 'readonly', (s) => s.get(id)))?.blob || null
export const heeftFoto = async (id) => !!(await doe('fotos', 'readonly', (s) => s.getKey(id)))
export const wisFoto = (id) => doe('fotos', 'readwrite', (s) => s.delete(id))
export const alleFotos = () =>
  doe('fotos', 'readonly', (s) => s.getAllKeys()).then(async (ids) => {
    const uit = []
    for (const id of ids || []) uit.push({ id, ...(await doe('fotos', 'readonly', (s) => s.get(id))) })
    return uit
  })

export const zetInWachtrij = (id, bord) => doe('wachtrij', 'readwrite', (s) => s.put({ bord, t: Date.now() }, id))
export const uitWachtrij = (id) => doe('wachtrij', 'readwrite', (s) => s.delete(id))
export async function wachtrij() {
  const ids = (await doe('wachtrij', 'readonly', (s) => s.getAllKeys())) || []
  const uit = []
  for (const id of ids) uit.push({ id, ...(await doe('wachtrij', 'readonly', (s) => s.get(id))) })
  return uit.sort((a, b) => a.t - b.t)
}

// ---------- Verkleinen ----------

// Een foto inlezen via <img>: dan draait de browser hem zelf rechtop (EXIF,
// bijv. een staande iPhone-foto). Safari kan ook HEIC lezen; Chrome niet.
function laadBeeld(bestand) {
  return new Promise((ok, nee) => {
    const url = URL.createObjectURL(bestand)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => ok({ img, klaar: () => URL.revokeObjectURL(url) })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      nee(new FotoFout('Deze foto kan ik niet lezen. Is het een HEIC-foto? Kies dan een andere, of maak er een schermafbeelding van.'))
    }
    img.src = url
  })
}

const naarBlob = (canvas, kwaliteit) => new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', kwaliteit))

// Verkleint een gekozen foto tot een JPEG van hooguit 1600 px, liefst onder
// de 400 KB (§6.4). Geeft { blob, w, h } terug of gooit een FotoFout.
export async function verklein(bestand) {
  if (!bestand || !bestand.size) throw new FotoFout('Dat bestand is leeg.')
  if (bestand.size > 60 * 1024 * 1024) throw new FotoFout('Die foto is wel héél groot. Kies een kleinere.')
  const { img, klaar } = await laadBeeld(bestand)
  try {
    const bw = img.naturalWidth
    const bh = img.naturalHeight
    if (!bw || !bh) throw new FotoFout('Deze foto kan ik niet lezen.')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const uitkomsten = []
    for (const { zijde, kwaliteit } of POGINGEN) {
      const { w, h } = doelMaat(bw, bh, zijde)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        // Wit eronder: een doorzichtige png wordt anders zwart in jpeg.
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, w, h)
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, w, h)
      }
      const blob = await naarBlob(canvas, kwaliteit)
      if (!blob) throw new FotoFout('Verkleinen lukt niet in deze browser.')
      uitkomsten.push({ blob, w, h, bytes: blob.size })
      if (blob.size <= DOEL_BYTES) break
    }
    const beste = besteUitkomst(uitkomsten)
    if (!beste || beste.bytes > MAX_FOTO) throw new FotoFout('Deze foto wordt niet klein genoeg. Kies een andere.')
    return beste
  } finally {
    klaar()
  }
}

// ---------- Naar en van de sync-worker ----------

const fotoUrl = ({ u, r }, id) => `${u}/bord/${encodeURIComponent(r)}/foto/${encodeURIComponent(id)}`
const metTijd = (ms) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(ms) } : {})

// Geeft 'ok', 'offline' (later opnieuw), 'opnieuw' (server even druk) of
// 'mislukt' (gaat nooit lukken, bijv. te groot).
export async function stuurFoto(fetch, adres, id, blob) {
  let res
  try {
    res = await fetch(fotoUrl(adres, id), { method: 'PUT', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob, cache: 'no-store', ...metTijd(90_000) })
  } catch {
    return 'offline'
  }
  if (res.ok) return 'ok'
  if (res.status === 503 || res.status >= 500 || res.status === 429) return 'opnieuw'
  return 'mislukt'
}

// Geeft { status: 'ok', blob } of { status: 'weg' } (nog niet op de server),
// 'offline' of 'fout'.
export async function haalFoto(fetch, adres, id) {
  let res
  try {
    res = await fetch(fotoUrl(adres, id), metTijd(60_000))
  } catch {
    return { status: 'offline' }
  }
  if (res.status === 404) return { status: 'weg' }
  if (!res.ok) return { status: 'fout' }
  try {
    const blob = await res.blob()
    const type = fotoSoort(new Uint8Array(await blob.slice(0, 16).arrayBuffer()))
    if (!type || blob.size > MAX_FOTO) return { status: 'fout' }
    return { status: 'ok', blob: blob.type === type ? blob : new Blob([blob], { type }) }
  } catch {
    return { status: 'offline' }
  }
}
