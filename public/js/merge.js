// Samenvoegen van twee standen van een bord (puur).
// Per veld wint de jongste wijziging (§6.3), niet per briefje: geeft de een
// een hartje terwijl de ander de tekst aanpast, dan blijven beide bewaard.
// Bij een gelijk tijdstip kiezen we vast op de JSON van de waarde, zodat elke
// telefoon hetzelfde kiest. Daardoor is samenvoegen commutatief, associatief
// en idempotent (zie tests/merge.test.mjs).
//
// Verwacht schone invoer (validate.js): objecten in vaste volgorde.

const sleutel = (w) => JSON.stringify(w) ?? ''

export function mergeRegister(a, b) {
  if (!a) return b || null
  if (!b) return a
  if (a.t !== b.t) return a.t > b.t ? a : b
  return sleutel(a.w) >= sleutel(b.w) ? a : b
}

// Twee objecten met registers ({ veld: { w, t } }), sleutels op volgorde.
export function mergeVelden(a = {}, b = {}) {
  const uit = {}
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const r = mergeRegister(a[k], b[k])
    if (r) uit[k] = r
  }
  return uit
}

function mergeMap(a = {}, b = {}, f) {
  const uit = {}
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    uit[k] = a[k] && b[k] ? f(a[k], b[k]) : a[k] || b[k]
  }
  return uit
}

// Maker en tijdstip veranderen nooit. Mochten ze toch verschillen (dat hoort
// niet), dan kiezen we vast het vroegste.
const eerste = (a, b) => (a.gemaakt !== b.gemaakt ? (a.gemaakt < b.gemaakt ? a : b) : a.door <= b.door ? a : b)

export function mergeBriefje(a, b) {
  if (!a) return b || null
  if (!b) return a
  const { id } = a
  const { door, gemaakt } = eerste(a, b)
  // Een grafsteen wint van elke bewerking (§6.2).
  const weg = Math.max(a.weg || 0, b.weg || 0)
  if (weg) return { id, door, gemaakt, weg }
  return { id, door, gemaakt, v: mergeVelden(a.v, b.v), hart: mergeVelden(a.hart, b.hart) }
}

export function mergeBord(a, b) {
  if (!a) return b || null
  if (!b) return a
  return {
    id: a.id,
    gemaakt: Math.min(a.gemaakt, b.gemaakt),
    info: mergeVelden(a.info, b.info),
    cats: mergeMap(a.cats, b.cats, mergeVelden),
    leden: mergeMap(a.leden, b.leden, mergeVelden),
    briefjes: mergeMap(a.briefjes, b.briefjes, mergeBriefje),
  }
}

// Een back-up samenvoegen met de eigen stand (§4.2: importeren voegt samen).
// Borden met hetzelfde id worden samengevoegd, nieuwe borden komen erbij.
// Instellingen van de telefoon zelf (apparaat) blijven van deze telefoon,
// behalve "wie ben ik" op een bord dat hier nog niet stond.
// Geeft { staat, nieuweBorden, nieuweBriefjes } terug.
export function importeer(staat, backup) {
  const borden = { ...staat.borden }
  const ik = { ...staat.apparaat.ik }
  let nieuweBorden = 0
  let nieuweBriefjes = 0
  for (const [id, bord] of Object.entries(backup.borden)) {
    const eigen = borden[id]
    if (!eigen) {
      nieuweBorden++
      if (backup.apparaat?.ik?.[id]) ik[id] = backup.apparaat.ik[id]
    }
    const samen = mergeBord(eigen, bord)
    for (const bid of Object.keys(samen.briefjes)) {
      if (!eigen?.briefjes[bid] && !samen.briefjes[bid].weg) nieuweBriefjes++
    }
    borden[id] = samen
  }
  const gesorteerd = Object.fromEntries(Object.keys(borden).sort().map((k) => [k, borden[k]]))
  return { staat: { ...staat, borden: gesorteerd, apparaat: { ...staat.apparaat, ik } }, nieuweBorden, nieuweBriefjes }
}
