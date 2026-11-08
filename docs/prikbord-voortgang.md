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
| M1 fundament en uiterlijk | klaar; **wacht op akkoord van Oscar om te deployen** (push naar `main`, Pages aanzetten) | `ccr-d21b9af2-gogh6f` |
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
- **V5, stijl (M1):** "Bord a maar schoolschrift op de briefjes". Uitgewerkt als: van A het kurk, de houten lijst, de kop, de tabbalk, de knoppen en de bolle punaises (die horen bij het bord); van C het papier: kleuren, lijntjes, de gaatjes van de scheurlijn bovenaan, de licht gescheurde onderkant, Caveat vet in balpenblauw. Het scheurblokje is ook kladblokpapier (het is tenslotte een stapel briefjes). De punaises van C (speldenknoppen) en de lijst van C zijn niet gebruikt; dat is mijn invulling, Oscar kan het omgooien.

## Nagelezen in de documentatie (8 nov 2026, via curl)

- **Cloudflare KV-limieten** (developers.cloudflare.com/kv/platform/limits): gratis plan 100.000 reads per dag, 1.000 writes per dag, 1 write per seconde op dezelfde sleutel, 1 GB opslag per account, max. 25 MiB per waarde, sleutel max. 512 bytes. Komt overeen met §6.3.
- **KV is "uiteindelijk consistent"** (developers.cloudflare.com/kv/concepts/how-kv-works): "Changes are usually immediately visible in the Cloudflare global network location at which they are made. Changes may take up to 60 seconds or more to be visible in other global network locations". Ook op dezelfde locatie is dat "not guaranteed". Gevolg: meestal zie je een wijziging binnen een paar tellen, soms pas na een minuut. Het opnieuw sturen uit §6.3 vangt verloren schrijfacties op, en de convergentietest moet ook verouderde reads nabootsen.
- **Nominatim-beleid** (operations.osmfoundation.org/policies/nominatim): absoluut max. 1 verzoek per seconde voor alle gebruikers samen. De app identificeren met een Referer of User-Agent (een e-mailadres is niet verplicht). Duidelijke bronvermelding. Uit te zetten zonder app-update. Bij voorkeur via een proxy met cache. Autocomplete is verboden, net als systematische zoekopdrachten. Nieuw sinds de spec: een sectie "Usage in LLMs". Daarin staat dat het publieke API alleen gebruikt mag worden als "the application developer has made a deliberate, informed decision to use it and is directly responsible for complying with this policy". Dat is Oscar: hij koos Nominatim zelf in de spec, en dit is hem verteld.

## Aannames die ik aanhoud (tenzij Oscar anders zegt)

Nieuw in M1, deel 2 (scheur-en-prik-moment):

- **Standaardcategorie van een nieuw briefje** is de laatst gebruikte op dit bord (`apparaat.laatsteCat`, per telefoon), anders de eerste. Het blokje heeft al die papierkleur, zodat het vel dat je afscheurt dezelfde kleur heeft als het briefje.
- **De 5 tellen "Ongedaan maken"** lopen vanaf het moment dat de melding verschijnt, dus na de valanimatie (~0,5 s). Anders hou je minder dan 5 tellen over.
- **Trillen bij de tok** (8 ms, `navigator.vibrate`) waar de browser dat kan. Op de iPhone gebeurt er niets (zie M0).
- **Toetsenbord op de iPhone:** het tekstvak krijgt focus nog binnen de tik op het blokje, anders komt het toetsenbord niet omhoog. Bij een concept na herstart lukt dat niet (geen tik); dan tik je zelf in het vel. Niet getest op een iPhone.
- **Nieuw briefje terwijl je ver naar beneden gescrold bent:** het bord schuift onder het vel naar boven, zodat je het briefje ziet landen. Werkt in Chromium met de pagina op slot (`overflow: hidden`); in Safari nog niet gezien.
- **Geluid** komt uit de Web Audio API (geen bestanden). Op de iPhone volgt dat de stilteschakelaar: staat die op stil, dan hoor je niets (uit mijn kennis, niet getest).
- **Snippers en "rrrits"** komen ook bij het heropenen van een concept via het blokje: het ligt op het blokje klaar, dus je scheurt het er opnieuw af.

