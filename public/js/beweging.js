// Het scheur-en-prik-moment (§5.3): scheuren, vliegen, prikken en wiebelen.
// Alles met de Web Animations API, op transform en opacity (die kan de
// browser vloeiend tekenen). Bij prefers-reduced-motion roept app.js deze
// functies niet aan en blijft het bij zachte overgangen.

export const minderBeweging = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const klaar = (anim) => anim.finished.then(
  () => {},
  () => {},
)
const toeval = (min, max) => min + Math.random() * (max - min)

// Waar een briefje op het bord hangt: de doos zonder draaiing, en het punt
// waar hij om draait (de punaise). layout.js zet x, y en draai in data-*.
// In vrij is het hele bord geschaald (data-schaal op de ouder): w, h, ox en oy
// zijn dan de maten van het briefje zelf, `schaal` komt er nog overheen.
export function geometrie(plek) {
  const ouder = plek.parentElement
  const bin = ouder.getBoundingClientRect()
  const schaal = Number(ouder.dataset.schaal || 1)
  const w = plek.offsetWidth
  const px = parseFloat(plek.style.getPropertyValue('--px')) || 50
  return {
    left: bin.left + Number(plek.dataset.x || 0) * schaal,
    top: bin.top + Number(plek.dataset.y || 0) * schaal,
    w,
    h: plek.offsetHeight,
    schaal,
    draai: Number(plek.dataset.draai || 0),
    ox: (w * px) / 100,
    oy: 6,
  }
}

// Transform (met transform-origin 0 0) die een element van breedte W op
// (L, T) precies over het briefje op het bord legt, inclusief zijn draaiing.
function overBriefje(g, L, T, W) {
  return `translate(${g.left - L}px, ${g.top - T}px) scale(${g.schaal}) translate(${g.ox}px, ${g.oy}px) rotate(${g.draai}deg) translate(${-g.ox}px, ${-g.oy}px) scale(${g.w / W})`
}

function vervaag(elementen, van, naar, opties) {
  return elementen.filter(Boolean).map((el) => el.animate([{ opacity: van }, { opacity: naar }], { fill: 'forwards', ...opties }))
}
const randen = (laag) => [...laag.querySelectorAll('.tabjes, .laag-knoppen, .laag-extra')]

// Snippers van de scheurrand: eerst een stukje omhoog, dan dwarrelen ze naar beneden.
function snippers(laag, rect, kleurKlasse) {
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('span')
    s.className = `snipper ${kleurKlasse}`
    const maat = toeval(4, 9)
    const punten = Array.from({ length: 3 }, () => `${Math.round(toeval(0, 100))}% ${Math.round(toeval(0, 100))}%`).join(',')
    s.style.cssText = `left:${rect.left + toeval(6, rect.width - 6)}px;top:${rect.top + toeval(0, 6)}px;width:${maat}px;height:${maat * toeval(0.6, 1.4)}px;clip-path:polygon(${punten})`
    laag.append(s)
    const dx = toeval(-45, 45)
    const draai = toeval(-540, 540)
    s.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx * 0.4}px, ${toeval(-38, -16)}px) rotate(${draai * 0.3}deg)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${dx}px, ${toeval(50, 130)}px) rotate(${draai}deg)`, opacity: 0 },
      ],
      { duration: toeval(750, 1050), easing: 'cubic-bezier(.3,.1,.6,1)' },
    ).finished.then(
      () => s.remove(),
      () => s.remove(),
    )
  }
}

// Tik op het blokje: het bovenste vel scheurt eraf (een rukje omhoog, het
// blokje schokt mee, snippers) en groeit uit tot het schrijfvel.
export function scheurAf(blokVel, velPlek, laag, kleurKlasse) {
  const P = blokVel.getBoundingClientRect()
  const F = velPlek.getBoundingClientRect()
  snippers(laag, P, kleurKlasse)
  blokVel.animate(
    [{ transform: 'rotate(-4deg)' }, { transform: 'translateY(4px) rotate(-1deg)', offset: 0.3 }, { transform: 'rotate(-6deg)', offset: 0.65 }, { transform: 'rotate(-4deg)' }],
    { duration: 320, easing: 'ease-out' },
  )
  const sx = P.width / F.width
  const sy = P.height / F.height
  const dx = P.left - F.left
  const dy = P.top - F.top
  const anim = velPlek.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) rotate(-4deg) scale(${sx}, ${sy})` },
      { transform: `translate(${dx - 26}px, ${dy - 80}px) rotate(-15deg) scale(${sx * 1.4}, ${sy * 1.4})`, offset: 0.26 },
      { transform: 'none' },
    ],
    { duration: 540, easing: 'cubic-bezier(.25,.8,.3,1)' },
  )
  for (const el of randen(laag)) {
    el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 320, easing: 'ease-out', fill: 'backwards' })
  }
  return klaar(anim)
}

