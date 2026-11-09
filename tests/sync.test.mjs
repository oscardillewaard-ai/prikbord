// De sync-laag (public/js/sync.js): het verschil, in delen versturen, de
// koppel-link, en de motor tegen de echte worker.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verschil, inDelen, maakKoppel, leesKoppel, nieuweCode, peilInterval, MAX_PUT, PEIL_SNEL_MS, PEIL_RUSTIG_MS } from '../public/js/sync.js'
import { schoonAdres, schoonSync, GROEP_RE } from '../public/js/validate.js'
import { mergeBord } from '../public/js/merge.js'
import { nieuwBord, voegLidToe, nieuwBriefje, zetVeld, zetHart, verwijder, zetLid, zetInfo, ledenVan, waarde } from '../public/js/model.js'
import { nepKv } from '../scripts/nep-kv.mjs'
import { telefoon, SERVER, CODE } from './hulp.mjs'

const NU = 1_762_600_000_000
const J = JSON.stringify

function bordMet(n) {
  const bord = nieuwBord({ id: 'bordsync1', naam: 'Thuis', emoji: '🏠', now: NU })
  const ik = voegLidToe(bord, { naam: 'Oscar', now: NU })
  for (let i = 0; i < n; i++) nieuwBriefje(bord, { id: `brf${String(i).padStart(5, '0')}`, door: ik, tekst: `Briefje ${i}`, cat: 'todo', now: NU + i })
  return { bord, ik }
}

test('verschil: niets als de server alles heeft, alleen het gewijzigde briefje als er iets veranderde', () => {
  const { bord, ik } = bordMet(5)
  const server = structuredClone(bord)
  assert.equal(verschil(bord, server), null)
  zetHart(bord.briefjes.brf00002, ik, true, NU + 100)
  const deel = verschil(bord, server)
  assert.deepEqual(Object.keys(deel.briefjes), ['brf00002'])
  assert.deepEqual(deel.info, {})
  assert.deepEqual(deel.cats, {})
  // Heeft de server iets nieuwers dan de telefoon? Dan hoeft er niets heen.
  zetVeld(server.briefjes.brf00003, 'tekst', 'Nieuwer op de server', NU + 200)
  assert.deepEqual(Object.keys(verschil(bord, server).briefjes), ['brf00002'])
  // Een grafsteen, een lid en de bordnaam gaan ook mee.
  verwijder(bord, 'brf00004', NU + 300)
  zetLid(bord, ik, 'kleur', 'blauw', NU + 300)
  zetInfo(bord, 'naam', 'Ons huis', NU + 300)
  const d2 = verschil(bord, server)
  assert.ok(d2.briefjes.brf00004.weg)
  assert.equal(d2.leden[ik].kleur.w, 'blauw')
  assert.equal(d2.info.naam.w, 'Ons huis')
  // De server samengevoegd met het verschil = alles samengevoegd.
  assert.equal(J(mergeBord(server, d2)), J(mergeBord(server, bord)))
})

test('verschil: als de server nog niets heeft, gaat alles mee', () => {
  const { bord } = bordMet(3)
  const deel = verschil(bord, null)
  assert.equal(J(mergeBord(null, deel)), J(bord))
})

test('inDelen: een groot bord gaat in stukken onder de 200 KB, en niets raakt kwijt', () => {
  const { bord, ik } = bordMet(0)
  for (let i = 0; i < 300; i++) {
    const b = nieuwBriefje(bord, { id: `vol${String(i).padStart(5, '0')}`, door: ik, tekst: 'ë'.repeat(500), cat: 'todo', now: NU + i })
    zetVeld(b, 'vrij', { x: i, y: i * 2 }, NU + i)
    zetHart(b, ik, true, NU + i)
  }
  const deel = verschil(bord, null)
  const delen = inDelen(deel)
  assert.ok(delen.length >= 2, `${delen.length} delen`)
  for (const d of delen) assert.ok(new TextEncoder().encode(J({ bord: d })).length <= MAX_PUT)
  assert.equal(J(delen.reduce((a, d) => mergeBord(a, d), null)), J(bord))
  // Een klein verschil: gewoon in één keer.
  assert.equal(inDelen(verschil(bordMet(2).bord, null)).length, 1)
})

