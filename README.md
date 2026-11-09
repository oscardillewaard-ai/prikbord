# Prikbord 📌

Een digitaal prikbord vol afgescheurde briefjes: to-do's, bucketlist,
vakantie-ideetjes en recepten om te proberen. Een idee = een papiertje
afscheuren, erop schrijven en op het bord prikken. Meerdere borden, en
samen met anderen op één bord via een koppel-link.

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
npm run screenshots:m2  # het bord van M2 (filters, doos, vrij …) in docs/m2-bord/
npm run screenshots:m4  # link, foto en kaart (M4) in docs/m4-kaart/ (met nep-kaarttegels)
npm run worker       # bouwt proxy/prikbord-sync-worker.js (zie hieronder)
npm run nep-worker   # de sync-worker op http://localhost:8787, met KV in het geheugen
npm run nep-worker -- --nep-zoek  # idem, met een nep-zoekdienst (zonder internet)
```

## Samen: de sync-worker

Gedeelde borden lopen via een eigen Cloudflare Worker met KV
(`proxy/prikbord-sync-worker.js`). Bovenin dat bestand staan de stappen om
hem neer te zetten. Het bestand wordt gemaakt met `npm run worker` uit
`proxy/prikbord-worker-kern.js` plus de echte `public/js/validate.js` en
`public/js/merge.js`, zodat app en worker precies hetzelfde controleren en
samenvoegen (zie A5 in de afwijkingen). Pas dus de kern of de modules aan,
niet het gebouwde bestand; `tests/worker.test.mjs` waarschuwt als je het
bouwen vergat. Het adres van de worker komt als `DEFAULT_SYNC_URL` in
`public/js/app.js`.

De worker bewaart ook de foto's van gedeelde borden (één KV-sleutel per foto,
max. 1,5 MB, alleen jpeg, png en webp) en zoekt plekken op naam via Nominatim,
de zoekdienst van OpenStreetMap (alleen na een tik op Zoek, hooguit één keer
per seconde, antwoorden onthouden). Zoeken staat uit met de variabele
`ZOEKEN = uit` in Cloudflare; de andere manieren om een plek te kiezen werken
dan gewoon.

Gegevens staan in `localStorage` onder `prikbord.v1` (die naam verandert nooit
meer). Foto's staan in IndexedDB (database `prikbord`, stores `fotos` en
`wachtrij`), want alle apps op dit domein delen één kleine localStorage. De
kaart gebruikt Leaflet 1.9.4 uit `public/vendor/` (BSD-2, zie
`public/vendor/LEAFLET-LICENSE`) met tegels van OpenStreetMap. De groepscodes van gedeelde borden staan apart onder `prikbord.sync`,
buiten de back-up. Bij een release: `APP_VERSION` in `public/js/app.js` en `CACHE` in
`public/sw.js` ophogen en bovenaan `CHANGELOG` in `app.js` een regel
toevoegen. `tests/sw.test.mjs` bewaakt dat ze bij elkaar passen.

De volledige uitleg (zoals bij Tarapp en Parkenjacht) volgt in M5.
