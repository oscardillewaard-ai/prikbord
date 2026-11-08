// Geluidjes (§5.3): een zacht "rrrits" bij het scheuren en een "tok" als de
// punaise erin gaat. Gemaakt met de Web Audio API, dus zonder geluidsbestanden.
// Uit te zetten onder Meer. iOS laat geluid pas toe na een tik: de context
// wordt pas gemaakt bij de eerste tik die een geluidje vraagt.

let ctx = null

function context() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try {
    ctx ||= new AC()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    return null
  }
  return ctx
}

// Papier dat scheurt: ruis met knisperende uitschieters, door een bandfilter
// dat omhoog glijdt (het geluid wordt tijdens het scheuren iets hoger).
export function rrrits() {
  const c = context()
  if (!c) return
  const duur = 0.34
  const n = Math.floor(c.sampleRate * duur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const d = buf.getChannelData(0)
  let knisper = 0
  for (let i = 0; i < n; i++) {
    const t = i / n
    if (i % 90 === 0) knisper = Math.random() < 0.45 ? 1 : 0.2
    const omhulsel = Math.min(1, t * 14) * (1 - t) ** 1.4
    d[i] = (Math.random() * 2 - 1) * omhulsel * knisper
  }
  const bron = c.createBufferSource()
  bron.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 0.9
  filter.frequency.setValueAtTime(1800, c.currentTime)
  filter.frequency.linearRampToValueAtTime(4200, c.currentTime + duur)
  const volume = c.createGain()
  volume.gain.value = 0.5
  bron.connect(filter).connect(volume).connect(c.destination)
  bron.start()
}

// Een korte, houtachtige tik: een toon die snel zakt, plus een klikje.
export function tok() {
  const c = context()
  if (!c) return
  const nu = c.currentTime
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(900, nu)
  osc.frequency.exponentialRampToValueAtTime(170, nu + 0.07)
  const volume = c.createGain()
  volume.gain.setValueAtTime(0.0001, nu)
  volume.gain.exponentialRampToValueAtTime(0.55, nu + 0.004)
  volume.gain.exponentialRampToValueAtTime(0.0001, nu + 0.11)
  osc.connect(volume).connect(c.destination)
  osc.start(nu)
  osc.stop(nu + 0.12)
}

// "Plop": de punaise springt eruit (Gedaan!). Een toon die snel omhoog schiet.
export function plop() {
  const c = context()
  if (!c) return
  const nu = c.currentTime
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(260, nu)
  osc.frequency.exponentialRampToValueAtTime(1100, nu + 0.09)
  const volume = c.createGain()
  volume.gain.setValueAtTime(0.0001, nu)
  volume.gain.exponentialRampToValueAtTime(0.45, nu + 0.01)
  volume.gain.exponentialRampToValueAtTime(0.0001, nu + 0.14)
  osc.connect(volume).connect(c.destination)
  osc.start(nu)
  osc.stop(nu + 0.15)
}