Nieuw in M1, deel 1:

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
- **Handschriftletter:** Caveat (vet, 700) is gekozen via de stijl (V5). Patrick Hand en Caveat 500 zijn weg.
- **Pages:** uit mijn kennis, niet nagelezen: op het gratis GitHub-plan werkt Pages alleen voor publieke repo's. `prikbord` is publiek.

## Bevindingen buiten Prikbord

- **Cache-bug in Tarapp en Parkenjacht:** gerepareerd in Tezt (`3cf0159`), nog niet gedeployd (zie V2).
- **De statuspagina van Parkenjacht** schrijft bij elk bezoek naar KV. Niet aangepakt, en Prikbord doet het anders (A2).
- **`npm run lint` in Tezt is rood** door Tarapp (sinds `9d838b1`). Niet aangepakt. De deploy van Tezt draait geen lint.

## Logboek

### M1, deel 2 (8 nov 2026): gekozen stijl en het scheur-en-prik-moment

- **Stijl samengevoegd (V5):** één thema in `styles.css` (variabelen bovenin `:root`). Weg zijn: `stijl.js`, `kurk-b.svg`, `kurk-c.svg`, Patrick Hand, Caveat 500 en `scripts/contactvel.mjs`. `kurk-a.svg` heet nu `img/kurk.svg`, en de scheurrand staat in `js/randen.js` (16 varianten, gekozen via het id).
- **Scheur-en-prik-moment (§5.3):**
  - `js/beweging.js`: scheuren (het vel rukt omhoog, het blokje schokt mee, snippers dwarrelen, het vel groeit uit tot schrijfvel), prikken (het vel krimpt, een kopie van het echte briefje vliegt in een boogje naar zijn plek, de punaise komt van boven met een veertje, het papier veert even in, buren wiebelen naar afstand mee), een briefje van het bord halen en terughangen, weggooien en weghalen (het briefje valt van het scherm).
  - `js/geluid.js`: "rrrits" en "tok" met de Web Audio API, alleen als geluid aan staat.
  - Bij `prefers-reduced-motion`: geen vliegen, snippers of wiebelen, alleen vervagen.
  - De donkere achtergrond van het venster is nu een eigen element (`.laag-achter`), zodat hij mee kan vervagen. Esc en de terugknop op Android sluiten met dezelfde beweging. Tik naast een groot briefje hangt het terug; tik naast het schrijfvel doet niets (anders ben je te snel iets kwijt).
  - Schermlezers krijgen "Briefje geprikt" via een verborgen live-regio in plaats van een toast.
- **Een fout die ik zelf vond:** in de eerste versie was het vliegende briefje onzichtbaar. Een CSS-regel maakte alles in het venster `position: relative`, en dat zag ik pas in de filmstrip. De rooktest controleert nu ook dat de vlieger en de snippers echt in beeld zijn.
- **Getest:**
  - `npm test`: 37 groen.
  - `npm run lint`: schoon.
  - `npm run rooktest`: 41 van 41 geslaagd. Nieuw daarin: snippers in beeld, geluid gaat aan na de tik (AudioContext geteld), het vel krijgt de kleur van het blokje, het tekstvak heeft meteen focus, de vlieger is zichtbaar, het briefje hangt na het landen zichtbaar op het bord zonder losse resten, openen verstopt het briefje op het bord, Esc hangt het terug, en met minder beweging en geluid uit: geen snippers, geen vlieger en geen AudioContext.
  - Twee bestaande controles zijn aangepast, met reden. "Bewerken" wacht nu tot het venster dicht is in plaats van 200 ms, want het briefje vliegt eerst. De grafsteen wacht 6 s in plaats van 5,4 s, want de 5 tellen beginnen nu na de valanimatie.
- **Screenshots en filmstrip** in `docs/m1-stijl/`: `bord.jpg`, `open.jpg`, `vel.jpg` en `scheur-en-prik.jpg` (9 beelden, met alle animaties 10× vertraagd vastgelegd). Opnieuw maken: `npm run screenshots`.
- **Niet getest:** alles op een echte telefoon (zie het lijstje hieronder), hoe het geluid klinkt (Chromium headless heeft geen luidspreker; alleen dat de AudioContext wordt aangemaakt), en of de animaties vloeiend zijn op een gewone telefoon met 300 briefjes (M5).

