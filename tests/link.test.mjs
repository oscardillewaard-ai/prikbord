import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linkUitInvoer, domeinVan } from '../public/js/link.js'

test('link: gewone links blijven zoals ze zijn (alleen netjes gemaakt)', () => {
  assert.equal(linkUitInvoer('https://www.ah.nl/allerhande/recept/R-R1188387'), 'https://www.ah.nl/allerhande/recept/R-R1188387')
  assert.equal(linkUitInvoer('  http://example.com  '), 'http://example.com/')
  assert.equal(linkUitInvoer('https://www.airbnb.nl/rooms/123?check_in=2026-12-01'), 'https://www.airbnb.nl/rooms/123?check_in=2026-12-01')
})

test('link: zonder https ervoor wordt het https', () => {
  assert.equal(linkUitInvoer('ah.nl/allerhande'), 'https://ah.nl/allerhande')
  assert.equal(linkUitInvoer('www.restaurant-de-haven.nl'), 'https://www.restaurant-de-haven.nl/')
  assert.equal(linkUitInvoer('booking.com:8443/x'), 'https://booking.com:8443/x')
})

test('link: uit een geplakt berichtje komt het adres, zonder leesteken erachter', () => {
  assert.equal(linkUitInvoer('Kijk eens! https://ah.nl/recept/123. Lekker toch?'), 'https://ah.nl/recept/123')
  assert.equal(linkUitInvoer('(https://nl.wikipedia.org/wiki/Porto)'), 'https://nl.wikipedia.org/wiki/Porto')
})

test('link: leeg = geen link, en alleen http(s)', () => {
  assert.equal(linkUitInvoer(''), '')
  assert.equal(linkUitInvoer('   '), '')
  for (const slecht of ['javascript:alert(1)', 'mailto:oscar@example.com', 'ftp://ftp.example.com/x', 'data:text/html,hoi', 'gewoon wat tekst', 'localhost:3000', 'file:///etc/passwd']) {
    assert.equal(linkUitInvoer(slecht), undefined, slecht)
  }
})

test('domein voor op het briefje, zonder www', () => {
  assert.equal(domeinVan('https://www.ah.nl/recept'), 'ah.nl')
  assert.equal(domeinVan('https://www2.example.com/'), 'example.com')
  assert.equal(domeinVan('https://nl.wikipedia.org/wiki/Porto'), 'nl.wikipedia.org')
  assert.equal(domeinVan('geen link'), '')
})