// "Prikken!": het vel krimpt en vliegt in een boogje naar zijn plek op het
// bord. Er vliegt een kopie van het echte briefje mee, zodat het precies zo
// landt als het straks hangt. Geeft de kopie terug (app.js ruimt hem op).
export async function vliegNaar(velPapier, plek, laag) {
  const V = velPapier.getBoundingClientRect()
  const g = geometrie(plek)
  const vlieger = plek.cloneNode(true)
  vlieger.classList.remove('verstopt')
  vlieger.classList.add('vlieger')
  vlieger.removeAttribute('data-id')
  vlieger.querySelector('[data-action]')?.removeAttribute('data-action')
  vlieger.setAttribute('aria-hidden', 'true')
  Object.assign(vlieger.style, { left: `${g.left}px`, top: `${g.top}px`, width: `${g.w}px`, transform: 'none' })
  laag.append(vlieger)

  const s = V.width / g.w
  const start = `translate(${V.left - g.left}px, ${V.top - g.top}px) scale(${s})`
  const midden = `translate(${(V.left - g.left) * 0.45}px, ${(V.top - g.top) * 0.45 - 60}px) rotate(${g.draai * 2 - 5}deg) scale(${g.schaal + (s - g.schaal) * 0.3})`
  const eind = `scale(${g.schaal}) translate(${g.ox}px, ${g.oy}px) rotate(${g.draai}deg) translate(${-g.ox}px, ${-g.oy}px)`

  velPapier.closest('.vel-plek').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' })
  vervaag(randen(laag), 1, 0, { duration: 140 })
  vervaag([laag.querySelector('.laag-achter')], 1, 0, { duration: 520, easing: 'ease-in' })
  const anim = vlieger.animate(
    [
      { transform: start, opacity: 0 },
      { opacity: 1, offset: 0.14 },
      { transform: midden, offset: 0.5 },
      { transform: eind, opacity: 1 },
    ],
    { duration: 580, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' },
  )
  await klaar(anim)
  return vlieger
}

// De punaise prikt erin: van boven, groot, dan met een veertje op zijn plek.
// `opImpact` gaat af op het moment dat hij het papier raakt (voor de "tok").
export function prikIn(plek, opImpact) {
  const pin = plek.querySelector('.punaise')
  const papier = plek.querySelector('.briefje')
  const duur = 440
  const raak = 0.6
  const anim = pin.animate(
    [
      { transform: 'translateY(-36px) scale(1.9)', opacity: 0 },
      { transform: 'translateY(-36px) scale(1.9)', opacity: 1, offset: 0.18, easing: 'cubic-bezier(.55,0,1,.45)' },
      { transform: 'translateY(2px) scale(0.85)', offset: raak, easing: 'ease-out' },
      { transform: 'translateY(-2px) scale(1.07)', offset: 0.8 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: duur },
  )
  setTimeout(() => opImpact?.(), duur * raak)
  papier.animate([{ transform: 'none' }, { transform: 'scale(0.97)' }, { transform: 'none' }], { duration: 240, delay: duur * raak - 20, easing: 'ease-out' })
  return klaar(anim)
}

function zwaai(el, hoek, delay) {
  el.animate(
    [{ transform: 'none' }, { transform: `rotate(${hoek}deg)` }, { transform: `rotate(${-hoek * 0.6}deg)` }, { transform: `rotate(${hoek * 0.3}deg)` }, { transform: 'none' }],
    { duration: 680, delay, easing: 'ease-in-out' },
  )
}

// Buren wiebelen even mee: hoe dichterbij, hoe meer. Ze draaien om hun eigen punaise.
export function wiebelBuren(plek, max = 5) {
  const r = plek.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const buren = [...plek.parentElement.querySelectorAll('.briefje-plek:not(.uit):not(.verstopt)')]
    .filter((el) => el !== plek)
    .map((el) => {
      const b = el.getBoundingClientRect()
      const bx = b.left + b.width / 2
      return { el, kant: Math.sign(bx - cx) || 1, afstand: Math.hypot(bx - cx, b.top + b.height / 2 - cy) }
    })
    .filter((b) => b.afstand < r.width * 1.9)
    .sort((a, b) => a.afstand - b.afstand)
    .slice(0, max)
  zwaai(plek.querySelector('.briefje'), 1.4, 120)
  buren.forEach(({ el, kant, afstand }, i) => zwaai(el.querySelector('.briefje'), kant * Math.max(0.7, 2.6 - afstand / r.width), 60 + i * 35))
  return buren.length
}

// Tik op een briefje: het komt van het bord en groeit uit tot groot.
export function vanBord(plek, grootPlek, laag) {
  const g = geometrie(plek)
  const G = grootPlek.getBoundingClientRect()
  const anim = grootPlek.animate(
    [{ transform: overBriefje(g, G.left, G.top, G.width) }, { transform: 'translate(0px, -12px) rotate(-1.5deg)', offset: 0.7 }, { transform: 'none' }],
    { duration: 430, easing: 'cubic-bezier(.3,.9,.3,1)' },
  )
  for (const el of randen(laag)) {
    el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: 220, easing: 'ease-out', fill: 'backwards' })
  }
  return klaar(anim)
}

