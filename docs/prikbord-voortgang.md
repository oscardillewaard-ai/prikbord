# Prikbord: voortgang en overdracht

Elke mijlpaal krijgt een nieuwe chat (afspraak met Oscar, 8 nov 2026). Dit
bestand is het geheugen tussen die chats. Leidend blijft
`docs/prikbord-spec.md`. Afwijkingen staan in `docs/prikbord-afwijkingen.md`;
lees vooral A3 (eigen repo, andere paden).

**Bij een nieuwe chat:**
- Kies de cloudomgeving **"Tezt"**. Die laat naast de package registries ook
  `developers.cloudflare.com` en `operations.osmfoundation.org` door.
- Een nieuwe sessie start vanaf `main`. Werk dat nog niet op `main` staat,
  zit op de werkbranch van de vorige mijlpaal (zie de tabel). Merge die eerst
  in je eigen werkbranch.
- Haal `oscardillewaard-ai/Tezt` erbij (alleen lezen) voor de bestanden uit §3
  van de spec en voor Leaflet.
- Lees externe sites met `curl` in Bash. WebFetch gaat niet via de proxy van
  de sessie en blijft de toegestane hosts weigeren.

## Status

| Mijlpaal | Status | Werkbranch in `prikbord` |
| --- | --- | --- |
| M0 lezen en plan | klaar, akkoord van Oscar (8 nov) | `ccr-dd7e09d5-7p41e5` |
| M1 fundament en uiterlijk | deel 1 klaar (skelet + 3 stijlvoorstellen), **wacht op stijlkeuze van Oscar** | `ccr-d21b9af2-gogh6f` |
| M2 het bord | nog niet begonnen | |
| M3 samen | nog niet begonnen | |
| M4 link, foto en kaart | nog niet begonnen | |
| M5 afronden | nog niet begonnen | |

## Plan uit M0: wat ik overneem en waar ik afwijk

1. **Van Tarapp:** network-first `sw.js`, `updateViaCache: 'none'`, `reg.update()` bij terugkomen, herladen via `reloadWhenIdle`, `CHANGELOG` met `seenVersion`, `requestPersistence`, export via `navigator.share` met download als terugval, "Nu bijwerken", de iOS-meta-tags, fonts met OFL in `fonts/`, iconen via sharp.
2. **Van Parkenjacht:** groepscode (`getRandomValues`, base64url), de `#koppel=`-link (met bordnaam `n` erbij), sync-lus met "gewijzigd"-vlag en max. 3 keer opnieuw sturen, statusbolletje, worker met CORS-lijst, validatie (`clean`), `findKv` en de statuspagina met neerzet-stappen in gewone taal. Leaflet uit `vendor/`.
3. **Anders, zoals de spec vraagt:** per veld samenvoegen in plaats van per park, met een vaste keuze bij een gelijk tijdstip. Parkenjacht houdt dan de eigen waarde, en dat is niet commutatief. Verder: alleen gewijzigde briefjes versturen, `rev` als hash, `?sinds=`, 1,5 s bundelen, en een mislukte KV-`put` afvangen met een status waarop de app het opnieuw probeert.
4. **A1:** caches alleen opruimen als ze met `prikbord-` beginnen.
5. **A2:** de statuspagina van de worker schrijft niet bij elk bezoek naar KV.
6. **A3:** een eigen repo, met eigen deploy, lint en tests.
7. **Puur en testbaar:** `merge`, `layout`, `seed`, `validate` en de koppel-link zonder DOM en zonder opslag, met `now` als argument. Tests via `node --test tests/*.test.mjs`.
8. **Grote PUT's:** de eerste koppeling van een groot bord gaat in delen van onder de 256 KB.
9. **Overdracht:** dit bestand per mijlpaal bijwerken, met aan het eind een startprompt voor de volgende chat.

## Besluiten van Oscar

8 nov 2026:

- **M0:** "Klinkt allemaal goed": akkoord met het plan, A1, A2 en de aannames.
- **V1, lint in Tezt:** vervallen door de eigen repo. `npm run lint` in Tezt is nog steeds rood door Tarapp (`useEmoji`), en dat is niet aangepakt.
- **V2, cache-bug in Tarapp en Parkenjacht:** ja, repareren. Gedaan in Tezt, commit `3cf0159` op branch `ccr-dd7e09d5-7p41e5` (Tarapp 34, Parkenjacht 4). Getest in Chromium. **Nog niet gedeployd**: daar is apart akkoord van Oscar voor nodig.
- **V3, volgorde in M1:** eerst het skelet plus 3 stijlvoorstellen (screenshots op 390 px), dan kiest Oscar, en pas daarna het scheur-en-prik-moment in de gekozen stijl. Allemaal in de M1-chat.
- **V4, eigen repo:** ja → `oscardillewaard-ai/prikbord` (zie A3).
- **Netwerk:** de cloudomgeving "Tezt" is aangemaakt.

## Nagelezen in de documentatie (8 nov 2026, via curl)

- **Cloudflare KV-limieten** (developers.cloudflare.com/kv/platform/limits): gratis plan 100.000 reads per dag, 1.000 writes per dag, 1 write per seconde op dezelfde sleutel, 1 GB opslag per account, max. 25 MiB per waarde, sleutel max. 512 bytes. Komt overeen met §6.3.
- **KV is "uiteindelijk consistent"** (developers.cloudflare.com/kv/concepts/how-kv-works): "Changes are usually immediately visible in the Cloudflare global network location at which they are made. Changes may take up to 60 seconds or more to be visible in other global network locations". Ook op dezelfde locatie is dat "not guaranteed". Gevolg: meestal zie je een wijziging binnen een paar tellen, soms pas na een minuut. Het opnieuw sturen uit §6.3 vangt verloren schrijfacties op, en de convergentietest moet ook verouderde reads nabootsen.
- **Nominatim-beleid** (operations.osmfoundation.org/policies/nominatim): absoluut max. 1 verzoek per seconde voor alle gebruikers samen. De app identificeren met een Referer of User-Agent (een e-mailadres is niet verplicht). Duidelijke bronvermelding. Uit te zetten zonder app-update. Bij voorkeur via een proxy met cache. Autocomplete is verboden, net als systematische zoekopdrachten. Nieuw sinds de spec: een sectie "Usage in LLMs". Daarin staat dat het publieke API alleen gebruikt mag worden als "the application developer has made a deliberate, informed decision to use it and is directly responsible for complying with this policy". Dat is Oscar: hij koos Nominatim zelf in de spec, en dit is hem verteld.

## Aannames die ik aanhoud (tenzij Oscar anders zegt)

Nieuw in M1:

- **Papierkleur als naam, niet als kleurcode.** Een categorie bewaart `zon`, `lucht`, `salie` … (10 kleuren, `PAPIER` in `validate.js`); de stijl bepaalt de tint. Zo blijft de inkt op elke kleur leesbaar (M5) en verandert een stijlwissel alle briefjes netjes mee. Gevolg voor M2: de categorie-editor kiest uit die 10 kleuren, niet uit een vrije kleurkiezer. Punaisekleuren werken net zo (`PUNAISE`, 8 kleuren).
- **Wie ben jij?** In M1 heet het enige lid "Ik" (kleur rood). Een naam kiezen bij de eerste start hoort bij de leden (M3), of eerder als Oscar dat wil.
- **Weghalen en de app wegklikken:** binnen de 5 tellen "Ongedaan maken" naar de achtergrond gaan, zet de grafsteen meteen. Je had het al bevestigd, en een briefje dat na het weghalen terugkomt, is verwarrender.
- **Enkele tik opent meteen** (M1). Zodra dubbeltik = hartje komt (M2), wacht een enkele tik ~250 ms.
- **Back-up exporteren en importeren zit al in M1** (regel 8 van §4.1 hoort bij het skelet). Importeren voegt per veld samen via `merge.js`, dat dus al af en getest is. "Met of zonder foto's" komt in M4.
- **Toast als popover**, zodat een melding ook boven een open venster ligt. Popover werkt vanaf Safari 17; op oudere iPhones staat de melding gewoon onderin (niet getest op een echte oude iPhone).
- **Minimale iOS-versie:** `color-mix()` (punaises, iOS 16.2+), `:has()` (focusrand, iOS 15.4+) en `<dialog>` (iOS 15.4+). Op ouder dan 16.2 missen alleen de schaduwtinten van de punaises. Uit mijn kennis, niet nagemeten op een toestel.

