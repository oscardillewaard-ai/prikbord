# Prikbord: voortgang en overdracht

Elke mijlpaal krijgt een nieuwe chat (afspraak met Oscar, 8 nov 2026). Dit
bestand is het geheugen tussen die chats. Leidend blijft
`docs/prikbord-spec.md`. Afwijkingen staan in `docs/prikbord-afwijkingen.md`;
lees vooral A3 (eigen repo, andere paden) en A4 (categorieën nooit wissen).

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
| M1 fundament en uiterlijk | klaar en gedeployd (8 nov, akkoord van Oscar), staat op `main`; testlijst voor de telefoon hieronder | `ccr-d21b9af2-gogh6f` |
| M2 het bord | klaar en gedeployd (9 nov, akkoord van Oscar), staat op `main`; testlijst voor de telefoon hieronder | `ccr-eb14dc7d-18clpv` |
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
- **V6, deploy M1:** "Pages staat aan, deploy maar". `main` is fast-forward gezet naar `7370f1d`; workflow-run 1 (lint, tests, deploy). Live op `https://oscardillewaard-ai.github.io/prikbord/`. Deze cloudsessie kan `github.io` niet openen (de proxy weigert de host), dus de live site is niet door mij bekeken; dat doet Oscar met de testlijst.
- **V5, stijl (M1):** "Bord a maar schoolschrift op de briefjes". Uitgewerkt als: van A het kurk, de houten lijst, de kop, de tabbalk, de knoppen en de bolle punaises (die horen bij het bord); van C het papier: kleuren, lijntjes, de gaatjes van de scheurlijn bovenaan, de licht gescheurde onderkant, Caveat vet in balpenblauw. Het scheurblokje is ook kladblokpapier (het is tenslotte een stapel briefjes). De punaises van C (speldenknoppen) en de lijst van C zijn niet gebruikt; dat is mijn invulling, Oscar kan het omgooien.

9 nov 2026:

- **V7, deploy M2:** "Deploy en geef prompt". `main` is fast-forward gezet naar `99d6957` (M2 deel 2); workflow-run 3 (lint, tests, deploy). Live op `https://oscardillewaard-ai.github.io/prikbord/` (versie 2). Ook nu niet zelf bekeken: deze cloudsessie kan `github.io` niet openen. Dat doet Oscar met de testlijst van M2.
- **A4 (categorieën nooit wissen):** nog geen reactie van Oscar, dus status blijft "voorgesteld".

## Nagelezen in de documentatie (8 nov 2026, via curl)

- **Cloudflare KV-limieten** (developers.cloudflare.com/kv/platform/limits): gratis plan 100.000 reads per dag, 1.000 writes per dag, 1 write per seconde op dezelfde sleutel, 1 GB opslag per account, max. 25 MiB per waarde, sleutel max. 512 bytes. Komt overeen met §6.3.
- **KV is "uiteindelijk consistent"** (developers.cloudflare.com/kv/concepts/how-kv-works): "Changes are usually immediately visible in the Cloudflare global network location at which they are made. Changes may take up to 60 seconds or more to be visible in other global network locations". Ook op dezelfde locatie is dat "not guaranteed". Gevolg: meestal zie je een wijziging binnen een paar tellen, soms pas na een minuut. Het opnieuw sturen uit §6.3 vangt verloren schrijfacties op, en de convergentietest moet ook verouderde reads nabootsen.
- **Nominatim-beleid** (operations.osmfoundation.org/policies/nominatim): absoluut max. 1 verzoek per seconde voor alle gebruikers samen. De app identificeren met een Referer of User-Agent (een e-mailadres is niet verplicht). Duidelijke bronvermelding. Uit te zetten zonder app-update. Bij voorkeur via een proxy met cache. Autocomplete is verboden, net als systematische zoekopdrachten. Nieuw sinds de spec: een sectie "Usage in LLMs". Daarin staat dat het publieke API alleen gebruikt mag worden als "the application developer has made a deliberate, informed decision to use it and is directly responsible for complying with this policy". Dat is Oscar: hij koos Nominatim zelf in de spec, en dit is hem verteld.

## Aannames die ik aanhoud (tenzij Oscar anders zegt)

Nieuw in M2 (het bord):

