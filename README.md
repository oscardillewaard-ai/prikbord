# Prikbord 📌

Prikbord is een losstaande PWA zonder build-stap (gewone HTML/CSS/JS met
ES-modules, zonder frameworks of CDN's): een digitaal prikbord vol
afgescheurde briefjes voor to-do's, de bucketlist, vakantie-ideetjes en
recepten om te proberen. Een idee = een vel van het scheurblokje rechtsonder
scheuren (rrrits!), erop schrijven en op het bord prikken (tok!). Een briefje
heeft een categorie (die bepaalt de papierkleur) en kan een link, een foto
(als polaroidje), een plek op de kaart en hartjes krijgen; dubbeltikken geeft
een hartje. Het bord staat standaard "netjes rommelig" (de app prikt zelf
neer, een paar graden scheef, overal hetzelfde dankzij een seed op het
briefje-id), of in vrij-modus, waarin je briefjes versleept en knijpt om te
zoomen. Verder: filters per categorie en "💞 Iedereen zin", sorteren op
hartjes, "Trek een briefje" 🎲, een Gedaan-doos (een plakboek per maand met
datum, "Hoe was het?" en een foto) en een kaart met alle briefjes die een plek
hebben. Een telefoon kan op meerdere borden zitten, en een bord kun je delen
met anderen via een koppel-link.

Na deploy staat hij op `https://oscardillewaard-ai.github.io/prikbord/`. Open
dat in Safari op de iPhone → deel-icoon → "Zet op beginscherm" (op Android in
Chrome: menu → "App installeren" of "Toevoegen aan startscherm"). Dezelfde
afspraken als bij Tarapp en Parkenjacht: geen trek-omlaag-om-te-verversen,
blijvende opslag aanvragen (`navigator.storage.persist`, de status staat onder
Meer), een network-first service worker, updates komen vanzelf binnen (nooit
terwijl het schrijfvel, een venster, een sleepbeweging of een foto-upload
bezig is) en tonen eenmalig "Wat is er nieuw?". Een half geschreven briefje
blijft bewaard als concept en staat er bij de volgende start weer.

## Gegevens

Briefjes en borden staan in `localStorage` onder de sleutel `prikbord.v1`;
die naam verandert nooit meer, zodat bestaande installaties hun gegevens
houden. Elk veld van een briefje heeft een eigen tijdstempel, en weghalen zet
een grafsteen (met 5 tellen "Ongedaan maken"). Foto's staan in IndexedDB
(database `prikbord`: `fotos`, de uploadwachtrij `wachtrij`, en `duimen` met
de kleine vierkantjes voor het bord), omdat alle apps op dit domein één kleine
localStorage delen. De groepscodes van gedeelde borden en het adres van de
sync-worker staan apart onder `prikbord.sync`, buiten de back-up. Onder Meer
staan back-up maken (via het deelmenu, met of zonder foto's) en terugzetten;
terugzetten voegt per veld samen, er gaat niets verloren.

## Samen: de sync-worker

Gedeelde borden lopen via een eigen Cloudflare Worker met KV-opslag (binding
`PRIKBORD`, gratis, los van Parkenjacht): `proxy/prikbord-sync-worker.js`.
Bovenin dat bestand staan de stappen om hem neer te zetten, en op `/` staat
een statuspagina in gewone taal. Onder Meer → Samen prikken maak je een
koppel-link (`…/#koppel=…`); de app maakt per bord een lange, willekeurige
groepscode, en die code is het enige wachtwoord. Telefoons sturen alleen
gewijzigde briefjes (1,5 s gebundeld), de worker voegt per veld samen (de
jongste wijziging wint) en geeft de stand terug met een `rev` (een hash).
Zolang het bord open is, peilt de app elke 10 s (na een tijdje rust 30 s), en
meteen bij terugkomen of weer online. Het bolletje naast de bordnaam zegt of
alles is aangekomen. Het adres van de worker kan vast in `DEFAULT_SYNC_URL` in
`public/js/app.js`; zolang dat leeg is, vul je het in bij Samen prikken en
neemt de koppel-link het mee.

Het bestand van de worker wordt gemaakt met `npm run worker` uit
`proxy/prikbord-worker-kern.js` plus de echte `public/js/validate.js` en
`public/js/merge.js`, zodat app en worker precies hetzelfde controleren en
samenvoegen. Pas dus de kern of de modules aan, niet het gebouwde bestand;
`tests/worker.test.mjs` waarschuwt als je het bouwen vergat. De worker
bewaart ook de foto's van gedeelde borden (één KV-sleutel per foto, max.
1,5 MB, alleen jpeg, png en webp) en zoekt plekken op naam via Nominatim, de
zoekdienst van OpenStreetMap (alleen na een tik op Zoek, hooguit één keer per
seconde, antwoorden onthouden). Zoeken staat uit met de variabele
`ZOEKEN = uit` in Cloudflare; tikken op de kaart, je locatie en een link van
Google Maps of OpenStreetMap plakken werken dan gewoon.

## Kaart, letters en iconen

De kaart gebruikt Leaflet 1.9.4 (meegeleverd in `public/vendor/`, BSD-2, zie
`LEAFLET-LICENSE`) met tegels van OpenStreetMap; die laadt de browser zelf en
worden niet in de service worker opgeslagen. De handschriftletter is Caveat
(vet), zelf gehost in `public/fonts/` met het OFL-licentiebestand. Kurk,
hout en papierkorrel zijn kleine SVG's met `feTurbulence` in `public/img/`.
Iconen opnieuw maken: `npm run icons` (uit `scripts/prikbord-icon.svg`).

## Release

Bij een release `APP_VERSION` in `public/js/app.js` en `CACHE` in
`public/sw.js` ophogen en bovenaan `CHANGELOG` in `app.js` een regel
toevoegen; geïnstalleerde apps halen de update dan zelf op en tonen eenmalig
wat er nieuw is. `tests/sw.test.mjs` bewaakt dat versie en cache bij elkaar
passen en dat elk app-bestand in de offline-lijst staat. Deployen = pushen
naar `main`: de workflow `.github/workflows/deploy-pages.yml` draait eerst
lint en tests (gaat er iets mis, dan blijft de vorige versie online) en zet
daarna alleen de map `public/` op GitHub Pages.

## Ontwikkelen

```
npm ci
npm run serve        # http://localhost:4173/
npm test             # node --test tests/*.test.mjs (zonder dependencies)
npm run lint         # oxlint
npm run rooktest     # Playwright-rooktest in Chromium, met axe-core (± 3 minuten)
npm run prestaties   # 300 briefjes scrollen met een vertraagde CPU (zie hieronder)
npm run icons        # iconen uit scripts/prikbord-icon.svg
npm run screenshots  # schermen en filmstrip op 390 px in docs/m1-stijl/
npm run screenshots:m2  # het bord van M2 (filters, doos, vrij …) in docs/m2-bord/
npm run screenshots:m4  # link, foto en kaart (M4) in docs/m4-kaart/ (met nep-kaarttegels)
npm run worker       # bouwt proxy/prikbord-sync-worker.js
npm run nep-worker   # de sync-worker op http://localhost:8787, met KV in het geheugen
npm run nep-worker -- --nep-zoek  # idem, met een nep-zoekdienst (zonder internet)
```

De tests in `tests/` zijn puur (Node, zonder browser): het datamodel,
samenvoegen (commutatief, associatief en idempotent), de layout, filters,
validatie, de koppel-link, foto-rekenwerk, de worker met een nep-KV, een
convergentietest met drie telefoons en een KV die soms schrijfacties kwijtraakt,
een drukke dag aan KV-schrijfacties, en het contrast van de inkt op elke
papierkleur. De rooktest (`scripts/rooktest.mjs`) draait de echte app in
Chromium op 390 px, ook met twee en drie browsers op één bord via de
nep-worker, en controleert elk scherm met axe-core (WCAG 2.2 AA).

Prestaties: `npm run prestaties` zet een bord met 300 briefjes (60 met foto)
neer, vertraagt de CPU 4× (zoals Lighthouse een gewone telefoon nabootst) en
scrolt met een aanraakgebaar; het meldt frametijden, lange taken en hoeveel
fotobeeldpunten er zijn uitgepakt. Het draait zonder GPU, dus gebruik het om
varianten te vergelijken, niet als belofte voor één telefoon. Foto's laden
pas als ze bijna in beeld komen, op het bord als vierkantje van 480 px.

## Documenten

- Opdracht (leidend): [`docs/prikbord-spec.md`](docs/prikbord-spec.md)
- Bewuste afwijkingen: [`docs/prikbord-afwijkingen.md`](docs/prikbord-afwijkingen.md)
- Voortgang, besluiten en testlijsten: [`docs/prikbord-voortgang.md`](docs/prikbord-voortgang.md)