// "Terughangen": het grote briefje krimpt terug naar zijn plek op het bord.
// `opLanden` gaat af vlak voor het einde, zodat app.js het echte briefje
// alvast kan laten zien terwijl het grote vervaagt.
export function terugNaarBord(grootPlek, plek, laag, opLanden) {
  const g = geometrie(plek)
  const G = grootPlek.getBoundingClientRect()
  const duur = 400
  vervaag(randen(laag), 1, 0, { duration: 140 })
  vervaag([laag.querySelector('.laag-achter')], 1, 0, { duration: duur, easing: 'ease-in' })
  setTimeout(() => opLanden?.(), duur * 0.75)
  const anim = grootPlek.animate(
    [
      { transform: 'none', opacity: 1 },
      { opacity: 1, offset: 0.75 },
      { transform: overBriefje(g, G.left, G.top, G.width), opacity: 0 },
    ],
    { duration: duur, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' },
  )
  return klaar(anim)
}

// Weghalen: het grote briefje valt van het scherm.
export function valWeg(grootPlek, laag) {
  vervaag(randen(laag), 1, 0, { duration: 140 })
  vervaag([laag.querySelector('.laag-achter')], 1, 0, { duration: 460, easing: 'ease-in' })
  return klaar(
    grootPlek.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(40px, 75vh) rotate(28deg)', opacity: 0.2 }], {
      duration: 480,
      easing: 'cubic-bezier(.5,0,.9,.6)',
      fill: 'forwards',
    }),
  )
}

// Zacht dicht: alles in de laag vervaagt (ook bij minder beweging).
export function vervaagLaag(laag, duur = 180) {
  const inhoud = [...laag.children].filter((el) => !el.classList.contains('laag-achter'))
  return Promise.all(vervaag([laag.querySelector('.laag-achter'), ...inhoud], 1, 0, { duration: duur, easing: 'ease-in' }).map(klaar))
}

// ---------- Nieuw in M2 ----------

// Fel, zodat het opvalt tussen het pastelpapier.
const KLEUREN = ['#ff3b5c', '#ffbe0b', '#2f7bff', '#06c48a', '#8a3ffc', '#ff6a00', '#ff1f8f', '#ffffff']

// Een hartje geven (dubbeltik): een groot hart klopt even op het briefje.
export function hartPop(plek) {
  const hart = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  hart.setAttribute('class', 'hart-pop')
  hart.setAttribute('aria-hidden', 'true')
  hart.innerHTML = '<use href="#hart"/>'
  plek.append(hart)
  const anim = hart.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -50%) scale(0.95)', opacity: 1, offset: 0.45 },
      { transform: 'translate(-50%, -50%) scale(1.05)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, -70%) scale(1.1)', opacity: 0 },
    ],
    { duration: 850, easing: 'ease-out' },
  )
  plek.querySelector('.briefje')?.animate([{ transform: 'none' }, { transform: 'scale(1.04)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' })
  return klaar(anim).then(() => hart.remove())
}

// Trek een briefje: het bord schudt even (alles wat in beeld hangt wiebelt),
// dan wiebelt het gekozen briefje los.
export async function schudLos(plekken, gekozen) {
  const inBeeld = plekken.filter((el) => {
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.top < innerHeight
  })
  inBeeld.forEach((el, i) => zwaai(el.querySelector('.briefje'), (i % 2 ? -1 : 1) * toeval(1.2, 2.6), i * 18))
  await new Promise((ok) => setTimeout(ok, 380))
  return klaar(
    gekozen.querySelector('.briefje').animate(
      [{ transform: 'none' }, { transform: 'rotate(7deg) translateY(-3px)' }, { transform: 'rotate(-8deg) translateY(-6px)' }, { transform: 'rotate(5deg) translateY(-8px)' }, { transform: 'translateY(-10px) scale(1.04)' }],
      { duration: 420, easing: 'ease-in-out' },
    ),
  )
}