- **Filters worden niet bewaard.** Bij elke start staat het bord weer op "Alles", zodat je nooit per ongeluk de helft van het bord mist. Sorteren en netjes/vrij worden wél per telefoon en per bord onthouden (`apparaat.sorteer`, `apparaat.weergave`). Eén filter geldt voor het bord én de Gedaan-doos.
- **Combinatie van filters:** categorieën onderling = "of" (Recepten of Uit eten), samen met "💞 Iedereen zin" = "en". Verborgen categorieën staan alleen in de filterbalk als er nog briefjes van zijn.
- **"💞 Iedereen zin"** = elk lid in `bord.leden` gaf een hartje. Met één lid (M2) is dat dus "ik gaf een hartje". In M3 tellen ook leden die het bord verlieten mee (leden worden nooit weggehaald); misschien wil Oscar dat anders.
- **Dubbeltik zet een hartje alleen áán**, net als Instagram. Uitzetten kan met de hartje-knop op het geopende briefje. Een enkele tik wacht 250 ms; met het toetsenbord (Enter) opent een briefje meteen. In de Gedaan-doos opent een tik meteen (daar geen dubbeltik).
- **Een nieuw of teruggehangen briefje dat niet door het filter komt**, zet het filter op "Alles", anders zie je het niet landen.
- **Gedaan:** de datum mag niet in de toekomst liggen (`max` = vandaag). "Ongedaan maken" staat 5 tellen in de melding. Een foto bij "Gedaan!" komt in M4 (foto's horen daar); het formulier heeft er nog geen knop voor.
- **"Terughangen" heeft twee betekenissen**, allebei letterlijk "terug op het bord": op een geopend briefje sluit het (zoals in M1), in de Gedaan-doos haalt het een briefje uit de doos. Daar heet sluiten "Sluiten".
- **Trek een briefje 🎲** staat alleen op het bord, niet in de Gedaan-doos (iets trekken wat al gedaan is, heeft weinig zin). Het getrokken briefje heeft precies de twee knoppen uit de spec; voor bewerken of gedaan tik je het daarna gewoon aan.
- **Vrij, maten:** het bord is 1000 eenheden breed, een briefje 230 (4 per rij). Bij zoom 1 is een briefje 170 px, net als netjes op een telefoon. Standaard zie je het hele bord in de breedte (op 390 px is een briefje dan ~86 px, de letter ~11 px: een overzicht, zoals een echt prikbord van een afstandje). Inzoomen tot 2,5×. Zoom en positie worden niet bewaard.
- **Vrij, eerste lege plek:** in vakjes van 245 × 235 eenheden, rij voor rij, met de vaste maat van een vakje in plaats van de gemeten hoogte. Zo komt elke telefoon op dezelfde plek uit (de letter kan per toestel net anders vallen). Een vakje telt als bezet als een briefje er voor 70% overheen hangt.
- **Vrij, vastzetten:** bij de eerste sleepbeweging krijgen álle briefjes zonder vrije plek hun huidige plek vast (`vrij` met tijdstempel). Anders kan een briefje verspringen als je er een ander bovenop legt. Gevolg voor M3: de eerste sleepbeweging op een bord verandert elk briefje één keer. Dat is één gebundelde PUT, daarna alleen nog het gesleepte briefje. Nagerekend (8 nov, met de echte modelfuncties): 300 briefjes van 80 tekens met vrije plek, stapel en twee hartjes = ~125 KB; 300 volle briefjes (500 tekens) = ~248 KB, net onder de 256 KB. M3 moet zo'n grote PUT dus in delen kunnen sturen (dat stond al in het plan uit M0, punt 8). Het neergezette briefje komt bovenop (`stapel` = hoogste + 1).
- **Vrij, toetsenbord:** briefjes verplaatsen met het toetsenbord kan nog niet. Iets voor de toegankelijkheid in M5.
- **Netjes of vrij** staat als schakelaar rechts in de kop (alleen op het bord). Sorteren is de eerste chip in de filterbalk (niet in vrij: daar ligt de plek vast). 🎲 staat vast rechts naast de chips.
- **Categorie-editor:** de kleur kies je uit de 10 papierkleuren (zie M1), de emoji typ je of kies je uit 24 voorstellen. Nooit wissen, alleen verbergen (A4). Minstens één categorie moet zichtbaar blijven. Een briefje in een verborgen categorie houdt bij bewerken die categorie (het tabje staat er dan gewoon bij).
- **Laatste back-up** staat onder Meer (`apparaat.laatsteBackup`, alleen op deze telefoon). Bij het deelmenu telt hij als gemaakt zodra het deelmenu "gelukt" zegt; of het bestand echt bewaard is, weet de app niet.

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

### M2 (8 nov 2026): het bord

- **Gedaan, in volgorde van de spec (§8):**
  - **Filters en sorteren (§5.6):** filterbalk onder de kop (blijft staan bij scrollen): sorteerchip, Alles, 💞 Iedereen zin en een chip per categorie in de papierkleur. Het bord wordt niet meer bij elke wijziging opnieuw opgebouwd: bestaande briefjes blijven staan en schuiven met een veertje naar hun nieuwe plek, wat niet door het filter komt vervaagt waar het hangt. Na het schuiven wordt ook de volgorde in de pagina gelijkgetrokken (tabvolgorde, schermlezers). Met een filter zonder resultaat: een vriendelijk "Niks gevonden" met "Alles laten zien".
  - **Categorie-editor (§5.6):** Meer → Categorieën. Toevoegen, hernoemen, emoji (typen of kiezen), kleur, volgorde (▲▼) en verbergen/weer laten zien, met een voorbeeldbriefje dat meekleurt. Per veld met tijdstempel (`zetCat`, `nieuweCat`, `verschuifCat` in `model.js`).
  - **Hartjes (§5.4, §5.5):** dubbeltik geeft een hartje met een kloppend hart op het briefje; kleine hartjes onderaan in de kleur van wie ze gaf (max. 5, dan "+n"); hartje-knop op het geopende briefje (`zetHart`, `hartjesVan`).
  - **Gedaan-doos (§5.8):** "Gedaan! ✅" vraagt datum (standaard vandaag) en "Hoe was het?". Dan springt de punaise eruit (plop), valt het briefje naar de Gedaan-doos in de tabbalk, stuitert het doosje en volgt er confetti. De doos is een plakboek met plakband, per maand, nieuwste eerst, met teller ("6 dingen samen gedaan 🎉", met filter "1 van de 6 …"). Vanuit de doos: aanpassen, terughangen (de punaise prikt hem terug op het bord) en weghalen.
  - **Trek een briefje 🎲 (§5.7):** binnen de filters; het bord schudt, één briefje wiebelt los en komt groot naar voren met "Nog eens" (altijd een ander, als er meer zijn) en "Sluiten".
  - **Vrij (§5.2):** `js/vrij.js` doet de vingers: lang drukken (300 ms) tilt op (schaduw groeit, punaise los, kort trillen op Android), slepen, loslaten prikt opnieuw met tok en wiebelende buren; dicht bij de rand schuift het bord mee. Eén vinger over het kurk schuift, knijpen zoomt rond je vingers, plus knoppen +, − en ⤢ (ook met één hand te doen). Muis en touchpad: scrollen schuift, ctrl+scrollen zoomt. Filters dimmen in plaats van te verschuiven. Het bord heeft zijn eigen kurk met een houten rand, op een donkere muur.
  - **Back-up:** "Laatste back-up" onder Meer; de rooktest controleert dat hartjes, gedaan, vrije plekken en categorieën heen en terug gaan.
- **Nieuwe pure modules en functies:** `filter.js` (filter, sorteren, trekken, de doos per maand), in `layout.js` `legVrij`/`eersteLegePlek` en de camera (`pasCamera`, `zoomRond`), in `model.js` hartjes en categorieën, in `validate.js` `apparaat.sorteer` en `apparaat.laatsteBackup` (oude opslag zonder die velden blijft werken). Animaties erbij in `beweging.js` (`hartPop`, `schudLos`, `valInDoos`, `confetti`, `stuiter`, `popIn`), `geometrie` werkt nu ook op een geschaald bord. Geluid `plop()`.
- **Release:** versie 2 (`APP_VERSION`, `CACHE` = `prikbord-v2`, `CHANGELOG`), `filter.js` en `vrij.js` in `SHELL`.
- **Twee fouten die de tests vingen:**
  - Na het schuiven over het bord negeerde de app 400 ms lang álle klikken in het venster, ook op de zoomknoppen. Nu alleen klikken op briefjes (dat is waarvoor het bedoeld was: na slepen mag een briefje niet opengaan).
  - De confetti was er wel, maar te klein en te bleek tussen het pastelpapier, en de melding lag eroverheen. Nu fellere kleuren, hoger, en de melding komt pas na het feestje. Dat zag ik pas in een screenshot op echte snelheid.
- **Getest:**
  - `npm test`: 50 groen (was 37). Nieuw: `tests/filter.test.mjs` (filters, Iedereen zin, sorteren, trekken: 3000 keer, eerlijk verdeeld en nooit twee keer hetzelfde, doos per maand), hartjes en categorie-editor in `model.test.mjs`, vrije plekken en camera in `layout.test.mjs` (zelfde invoer = zelfde plek, ook in andere volgorde; een nieuw briefje laat oudere niet verspringen; zoomen rond een punt houdt dat punt op zijn plek), apparaatvelden in `validate.test.mjs`.
  - `npm run lint`: schoon.
  - `npm run rooktest`: 107 van 107 (was 41). Nieuw: filters (schuiven, uit beeld, meerdere tegelijk, niks gevonden), dubbeltik (hartje, opent niet), Iedereen zin, sorteren (linksboven én tabvolgorde, onthouden), hartje-knop aan en uit, Gedaan (datum vandaag, notitie, confetti, ongedaan maken, doos per maand met teller, filters in de doos, aanpassen, terughangen), Trek (binnen het filter, Nog eens = ander, Sluiten), categorie-editor (toevoegen, volgorde, hernoemen, verbergen, het schrijfvel, verborgen categorie houdt kleur en blijft gekozen bij bewerken), back-up heen en terug op een nieuwe telefoon, vrij met de muis (optillen, slepen precies zoals de muis ging, alles vastgezet, bovenop de stapel, tik opent wel, slepen niet, zoomknoppen, schuiven, ⤢) en met **echte aanraakpunten via CDP** (knijpen met twee vingers = ×3 bij ×3 uit elkaar, lang drukken en slepen met een vinger), filters dimmen in vrij zonder te verschuiven, nieuw briefje in vrij landt bovenaan, na herladen alles op zijn plek, en Gedaan met minder beweging (geen confetti).
  - Twee bestaande controles aangepast, met reden: "Meer toont de versie" en "service worker cachet onder prikbord-v1" hadden het versienummer 1 vast in de test. Ze lezen nu `APP_VERSION` uit `app.js`, zodat het release-ritueel de rooktest niet meer breekt. Wat ze controleren, is niet veranderd.
  - Ter controle twee keer bewust kapotgemaakt: zonder vastzetten bij het slepen gaan 2 controles rood; een dubbeltik die toch opent, laat de rooktest vastlopen (ook rood, alleen minder netjes).
- **Screenshots en filmstrip** in `docs/m2-bord/` (390 px): bord, filter, meeste hartjes, dubbeltik, open, gedaan, doos, trek, vrij, vrij slepen, vrij zoom, Meer, categorieën, nieuwe categorie, plus `gedaan-filmstrip.jpg` (8× vertraagd). Opnieuw maken: `npm run screenshots:m2`. Het demobord staat nu in `scripts/demo.mjs` (gedeeld met `npm run screenshots`).
- **Niet getest:** alles op een echte telefoon (zie de lijst hieronder), vooral de gebaren in vrij op de iPhone (Safari houdt zich voor zover ik weet aan `touch-action: none`, en `gesturestart` wordt tegengehouden; niet nagemeten), of een dubbeltik op de iPhone twee klikken geeft (zou moeten met `touch-action: manipulation`, niet nagemeten), trillen, hoe "plop" klinkt, en hoe vloeiend het schuiven is met 300 briefjes (M5).
- **Gedeployd op 9 nov** (zie V7 bij de besluiten).

### Te controleren op de telefoon (na de deploy van M2)

1. Na het bijwerken: verschijnt één keer "Er hangt iets nieuws op het prikbord!" met versie 2?
2. Filters: tik twee categorieën aan. Schuiven de briefjes vloeiend naar hun plek? Blijft de filterbalk staan als je scrolt, en kun je hem opzij vegen?
3. Dubbeltik op een briefje: klopt er een hart en komt er een klein hartje onderaan, zónder dat het briefje opengaat? Voelt een enkele tik (250 ms wachten) niet te traag?
4. Open een briefje → "Gedaan!" → typ iets → "In de doos!": plop, valt hij naar de doos, confetti? Werkt het datumveld op de iPhone (het datumwieltje)?
5. Gedaan-doos: per maand, met teller. "Terughangen": prikt de punaise hem terug op het bord?
6. 🎲 Trek een briefje, een paar keer "Nog eens".
7. Vrij: houd een briefje vast. Komt het los (op Android met een trilling) en kun je het slepen, ook tot aan de rand? Zoomt knijpen (en niet de hele pagina)? Schuift één vinger over het kurk? Verschijnt er geen menuutje of tekstselectie bij lang drukken?
8. Vrij met één hand: + en − en ⤢ linksonder.
9. Meer → Categorieën: voeg er een toe met een eigen emoji (emoji-toetsenbord), verander een kleur, schuif er een omhoog, verberg er een.
10. Back-up maken: staat er daarna "Laatste back-up: …" onder Meer?

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

## Voor M3: handig om te weten

- **Het bord bijwerken na een sync:** gewoon `render()` aanroepen. Het bord is keyed (`vulBak` in `app.js`): bestaande briefjes blijven staan en schuiven naar hun nieuwe plek, nieuwe komen erbij, weggehaalde verdwijnen. Een briefje dat een ander verplaatste in vrij glijdt dus vanzelf naar zijn nieuwe plek. Een briefje dat groot openligt (`ui.open`) of net landt (`ui.landt`) blijft verstopt. Tijdens een sleepbeweging (`.sleept`) laat `legVrijNeer` het gesleepte briefje met rust.
- **Wat er per veld verandert (voor "alleen gewijzigde briefjes versturen"):** hartjes (`zetHart`), `gedaan`, `vrij` en `stapel` (bij slepen: álle briefjes zonder plek krijgen er één, zie de aannames), categorieën (`zetCat`, `nieuweCat`, `verschuifCat` nummert alle `volg` opnieuw). Alles gaat via `stempel()`, dus de tijdstempels kloppen al.
- **Opslaan gebeurt nu op één plek per handeling** (`opslaan()`); daar kan de "gewijzigd"-vlag en het bundelen (1,5 s) van de sync bij.
- **Leden:** er is nog één lid ("Ik", rood). `hartjesHtml` en `hartKnopHtml` tonen al de kleur van elk lid, en "💞 Iedereen zin" telt alle leden in `bord.leden`. De naam kiezen en "Dit ben ik al" komen in M3.
- **Meerdere borden:** `ui.filter`, `ui.camera` en `ui.getrokken` horen bij het actieve bord; zet ze terug bij een bordwissel (`ui.filter = ALLES`). `apparaat.weergave` en `apparaat.sorteer` zijn al per bord.
- **"Nieuw"-stickertje en "3 nieuwe briefjes":** `apparaat.gezien` (per bord, een tijdstip) staat al in het schema maar wordt nog niet gebruikt.
- **Niet herladen tijdens iets:** `rustig()` kijkt nu ook naar `vrijApi.bezig()` (schuiven, knijpen, slepen). Een melding van de sync ("📌 Tara prikte …") kan met `toast()`; die ligt als popover ook boven een open venster.
- **KV-writes en de 256 KB (§6.3):** de eerste sleepbeweging op een bord verandert elk briefje één keer. Met 300 volle briefjes is dat ~248 KB (nagerekend), dus versturen in delen onder de 256 KB is nodig, niet alleen bij de eerste koppeling.
- **Rooktest:** `m2Staat()` in `scripts/rooktest.mjs` bouwt een bord in Node met de pure modules en zet het via `addInitScript` in de browser; handig voor de twee-contexten-test van M3. Aanraakgebaren kunnen via `ctx.newCDPSession(p)` en `Input.dispatchTouchEvent` (zie blok 17).

## Startprompt voor M3

Plak dit in een nieuwe chat met repo `oscardillewaard-ai/prikbord` en omgeving "Tezt":

```
Prikbord, mijlpaal M3 (samen). Je werkt in de repo oscardillewaard-ai/prikbord.
1. Merge eerst het werk uit M2 in je werkbranch (verandert niets als het al op main staat):
   git fetch origin ccr-eb14dc7d-18clpv && git merge origin/ccr-eb14dc7d-18clpv
2. Lees docs/prikbord-spec.md (leidend), docs/prikbord-afwijkingen.md (vooral A3:
   eigen repo, andere paden; en A4) en docs/prikbord-voortgang.md (besluiten, aannames,
   logboek M1 en M2 en "Voor M3: handig om te weten").
3. Haal oscardillewaard-ai/Tezt erbij (alleen lezen) voor proxy/parken-sync-worker.js
   en de sync-lus in public/parken/app.js (§3, §6.3).
4. Doe M3 (§8 van de spec): worker, meerdere borden, koppel-link, leden (wie ben jij,
   "Dit ben ik al"), samenvoegen per veld, peilen, statusbolletje en de convergentietest.
   Schrijf voor Oscar de stappen om de worker neer te zetten. Draai voor elke commit
   npm test, npm run lint en npm run rooktest. Werk aan het eind
   docs/prikbord-voortgang.md bij, met een startprompt voor M4.
   ⏸ Daarna wacht je op akkoord: Oscar test het met twee telefoons.
```
