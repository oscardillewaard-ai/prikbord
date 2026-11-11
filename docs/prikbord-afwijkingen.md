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

## A4. Een categorie wordt nooit gewist, ook een ongebruikte niet

- **Waar:** de categorie-editor onder Meer (`model.js`: `zetCat`, `nieuweCat`).
- **Wat de spec zegt:** "Een gebruikte categorie wordt alleen verborgen, niet
  gewist, zodat oude briefjes hun kleur houden (zoals Tarapp met
  trainingstypes doet)." Tarapp wist een ongebruikt type wel echt.
- **Waarom anders:** categorieën worden in M3 per veld samengevoegd met de
  andere telefoons. Een gewiste categorie heeft geen grafsteen, dus de
  volgende sync van een telefoon die hem nog heeft, zet hem gewoon terug. En
  een briefje dat iemand anders net in die categorie prikte, zou zijn kleur
  verliezen. Verbergen doet wat je wilt (weg uit de lijst, de tabjes en de
  filterbalk) en is altijd terug te draaien. De editor toont verborgen
  categorieën onderaan, met "Laten zien".
- **Alternatief als Oscar echt wissen wil:** een grafsteen voor categorieën
  (zoals bij briefjes), alleen toegestaan als er geen briefje meer in zit.
- **Status:** akkoord (Oscar, 9 nov 2026: "A4 akkoord").

## A5. De worker wordt gebouwd uit de kern plus validate.js en merge.js

- **Waar:** `proxy/prikbord-sync-worker.js` (het bestand dat Oscar in
  Cloudflare plakt), gemaakt door `npm run worker` (`scripts/bouw-worker.mjs`)
  uit `proxy/prikbord-worker-kern.js`, `public/js/validate.js` en
  `public/js/merge.js`.
- **Hoe Parkenjacht het doet:** de worker is één met de hand geschreven
  bestand, met een eigen, kleine `clean` en `merge`.
- **Waarom anders:** bij het Prikbord moeten app en worker precies hetzelfde
  controleren en samenvoegen: per veld, met dezelfde vaste keuze bij een
  gelijk tijdstip. Twee kopieën lopen vroeg of laat uit elkaar, en dan
  komen de telefoons niet meer op dezelfde stand uit. Zie de
  convergentietest: met een andere keuze bij een gelijk tijdstip gaat hij
  rood. Nu is er één bron, en het bouwscript plakt de echte modules in de
  worker (zonder `export`).
- **Wat blijft zoals de spec vraagt:** de app zelf heeft geen buildstap
  (§4.1, regel 1). Het gebouwde bestand staat in de repo, dus Oscar hoeft
  niets te draaien: hij kopieert het bestand. `tests/worker.test.mjs` faalt
  als het niet meer bij de bronnen past ("draai npm run worker"), en test
  precies het bestand dat in Cloudflare komt.
- **Alternatief:** de worker met de hand bijhouden, met een test die op
  willekeurige borden controleert dat worker en app hetzelfde samenvoegen.
  Dat werkt ook, maar dan pas je alles twee keer aan.
- **Status:** akkoord (Oscar, 9 nov 2026: "Akkoord met a5").

## A6. De pauze van 1 seconde voor Nominatim geldt per worker-exemplaar

- **Waar:** `proxy/prikbord-worker-kern.js`, `GET /zoek` (de rij in `beurt()`).
- **Wat de spec zegt (§6.5):** "Max. 1 verzoek per seconde, en dat geldt
  voor alle gebruikers samen. […] zet daarnaast in de app en in de worker
  minstens 1 s tussen twee zoekopdrachten."
- **Wat er gebouwd is:** de app wacht minstens 1 s tussen twee zoekopdrachten
  (en zoekt alleen na een tik op Zoek). De worker zet alle vragen aan
  Nominatim in één rij met minstens 1 s ertussen, onthoudt elk antwoord een
  week (Cache API van Cloudflare, plus een kleine cache in het geheugen), en
  zegt "even druk" als er al 4 zoekopdrachten wachten. Getest in
  `tests/worker-foto-zoek.test.mjs` (6 tegelijk: 4 netjes met ≥ 1 s ertussen,
  2 krijgen "even druk") en in de rooktest (de app wacht ≥ 1 s).
- **Waarom niet helemaal zoals de spec:** die rij en dat geheugen gelden per
  exemplaar van de worker. Uit mijn kennis van Cloudflare (niet nagelezen):
  Cloudflare kan op verschillende plekken in de wereld tegelijk een exemplaar
  draaien, elk met een eigen geheugen. Zoeken Oscar in Nederland en een
  vriend in Portugal in precies dezelfde seconde, dan kunnen er dus twee
  vragen tegelijk naar Nominatim gaan. Voor een paar mensen die af en toe op
  een knop tikken, is dat in de praktijk verwaarloosbaar. Een harde,
  wereldwijde grens kan alleen met een gedeelde teller, en KV kan dat niet
  (uiteindelijk consistent, en schrijfacties zijn schaars).
- **Alternatief:** een Durable Object als wereldwijde rij (één plek die alle
  zoekopdrachten doorlaat). Dat kan op het gratis plan, alleen met de
  SQLite-opslag (nagelezen op developers.cloudflare.com/durable-objects/platform/pricing
  op 9 nov 2026). Het is wel meer werk en een extra onderdeel om neer te
  zetten; voor zover ik weet vraagt een Durable Object een "migratie" die je
  niet zomaar met plakken in de editor van het dashboard regelt (niet
  nagelezen). Of: zoeken helemaal uit (`ZOEKEN=uit`), dan blijven de andere drie
  manieren werken.
- **Status:** voorgesteld (wacht op Oscar).

## A7. Kurk, hout en papier als plaatjes uit een script, niet als SVG-ruis

- **Waar:** `public/img/kurk.webp`, `hout.webp` en `papier.webp`, gemaakt
  door `npm run texturen` (`scripts/gen-texturen.mjs`).
- **Wat de spec zegt (§5.4):** kurk uit kleine SVG-ruis (`feTurbulence`), geen
  grote foto.
- **Waarom anders:** Oscar vond de app goedkoop ogen ("de textures moeten
  beter", 11 nov 2026). Ruis uit een SVG-filter is overal even korrelig: het
  leest als zand of als een slechte foto, niet als kurk. En elke browser
  tekent zo'n filter net anders, dus wat ik hier zag, was niet zeker wat er
  op de iPhone stond. Het script bouwt de structuur zelf op: kurk uit
  korrels van wisselende grootte met kieren, putjes en spikkels, hout uit
  jaarringen en vezels, papier uit een zachte wolk met een paar vezeltjes,
  met licht van linksboven. Het zijn nog steeds geen foto's, en alles sluit
  naadloos op zichzelf aan.
- **Wat het kost:** samen ± 175 KB (was 3 KB), één keer geladen en daarna
  uit de cache van de service worker. Scrollen: geen meetbaar verschil
  (`npm run prestaties`: met en zonder kurk of papier 47 tot 52 haperende
  frames op dezelfde machine).
- **Wat blijft zoals de spec vraagt:** de app heeft geen buildstap. De
  plaatjes staan in de repo, net als de iconen uit `npm run icons`.
- **Alternatief:** terug naar de SVG-ruis (drie bestandjes van samen 3 KB),
  of een echte foto van kurk (mooier, maar dan moet er een rechtenvrije foto
  bij en is hij lastig naadloos te krijgen).
- **Status:** voorgesteld (wacht op Oscar).