// "Gedaan!": de punaise springt eruit (`opPlop` op dat moment), het briefje
// kantelt en valt in de doos (het tabje "Gedaan-doos" onderin).
export async function valInDoos(grootPlek, doel, laag, opPlop) {
  const pin = grootPlek.querySelector('.punaise')
  const G = grootPlek.getBoundingClientRect()
  const D = doel.getBoundingClientRect()
  vervaag(randen(laag), 1, 0, { duration: 140 })
  opPlop?.()
  pin?.animate(
    [
      { transform: 'none', opacity: 1 },
      { transform: 'translate(26px, 4px) rotate(70deg) scale(1.35)', opacity: 1, offset: 0.12 },
      { transform: 'translate(58px, -22px) rotate(220deg) scale(1.3)', opacity: 1, offset: 0.4 },
      { transform: 'translate(92px, 90px) rotate(420deg) scale(1)', opacity: 0 },
    ],
    { duration: 700, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' },
  )
  // Het papier zakt eerst een stukje (het hangt niet meer vast) en valt dan.
  const dx = D.left + D.width / 2 - (G.left + G.width / 2)
  const dy = D.top + D.height / 2 - (G.top + G.height * 0.3)
  const s = Math.max(0.08, (D.width * 0.6) / G.width)
  vervaag([laag.querySelector('.laag-achter')], 1, 0, { duration: 700, delay: 200, easing: 'ease-in' })
  const anim = grootPlek.animate(
    [
      { transform: 'none', opacity: 1 },
      { transform: 'translateY(10px) rotate(4deg)', opacity: 1, offset: 0.22, easing: 'ease-in' },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.3}px) rotate(-8deg) scale(${0.6 + s * 0.4})`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) rotate(14deg) scale(${s})`, opacity: 0.35 },
    ],
    { duration: 800, easing: 'cubic-bezier(.5,0,.75,.6)', fill: 'forwards' },
  )
  return klaar(anim)
}

// Confetti vanuit een element (de Gedaan-doos). Op de body, want de laag is dan al dicht.
export function confetti(bron, aantal = 44) {
  const r = bron.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height * 0.3
  const doos = document.createElement('div')
  doos.className = 'confetti'
  doos.setAttribute('aria-hidden', 'true')
  document.body.append(doos)
  const klaarAlles = []
  for (let i = 0; i < aantal; i++) {
    const c = document.createElement('span')
    const maat = toeval(7, 12)
    c.style.cssText = `left:${x}px;top:${y}px;width:${maat}px;height:${maat * toeval(0.4, 1)}px;background:${KLEUREN[i % KLEUREN.length]};border-radius:${Math.random() < 0.3 ? '50%' : '1px'}`
    doos.append(c)
    const hoek = toeval(-Math.PI * 0.88, -Math.PI * 0.12)
    const kracht = toeval(140, 340)
    const tx = Math.cos(hoek) * kracht
    const ty = Math.sin(hoek) * kracht
    klaarAlles.push(
      klaar(
        c.animate(
          [
            { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) rotate(${toeval(-300, 300)}deg)`, opacity: 1, offset: 0.45, easing: 'cubic-bezier(.3,0,.7,1)' },
            { transform: `translate(${tx * 1.3}px, ${ty + toeval(160, 280)}px) rotate(${toeval(-700, 700)}deg)`, opacity: 0 },
          ],
          { duration: toeval(1200, 1800), easing: 'cubic-bezier(.15,.7,.4,1)' },
        ),
      ),
    )
  }
  return Promise.all(klaarAlles).then(() => doos.remove())
}

// Iets stuitert even (bijv. het doos-icoontje als er een briefje in valt).
export function stuiter(el) {
  return klaar(
    el.animate(
      [{ transform: 'none' }, { transform: 'translateY(4px) scale(1.25, 0.8)' }, { transform: 'translateY(-8px) scale(0.9, 1.15)' }, { transform: 'translateY(1px) scale(1.05, 0.95)' }, { transform: 'none' }],
      { duration: 560, easing: 'ease-out' },
    ),
  )
}

// Een briefje komt groot naar het midden, zonder plek op het bord (de Gedaan-doos).
export function popIn(grootPlek, laag) {
  for (const el of randen(laag)) {
    el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: 160, easing: 'ease-out', fill: 'backwards' })
  }
  return klaar(grootPlek.animate([{ transform: 'translateY(30px) scale(0.85) rotate(3deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.3,1.3,.5,1)' }))
}
