# Prikbord 📌

Een digitaal prikbord vol afgescheurde briefjes: to-do's, bucketlist,
vakantie-ideetjes en recepten om te proberen. Een idee = een papiertje
afscheuren, erop schrijven en op het bord prikken. Later ook samen met
anderen op één bord.

Gewone HTML/CSS/JS met ES-modules, zonder buildstap en zonder frameworks.
Alleen de map `public/` wordt gedeployd, naar
`https://oscardillewaard-ai.github.io/prikbord/` (na een push naar `main`).

- Opdracht (leidend): [`docs/prikbord-spec.md`](docs/prikbord-spec.md)
- Bewuste afwijkingen: [`docs/prikbord-afwijkingen.md`](docs/prikbord-afwijkingen.md)
- Voortgang en overdracht tussen chats: [`docs/prikbord-voortgang.md`](docs/prikbord-voortgang.md)

## Ontwikkelen

```
npm ci
npm run serve        # http://localhost:4173/
npm test             # node --test tests/*.test.mjs (zonder dependencies)
npm run lint         # oxlint
npm run rooktest     # Playwright-rooktest in Chromium
npm run icons        # iconen uit scripts/prikbord-icon.svg
npm run screenshots  # schermen en filmstrip op 390 px in docs/m1-stijl/
```

Gegevens staan in `localStorage` onder `prikbord.v1` (die naam verandert nooit
meer). Bij een release: `APP_VERSION` in `public/js/app.js` en `CACHE` in
`public/sw.js` ophogen en bovenaan `CHANGELOG` in `app.js` een regel
toevoegen. `tests/sw.test.mjs` bewaakt dat ze bij elkaar passen.

De volledige uitleg (zoals bij Tarapp en Parkenjacht) volgt in M5.