test('koppel-link: heen en terug, ook met emoji en é in de bordnaam', () => {
  const link = maakKoppel('https://oscardillewaard-ai.github.io/prikbord/', { u: SERVER, r: CODE, n: 'Groepsreis Porto 🇵🇹 café' })
  assert.match(link, /^https:\/\/oscardillewaard-ai\.github\.io\/prikbord\/#koppel=[A-Za-z0-9_-]+$/)
  assert.deepEqual(leesKoppel(link), { u: SERVER, r: CODE, n: 'Groepsreis Porto 🇵🇹 café' })
  // Midden in een appje werkt ook.
  assert.deepEqual(leesKoppel(`Doe je mee? ${link} 😄`), { u: SERVER, r: CODE, n: 'Groepsreis Porto 🇵🇹 café' })
  // Kapot of verdacht: null.
  const code = (o) => `#koppel=${Buffer.from(J(o)).toString('base64url')}`
  assert.equal(leesKoppel('https://oscardillewaard-ai.github.io/prikbord/'), null)
  assert.equal(leesKoppel('#koppel=!!!'), null)
  assert.equal(leesKoppel('#koppel=bm9rIGpzb24'), null)
  assert.equal(leesKoppel(code({ u: 'javascript:alert(1)', r: CODE, n: 'x' })), null)
  assert.equal(leesKoppel(code({ u: 'http://kwaad.example', r: CODE, n: 'x' })), null)
  assert.equal(leesKoppel(code({ u: SERVER, r: 'kort', n: 'x' })), null)
  // Geen naam: dan "Prikbord"; te lang: ingekort.
  assert.equal(leesKoppel(code({ u: SERVER, r: CODE })).n, 'Prikbord')
  assert.equal(leesKoppel(code({ u: SERVER, r: CODE, n: 'a'.repeat(100) })).n.length, 60)
})

test('groepscode: lang, willekeurig en geldig', () => {
  const codes = new Set(Array.from({ length: 500 }, nieuweCode))
  assert.equal(codes.size, 500)
  for (const c of codes) assert.match(c, GROEP_RE)
  assert.equal([...codes][0].length, 24)
})

test('sync-adres en prikbord.sync worden gecontroleerd', () => {
  assert.equal(schoonAdres('https://prikbord.oscar.workers.dev/'), 'https://prikbord.oscar.workers.dev')
  assert.equal(schoonAdres('http://localhost:8787'), 'http://localhost:8787')
  assert.equal(schoonAdres('http://prikbord.workers.dev'), '')
  assert.equal(schoonAdres('javascript:alert(1)'), '')
  assert.equal(schoonAdres('https://a.b/c?x=1'), '')
  assert.deepEqual(schoonSync(null), { url: '', borden: {} })
  assert.deepEqual(schoonSync({ url: 'https://x.dev/', borden: { bordsync1: { u: SERVER, r: CODE, extra: 1 }, 'fout id!': { u: SERVER, r: CODE }, bordsync2: { u: SERVER, r: 'kort' } } }), {
    url: 'https://x.dev',
    borden: { bordsync1: { u: SERVER, r: CODE } },
  })
})

test('peilen: elke 10 s als er de laatste 5 minuten iets gebeurde, anders elke 30 s', () => {
  assert.equal(peilInterval(NU, NU - 60_000), PEIL_SNEL_MS)
  assert.equal(peilInterval(NU, NU - 6 * 60_000), PEIL_RUSTIG_MS)
})

test('motor: delen, koppelen, en een briefje van de een verschijnt bij de ander', async () => {
  const env = { PRIKBORD: nepKv() }
  let tijd = NU
  const oscar = telefoon({ env, naam: 'Oscar', klok: () => tijd })
  const tara = telefoon({ env, naam: 'Tara', klok: () => tijd })
  const id = oscar.maakBord(tijd)
  nieuwBriefje(oscar.borden[id], { id: 'sushi001', door: oscar.ik[id], tekst: 'Sushi in Den Haag', cat: 'uiteten', now: tijd })
  assert.equal((await oscar.sync.ronde(id)).status, 'ok')
  assert.deepEqual(oscar.teller, { GET: 1, PUT: 1 }, 'eerst ophalen (nog leeg), dan alles sturen')
  tijd += 1000
  await tara.koppel(tijd)
  assert.ok(tara.borden[id].briefjes.sushi001)
  await tara.sync.ronde(id)
  // Oscar peilt en ziet Tara als lid.
  await oscar.sync.ronde(id)
  assert.deepEqual(ledenVan(oscar.borden[id]).map((l) => l.naam), ['Oscar', 'Tara'])
  // Tara prikt iets; Oscar ziet het na één peiling.
  tijd += 1000
  nieuwBriefje(tara.borden[id], { id: 'taart001', door: tara.ik[id], tekst: 'Appeltaart', cat: 'recepten', now: tijd })
  await tara.sync.ronde(id)
  await oscar.sync.ronde(id)
  assert.equal(waarde(oscar.borden[id].briefjes.taart001.v, 'tekst'), 'Appeltaart')
  assert.equal(J(oscar.borden[id]), J(tara.borden[id]))
  // Niets veranderd: peilen geeft "ongewijzigd" en schrijft niets in KV.
  const schrijfVoor = env.PRIKBORD.tel.schrijf
  const geschrevenVoor = oscar.geschreven
  await oscar.sync.ronde(id)
  assert.equal(env.PRIKBORD.tel.schrijf, schrijfVoor)
  assert.equal(oscar.geschreven, geschrevenVoor)
  assert.equal(oscar.statussen.at(-1), 'ok')
})

test('motor: alleen gewijzigde briefjes gaan mee', async () => {
  const env = { PRIKBORD: nepKv() }
  const tijd = NU
  const oscar = telefoon({ env, naam: 'Oscar', klok: () => tijd })
  const id = oscar.maakBord(tijd)
  for (let i = 0; i < 50; i++) nieuwBriefje(oscar.borden[id], { id: `veel${String(i).padStart(4, '0')}`, door: oscar.ik[id], tekst: `Briefje ${i}`, cat: 'todo', now: tijd })
  await oscar.sync.ronde(id)
  assert.equal(Object.keys(oscar.verstuurd[0].bord.briefjes).length, 50, 'de eerste keer alles')
  zetHart(oscar.borden[id].briefjes.veel0007, oscar.ik[id], true, tijd + 5)
  zetVeld(oscar.borden[id].briefjes.veel0042, 'tekst', 'Aangepast', tijd + 5)
  await oscar.sync.ronde(id)
  assert.equal(oscar.verstuurd.length, 2)
  const tweede = oscar.verstuurd[1].bord
  assert.deepEqual(Object.keys(tweede.briefjes), ['veel0007', 'veel0042'])
  assert.deepEqual([tweede.info, tweede.cats, tweede.leden], [{}, {}, {}])
})

test('motor: offline blijft het gewijzigd, en gaat mee zodra het weer lukt', async () => {
  const env = { PRIKBORD: nepKv() }
  let tijd = NU
  const oscar = telefoon({ env, naam: 'Oscar', klok: () => tijd })
  const tara = telefoon({ env, naam: 'Tara', klok: () => tijd })
  const id = oscar.maakBord(tijd)
  await oscar.sync.ronde(id)
  await tara.koppel(tijd)
  await tara.sync.ronde(id)
  oscar.online = false
  tijd += 1000
  nieuwBriefje(oscar.borden[id], { id: 'offline1', door: oscar.ik[id], tekst: 'In de trein bedacht', cat: 'todo', now: tijd })
  assert.deepEqual(await oscar.sync.ronde(id), { status: 'offline', fout: 'offline' })
  assert.equal(oscar.statussen.at(-1), 'offline')
  assert.ok(oscar.sync.heeftIets(id))
  oscar.online = true
  await oscar.sync.ronde(id)
  assert.ok(!oscar.sync.heeftIets(id))
  await tara.sync.ronde(id)
  assert.ok(tara.borden[id].briefjes.offline1)
})

test('motor: KV even druk (503) → na een pauze opnieuw, en anders blijft het staan voor de volgende ronde', async () => {
  const env = { PRIKBORD: nepKv() }
  const tijd = NU
  const oscar = telefoon({ env, naam: 'Oscar', klok: () => tijd })
  const id = oscar.maakBord(tijd)
  await oscar.sync.ronde(id)
  const kv = env.PRIKBORD
  const echtePut = kv.put
  let mislukt = 0
  kv.put = async (...a) => {
    if (mislukt++ < 2) throw new Error('429 Too Many Requests')
    return echtePut(...a)
  }
  nieuwBriefje(oscar.borden[id], { id: 'druk0001', door: oscar.ik[id], tekst: 'Toch erdoor', cat: 'todo', now: tijd })
  assert.equal((await oscar.sync.ronde(id)).status, 'ok')
  assert.equal(mislukt, 3)
  assert.ok(!oscar.sync.heeftIets(id))
  // Blijft het druk, dan na max. 1 + 3 pogingen een fout, en niets kwijt.
  kv.put = async () => {
    throw new Error('429 Too Many Requests')
  }
  nieuwBriefje(oscar.borden[id], { id: 'druk0002', door: oscar.ik[id], tekst: 'Later', cat: 'todo', now: tijd })
  const uit = await oscar.sync.ronde(id)
  assert.equal(uit.status, 'fout')
  assert.match(uit.fout, /druk/)
  assert.ok(oscar.sync.heeftIets(id))
  kv.put = echtePut
  await oscar.sync.ronde(id)
  assert.ok(!oscar.sync.heeftIets(id))
})

test('motor: "Dit ben ik al" op een tweede telefoon: hartjes tellen niet dubbel', async () => {
  const env = { PRIKBORD: nepKv() }
  let tijd = NU
  const oscar = telefoon({ env, naam: 'Oscar', klok: () => tijd })
  const tablet = telefoon({ env, naam: 'Oscar', klok: () => tijd })
  const id = oscar.maakBord(tijd)
  nieuwBriefje(oscar.borden[id], { id: 'sushi001', door: oscar.ik[id], tekst: 'Sushi', cat: 'uiteten', now: tijd })
  zetHart(oscar.borden[id].briefjes.sushi001, oscar.ik[id], true, tijd)
  await oscar.sync.ronde(id)
  tijd += 1000
  await tablet.koppel(tijd, { alLid: oscar.ik[id] })
  zetHart(tablet.borden[id].briefjes.sushi001, tablet.ik[id], true, tijd)
  await tablet.sync.ronde(id)
  await oscar.sync.ronde(id)
  const hart = oscar.borden[id].briefjes.sushi001.hart
  assert.deepEqual(Object.keys(hart), [oscar.ik[id]])
  assert.equal(Object.keys(oscar.borden[id].leden).length, 1)
})

test('motor: een bord dat je verliet, wordt niet meer gesynchroniseerd', async () => {
  const env = { PRIKBORD: nepKv() }
  const oscar = telefoon({ env, naam: 'Oscar', klok: () => NU })
  const id = oscar.maakBord(NU)
  await oscar.sync.ronde(id)
  delete oscar.borden[id]
  delete oscar.adres[id]
  oscar.sync.vergeet(id)
  assert.deepEqual(await oscar.sync.ronde(id), { status: 'uit' })
})

test('motor: een briefje van een ander aanpassen gaat mee, ook als verder niemand iets doet', async () => {
  // Bewaakt dat de onthouden serverstand een eigen kopie is: deelt hij een
  // briefje met de telefoon, dan verandert hij stilletjes mee en lijkt er
  // niets gewijzigd.
  const env = { PRIKBORD: nepKv() }
  let tijd = NU
  const oscar = telefoon({ env, naam: 'Oscar', klok: () => tijd })
  const tara = telefoon({ env, naam: 'Tara', klok: () => tijd })
  const id = oscar.maakBord(tijd)
  await oscar.sync.ronde(id)
  await tara.koppel(tijd)
  nieuwBriefje(tara.borden[id], { id: 'vantara1', door: tara.ik[id], tekst: 'Van Tara', cat: 'todo', now: tijd })
  await tara.sync.ronde(id)
  await oscar.sync.ronde(id)
  tijd += 1000
  zetVeld(oscar.borden[id].briefjes.vantara1, 'tekst', 'Van Tara, aangevuld door Oscar', tijd)
  assert.ok(oscar.sync.heeftIets(id))
  await oscar.sync.ronde(id)
  await tara.sync.ronde(id)
  assert.equal(waarde(tara.borden[id].briefjes.vantara1.v, 'tekst'), 'Van Tara, aangevuld door Oscar')
})
