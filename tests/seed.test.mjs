import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hash32, prng, uiterlijk, randPolygon, RANDEN } from '../public/js/seed.js'

test('hash32 is vast en verschilt per id', () => {
  assert.equal(hash32('abc'), hash32('abc'))
  assert.notEqual(hash32('abc'), hash32('abd'))
  // Officiële FNV-1a-testvectoren (32 bit). Verandert de hash, dan ziet elk
  // bestaand bord er ineens anders uit.
  assert.equal(hash32(''), 0x811c9dc5)
  assert.equal(hash32('a'), 0xe40c292c)
  assert.equal(hash32('foobar'), 0xbf9cf968)
})

test('prng geeft getallen tussen 0 en 1 en is herhaalbaar', () => {
  const a = prng(42)
  const b = prng(42)
  for (let i = 0; i < 1000; i++) {
    const x = a()
    assert.equal(x, b())
    assert.ok(x >= 0 && x < 1)
  }
})

test('uiterlijk: zelfde id geeft hetzelfde, binnen de grenzen', () => {
  assert.deepEqual(uiterlijk('Xy12abcd'), uiterlijk('Xy12abcd'))
  const r = prng(7)
  for (let i = 0; i < 500; i++) {
    const id = Math.floor(r() * 1e12).toString(36)
    const u = uiterlijk(id)
    assert.ok(Math.abs(u.draai) <= 3.5, 'draai')
    assert.ok(Math.abs(u.dx) <= 5 && Math.abs(u.dy) <= 3, 'verschuiving')
    assert.ok(Number.isInteger(u.rand) && u.rand >= 0 && u.rand < RANDEN, 'rand')
    assert.ok(u.punaiseX >= 40 && u.punaiseX <= 60, 'punaise')
  }
})

test('randPolygon is een geldige, vaste polygon', () => {
  const vorm = { boven: { diepte: 4, punten: 20 }, rechts: { diepte: 1, punten: 6 }, onder: { diepte: 1, punten: 6 }, links: { diepte: 1, punten: 6 } }
  const p = randPolygon(3, vorm)
  assert.equal(p, randPolygon(3, vorm))
  assert.notEqual(p, randPolygon(4, vorm))
  assert.match(p, /^polygon\(.+\)$/)
  assert.ok(!/NaN|undefined/.test(p))
  const perf = randPolygon(1, { ...vorm, boven: { perforatie: { aantal: 12, diepte: 3 } } })
  assert.ok(!/NaN|undefined/.test(perf))
})
