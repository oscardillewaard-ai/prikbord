# Prikbord: bewuste afwijkingen

Elke bewuste afwijking van `docs/prikbord-spec.md`, of van hoe Tarapp en
Parkenjacht het doen, met de reden erbij. Status: **voorgesteld** (wacht op
Oscar), **akkoord** of **afgewezen**.

De drie afwijkingen uit §4.2 van de spec (importeren voegt samen, foto's in
IndexedDB, ES-modules) staan al in de spec zelf en zijn daarmee akkoord. Ze
worden hier niet herhaald.

## A1. Caches alleen opruimen als ze met `prikbord-` beginnen

- **Waar:** `sw.js` bij `activate`, en de knop "Nu bijwerken".
- **Hoe Tarapp en Parkenjacht het doen:** `sw.js` wist bij `activate` elke
  cache die niet de eigen `CACHE` is (`k !== CACHE`), en "Nu bijwerken" wist
  alles uit `caches.keys()`.
- **Waarom anders:** Cache Storage hoort bij de origin, niet bij de map. Alle
  apps op `https://oscardillewaard-ai.github.io` zien dus elkaars caches.
  Getest in Chromium (8 nov 2026, Playwright): een cache die onder `/a/` is
  aangemaakt, is zichtbaar onder `/b/`, en de opruimregel van Tarapp onder
  `/b/` wist hem. Een update van Tarapp wist zo ook de offline-kopie van
  Parkenjacht en de precache van Bergtrainer, en andersom. Prikbord filtert
  daarom op het eigen voorvoegsel. Het doel van regels 4 en 9 (oude versies
  weg, alleen de app-cache wissen) blijft hetzelfde.
- **Status:** akkoord (Oscar, 8 nov 2026).

## A2. De statuspagina van de worker schrijft niet bij elk bezoek naar KV

- **Waar:** `proxy/prikbord-sync-worker.js`, `GET /`.
- **Hoe Parkenjacht het doet:** bij elk bezoek aan de statuspagina een
  `kv.put('health', …)` als controle.
- **Waarom anders:** het gratis plan heeft 1.000 KV-writes per dag, gedeeld
  met Parkenjacht (§6.3). De statuspagina controleert de koppeling daarom met
  een leesactie. Een echte schrijftest gebeurt alleen op `/?schrijftest=1`.
- **Status:** akkoord (Oscar, 8 nov 2026).

## A3. Een eigen repo in plaats van een map in Tezt

- **Wat:** Prikbord staat in `oscardillewaard-ai/prikbord` (publiek), niet in
  `public/prikbord/` van Tezt. Na deploy op
  `https://oscardillewaard-ai.github.io/prikbord/`.
- **Waarom:** besluit van Oscar (8 nov 2026), na de afweging in
  `docs/prikbord-voortgang.md` (V4). Prikbord krijgt een eigen deploy: een
  fout in Prikbord houdt Tarapp niet meer tegen. Er hangt geen service worker
  van Bergtrainer boven (scope `/Tezt/`), en er staat geen site op de root van
  het domein met een service worker. Verder geen buildstap, een eigen lint en
  geen botsingen met andere chats op de deploybranch van Tezt.
- **Paden (spec → deze repo):**
  - `public/prikbord/…` → `public/…` (alleen deze map wordt gedeployd)
  - `proxy/prikbord-sync-worker.js` → ongewijzigd
  - `tests/prikbord/*.test.mjs` → `tests/*.test.mjs`, als npm-script `test`
    (in plaats van `test:prikbord`)
  - `scripts/…` en `docs/…` → ongewijzigd
- **Wat vervalt uit §4.3:** de aanpassingen in `vite.config.ts` en
  `.oxlintrc.json` van Tezt, de afhankelijkheid van `npm run build` van Tezt,
  en de README-sectie in Tezt (de README van deze repo neemt die rol over).
- **Wat ervoor in de plaats komt:**
  - een eigen `package.json` met alleen devDependencies, en scripts voor
    lint, tests en iconen;
  - een eigen `.oxlintrc.json` die `public/vendor/**` negeert;
  - een eigen workflow `.github/workflows/deploy-pages.yml`: bij een push
    naar `main` eerst lint en tests, daarna `public/` naar Pages. Hier mogen
    de tests de deploy wél tegenhouden, want andere apps hebben er geen last
    van;
  - Pages aanzetten: Oscar zet vóór de eerste deploy (M1) Settings → Pages →
    Source op "GitHub Actions";
  - deployen = pushen naar `main`, en dat pas na akkoord van Oscar (zoals
    §4.3).
- **Wat blijft:** het domein is hetzelfde, dus A1, de sleutels `prikbord.v1`
  en `prikbord.sync` en de reden voor IndexedDB blijven gelden. De bestanden
  uit §3 staan in Tezt: haal die repo erbij om te lezen. Leaflet komt uit
  Tezt `public/parken/vendor/`.
- **Status:** akkoord (Oscar, 8 nov 2026).
