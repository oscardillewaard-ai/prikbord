// Vrij-modus (§5.2): met één vinger over het kurk schuiven, knijpen om te
// zoomen, en lang drukken (± 300 ms) om een briefje op te tillen en te slepen.
// Dit bestand doet alleen de vingers en de camera; wat er met het briefje
// gebeurt (opslaan, prikken), regelt app.js via de terugroepfuncties.
// Het rekenwerk van de camera staat puur in layout.js (pasCamera, zoomRond).

import { pasCamera, zoomRond, passendeSchaal, ZOOM_MAX } from './layout.js'

export const LANG_DRUKKEN = 300 // ms
const DREMPEL = 8 // px: zoveel mag je vinger bewegen voordat het "schuiven" wordt
const RAND = 48 // px: zo dicht bij de rand schuift het bord mee tijdens het slepen

// viewport: het venster op het bord (overflow hidden). wereld: het bord zelf
// (wordt verschoven en geschaald). maten(): { vw, vh, ww, wh }. K: px per
// bordeenheid bij schaal 1.
// kanOptillen(plek) → { x, y } (de huidige plek in bordeenheden) of null.
// opSlepen(plek, x, y), opNeerzetten(plek, x, y), opAnnuleren(plek).
export function maakVrij({ viewport, wereld, maten, K, cam: begin, kanOptillen, opSlepen, opNeerzetten, opAnnuleren, opCamera }) {
  let cam = pasCamera(begin || { s: passendeSchaal(maten()), tx: 0, ty: 0 }, maten())
  const punten = new Map() // pointerId → { x, y }
  let modus = null // 'wacht' | 'schuif' | 'knijp' | 'sleep'
  let start = null // gegevens bij het begin van het gebaar
  let timer = 0
  let negeerTot = 0 // klikken na een gebaar negeren (dat was geen tik)
  let rand = { vx: 0, vy: 0, frame: 0 }
  let lopend = null // { plek, grijp: { x, y } } tijdens het slepen
  let laatste = null // laatste vingerpositie tijdens het slepen

  function toon() {
    wereld.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`
    wereld.dataset.schaal = String(cam.s)
    opCamera?.(cam)
  }
  function zet(c, { vlot = false } = {}) {
    cam = pasCamera(c, maten())
    if (vlot) {
      wereld.classList.add('vlot')
      setTimeout(() => wereld.classList.remove('vlot'), 320)
    }
    toon()
  }
  const venster = () => viewport.getBoundingClientRect()
  // Van een punt op het scherm naar bordeenheden.
  function naarBord(px, py) {
    const v = venster()
    return { x: (px - v.left - cam.tx) / cam.s / K, y: (py - v.top - cam.ty) / cam.s / K }
  }

  // ---------- Optillen en slepen ----------

  function til(plek, e) {
    const plekNu = kanOptillen(plek)
    if (!plekNu) return false
    const p = naarBord(e.clientX, e.clientY)
    lopend = { plek, grijp: { x: p.x - plekNu.x, y: p.y - plekNu.y } }
    laatste = { x: e.clientX, y: e.clientY }
    modus = 'sleep'
    try {
      viewport.setPointerCapture(e.pointerId)
    } catch {
      // De vinger is al weg.
    }
    return true
  }
  function sleepNaar(px, py) {
    if (!lopend) return
    const p = naarBord(px, py)
    opSlepen(lopend.plek, p.x - lopend.grijp.x, p.y - lopend.grijp.y)
  }
  // Dicht bij de rand: het bord schuift mee, het briefje blijft onder je vinger.
  function randSchuiven() {
    if (!lopend || (!rand.vx && !rand.vy)) {
      rand.frame = 0
      return
    }
    zet({ ...cam, tx: cam.tx + rand.vx, ty: cam.ty + rand.vy })
    sleepNaar(laatste.x, laatste.y)
    rand.frame = requestAnimationFrame(randSchuiven)
  }
  function bijRand(px, py) {
    const v = venster()
    const kracht = (afstand) => (afstand < RAND ? ((RAND - afstand) / RAND) * 12 : 0)
    rand.vx = kracht(px - v.left) - kracht(v.right - px)
    rand.vy = kracht(py - v.top) - kracht(v.bottom - py)
    if ((rand.vx || rand.vy) && !rand.frame) rand.frame = requestAnimationFrame(randSchuiven)
  }
  function stopSlepen(neerzetten) {
    const l = lopend
    lopend = null
    rand.vx = rand.vy = 0
    if (!l) return
    if (neerzetten) {
      const p = naarBord(laatste.x, laatste.y)
      opNeerzetten(l.plek, p.x - l.grijp.x, p.y - l.grijp.y)
    } else opAnnuleren(l.plek)
  }

  // ---------- Vingers ----------

  function beginKnijpen() {
    const [a, b] = [...punten.values()]
    start = { afstand: Math.hypot(a.x - b.x, a.y - b.y) || 1, midden: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam: { ...cam } }
    modus = 'knijp'
  }
  function beginSchuiven(e) {
    start = { x: e.clientX, y: e.clientY, cam: { ...cam } }
    modus = 'schuif'
    try {
      viewport.setPointerCapture(e.pointerId)
    } catch {
      // De vinger is al weg.
    }
  }

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('.zoomknoppen')) return
    punten.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (modus === 'sleep') return // een tweede vinger tijdens het slepen negeren we
    clearTimeout(timer)
    if (punten.size === 2) return beginKnijpen()
    if (punten.size > 2) return
    const plek = e.target.closest('.briefje-plek')
    if (plek && wereld.contains(plek)) {
      modus = 'wacht'
      start = { x: e.clientX, y: e.clientY, cam: { ...cam }, id: e.pointerId }
      timer = setTimeout(() => {
        if (modus === 'wacht' && punten.has(start.id)) til(plek, { clientX: punten.get(start.id).x, clientY: punten.get(start.id).y, pointerId: start.id })
      }, LANG_DRUKKEN)
    } else beginSchuiven(e)
  })

  viewport.addEventListener('pointermove', (e) => {
    if (!punten.has(e.pointerId)) return
    punten.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (modus === 'wacht') {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > DREMPEL) {
        // Toch schuiven in plaats van optillen. Vanaf het beginpunt rekenen,
        // zodat de eerste pixels niet verloren gaan.
        clearTimeout(timer)
        const { x, y } = start
        beginSchuiven(e)
        Object.assign(start, { x, y })
      }
      return
    }
    if (modus === 'schuif') {
      zet({ s: cam.s, tx: start.cam.tx + e.clientX - start.x, ty: start.cam.ty + e.clientY - start.y })
    } else if (modus === 'knijp' && punten.size >= 2) {
      const [a, b] = [...punten.values()]
      const afstand = Math.hypot(a.x - b.x, a.y - b.y)
      const midden = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const v = venster()
      const s = Math.min(ZOOM_MAX, Math.max(0.05, start.cam.s * (afstand / start.afstand)))
      const z = zoomRond(start.cam, s, start.midden.x - v.left, start.midden.y - v.top)
      zet({ s: z.s, tx: z.tx + midden.x - start.midden.x, ty: z.ty + midden.y - start.midden.y })
    } else if (modus === 'sleep') {
      laatste = { x: e.clientX, y: e.clientY }
      sleepNaar(e.clientX, e.clientY)
      bijRand(e.clientX, e.clientY)
    }
  })

  function los(e, geannuleerd) {
    if (!punten.has(e.pointerId)) return
    punten.delete(e.pointerId)
    clearTimeout(timer)
    if (modus === 'wacht') {
      modus = null // een gewone tik: de klik opent het briefje (app.js)
      return
    }
    if (modus === 'sleep') {
      if (punten.size) return
      stopSlepen(!geannuleerd)
    }
    negeerTot = performance.now() + 400
    if (modus === 'knijp' && punten.size === 1) {
      // Eén vinger blijft: verder schuiven vanaf hier.
      const [id, p] = [...punten.entries()][0]
      return beginSchuiven({ clientX: p.x, clientY: p.y, pointerId: id })
    }
    if (!punten.size) modus = null
  }
  viewport.addEventListener('pointerup', (e) => los(e, false))
  viewport.addEventListener('pointercancel', (e) => los(e, true))

  // Na schuiven, knijpen of slepen is de klik die volgt geen tik op een
  // briefje. (De zoomknoppen doen gewoon mee.)
  viewport.addEventListener(
    'click',
    (e) => {
      if (performance.now() < negeerTot && e.target.closest('.briefje-plek')) {
        e.stopPropagation()
        e.preventDefault()
      }
    },
    true,
  )
  // Geen menuutje bij lang drukken, en op de iPhone niet de hele pagina zoomen.
  viewport.addEventListener('contextmenu', (e) => e.preventDefault())
  for (const naam of ['gesturestart', 'gesturechange']) viewport.addEventListener(naam, (e) => e.preventDefault())

  // Muis en touchpad: scrollen schuift, knijpen op het touchpad (ctrl) zoomt.
  viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const v = venster()
        const s = cam.s * Math.exp(-e.deltaY * 0.01)
        zet(zoomRond(cam, Math.min(ZOOM_MAX, s), e.clientX - v.left, e.clientY - v.top))
      } else zet({ s: cam.s, tx: cam.tx - e.deltaX, ty: cam.ty - e.deltaY })
    },
    { passive: false },
  )

  toon()

  return {
    get cam() {
      return cam
    },
    zet,
    // Opnieuw binnen de grenzen (na het neerleggen of een andere schermmaat).
    pas: () => zet(cam),
    // Knoppen: inzoomen, uitzoomen, het hele bord.
    zoom(factor) {
      const v = venster()
      zet(zoomRond(cam, Math.min(ZOOM_MAX, cam.s * factor), v.width / 2, v.height / 2), { vlot: true })
    },
    passend() {
      zet({ s: passendeSchaal(maten()), tx: 0, ty: 0 }, { vlot: true })
    },
    // Een element in beeld brengen (bijv. een nieuw briefje dat gaat landen).
    toon(el) {
      const v = venster()
      const r = el.getBoundingClientRect()
      const dx = r.left < v.left + 12 || r.right > v.right - 12 ? v.left + v.width / 2 - (r.left + r.width / 2) : 0
      const dy = r.top < v.top + 12 || r.bottom > v.bottom - 12 ? v.top + v.height / 2 - (r.top + r.height / 2) : 0
      if (dx || dy) zet({ s: cam.s, tx: cam.tx + dx, ty: cam.ty + dy })
    },
    bezig: () => modus === 'sleep' || modus === 'knijp' || modus === 'schuif',
  }
}
