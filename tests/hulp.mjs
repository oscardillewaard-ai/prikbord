// Hulpjes voor de sync-tests: nep-telefoons die met de echte sync-motor
// (public/js/sync.js) praten met de echte worker (proxy/prikbord-sync-worker.js).
import worker from '../proxy/prikbord-sync-worker.js'
import { maakSync, haalBord } from '../public/js/sync.js'
import { nieuwBord, voegLidToe } from '../public/js/model.js'

export const SERVER = 'https://prikbord.test'
export const CODE = 'Grp_code-1234567890abcd'

// fetch die rechtstreeks de worker aanroept, met echte Request-objecten.
export const naarWorker = (env, teller) => async (url, init = {}) => {
  if (teller) teller[init.method || 'GET'] = (teller[init.method || 'GET'] || 0) + 1
  return worker.fetch(new Request(url, { ...init, headers: { ...init.headers, Origin: 'https://oscardillewaard-ai.github.io' } }), env)
}

// Een telefoon: een paar borden, een klok, en de sync-motor.
export function telefoon({ env, naam, klok, willekeurig = Math.random }) {
  const t = { naam, borden: {}, ik: {}, adres: {}, online: true, statussen: [], geschreven: 0, teller: {}, verstuurd: [] }
  const echteFetch = naarWorker(env, t.teller)
  t.sync = maakSync({
    fetch: (url, init) => {
      if (!t.online) return Promise.reject(new TypeError('Failed to fetch'))
      if (init?.body) t.verstuurd.push(JSON.parse(init.body))
      return echteFetch(url, init)
    },
    lees: (id) => t.borden[id],
    schrijf: (id, samen) => {
      t.borden[id] = samen
      t.geschreven++
    },
    adres: (id) => t.adres[id] || null,
    wacht: async () => {},
    willekeurig,
    online: () => t.online,
    opStatus: (id, s) => t.statussen.push(s.status),
    nu: klok,
  })
  // Een nieuw bord maken en delen.
  t.maakBord = (now, id) => {
    const bord = nieuwBord({ id, naam: 'Groepsreis Porto', emoji: '🧳', sjabloon: 'thuis', now })
    t.ik[bord.id] = voegLidToe(bord, { naam, now })
    t.borden[bord.id] = bord
    t.adres[bord.id] = { u: SERVER, r: CODE }
    return bord.id
  }
  // Koppelen zoals de app: eerst ophalen, dan jezelf erbij als nieuw lid
  // (of "Dit ben ik al": een bestaand lid kiezen).
  t.koppel = async (now, { alLid } = {}) => {
    const { rev, bord } = await haalBord(echteFetch, { u: SERVER, r: CODE })
    // De serverstand onthouden vóór je jezelf toevoegt (onthoud maakt een eigen kopie).
    t.sync.onthoud(bord.id, rev, bord)
    t.ik[bord.id] = alLid || voegLidToe(bord, { naam, now })
    t.borden[bord.id] = bord
    t.adres[bord.id] = { u: SERVER, r: CODE }
    return bord.id
  }
  return t
}