### Te controleren op de telefoon (na de deploy van M1)

1. Openen in Safari en via "Zet op beginscherm" installeren. Icoon en naam "Prikbord" kloppen, en de app opent zonder adresbalk.
2. Tik op het blokje: hoor je "rrrits", zie je snippers, en komt het toetsenbord meteen omhoog? Staat "Prikken!" niet achter het toetsenbord?
3. Prikken: vliegt het briefje naar zijn plek, hoor je "tok" en wiebelen de buren? Op Android trilt hij even.
4. Tik op een briefje: komt het groot van het bord? Hangt "Terughangen" het netjes terug?
5. Weghalen en dan "Ongedaan maken": komt het briefje terug met punaise?
6. Half getypt briefje, app wegvegen en opnieuw openen: staat je tekst er nog?
7. Meer → geluid uit: is het stil? Meer → back-up maken: opent het deelmenu ("Bewaar in Bestanden")?
8. Instellingen → Toegankelijkheid → Beweging → "Verminder beweging" aan: alleen nog rustig vervagen?
9. Vliegtuigmodus aan en de app openen: werkt hij offline?

### M1, deel 1 (8 nov 2026): skelet en 3 stijlvoorstellen

- **Repo-fundament:** `package.json` (devDependencies oxlint, playwright 1.63.0 en sharp; scripts `lint`, `test`, `icons`, `serve`, `rooktest`, `screenshots`), `.oxlintrc.json` (negeert `public/vendor/**`), lint met `--deny-warnings`, workflow `.github/workflows/deploy-pages.yml` (push naar `main`: lint, tests, dan `public/` naar Pages). **Nog niet naar `main` gepusht**: dat is deployen, en wacht op akkoord (§8).
- **Pure modules** (`public/js/`): `seed.js` (FNV-1a + mulberry32), `layout.js` (netjes rommelig), `model.js` (datamodel en tijdstempels), `validate.js` (schema en schoonmaken), `merge.js` (per veld samenvoegen en importeren). `model.js` staat niet in het bestandsvoorstel van §6.1; ik heb het toegevoegd zodat het datamodel puur en testbaar is. Ook nieuw: `stijl.js` (tijdelijk, de drie voorstellen) en `public/img/` (kurk, papierkorrel en hout als kleine SVG's met `feTurbulence`).
- **App-skelet:** `index.html` (iOS-meta zoals Tarapp), manifest, `sw.js` (network-first, caches alleen met `prikbord-`), `store.js` (sleutel `prikbord.v1`, kapotte opslag → vers bord en de oude tekst onder `prikbord.v1.kapot`), `app.js`: bord, briefje openen, bewerken, weghalen met 5 tellen ongedaan maken, schrijfvel met concept, tabs (Kaart en Gedaan-doos als vrolijke "komt eraan"-briefjes), Meer (geluid, blijvende opslag, back-up, wat is er nieuw, nu bijwerken, versie), updates zoals `reloadWhenIdle`. Letters Caveat (500, 700) en Patrick Hand met OFL-licenties; é, ë, ï, ö, ü, € en de krullende aanhalingstekens nagemeten met fonttools (cmap van de woff2-bestanden). Icoon `scripts/prikbord-icon.svg` → `public/icons/` (palet-PNG, 512 px = 172 KB).
- **Getest:**
  - `npm test`: 37 tests groen. Daarin zitten seed (officiële FNV-1a-testvectoren), layout, validate, model, de sw-test (CACHE = APP_VERSION, SHELL compleet) en merge: 2000 geseede rondes commutatief, associatief en idempotent. Ter controle heb ik merge twee keer bewust kapotgemaakt (gelijk tijdstip en grafsteen); de tests vingen het allebei.
  - `npm run rooktest` (Playwright/Chromium, 390 px): 27 van 27 geslaagd. Dat dekt briefje prikken en herladen, bewerken, concept na herladen, ongedaan maken, grafsteen na 5 tellen, geluid bewaren, export als download, importeren dat samenvoegt, kapotte opslag, service worker, offline openen, en "Nu bijwerken" dat de cache van Tarapp laat staan.
  - `npm run lint`: schoon.
- **Niet getest:** echte iPhone en Android (toetsenbord bij het schrijfvel, deelmenu bij de back-up, "Zet op beginscherm"), blijvende opslag (Chromium headless zegt "nee"), trillen.
- **Stijlvoorstellen** in `docs/m1-stijlen/` (390 px, 2× scherp; `vergelijk-*.jpg` zet ze naast elkaar). Dat is een momentopname: de scripts en de drie stijlen staan in commit `453bfd0` en zijn daarna weggehaald.
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

## Voor M2: handig om te weten

- **Het bord herbouwen of verschuiven:** `render()` bouwt het bord opnieuw op (`innerHTML`). Voor het "schudden" bij filteren en sorteren (§5.2) moeten de bestaande elementen blijven staan en alleen verschuiven: `legBordNeer()` werkt op de elementen die er zijn, en zodra `.bord-binnen` de klasse `klaar` heeft, glijden ze met een `transition` naar hun nieuwe plek. Verbergen kan met een klasse in plaats van ze weg te halen.
- **Dubbeltik = hartje:** een enkele tik opent nu meteen (`acties.open` → `openBriefje`). Voor dubbeltik ~250 ms wachten (zie de aannames uit M0). Hartjes staan in het model als `briefje.hart[lidId] = { w: true/false, t }`. Een functie `zetHart` bestaat nog niet; volg `zetVeld` (tijdstempel via `stempel`).
- **Gedaan:** `zetVeld(b, 'gedaan', { datum, notitie }, now)`. `opHetBord()` laat gedane briefjes al weg. "Terughangen" uit de Gedaan-doos = `gedaan` op `null` (met tijdstempel).
- **Vrij-modus:** de velden `vrij` (`{ x, y }` in bordcoördinaten, `BORD_BREEDTE` = 1000) en `stapel` bestaan al in het schema (`validate.js`). Telt `ui.bezig` op tijdens het slepen, zodat een update niet midden in een sleepbeweging herlaadt. De keuze netjes of vrij per bord staat al in het schema: `apparaat.weergave[bordId]`.
- **Categorie-editor:** kleuren uit `PAPIER` (10 namen). Een gebruikte categorie alleen verbergen (`verborgen`), zoals `delete-type` in Tarapp.
- **Het geopende briefje** heeft nu de knoppen Weghalen, Bewerken en Terughangen (`.laag-knoppen` is een raster van 2 kolommen). Hartje en "Gedaan! ✅" komen erbij.
- **Animaties hergebruiken:** `prikIn` en `wiebelBuren` (bijv. bij "Terughangen" uit de Gedaan-doos), `vanBord` (bijv. voor "Trek een briefje": het briefje komt los en groot naar het midden), `valWeg`, en het patroon `metRust(async () => …)` dat tikken blokkeert en herladen uitstelt tijdens een animatie.
- **Back-up:** exporteren en samenvoegend importeren werken al (M1). "Met of zonder foto's" komt in M4.

## Startprompt voor M2

Plak dit in een nieuwe chat met repo `oscardillewaard-ai/prikbord` en omgeving "Tezt":

```
Prikbord, mijlpaal M2 (het bord). Je werkt in de repo oscardillewaard-ai/prikbord.
1. Merge eerst het werk uit M1 in je werkbranch (als het nog niet op main staat):
   git fetch origin ccr-d21b9af2-gogh6f && git merge origin/ccr-d21b9af2-gogh6f
2. Lees docs/prikbord-spec.md (leidend), docs/prikbord-afwijkingen.md (vooral A3:
   eigen repo, andere paden) en docs/prikbord-voortgang.md (besluiten, aannames,
   logboek M1 en "Voor M2: handig om te weten").
3. Haal oscardillewaard-ai/Tezt erbij (alleen lezen) als je iets uit §3 nodig hebt.
4. Doe M2 (§8 van de spec): filters, sorteren, categorie-editor, hartjes (met één
   lokaal lid), Gedaan-doos, Trek een briefje, vrij-modus met slepen en zoomen,
   back-up. Draai voor elke commit npm test, npm run lint en npm run rooktest.
   Werk aan het eind docs/prikbord-voortgang.md bij, met een startprompt voor M3.
```