Uit M0:

- **Dubbeltik = hartje** (§5.5) betekent dat een enkele tik ongeveer 250 ms wacht voordat het briefje opent. Instagram doet dat ook. Uitproberen in M2.
- **Trillen:** voor zover ik weet heeft Safari op de iPhone geen Vibration API (niet getest). Optillen trilt dan alleen op Android.
- **Nominatim-User-Agent (M4):** `Prikbord/1.0 (+https://github.com/oscardillewaard-ai/prikbord)`, zonder e-mailadres.
- **Tests in de deploy-workflow:** ja, nu het een eigen repo is (A3). Lint en `node --test` houden de deploy tegen. De Playwright-rooktest draait lokaal.
- **Handschriftletter:** zowel Caveat als Patrick Hand in de stijlvoorstellen, zodat Oscar kiest.
- **Pages:** uit mijn kennis, niet nagelezen: op het gratis GitHub-plan werkt Pages alleen voor publieke repo's. `prikbord` is publiek.

## Bevindingen buiten Prikbord

- **Cache-bug in Tarapp en Parkenjacht:** gerepareerd in Tezt (`3cf0159`), nog niet gedeployd (zie V2).
- **De statuspagina van Parkenjacht** schrijft bij elk bezoek naar KV. Niet aangepakt, en Prikbord doet het anders (A2).
- **`npm run lint` in Tezt is rood** door Tarapp (sinds `9d838b1`). Niet aangepakt. De deploy van Tezt draait geen lint.

## Logboek

### M1, deel 1 (8 nov 2026): skelet en 3 stijlvoorstellen

