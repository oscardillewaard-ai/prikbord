import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plekUitLink, schoonZoek, plekLabel, korteNaam, maakPlek } from '../public/js/plek.js'

test('Google Maps: de punaise van de plek gaat voor het midden van de kaart, met naam', () => {
  const p = plekUitLink(
    'https://www.google.com/maps/place/Mauritshuis/@52.0804,4.3121,17z/data=!3m1!4b1!4m6!3m5!1s0x47c5b725b2ab8b1d:0x6e7f5a58cdbbbf1f!8m2!3d52.0804049!4d4.3143911!16zL20vMDF4cDZk?entry=ttu',
  )
  assert.deepEqual(p, { lat: 52.080405, lng: 4.314391, naam: 'Mauritshuis' })
})

test('Google Maps: allerlei soorten links', () => {
  assert.deepEqual(plekUitLink('https://www.google.com/maps/@52.0116,4.3571,15z'), { lat: 52.0116, lng: 4.3571 })
  assert.deepEqual(plekUitLink('https://maps.google.com/?q=52.0116,4.3571'), { lat: 52.0116, lng: 4.3571 })
  assert.deepEqual(plekUitLink('https://www.google.com/maps/search/?api=1&query=52.0116%2C4.3571'), { lat: 52.0116, lng: 4.3571 })
  assert.deepEqual(plekUitLink('https://www.google.nl/maps?ll=41.1496,-8.6109&z=12'), { lat: 41.1496, lng: -8.6109 })
  assert.deepEqual(plekUitLink('https://www.google.com/maps/dir/?api=1&destination=41.1579,-8.6291'), { lat: 41.1579, lng: -8.6291 })
  assert.deepEqual(plekUitLink('https://www.google.com/maps/place/Sushi+Den+Haag/@52.07,4.3,17z'), { lat: 52.07, lng: 4.3, naam: 'Sushi Den Haag' })
  assert.deepEqual(plekUitLink('https://www.google.com/maps/place/Caf%C3%A9+de+Zwart/@52.37,4.89,17z'), { lat: 52.37, lng: 4.89, naam: 'Café de Zwart' })
})

test('Google Maps: alleen een plaatsnaam = voorstel om te zoeken; verkorte link = herkend', () => {
  assert.deepEqual(plekUitLink('https://www.google.com/maps/search/?api=1&query=Mauritshuis+Den+Haag'), { zoek: 'Mauritshuis Den Haag' })
  assert.deepEqual(plekUitLink('https://www.google.com/maps/place/Livraria+Lello/'), { zoek: 'Livraria Lello' })
  assert.deepEqual(plekUitLink('Kijk! https://maps.app.goo.gl/AbCdEf123'), { kort: true })
  assert.deepEqual(plekUitLink('https://goo.gl/maps/xyz'), { kort: true })
})

test('OpenStreetMap: de marker gaat voor het midden van de kaart', () => {
  assert.deepEqual(plekUitLink('https://www.openstreetmap.org/#map=17/52.01160/4.35710'), { lat: 52.0116, lng: 4.3571 })
  assert.deepEqual(plekUitLink('https://www.openstreetmap.org/?mlat=52.0116&mlon=4.3571#map=12/52.1/4.2'), { lat: 52.0116, lng: 4.3571 })
  assert.equal(plekUitLink('https://www.openstreetmap.org/node/123456'), null)
  assert.deepEqual(plekUitLink('https://osm.org/go/0E4~~Nb--'), { kort: true })
})

test('Apple Kaarten, geo: en losse coördinaten', () => {
  assert.deepEqual(plekUitLink('https://maps.apple.com/?ll=52.0804,4.3144&q=Mauritshuis'), { lat: 52.0804, lng: 4.3144, naam: 'Mauritshuis' })
  assert.deepEqual(plekUitLink('https://maps.apple.com/place?coordinate=41.1496,-8.6109&name=Ribeira'), { lat: 41.1496, lng: -8.6109, naam: 'Ribeira' })
  assert.deepEqual(plekUitLink('https://maps.apple.com/?address=Plein%208,%20Den%20Haag'), { zoek: 'Plein 8, Den Haag' })
  assert.deepEqual(plekUitLink('geo:52.0116,4.3571?q=Delft'), { lat: 52.0116, lng: 4.3571 })
  assert.deepEqual(plekUitLink(' 52.0116, 4.3571 '), { lat: 52.0116, lng: 4.3571 })
})

test('onzin, andere sites en coördinaten buiten bereik geven null', () => {
  for (const x of ['', 'hallo', 'https://www.ah.nl/recept/123', 'https://www.google.com/search?q=sushi', 'https://www.google.com/maps/@95.1,4.3,15z', '200.1, 4.3', '0, 0', 'https://www.google.com/maps/@%E0%A4%A,4.3']) {
    assert.equal(plekUitLink(x), null, x)
  }
})

test('maakPlek rondt af op zes decimalen en kort de naam in', () => {
  assert.deepEqual(maakPlek(52.123456789, 4.987654321, '  Mooi   plekje  '), { lat: 52.123457, lng: 4.987654, naam: 'Mooi plekje' })
  assert.equal(maakPlek(52, 'x'), null)
  assert.equal(maakPlek(91, 4), null)
  assert.equal(maakPlek(52, 4, 'x'.repeat(200)).naam.length, 120)
})

test('zoekuitkomsten van de worker: gecontroleerd, korte naam, hooguit 5', () => {
  const raw = {
    plekken: [
      { naam: 'Mauritshuis', adres: 'Mauritshuis, 8, Plein, Den Haag, Nederland', lat: 52.0804, lng: 4.3144 },
      { naam: '', adres: '8, Plein, Centrum, Den Haag, Nederland', lat: 52.08, lng: 4.31 },
      { naam: 'Kapot', lat: 'x', lng: 4 },
      { naam: 'Buiten bereik', lat: 120, lng: 4 },
      null,
      ...Array.from({ length: 6 }, (_, i) => ({ naam: `Plek ${i}`, lat: 50 + i, lng: 4 })),
    ],
  }
  const uit = schoonZoek(raw)
  assert.equal(uit.length, 1 + 1) // de eerste vijf: twee goed, drie kapot
  assert.deepEqual(uit[0], { plek: { lat: 52.0804, lng: 4.3144, naam: 'Mauritshuis' }, adres: 'Mauritshuis, 8, Plein, Den Haag, Nederland' })
  assert.equal(uit[1].plek.naam, 'Plein 8')
  assert.deepEqual(schoonZoek({ plekken: 'nee' }), [])
  assert.deepEqual(schoonZoek(null), [])
})

test('label op het briefje: de naam, anders de coördinaten in het Nederlands', () => {
  assert.equal(plekLabel({ lat: 52, lng: 4, naam: 'Delft' }), 'Delft')
  assert.equal(plekLabel({ lat: 52.0116, lng: 4.3571 }), '52,0116° N, 4,3571° O')
  assert.equal(plekLabel({ lat: -33.8568, lng: -151.2153 }), '33,8568° Z, 151,2153° W')
  assert.equal(plekLabel(null), '')
  assert.equal(korteNaam('Livraria Lello, Rua das Carmelitas, Porto'), 'Livraria Lello')
  assert.equal(korteNaam(''), '')
})