- **Repo-fundament:** `package.json` (devDependencies oxlint, playwright 1.63.0 en sharp; scripts `lint`, `test`, `icons`, `serve`, `rooktest`, `screenshots`), `.oxlintrc.json` (negeert `public/vendor/**`), lint met `--deny-warnings`, workflow `.github/workflows/deploy-pages.yml` (push naar `main`: lint, tests, dan `public/` naar Pages). **Nog niet naar `main` gepusht**: dat is deployen, en wacht op akkoord (§8).
- **Pure modules** (`public/js/`): `seed.js` (FNV-1a + mulberry32), `layout.js` (netjes rommelig), `model.js` (datamodel en tijdstempels), `validate.js` (schema en schoonmaken), `merge.js` (per veld samenvoegen en importeren). `model.js` staat niet in het bestandsvoorstel van §6.1; ik heb het toegevoegd zodat het datamodel puur en testbaar is. Ook nieuw: `stijl.js` (tijdelijk, de drie voorstellen) en `public/img/` (kurk, papierkorrel en hout als kleine SVG's met `feTurbulence`).
- **App-skelet:** `index.html` (iOS-meta zoals Tarapp), manifest, `sw.js` (network-first, caches alleen met `prikbord-`), `store.js` (sleutel `prikbord.v1`, kapotte opslag → vers bord en de oude tekst onder `prikbord.v1.kapot`), `app.js`: bord, briefje openen, bewerken, weghalen met 5 tellen ongedaan maken, schrijfvel met concept, tabs (Kaart en Gedaan-doos als vrolijke "komt eraan"-briefjes), Meer (geluid, blijvende opslag, back-up, wat is er nieuw, nu bijwerken, versie), updates zoals `reloadWhenIdle`. Letters Caveat (500, 700) en Patrick Hand met OFL-licenties; é, ë, ï, ö, ü, € en de krullende aanhalingstekens nagemeten met fonttools (cmap van de woff2-bestanden). Icoon `scripts/prikbord-icon.svg` → `public/icons/` (palet-PNG, 512 px = 172 KB).
- **Getest:**
  - `npm test`: 37 tests groen. Daarin zitten seed (officiële FNV-1a-testvectoren), layout, validate, model, de sw-test (CACHE = APP_VERSION, SHELL compleet) en merge: 2000 geseede rondes commutatief, associatief en idempotent. Ter controle heb ik merge twee keer bewust kapotgemaakt (gelijk tijdstip en grafsteen); de tests vingen het allebei.
  - `npm run rooktest` (Playwright/Chromium, 390 px): 27 van 27 geslaagd. Dat dekt briefje prikken en herladen, bewerken, concept na herladen, ongedaan maken, grafsteen na 5 tellen, geluid bewaren, export als download, importeren dat samenvoegt, kapotte opslag, service worker, offline openen, en "Nu bijwerken" dat de cache van Tarapp laat staan.
  - `npm run lint`: schoon.
- **Niet getest:** echte iPhone en Android (toetsenbord bij het schrijfvel, deelmenu bij de back-up, "Zet op beginscherm"), blijvende opslag (Chromium headless zegt "nee"), trillen.
- **Stijlvoorstellen** in `docs/m1-stijlen/` (390 px, 2× scherp; `vergelijk-*.jpg` zet ze naast elkaar). Opnieuw maken: `npm run screenshots && node scripts/contactvel.mjs`. Proberen in de browser: `npm run serve`, dan `http://localhost:4173/?stijl=b`.
  - **A · Klassiek kurk:** warm kurk, houten lijst, pastel blokpapier dat bovenaan echt is afgescheurd, Caveat, glimmende bolle punaises.
  - **B · Licht & luchtig:** licht honingkurk zonder lijst, zachte moderne kleuren met rafelrandjes rondom, Patrick Hand, platte punaises.
  - **C · Schoolschrift:** grof donker kurk in een stevige lijst, gelinieerd kladblokpapier met gaatjes van de scheurlijn, Caveat vet in balpenblauw, speldenknoppen.
  - Onderdelen zijn te mengen (bijv. kurk van A met papier van C).

### M0 (8 nov 2026)

- Gelezen: alle bestanden uit §3 van de spec (in Tezt).
- Nulmeting in Tezt: build groen, lint rood (3 fouten door `useEmoji` in Tarapp), deploybranch gelijk aan de werkbranch (`0c82ec8`).
- Getest: of Cache Storage gedeeld wordt over mappen op één domein (ja, Chromium), en de lint-override (werkt, maar is vervallen).
- Cloudomgeving "Tezt" aangemaakt. KV-docs en Nominatim-beleid nagelezen.
- Oscar koos voor een eigen repo. De docs zijn overgezet naar `oscardillewaard-ai/prikbord`, met A3 erbij.
- In Tezt: cache-fix voor Tarapp en Parkenjacht (`3cf0159`), getest in Chromium (vóór en na).

## Startprompt om M1 af te maken (als deze chat stopt vóór de stijlkeuze)

Plak dit in een nieuwe chat met repo `oscardillewaard-ai/prikbord` en omgeving "Tezt":

```
Prikbord, mijlpaal M1 deel 2. Je werkt in de repo oscardillewaard-ai/prikbord.
1. Merge eerst het werk uit M1 deel 1 in je werkbranch:
   git fetch origin ccr-d21b9af2-gogh6f && git merge origin/ccr-d21b9af2-gogh6f
2. Lees docs/prikbord-spec.md (leidend), docs/prikbord-afwijkingen.md (vooral A3)
   en docs/prikbord-voortgang.md (besluiten, aannames, logboek M1 deel 1).
3. Haal oscardillewaard-ai/Tezt erbij (alleen lezen) als je iets uit §3 nodig hebt.
4. Mijn stijlkeuze: <A, B of C, plus eventuele wensen>. Haal de andere twee stijlen
   weg (stijl.js, styles.css, img/, fonts/, SHELL in sw.js) en bouw het
   scheur-en-prik-moment (§5.3) in die stijl. Werk aan het eind
   docs/prikbord-voortgang.md bij, met een startprompt voor M2.
```
